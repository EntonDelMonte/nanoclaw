import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';

const mockEnv: Record<string, string> = {};
vi.mock('./env.js', () => ({
  readEnvFile: vi.fn(() => ({ ...mockEnv })),
}));

vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { startCredentialProxy } from './credential-proxy.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Start a minimal HTTP server that always responds with a fixed status + body.
 *  The handler receives the already-buffered body as the third argument. */
function startMockServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse, body?: string) => void,
): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        handler(req, res, body);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, port });
    });
  });
}

/** OpenAI-compatible success response */
function openAISuccess(content = 'hello from fallback'): string {
  return JSON.stringify({
    choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });
}

/** OpenAI streaming success SSE body */
function openAIStreamSSE(text = 'streamed text'): string {
  const chunks = text.split('');
  const lines = chunks.map(
    (ch) =>
      `data: ${JSON.stringify({ choices: [{ delta: { content: ch }, finish_reason: null }] })}\n\n`,
  );
  lines.push('data: [DONE]\n\n');
  return lines.join('');
}

function makeRequest(
  port: number,
  options: http.RequestOptions,
  body = '',
): Promise<{
  statusCode: number;
  body: string;
  headers: http.IncomingHttpHeaders;
}> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { ...options, hostname: '127.0.0.1', port },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode!,
            body: Buffer.concat(chunks).toString(),
            headers: res.headers,
          });
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

describe('credential-proxy', () => {
  let proxyServer: http.Server;
  let upstreamServer: http.Server;
  let proxyPort: number;
  let upstreamPort: number;
  let lastUpstreamHeaders: http.IncomingHttpHeaders;

  beforeEach(async () => {
    lastUpstreamHeaders = {};

    upstreamServer = http.createServer((req, res) => {
      lastUpstreamHeaders = { ...req.headers };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) =>
      upstreamServer.listen(0, '127.0.0.1', resolve),
    );
    upstreamPort = (upstreamServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((r) => proxyServer?.close(() => r()));
    await new Promise<void>((r) => upstreamServer?.close(() => r()));
    for (const key of Object.keys(mockEnv)) delete mockEnv[key];
  });

  async function startProxy(env: Record<string, string>): Promise<number> {
    Object.assign(mockEnv, env, {
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
    });
    proxyServer = await startCredentialProxy(0);
    return (proxyServer.address() as AddressInfo).port;
  }

  it('API-key mode injects x-api-key and strips placeholder', async () => {
    proxyPort = await startProxy({ ANTHROPIC_API_KEY: 'sk-ant-real-key' });

    await makeRequest(
      proxyPort,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'placeholder',
        },
      },
      '{}',
    );

    expect(lastUpstreamHeaders['x-api-key']).toBe('sk-ant-real-key');
  });

  it('OAuth mode replaces Authorization when container sends one', async () => {
    proxyPort = await startProxy({
      CLAUDE_CODE_OAUTH_TOKEN: 'real-oauth-token',
    });

    await makeRequest(
      proxyPort,
      {
        method: 'POST',
        path: '/api/oauth/claude_cli/create_api_key',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer placeholder',
        },
      },
      '{}',
    );

    expect(lastUpstreamHeaders['authorization']).toBe(
      'Bearer real-oauth-token',
    );
  });

  it('OAuth mode does not inject Authorization when container omits it', async () => {
    proxyPort = await startProxy({
      CLAUDE_CODE_OAUTH_TOKEN: 'real-oauth-token',
    });

    // Post-exchange: container uses x-api-key only, no Authorization header
    await makeRequest(
      proxyPort,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'temp-key-from-exchange',
        },
      },
      '{}',
    );

    expect(lastUpstreamHeaders['x-api-key']).toBe('temp-key-from-exchange');
    expect(lastUpstreamHeaders['authorization']).toBeUndefined();
  });

  it('strips hop-by-hop headers', async () => {
    proxyPort = await startProxy({ ANTHROPIC_API_KEY: 'sk-ant-real-key' });

    await makeRequest(
      proxyPort,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: {
          'content-type': 'application/json',
          connection: 'keep-alive',
          'keep-alive': 'timeout=5',
          'transfer-encoding': 'chunked',
        },
      },
      '{}',
    );

    // Proxy strips client hop-by-hop headers. Node's HTTP client may re-add
    // its own Connection header (standard HTTP/1.1 behavior), but the client's
    // custom keep-alive and transfer-encoding must not be forwarded.
    expect(lastUpstreamHeaders['keep-alive']).toBeUndefined();
    expect(lastUpstreamHeaders['transfer-encoding']).toBeUndefined();
  });

  it('returns 502 when upstream is unreachable', async () => {
    Object.assign(mockEnv, {
      ANTHROPIC_API_KEY: 'sk-ant-real-key',
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:59999',
    });
    proxyServer = await startCredentialProxy(0);
    proxyPort = (proxyServer.address() as AddressInfo).port;

    const res = await makeRequest(
      proxyPort,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: { 'content-type': 'application/json' },
      },
      '{}',
    );

    expect(res.statusCode).toBe(502);
    expect(res.body).toBe('Bad Gateway');
  });
});

// ---------------------------------------------------------------------------
// Fallback tests
// ---------------------------------------------------------------------------

describe('credential-proxy fallback', () => {
  let proxyServer: http.Server;
  let anthropicServer: http.Server;
  let mammouthServer: http.Server;
  let proxyPort: number;

  afterEach(async () => {
    await new Promise<void>((r) => proxyServer?.close(() => r()));
    await new Promise<void>((r) => anthropicServer?.close(() => r()));
    await new Promise<void>((r) => mammouthServer?.close(() => r()));
    for (const key of Object.keys(mockEnv)) delete mockEnv[key];
  });

  it('retries against Mammouth when Anthropic returns 429', async () => {
    // Anthropic returns 429
    const anthropic = await startMockServer((_req, res) => {
      res.writeHead(429, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'rate_limit_error', message: 'Too many requests' } }));
    });
    anthropicServer = anthropic.server;

    // Mammouth returns a valid OpenAI response
    const mammouthReqBodies: string[] = [];
    const mammouth = await startMockServer((_req, res, body) => {
      mammouthReqBodies.push(body ?? '');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(openAISuccess('hello from mammouth'));
    });
    mammouthServer = mammouth.server;

    Object.assign(mockEnv, {
      ANTHROPIC_API_KEY: 'sk-ant-real-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropic.port}`,
      MAMMOUTH_API_KEY: 'mammouth-key',
      MAMMOUTH_BASE_URL: `http://127.0.0.1:${mammouth.port}`,
    });
    proxyServer = await startCredentialProxy(0);
    proxyPort = (proxyServer.address() as AddressInfo).port;

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100,
    });

    const res = await makeRequest(
      proxyPort,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: { 'content-type': 'application/json', 'x-api-key': 'placeholder' },
      },
      requestBody,
    );

    // Proxy should return 200 with Anthropic-format response translated from OpenAI
    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body) as {
      type: string;
      role: string;
      content: Array<{ type: string; text: string }>;
      stop_reason: string;
    };
    expect(parsed.type).toBe('message');
    expect(parsed.role).toBe('assistant');
    expect(parsed.content[0].type).toBe('text');
    expect(parsed.content[0].text).toBe('hello from mammouth');
    expect(parsed.stop_reason).toBe('end_turn');

    // Verify Mammouth received an OpenAI-format request
    expect(mammouthReqBodies.length).toBeGreaterThan(0);
    const mammouthReq = JSON.parse(mammouthReqBodies[0]) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(mammouthReq.model).toBe('deepseek-v3.1-terminus');
    // system message should be absent (no system field in request) and user message should be present
    const userMsg = mammouthReq.messages.find((m) => m.role === 'user');
    expect(userMsg?.content).toBe('Hello');
  });

  it('translates Anthropic request format correctly when falling back', async () => {
    // Anthropic returns 529 overloaded
    const anthropic = await startMockServer((_req, res) => {
      res.writeHead(529, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'overloaded_error' } }));
    });
    anthropicServer = anthropic.server;

    let capturedBody = '';
    const mammouth = await startMockServer((_req, res, body) => {
      capturedBody = body ?? '';
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(openAISuccess());
    });
    mammouthServer = mammouth.server;

    Object.assign(mockEnv, {
      ANTHROPIC_API_KEY: 'sk-ant-real-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropic.port}`,
      MAMMOUTH_API_KEY: 'mammouth-key',
      MAMMOUTH_BASE_URL: `http://127.0.0.1:${mammouth.port}`,
    });
    proxyServer = await startCredentialProxy(0);
    proxyPort = (proxyServer.address() as AddressInfo).port;

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-6',
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Test' }],
      max_tokens: 50,
      tools: [
        {
          name: 'get_weather',
          description: 'Get weather',
          input_schema: { type: 'object', properties: { location: { type: 'string' } } },
        },
      ],
    });

    await makeRequest(
      proxyPort,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: { 'content-type': 'application/json', 'x-api-key': 'placeholder' },
      },
      requestBody,
    );

    const openAIReq = JSON.parse(capturedBody) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      max_tokens: number;
      tools: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }>;
    };

    // Model replaced with fallback model
    expect(openAIReq.model).toBe('deepseek-v3.1-terminus');

    // System prompt moved to messages[0]
    expect(openAIReq.messages[0].role).toBe('system');
    expect(openAIReq.messages[0].content).toBe('You are a helpful assistant.');
    expect(openAIReq.messages[1].role).toBe('user');
    expect(openAIReq.messages[1].content).toBe('Test');

    // max_tokens preserved
    expect(openAIReq.max_tokens).toBe(50);

    // Tools translated to OpenAI format
    expect(openAIReq.tools[0].type).toBe('function');
    expect(openAIReq.tools[0].function.name).toBe('get_weather');
    expect(openAIReq.tools[0].function.description).toBe('Get weather');
    expect(openAIReq.tools[0].function.parameters.type).toBe('object');
  });

  it('returns Anthropic-format response with tool_use when fallback returns tool_calls', async () => {
    const anthropic = await startMockServer((_req, res) => {
      res.writeHead(429, { 'content-type': 'application/json' });
      res.end('{}');
    });
    anthropicServer = anthropic.server;

    const mammouth = await startMockServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_abc',
                    type: 'function',
                    function: { name: 'get_weather', arguments: '{"location":"Paris"}' },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 10 },
        }),
      );
    });
    mammouthServer = mammouth.server;

    Object.assign(mockEnv, {
      ANTHROPIC_API_KEY: 'sk-ant-real-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropic.port}`,
      MAMMOUTH_API_KEY: 'mammouth-key',
      MAMMOUTH_BASE_URL: `http://127.0.0.1:${mammouth.port}`,
    });
    proxyServer = await startCredentialProxy(0);
    proxyPort = (proxyServer.address() as AddressInfo).port;

    const res = await makeRequest(
      proxyPort,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: { 'content-type': 'application/json', 'x-api-key': 'placeholder' },
      },
      JSON.stringify({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: 'weather?' }], max_tokens: 100 }),
    );

    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body) as {
      stop_reason: string;
      content: Array<{ type: string; id: string; name: string; input: Record<string, string> }>;
      usage: { input_tokens: number; output_tokens: number };
    };
    expect(parsed.stop_reason).toBe('tool_use');
    const toolUse = parsed.content.find((b) => b.type === 'tool_use');
    expect(toolUse?.id).toBe('call_abc');
    expect(toolUse?.name).toBe('get_weather');
    expect(toolUse?.input).toEqual({ location: 'Paris' });
    expect(parsed.usage.input_tokens).toBe(20);
    expect(parsed.usage.output_tokens).toBe(10);
  });

  it('streams translated Anthropic SSE events when falling back with stream:true', async () => {
    const anthropic = await startMockServer((_req, res) => {
      res.writeHead(429, { 'content-type': 'application/json' });
      res.end('{}');
    });
    anthropicServer = anthropic.server;

    const mammouth = await startMockServer((_req, res) => {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      });
      res.end(openAIStreamSSE('Hi'));
    });
    mammouthServer = mammouth.server;

    Object.assign(mockEnv, {
      ANTHROPIC_API_KEY: 'sk-ant-real-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropic.port}`,
      MAMMOUTH_API_KEY: 'mammouth-key',
      MAMMOUTH_BASE_URL: `http://127.0.0.1:${mammouth.port}`,
    });
    proxyServer = await startCredentialProxy(0);
    proxyPort = (proxyServer.address() as AddressInfo).port;

    const res = await makeRequest(
      proxyPort,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: { 'content-type': 'application/json', 'x-api-key': 'placeholder' },
      },
      JSON.stringify({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: 'hi' }], max_tokens: 10, stream: true }),
    );

    expect(res.statusCode).toBe(200);
    // Should contain Anthropic SSE events
    expect(res.body).toContain('event: message_start');
    expect(res.body).toContain('event: content_block_start');
    expect(res.body).toContain('event: content_block_delta');
    expect(res.body).toContain('text_delta');
    expect(res.body).toContain('event: message_stop');
    // Should contain the streamed text characters
    expect(res.body).toContain('"H"');
    expect(res.body).toContain('"i"');
  });

  it('passes through non-messages endpoints without fallback', async () => {
    const anthropic = await startMockServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ models: [] }));
    });
    anthropicServer = anthropic.server;

    Object.assign(mockEnv, {
      ANTHROPIC_API_KEY: 'sk-ant-real-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropic.port}`,
    });
    proxyServer = await startCredentialProxy(0);
    proxyPort = (proxyServer.address() as AddressInfo).port;

    const res = await makeRequest(
      proxyPort,
      {
        method: 'GET',
        path: '/v1/models',
        headers: { 'x-api-key': 'placeholder' },
      },
    );

    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body) as { models: unknown[] };
    expect(parsed.models).toEqual([]);
  });

  it('returns last error when all fallback providers fail', async () => {
    const anthropic = await startMockServer((_req, res) => {
      res.writeHead(429, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'rate_limit_error' } }));
    });
    anthropicServer = anthropic.server;

    Object.assign(mockEnv, {
      ANTHROPIC_API_KEY: 'sk-ant-real-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropic.port}`,
      // No MAMMOUTH_API_KEY / OLLAMA_API_KEY set → all fallbacks skipped
    });
    proxyServer = await startCredentialProxy(0);
    proxyPort = (proxyServer.address() as AddressInfo).port;

    const res = await makeRequest(
      proxyPort,
      {
        method: 'POST',
        path: '/v1/messages',
        headers: { 'content-type': 'application/json', 'x-api-key': 'placeholder' },
      },
      JSON.stringify({ model: 'claude-sonnet-4-6', messages: [], max_tokens: 10 }),
    );

    // Should return the Anthropic error as-is
    expect(res.statusCode).toBe(429);
  });
});
