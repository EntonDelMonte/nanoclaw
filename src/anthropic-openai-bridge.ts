/**
 * Anthropic Messages API ↔ OpenAI Chat Completions format bridge.
 *
 * Used by the AI adapter proxy when routing to an OpenAI-compatible backend
 * (e.g. Ollama cloud) instead of an Anthropic-compatible one (Mammouth).
 */
import type { IncomingMessage, ServerResponse } from 'http';

// ──────────────────────────────────────────────────────────────
// Request: Anthropic → OpenAI
// ──────────────────────────────────────────────────────────────

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return (content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
}

// Convert a single Anthropic message to one or more OpenAI messages.
// User messages with mixed tool_result + text become separate messages.
function convertMessage(msg: Record<string, unknown>): Record<string, unknown>[] {
  const role = msg['role'] as string;
  const content = msg['content'];

  if (typeof content === 'string') return [{ role, content }];

  if (!Array.isArray(content)) return [{ role, content: '' }];

  if (role === 'user') {
    const out: Record<string, unknown>[] = [];
    const toolResults = content.filter((b) => b.type === 'tool_result');
    const textBlocks = content.filter((b) => b.type === 'text');

    for (const tr of toolResults) {
      out.push({
        role: 'tool',
        tool_call_id: tr.tool_use_id,
        content: typeof tr.content === 'string' ? tr.content : extractText(tr.content),
      });
    }
    if (textBlocks.length > 0) {
      out.push({ role: 'user', content: textBlocks.map((b) => b.text).join('') });
    }
    return out;
  }

  if (role === 'assistant') {
    const textBlocks = content.filter((b) => b.type === 'text');
    const toolUse = content.filter((b) => b.type === 'tool_use');
    const m: Record<string, unknown> = {
      role: 'assistant',
      content: textBlocks.map((b) => b.text).join('') || null,
    };
    if (toolUse.length > 0) {
      m['tool_calls'] = toolUse.map((b) => ({
        id: b.id,
        type: 'function',
        function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      }));
    }
    return [m];
  }

  return [{ role, content: extractText(content) }];
}

export function anthropicToOpenAI(body: Record<string, unknown>): {
  path: string;
  body: Record<string, unknown>;
} {
  const messages: Record<string, unknown>[] = [];

  const system = body['system'];
  if (system) {
    messages.push({ role: 'system', content: extractText(system) || String(system) });
  }

  for (const msg of (body['messages'] as Record<string, unknown>[]) ?? []) {
    messages.push(...convertMessage(msg));
  }

  const openai: Record<string, unknown> = {
    model: body['model'],
    messages,
    stream: body['stream'] ?? false,
  };

  if (body['max_tokens'] != null) openai['max_tokens'] = body['max_tokens'];
  if (body['temperature'] != null) openai['temperature'] = body['temperature'];
  if (Array.isArray(body['stop_sequences'])) openai['stop'] = body['stop_sequences'];

  const tools = body['tools'] as Array<Record<string, unknown>> | undefined;
  if (tools?.length) {
    openai['tools'] = tools.map((t) => ({
      type: 'function',
      function: {
        name: t['name'],
        description: t['description'] ?? '',
        parameters: t['input_schema'] ?? { type: 'object', properties: {} },
      },
    }));
  }

  const tc = body['tool_choice'];
  if (tc === 'auto') openai['tool_choice'] = 'auto';
  else if (tc === 'any') openai['tool_choice'] = 'required';
  else if (tc === 'none') openai['tool_choice'] = 'none';
  else if (tc && typeof tc === 'object' && (tc as Record<string, unknown>)['type'] === 'tool') {
    openai['tool_choice'] = {
      type: 'function',
      function: { name: (tc as Record<string, unknown>)['name'] },
    };
  }

  return { path: '/v1/chat/completions', body: openai };
}

// ──────────────────────────────────────────────────────────────
// Response (non-streaming): OpenAI → Anthropic
// ──────────────────────────────────────────────────────────────

const STOP_REASON: Record<string, string> = {
  stop: 'end_turn',
  tool_calls: 'tool_use',
  length: 'max_tokens',
  content_filter: 'stop_sequence',
};

export function openAIToAnthropic(openai: Record<string, unknown>, model: string): Record<string, unknown> {
  const choices = openai['choices'] as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0] as Record<string, unknown> | undefined;
  if (!choice) return openai;

  const msg = choice['message'] as Record<string, unknown>;
  const content: unknown[] = [];

  // Ollama kimi-k2.5 returns thinking tokens in a non-standard `reasoning` field
  const reasoning = (msg['reasoning'] || msg['reasoning_content']) as string | undefined;
  if (reasoning) content.push({ type: 'thinking', thinking: reasoning, signature: null });

  if (msg['content']) content.push({ type: 'text', text: msg['content'] });

  for (const tc of (msg['tool_calls'] as Array<Record<string, unknown>>) ?? []) {
    const fn = tc['function'] as Record<string, unknown>;
    let input: unknown = {};
    try { input = JSON.parse(String(fn['arguments'] ?? '{}')); } catch {}
    content.push({ type: 'tool_use', id: tc['id'], name: fn['name'], input });
  }

  const usage = openai['usage'] as Record<string, unknown> | undefined;
  return {
    id: openai['id'] ?? `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: STOP_REASON[String(choice['finish_reason'] ?? 'stop')] ?? 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: usage?.['prompt_tokens'] ?? 0,
      output_tokens: usage?.['completion_tokens'] ?? 0,
    },
  };
}

// ──────────────────────────────────────────────────────────────
// Response (streaming): OpenAI SSE → Anthropic SSE
// ──────────────────────────────────────────────────────────────

export function translateStream(
  upstream: IncomingMessage,
  res: ServerResponse,
  model: string,
): void {
  res.setHeader('content-type', 'text/event-stream; charset=utf-8');
  res.setHeader('cache-control', 'no-cache');
  res.flushHeaders();

  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let messageStarted = false;
  let nextIndex = 0;
  const openedBlocks = new Set<number>();
  const toolIndexToBlock = new Map<number, number>();
  let outputTokens = 0;
  let buffer = '';

  const ensureMessageStart = (id: string): void => {
    if (messageStarted) return;
    send('message_start', {
      type: 'message_start',
      message: {
        id, type: 'message', role: 'assistant', content: [], model,
        stop_reason: null, stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 1 },
      },
    });
    send('ping', { type: 'ping' });
    messageStarted = true;
  };

  const finalize = (stopReason = 'end_turn'): void => {
    for (const idx of Array.from(openedBlocks).sort((a, b) => a - b)) {
      send('content_block_stop', { type: 'content_block_stop', index: idx });
    }
    send('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: outputTokens },
    });
    send('message_stop', { type: 'message_stop' });
    if (!res.writableEnded) res.end();
  };

  const processChunk = (parsed: Record<string, unknown>): void => {
    const id = String(parsed['id'] ?? `msg_${Date.now()}`);
    ensureMessageStart(id);

    const choices = parsed['choices'] as Array<Record<string, unknown>> | undefined;
    const choice = choices?.[0];
    if (!choice) return;

    const delta = choice['delta'] as Record<string, unknown> | undefined;
    if (!delta) return;

    // Ollama kimi-k2.5: reasoning tokens arrive in `reasoning` or `reasoning_content`
    const reasoningDelta = (delta['reasoning'] || delta['reasoning_content']) as string | null | undefined;
    if (reasoningDelta) {
      if (!openedBlocks.has(0)) {
        send('content_block_start', {
          type: 'content_block_start', index: 0,
          content_block: { type: 'thinking', thinking: '' },
        });
        openedBlocks.add(0);
        nextIndex = Math.max(nextIndex, 1);
      }
      send('content_block_delta', {
        type: 'content_block_delta', index: 0,
        delta: { type: 'thinking_delta', thinking: reasoningDelta },
      });
    }

    const textContent = delta['content'] as string | null | undefined;
    if (textContent) {
      // Text block comes after reasoning block (index 1 if reasoning opened, else 0)
      const textBlockIdx = openedBlocks.has(0) ? 1 : 0;
      if (!openedBlocks.has(textBlockIdx)) {
        send('content_block_start', {
          type: 'content_block_start', index: textBlockIdx,
          content_block: { type: 'text', text: '' },
        });
        openedBlocks.add(textBlockIdx);
        nextIndex = Math.max(nextIndex, textBlockIdx + 1);
      }
      send('content_block_delta', {
        type: 'content_block_delta', index: textBlockIdx,
        delta: { type: 'text_delta', text: textContent },
      });
      outputTokens++;
    }

    const toolCalls = delta['tool_calls'] as Array<Record<string, unknown>> | undefined;
    for (const tc of toolCalls ?? []) {
      const tcIdx = tc['index'] as number;
      if (!toolIndexToBlock.has(tcIdx)) {
        // Close any open text block before opening a tool_use block
        const textBlockIdx = openedBlocks.has(0) ? 1 : 0;
        if (openedBlocks.has(textBlockIdx)) {
          send('content_block_stop', { type: 'content_block_stop', index: textBlockIdx });
          openedBlocks.delete(textBlockIdx);
        }
        const blockIdx = nextIndex++;
        toolIndexToBlock.set(tcIdx, blockIdx);
        const fn = tc['function'] as Record<string, unknown> | undefined;
        send('content_block_start', {
          type: 'content_block_start', index: blockIdx,
          content_block: { type: 'tool_use', id: tc['id'] ?? '', name: fn?.['name'] ?? '', input: {} },
        });
        openedBlocks.add(blockIdx);
      }
      const blockIdx = toolIndexToBlock.get(tcIdx)!;
      const args = (tc['function'] as Record<string, unknown> | undefined)?.['arguments'] as string | undefined;
      if (args) {
        send('content_block_delta', {
          type: 'content_block_delta', index: blockIdx,
          delta: { type: 'input_json_delta', partial_json: args },
        });
      }
    }

    const finishReason = choice['finish_reason'] as string | undefined;
    if (finishReason && finishReason !== 'null') {
      // Will finalise on [DONE]; store reason for use then
      (parsed as Record<string, unknown>)['_stop'] = STOP_REASON[finishReason] ?? 'end_turn';
    }
  };

  let lastStopReason = 'end_turn';

  upstream.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf-8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') { finalize(lastStopReason); return; }
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        processChunk(parsed);
        if (parsed['_stop']) lastStopReason = String(parsed['_stop']);
      } catch { /* skip malformed */ }
    }
  });

  upstream.on('error', () => { if (!res.writableEnded) res.end(); });
  upstream.on('end', () => { if (!res.writableEnded) finalize(lastStopReason); });
}
