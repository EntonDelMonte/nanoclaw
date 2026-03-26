/**
 * Credential proxy for container isolation.
 * Containers connect here instead of directly to the Anthropic API.
 * The proxy injects real credentials so containers never see them.
 *
 * Two auth modes:
 *   API key:  Proxy injects x-api-key on every request.
 *   OAuth:    Container CLI exchanges its placeholder token for a temp
 *             API key via /api/oauth/claude_cli/create_api_key.
 *             Proxy injects real OAuth token on that exchange request;
 *             subsequent requests carry the temp key which is valid as-is.
 *
 * Fallback chain (triggered on Anthropic 429 / 529 / overloaded_error):
 *   1. Anthropic (primary)
 *   2. Mammouth — deepseek-v3.1-terminus (OpenAI-compatible)
 *   3. Ollama cloud — deepseek-v3.2 (OpenAI-compatible)
 */
import { createServer, Server } from 'http';
import { request as httpsRequest } from 'https';
import { request as httpRequest, RequestOptions } from 'http';

import { readEnvFile } from './env.js';
import { logger } from './logger.js';

export type AuthMode = 'api-key' | 'oauth';

export interface ProxyConfig {
  authMode: AuthMode;
}

// ---------------------------------------------------------------------------
// Fallback provider definitions
// ---------------------------------------------------------------------------

interface FallbackProvider {
  name: string;
  baseUrl: string;
  model: string;
  apiKeyEnv: string;
}

// Default fallback provider definitions — base URLs can be overridden via env
// (MAMMOUTH_BASE_URL / OLLAMA_BASE_URL) to allow test substitution.
const DEFAULT_FALLBACK_PROVIDERS: FallbackProvider[] = [
  {
    name: 'Mammouth',
    baseUrl: 'https://api.mammouth.ai/v1',
    model: 'deepseek-v3.1-terminus',
    apiKeyEnv: 'MAMMOUTH_API_KEY',
  },
  {
    name: 'Ollama',
    baseUrl: 'https://ollama.com/v1',
    model: 'deepseek-v3.2',
    apiKeyEnv: 'OLLAMA_API_KEY',
  },
];

function buildFallbackProviders(secrets: Record<string, string>): FallbackProvider[] {
  return DEFAULT_FALLBACK_PROVIDERS.map((p) => {
    // Allow test/config override via <NAME>_BASE_URL env var
    const baseUrlKey = p.name.toUpperCase() + '_BASE_URL';
    const overriddenBaseUrl = secrets[baseUrlKey] ?? p.baseUrl;
    return { ...p, baseUrl: overriddenBaseUrl };
  });
}

// ---------------------------------------------------------------------------
// Quota-error detection
// ---------------------------------------------------------------------------

function isQuotaError(statusCode: number, body: string): boolean {
  if (statusCode === 429 || statusCode === 529) return true;
  if (statusCode >= 500) {
    try {
      const parsed = JSON.parse(body) as {
        type?: string;
        error?: { type?: string };
      };
      if (parsed?.error?.type === 'overloaded_error') return true;
    } catch {
      // ignore parse errors
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Anthropic ↔ OpenAI format translation
// ---------------------------------------------------------------------------

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: { type: string; properties?: Record<string, unknown>; [key: string]: unknown };
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: { type: string; properties?: Record<string, unknown>; [key: string]: unknown };
  };
}

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string }
  | { type: string; [key: string]: unknown };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface AnthropicRequest {
  model?: string;
  system?: string;
  messages?: AnthropicMessage[];
  max_tokens?: number;
  tools?: AnthropicTool[];
  stream?: boolean;
  [key: string]: unknown;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  tools?: OpenAITool[];
  stream?: boolean;
  [key: string]: unknown;
}

function translateToolsToOpenAI(tools: AnthropicTool[]): OpenAITool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

function translateMessagesToOpenAI(
  messages: AnthropicMessage[],
  system?: string,
): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  if (system) {
    result.push({ role: 'system', content: system });
  }

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      result.push({ role: msg.role, content: msg.content });
      continue;
    }

    const blocks = msg.content as AnthropicContentBlock[];

    // Tool results: Anthropic user message with tool_result blocks → OpenAI tool messages
    const toolResults = blocks.filter((b) => b.type === 'tool_result');
    if (toolResults.length > 0) {
      for (const block of toolResults) {
        const tr = block as { type: 'tool_result'; tool_use_id: string; content: string };
        result.push({
          role: 'tool',
          content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content),
          tool_call_id: tr.tool_use_id,
        });
      }
      continue;
    }

    // Assistant message — may contain text + tool_use blocks
    if (msg.role === 'assistant') {
      const textBlocks = blocks.filter((b) => b.type === 'text') as Array<{ type: 'text'; text: string }>;
      const toolUseBlocks = blocks.filter((b) => b.type === 'tool_use') as Array<{
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
      }>;

      const openAIMsg: OpenAIMessage = {
        role: 'assistant',
        content: textBlocks.length > 0 ? textBlocks.map((b) => b.text).join('') : null,
      };

      if (toolUseBlocks.length > 0) {
        openAIMsg.tool_calls = toolUseBlocks.map((b) => ({
          id: b.id,
          type: 'function' as const,
          function: {
            name: b.name,
            arguments: JSON.stringify(b.input),
          },
        }));
      }

      result.push(openAIMsg);
      continue;
    }

    // User message with only text blocks
    const textContent = blocks
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');
    result.push({ role: msg.role, content: textContent });
  }

  return result;
}

function translateAnthropicToOpenAI(
  anthropicBody: AnthropicRequest,
  fallbackModel: string,
): OpenAIRequest {
  const openAIReq: OpenAIRequest = {
    model: fallbackModel,
    messages: translateMessagesToOpenAI(
      anthropicBody.messages || [],
      anthropicBody.system,
    ),
    stream: anthropicBody.stream,
  };

  if (anthropicBody.max_tokens !== undefined) {
    openAIReq.max_tokens = anthropicBody.max_tokens;
  }

  if (anthropicBody.tools && anthropicBody.tools.length > 0) {
    openAIReq.tools = translateToolsToOpenAI(anthropicBody.tools);
  }

  return openAIReq;
}

// ---------------------------------------------------------------------------
// OpenAI → Anthropic response translation (non-streaming)
// ---------------------------------------------------------------------------

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

type AnthropicStopReason = 'end_turn' | 'tool_use' | 'max_tokens';

function finishReasonToStopReason(reason?: string): AnthropicStopReason {
  if (reason === 'tool_calls') return 'tool_use';
  if (reason === 'length') return 'max_tokens';
  return 'end_turn';
}

function translateOpenAIToAnthropic(
  openAIResponse: OpenAIResponse,
  model: string,
): Record<string, unknown> {
  const choice = openAIResponse.choices?.[0];
  const message = choice?.message;

  const content: Array<{ type: string; [key: string]: unknown }> = [];

  if (message?.content) {
    content.push({ type: 'text', text: message.content });
  }

  if (message?.tool_calls) {
    for (const tc of message.tool_calls) {
      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        parsedInput = { _raw: tc.function.arguments };
      }
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: parsedInput,
      });
    }
  }

  return {
    id: 'msg_fallback',
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: finishReasonToStopReason(choice?.finish_reason),
    usage: {
      input_tokens: openAIResponse.usage?.prompt_tokens ?? 0,
      output_tokens: openAIResponse.usage?.completion_tokens ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Streaming: OpenAI SSE → Anthropic SSE translation
// ---------------------------------------------------------------------------

interface OpenAIStreamDelta {
  content?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: OpenAIStreamDelta;
    finish_reason?: string | null;
  }>;
}

// Accumulator for tool calls across stream chunks
interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

async function streamOpenAIToAnthropic(
  openAIStream: NodeJS.ReadableStream,
  anthropicResponse: import('http').ServerResponse,
  model: string,
): Promise<void> {
  // Emit Anthropic message_start
  anthropicResponse.write(
    `event: message_start\ndata: ${JSON.stringify({
      type: 'message_start',
      message: {
        id: 'msg_fallback',
        type: 'message',
        role: 'assistant',
        model,
        content: [],
        stop_reason: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    })}\n\n`,
  );

  // Emit content_block_start for text block (index 0)
  anthropicResponse.write(
    `event: content_block_start\ndata: ${JSON.stringify({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    })}\n\n`,
  );

  let outputTokenCount = 0;
  let finishReason: string | null = null;
  let buffer = '';
  // tool call accumulators: index → accumulator
  const toolAccumulators = new Map<number, ToolCallAccumulator>();
  // Whether we've emitted a text content block start already
  let textBlockOpen = true;
  // Track highest content block index used
  let nextBlockIndex = 1;

  for await (const chunk of openAIStream as AsyncIterable<Buffer>) {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.slice(6);
      if (jsonStr === '[DONE]') continue;

      let parsed: OpenAIStreamChunk;
      try {
        parsed = JSON.parse(jsonStr) as OpenAIStreamChunk;
      } catch {
        continue;
      }

      const choice = parsed.choices?.[0];
      if (!choice) continue;

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }

      const delta = choice.delta;
      if (!delta) continue;

      // Text content delta
      if (delta.content) {
        if (!textBlockOpen) {
          // Open a new text block if previously closed
          anthropicResponse.write(
            `event: content_block_start\ndata: ${JSON.stringify({
              type: 'content_block_start',
              index: nextBlockIndex,
              content_block: { type: 'text', text: '' },
            })}\n\n`,
          );
          textBlockOpen = true;
          nextBlockIndex++;
        }
        const textDelta = JSON.stringify({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: delta.content },
        });
        anthropicResponse.write(`event: content_block_delta\ndata: ${textDelta}\n\n`);
        outputTokenCount += Math.ceil(delta.content.length / 4); // rough estimate
      }

      // Tool call deltas
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolAccumulators.has(idx)) {
            toolAccumulators.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', arguments: '' });
          }
          const acc = toolAccumulators.get(idx)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name += tc.function.name;
          if (tc.function?.arguments) acc.arguments += tc.function.arguments;
        }
      }
    }
  }

  // Close text block
  anthropicResponse.write(
    `event: content_block_stop\ndata: ${JSON.stringify({
      type: 'content_block_stop',
      index: 0,
    })}\n\n`,
  );

  // Emit accumulated tool calls as content blocks
  for (const [, acc] of toolAccumulators) {
    const blockIdx = nextBlockIndex++;
    anthropicResponse.write(
      `event: content_block_start\ndata: ${JSON.stringify({
        type: 'content_block_start',
        index: blockIdx,
        content_block: { type: 'tool_use', id: acc.id, name: acc.name, input: {} },
      })}\n\n`,
    );
    // Emit input_json_delta
    anthropicResponse.write(
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: blockIdx,
        delta: { type: 'input_json_delta', partial_json: acc.arguments },
      })}\n\n`,
    );
    anthropicResponse.write(
      `event: content_block_stop\ndata: ${JSON.stringify({
        type: 'content_block_stop',
        index: blockIdx,
      })}\n\n`,
    );
  }

  // message_delta
  anthropicResponse.write(
    `event: message_delta\ndata: ${JSON.stringify({
      type: 'message_delta',
      delta: {
        stop_reason: finishReasonToStopReason(finishReason ?? undefined),
        stop_sequence: null,
      },
      usage: { output_tokens: outputTokenCount },
    })}\n\n`,
  );

  // message_stop
  anthropicResponse.write(
    `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`,
  );
}

// ---------------------------------------------------------------------------
// HTTP helper for fallback providers
// ---------------------------------------------------------------------------

function makeHttpRequest(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body: Buffer,
): Promise<{ statusCode: number; headers: Record<string, string>; body: Buffer; stream: NodeJS.ReadableStream }> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const requestFn = isHttps ? httpsRequest : httpRequest;

    const req = requestFn(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + (url.search || ''),
        method,
        headers: { ...headers, 'content-length': body.length },
      } as RequestOptions,
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers as Record<string, string>,
            body: Buffer.concat(chunks),
            stream: res,
          });
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function makeHttpRequestStream(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body: Buffer,
): Promise<{ statusCode: number; responseHeaders: Record<string, string | string[] | undefined>; stream: import('http').IncomingMessage }> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const requestFn = isHttps ? httpsRequest : httpRequest;

    const req = requestFn(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + (url.search || ''),
        method,
        headers: { ...headers, 'content-length': body.length },
      } as RequestOptions,
      (res) => {
        resolve({
          statusCode: res.statusCode ?? 0,
          responseHeaders: res.headers as Record<string, string | string[] | undefined>,
          stream: res,
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Main proxy server
// ---------------------------------------------------------------------------

export function startCredentialProxy(
  port: number,
  host = '127.0.0.1',
): Promise<Server> {
  const secrets = readEnvFile([
    'ANTHROPIC_API_KEY',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'MAMMOUTH_API_KEY',
    'MAMMOUTH_BASE_URL',
    'OLLAMA_API_KEY',
    'OLLAMA_BASE_URL',
  ]);

  const authMode: AuthMode = secrets.ANTHROPIC_API_KEY ? 'api-key' : 'oauth';
  const oauthToken =
    secrets.CLAUDE_CODE_OAUTH_TOKEN || secrets.ANTHROPIC_AUTH_TOKEN;

  const upstreamUrl = new URL(
    secrets.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
  );
  const isHttps = upstreamUrl.protocol === 'https:';
  const makeRequest = isHttps ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        const body = Buffer.concat(chunks);

        // Only attempt fallback for /v1/messages endpoint
        const isMessagesEndpoint = req.url === '/v1/messages';
        const isStreaming = (() => {
          try {
            const parsed = JSON.parse(body.toString()) as { stream?: boolean };
            return parsed.stream === true;
          } catch {
            return false;
          }
        })();

        const headers: Record<string, string | number | string[] | undefined> =
          {
            ...(req.headers as Record<string, string>),
            host: upstreamUrl.host,
            'content-length': body.length,
          };

        // Strip hop-by-hop headers that must not be forwarded by proxies
        delete headers['connection'];
        delete headers['keep-alive'];
        delete headers['transfer-encoding'];

        if (authMode === 'api-key') {
          delete headers['x-api-key'];
          headers['x-api-key'] = secrets.ANTHROPIC_API_KEY;
        } else {
          if (headers['authorization']) {
            delete headers['authorization'];
            if (oauthToken) {
              headers['authorization'] = `Bearer ${oauthToken}`;
            }
          }
        }

        if (!isMessagesEndpoint) {
          // Non-messages endpoints: forward directly, no fallback
          const upstream = makeRequest(
            {
              hostname: upstreamUrl.hostname,
              port: upstreamUrl.port || (isHttps ? 443 : 80),
              path: req.url,
              method: req.method,
              headers,
            } as RequestOptions,
            (upRes) => {
              res.writeHead(upRes.statusCode!, upRes.headers);
              upRes.pipe(res);
            },
          );
          upstream.on('error', (err) => {
            logger.error({ err, url: req.url }, 'Credential proxy upstream error');
            if (!res.headersSent) {
              res.writeHead(502);
              res.end('Bad Gateway');
            }
          });
          upstream.write(body);
          upstream.end();
          return;
        }

        // For /v1/messages: buffer the Anthropic response to check for quota errors
        const fallbackProviders = buildFallbackProviders(secrets);
        try {
          if (isStreaming) {
            await handleStreamingWithFallback(
              req, res, body, headers, upstreamUrl, isHttps, makeRequest, secrets, authMode, fallbackProviders,
            );
          } else {
            await handleNonStreamingWithFallback(
              req, res, body, headers, upstreamUrl, isHttps, makeRequest, secrets, authMode, fallbackProviders,
            );
          }
        } catch (err) {
          logger.error({ err, url: req.url }, 'Credential proxy error');
          if (!res.headersSent) {
            res.writeHead(502);
            res.end('Bad Gateway');
          }
        }
      });
    });

    server.listen(port, host, () => {
      logger.info({ port, host, authMode }, 'Credential proxy started');
      resolve(server);
    });

    server.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Non-streaming request handler with fallback
// ---------------------------------------------------------------------------

async function handleNonStreamingWithFallback(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  body: Buffer,
  headers: Record<string, string | number | string[] | undefined>,
  upstreamUrl: URL,
  isHttps: boolean,
  makeRequest: typeof httpsRequest | typeof httpRequest,
  secrets: Record<string, string>,
  _authMode: AuthMode,
  fallbackProviders: FallbackProvider[],
): Promise<void> {
  // Try Anthropic first
  let anthropicStatusCode: number;
  let anthropicBody: Buffer;
  let anthropicHeaders: Record<string, string | string[] | undefined>;

  await new Promise<void>((resolve, reject) => {
    const upstream = makeRequest(
      {
        hostname: upstreamUrl.hostname,
        port: upstreamUrl.port || (isHttps ? 443 : 80),
        path: req.url,
        method: req.method,
        headers,
      } as RequestOptions,
      (upRes) => {
        const chunks: Buffer[] = [];
        upRes.on('data', (c: Buffer) => chunks.push(c));
        upRes.on('end', () => {
          anthropicStatusCode = upRes.statusCode!;
          anthropicBody = Buffer.concat(chunks);
          anthropicHeaders = upRes.headers as Record<string, string | string[] | undefined>;
          resolve();
        });
        upRes.on('error', reject);
      },
    );
    upstream.on('error', reject);
    upstream.write(body);
    upstream.end();
  });

  const bodyStr = anthropicBody!.toString('utf8');
  if (!isQuotaError(anthropicStatusCode!, bodyStr)) {
    // Success — forward as-is
    res.writeHead(anthropicStatusCode!, anthropicHeaders!);
    res.end(anthropicBody!);
    return;
  }

  // Parse original Anthropic request for translation
  let anthropicRequest: AnthropicRequest;
  try {
    anthropicRequest = JSON.parse(body.toString('utf8')) as AnthropicRequest;
  } catch {
    res.writeHead(anthropicStatusCode!, anthropicHeaders!);
    res.end(anthropicBody!);
    return;
  }

  // Try fallback providers
  const allSecrets = { ...secrets };

  let lastStatusCode = anthropicStatusCode!;
  let lastBody = anthropicBody!;
  let lastHeaders = anthropicHeaders!;

  for (const provider of fallbackProviders) {
    const apiKey = allSecrets[provider.apiKeyEnv];
    if (!apiKey) {
      logger.warn({ provider: provider.name }, 'No API key configured, skipping fallback');
      continue;
    }

    logger.warn({ provider: provider.name, model: provider.model }, 'Claude quota hit — falling back');

    const openAIBody = translateAnthropicToOpenAI(anthropicRequest, provider.model);
    const openAIBodyBuf = Buffer.from(JSON.stringify(openAIBody), 'utf8');
    const providerUrl = new URL(`${provider.baseUrl}/chat/completions`);

    try {
      const result = await makeHttpRequest(
        providerUrl,
        'POST',
        {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          accept: 'application/json',
        },
        openAIBodyBuf,
      );

      lastStatusCode = result.statusCode;
      lastBody = result.body;
      lastHeaders = result.headers;

      const resultBodyStr = result.body.toString('utf8');
      if (result.statusCode >= 200 && result.statusCode < 300) {
        // Translate OpenAI response to Anthropic format
        const openAIResponse = JSON.parse(resultBodyStr) as OpenAIResponse;
        const anthropicTranslated = translateOpenAIToAnthropic(openAIResponse, provider.model);
        const translatedBuf = Buffer.from(JSON.stringify(anthropicTranslated), 'utf8');

        res.writeHead(200, {
          'content-type': 'application/json',
          'content-length': translatedBuf.length,
        });
        res.end(translatedBuf);
        return;
      }

      logger.warn({ provider: provider.name, statusCode: result.statusCode }, 'Fallback provider failed');
    } catch (err) {
      logger.error({ err, provider: provider.name }, 'Fallback provider request error');
    }
  }

  // All providers failed — return last error
  res.writeHead(lastStatusCode, lastHeaders);
  res.end(lastBody);
}

// ---------------------------------------------------------------------------
// Streaming request handler with fallback
// ---------------------------------------------------------------------------

async function handleStreamingWithFallback(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  body: Buffer,
  headers: Record<string, string | number | string[] | undefined>,
  upstreamUrl: URL,
  isHttps: boolean,
  makeRequest: typeof httpsRequest | typeof httpRequest,
  secrets: Record<string, string>,
  _authMode: AuthMode,
  fallbackProviders: FallbackProvider[],
): Promise<void> {
  // For streaming: buffer the first chunk to detect quota errors
  const { statusCode, responseHeaders, stream } = await new Promise<{
    statusCode: number;
    responseHeaders: Record<string, string | string[] | undefined>;
    stream: import('http').IncomingMessage;
  }>((resolve, reject) => {
    const upstream = makeRequest(
      {
        hostname: upstreamUrl.hostname,
        port: upstreamUrl.port || (isHttps ? 443 : 80),
        path: req.url,
        method: req.method,
        headers,
      } as RequestOptions,
      (upRes) => {
        resolve({
          statusCode: upRes.statusCode ?? 0,
          responseHeaders: upRes.headers as Record<string, string | string[] | undefined>,
          stream: upRes,
        });
      },
    );
    upstream.on('error', reject);
    upstream.write(body);
    upstream.end();
  });

  // For streaming, we need to check the status code immediately
  // If not a quota error status code, pipe directly
  if (!isQuotaError(statusCode, '')) {
    res.writeHead(statusCode, responseHeaders);
    stream.pipe(res);
    return;
  }

  // Buffer the full stream to check for overloaded_error in body
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve) => {
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', resolve);
  });
  const fullBody = Buffer.concat(chunks).toString('utf8');

  if (!isQuotaError(statusCode, fullBody)) {
    // Not a real quota error — forward as-is
    res.writeHead(statusCode, responseHeaders);
    res.end(fullBody);
    return;
  }

  // Parse original request for fallback
  let anthropicRequest: AnthropicRequest;
  try {
    anthropicRequest = JSON.parse(body.toString('utf8')) as AnthropicRequest;
  } catch {
    res.writeHead(statusCode, responseHeaders);
    res.end(fullBody);
    return;
  }

  const allSecrets = { ...secrets };

  for (const provider of fallbackProviders) {
    const apiKey = allSecrets[provider.apiKeyEnv];
    if (!apiKey) {
      logger.warn({ provider: provider.name }, 'No API key configured, skipping fallback');
      continue;
    }

    logger.warn({ provider: provider.name, model: provider.model }, 'Claude quota hit — falling back');

    const openAIBody = translateAnthropicToOpenAI(anthropicRequest, provider.model);
    // Ensure stream is true for the fallback too
    openAIBody.stream = true;
    const openAIBodyBuf = Buffer.from(JSON.stringify(openAIBody), 'utf8');
    const providerUrl = new URL(`${provider.baseUrl}/chat/completions`);

    try {
      const { statusCode: fallbackStatus, stream: fallbackStream } = await makeHttpRequestStream(
        providerUrl,
        'POST',
        {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          accept: 'text/event-stream',
        },
        openAIBodyBuf,
      );

      if (fallbackStatus >= 200 && fallbackStatus < 300) {
        // Translate OpenAI SSE stream to Anthropic SSE stream
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        await streamOpenAIToAnthropic(fallbackStream, res, provider.model);
        res.end();
        return;
      }

      // Drain the failed stream
      await new Promise<void>((resolve) => {
        fallbackStream.on('data', () => undefined);
        fallbackStream.on('end', resolve);
      });
      logger.warn({ provider: provider.name, statusCode: fallbackStatus }, 'Fallback provider stream failed');
    } catch (err) {
      logger.error({ err, provider: provider.name }, 'Fallback provider stream error');
    }
  }

  // All providers failed — return last error
  res.writeHead(statusCode, responseHeaders);
  res.end(fullBody);
}

/** Detect which auth mode the host is configured for. */
export function detectAuthMode(): AuthMode {
  const secrets = readEnvFile(['ANTHROPIC_API_KEY']);
  return secrets.ANTHROPIC_API_KEY ? 'api-key' : 'oauth';
}
