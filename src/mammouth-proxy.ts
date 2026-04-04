/**
 * Mammouth adapter proxy
 *
 * Sits between the Claude Code SDK (inside containers) and the Mammouth API.
 * Listens on HTTP so OneCLI's container-level HTTPS_PROXY never intercepts it.
 * Rewrites model names and injects the real Mammouth API key before forwarding.
 */
import http from 'http';
import https from 'https';

import { readEnvFile } from './env.js';
import { logger } from './logger.js';

const _env = readEnvFile([
  'MAMMOUTH_API_KEY',
  'MAMMOUTH_TARGET_MODEL',
  'MAMMOUTH_PROXY_PORT',
]);

export const MAMMOUTH_PROXY_PORT = parseInt(
  process.env.MAMMOUTH_PROXY_PORT || _env.MAMMOUTH_PROXY_PORT || '3099',
  10,
);

const TARGET_MODEL =
  process.env.MAMMOUTH_TARGET_MODEL ||
  _env.MAMMOUTH_TARGET_MODEL ||
  'kimi-k2.5';

const API_KEY =
  process.env.MAMMOUTH_API_KEY || _env.MAMMOUTH_API_KEY || '';

const TARGET_HOST = 'api.mammouth.ai';

export function startMammouthProxy(): http.Server | null {
  if (!API_KEY) {
    logger.debug('MAMMOUTH_API_KEY not set — Mammouth proxy not started');
    return null;
  }

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      let body = Buffer.concat(chunks);

      // Log every incoming request so we can see what the SDK actually sends
      const urlPath = (req.url ?? '/').split('?')[0];
      logger.debug({ method: req.method, url: req.url }, 'Mammouth proxy: request received');

      // Rewrite model field in messages requests.
      // Use endsWith rather than exact match — the SDK may send /messages or
      // /v1/messages, and query strings are stripped before comparison.
      if (req.method === 'POST' && urlPath.endsWith('/messages')) {
        try {
          const json = JSON.parse(body.toString('utf-8')) as Record<
            string,
            unknown
          >;
          const originalModel = json['model'];
          json['model'] = TARGET_MODEL;
          body = Buffer.from(JSON.stringify(json), 'utf-8');
          logger.info(
            { originalModel, targetModel: TARGET_MODEL },
            'Mammouth proxy: routing request',
          );
        } catch {
          // Forward body as-is if parse fails
        }
      }

      // Build forwarded headers — replace host, auth, and content-length
      const forwardHeaders: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        const lower = k.toLowerCase();
        if (
          lower === 'host' ||
          lower === 'authorization' ||
          lower === 'content-length'
        )
          continue;
        if (v !== undefined) forwardHeaders[k] = v;
      }
      forwardHeaders['host'] = TARGET_HOST;
      forwardHeaders['authorization'] = `Bearer ${API_KEY}`;
      if (body.length > 0) {
        forwardHeaders['content-length'] = String(body.length);
      }

      const proxyReq = https.request(
        {
          hostname: TARGET_HOST,
          port: 443,
          path: req.url || '/',
          method: req.method,
          headers: forwardHeaders,
        },
        (proxyRes) => {
          const resHeaders: Record<string, string | string[]> = {};
          for (const [k, v] of Object.entries(proxyRes.headers)) {
            if (v !== undefined) resHeaders[k] = v;
          }
          res.writeHead(proxyRes.statusCode || 502, resHeaders);
          proxyRes.pipe(res, { end: true });
        },
      );

      proxyReq.on('error', (err: Error) => {
        logger.error({ err }, 'Mammouth proxy upstream error');
        if (!res.headersSent) {
          res.writeHead(502, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              error: { message: err.message, type: 'proxy_error' },
            }),
          );
        }
      });

      proxyReq.write(body);
      proxyReq.end();
    });
  });

  server.listen(MAMMOUTH_PROXY_PORT, '0.0.0.0', () => {
    logger.info(
      { port: MAMMOUTH_PROXY_PORT, targetModel: TARGET_MODEL },
      'Mammouth proxy started',
    );
  });

  return server;
}
