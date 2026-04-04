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
          } else {
            // Mammouth or non-messages: pipe through unchanged
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
