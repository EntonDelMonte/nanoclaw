/**
 * AI adapter proxy
 *
 * Sits between the Claude Code SDK (inside containers) and the AI backend.
 * Listens on HTTP so OneCLI's container-level HTTPS_PROXY never intercepts it.
 *
 * Backend selection via PROXY_BACKEND env var:
 *   mammouth   — Mammouth API (Anthropic-compatible). Rewrites model + injects key.
 *   ollama     — Ollama cloud (OpenAI-compatible). Translates Anthropic ↔ OpenAI format.
 */
import http from 'http';
import https from 'https';

import { anthropicToOpenAI, openAIToAnthropic, translateStream } from './anthropic-openai-bridge.js';
import { readEnvFile } from './env.js';
import { logger } from './logger.js';

const _env = readEnvFile([
  'PROXY_BACKEND',
  'MAMMOUTH_API_KEY',
  'MAMMOUTH_TARGET_MODEL',
  'MAMMOUTH_PROXY_PORT',
  'OLLAMA_API_KEY',
  'OLLAMA_TARGET_MODEL',
]);

export const MAMMOUTH_PROXY_PORT = parseInt(
  process.env.MAMMOUTH_PROXY_PORT || _env.MAMMOUTH_PROXY_PORT || '3099',
  10,
);

const BACKEND = (process.env.PROXY_BACKEND || _env.PROXY_BACKEND || 'mammouth').toLowerCase();

// ── Mammouth config ──────────────────────────────────────────
const MAMMOUTH_KEY = process.env.MAMMOUTH_API_KEY || _env.MAMMOUTH_API_KEY || '';
const MAMMOUTH_MODEL = process.env.MAMMOUTH_TARGET_MODEL || _env.MAMMOUTH_TARGET_MODEL || 'kimi-k2.5';
const MAMMOUTH_HOST = 'api.mammouth.ai';

// ── Ollama cloud config ──────────────────────────────────────
const OLLAMA_KEY = process.env.OLLAMA_API_KEY || _env.OLLAMA_API_KEY || '';
const OLLAMA_MODEL = process.env.OLLAMA_TARGET_MODEL || _env.OLLAMA_TARGET_MODEL || 'kimi-k2.5';
const OLLAMA_HOST = 'ollama.com';

function getConfig(): { host: string; key: string; model: string; openai: boolean } {
  if (BACKEND === 'ollama') {
    return { host: OLLAMA_HOST, key: OLLAMA_KEY, model: OLLAMA_MODEL, openai: true };
  }
  return { host: MAMMOUTH_HOST, key: MAMMOUTH_KEY, model: MAMMOUTH_MODEL, openai: false };
}

// ──────────────────────────────────────────────────────────────
// Mammouth response helpers: strip thinking blocks
//
// Mammouth (kimi-k2.5) returns thinking blocks with signature: null.
// If those get stored in session history and replayed to the Anthropic API,
// it rejects them with a 400 (signature must be a valid string).
// Strip all thinking blocks before forwarding to the SDK.
// ──────────────────────────────────────────────────────────────

function mammouthStripThinkingNonStream(
  upstream: import('http').IncomingMessage,
  res: import('http').ServerResponse,
): void {
  const chunks: Buffer[] = [];
  upstream.on('data', (c: Buffer) => chunks.push(c));
  upstream.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf-8');
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      if (Array.isArray(obj['content'])) {
        obj['content'] = (obj['content'] as Array<Record<string, unknown>>).filter(
          (b) => b['type'] !== 'thinking',
        );
      }
      const out = JSON.stringify(obj);
      res.writeHead(upstream.statusCode ?? 200, {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(out)),
      });
      res.end(out);
    } catch {
      res.writeHead(upstream.statusCode ?? 200, { 'content-type': 'application/json' });
      res.end(raw);
    }
  });
  upstream.on('error', () => { if (!res.writableEnded) res.end(); });
}

function mammouthStripThinkingStream(
  upstream: import('http').IncomingMessage,
  res: import('http').ServerResponse,
): void {
  res.setHeader('content-type', 'text/event-stream; charset=utf-8');
  res.setHeader('cache-control', 'no-cache');
  res.flushHeaders();

  const thinkingIndices = new Set<number>();
  let dropped = 0;
  const indexMap = new Map<number, number>();
  let buf = '';
  let pendingEvent = '';

  const emit = (event: string, data: string): void => {
    res.write(`event: ${event}\ndata: ${data}\n\n`);
  };

  const processData = (event: string, data: string): void => {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(data) as Record<string, unknown>; }
    catch { emit(event, data); return; }

    const type = parsed['type'] as string | undefined;

    if (type === 'content_block_start') {
      const idx = parsed['index'] as number;
      const block = parsed['content_block'] as Record<string, unknown> | undefined;
      if (block?.['type'] === 'thinking') {
        thinkingIndices.add(idx);
        dropped++;
        return; // suppress
      }
      const newIdx = idx - dropped;
      indexMap.set(idx, newIdx);
      emit(event, JSON.stringify({ ...parsed, index: newIdx }));
      return;
    }

    if (type === 'content_block_delta' || type === 'content_block_stop') {
      const idx = parsed['index'] as number;
      if (thinkingIndices.has(idx)) return; // suppress
      const newIdx = indexMap.get(idx) ?? (idx - dropped);
      emit(event, JSON.stringify({ ...parsed, index: newIdx }));
      return;
    }

    // Pass through everything else (message_start, ping, message_delta, message_stop)
    emit(event, data);
  };

  upstream.on('data', (chunk: Buffer) => {
    buf += chunk.toString('utf-8');
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        pendingEvent = line.slice(7).trimEnd();
      } else if (line.startsWith('data: ') && pendingEvent) {
        processData(pendingEvent, line.slice(6).trimEnd());
        pendingEvent = '';
      } else if (line.trimEnd() === '') {
        pendingEvent = '';
      }
    }
  });

  upstream.on('error', () => { if (!res.writableEnded) res.end(); });
  upstream.on('end', () => { if (!res.writableEnded) res.end(); });
}

export function startMammouthProxy(): http.Server | null {
  const cfg = getConfig();

  if (!cfg.key) {
    logger.warn({ backend: BACKEND }, 'AI proxy: API key not set — proxy not started');
    return null;
  }

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      let body = Buffer.concat(chunks);
      const urlPath = (req.url ?? '/').split('?')[0];
      const isMessages = req.method === 'POST' && urlPath.endsWith('/messages');

      logger.debug({ method: req.method, url: req.url, backend: BACKEND }, 'AI proxy: request received');

      let targetPath = req.url ?? '/';
      let isStreaming = false;

      if (isMessages) {
        let bodyObj: Record<string, unknown> = {};
        try { bodyObj = JSON.parse(body.toString('utf-8')); } catch {}
        isStreaming = Boolean(bodyObj['stream']);

        if (cfg.openai) {
          // Anthropic → OpenAI format translation
          const { path, body: translated } = anthropicToOpenAI(bodyObj);
          translated['model'] = cfg.model;
          logger.info({ originalModel: bodyObj['model'], targetModel: cfg.model, backend: BACKEND, streaming: isStreaming }, 'AI proxy: routing request');
          body = Buffer.from(JSON.stringify(translated), 'utf-8');
          targetPath = path;
        } else {
          // Mammouth: Anthropic-compatible — just rewrite model
          bodyObj['model'] = cfg.model;
          logger.info({ originalModel: bodyObj['model'], targetModel: cfg.model, backend: BACKEND, streaming: isStreaming }, 'AI proxy: routing request');
          body = Buffer.from(JSON.stringify(bodyObj), 'utf-8');
        }
      }

      const forwardHeaders: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        const lower = k.toLowerCase();
        if (lower === 'host' || lower === 'authorization' || lower === 'content-length') continue;
        if (v !== undefined) forwardHeaders[k] = v;
      }
      forwardHeaders['host'] = cfg.host;
      forwardHeaders['authorization'] = `Bearer ${cfg.key}`;
      if (body.length > 0) forwardHeaders['content-length'] = String(body.length);

      const proxyReq = https.request(
        { hostname: cfg.host, port: 443, path: targetPath, method: req.method, headers: forwardHeaders },
        (proxyRes) => {
          if (isMessages && cfg.openai && isStreaming) {
            // Translate OpenAI SSE → Anthropic SSE on the fly
            translateStream(proxyRes, res, cfg.model);
          } else if (isMessages && cfg.openai && !isStreaming) {
            // Buffer full response, translate JSON
            const chunks: Buffer[] = [];
            proxyRes.on('data', (c: Buffer) => chunks.push(c));
            proxyRes.on('end', () => {
              try {
                const openaiBody = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                const anthropicBody = openAIToAnthropic(openaiBody, cfg.model);
                const out = JSON.stringify(anthropicBody);
                res.writeHead(proxyRes.statusCode ?? 200, { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(out)) });
                res.end(out);
              } catch {
                res.writeHead(proxyRes.statusCode ?? 502);
                res.end(Buffer.concat(chunks));
              }
            });
          } else if (isMessages && !cfg.openai) {
            // Mammouth (Anthropic-compatible): strip thinking blocks so null-signature
            // thinking blocks never get stored in session history.
            if (isStreaming) {
              mammouthStripThinkingStream(proxyRes, res);
            } else {
              mammouthStripThinkingNonStream(proxyRes, res);
            }
          } else {
            // Non-messages endpoints: pipe through unchanged
            const resHeaders: Record<string, string | string[]> = {};
            for (const [k, v] of Object.entries(proxyRes.headers)) {
              if (v !== undefined) resHeaders[k] = v;
            }
            res.writeHead(proxyRes.statusCode ?? 502, resHeaders);
            proxyRes.pipe(res, { end: true });
          }
        },
      );

      proxyReq.on('error', (err: Error) => {
        logger.error({ err }, 'AI proxy upstream error');
        if (!res.headersSent) {
          res.writeHead(502, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message, type: 'proxy_error' } }));
        }
      });

      proxyReq.write(body);
      proxyReq.end();
    });
  });

  server.listen(MAMMOUTH_PROXY_PORT, '0.0.0.0', () => {
    logger.info({ port: MAMMOUTH_PROXY_PORT, backend: BACKEND, model: cfg.model }, 'AI proxy started');
  });

  return server;
}
