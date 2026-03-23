---
name: ollama-delegation
description: Delegate coding and inference tasks to local Ollama models via mcp__ollama__ollama_generate. Covers prompt construction, context limits, output handling, and when NOT to delegate.
allowed-tools: Bash, Read, Write, Edit
---

# Ollama Delegation Pattern

Use `mcp__ollama__ollama_generate` to delegate self-contained tasks to local Ollama models. The primary delegate model is `qwen3.5:9b` with a 32k token context window.

## When to Delegate to Ollama

Delegate when:
- Task is self-contained (single file or small multi-file)
- Full prompt (context + spec + expected output) fits under ~28k tokens
- No web access, GitHub, or external API calls are needed
- Task is coding, test generation, or focused refactor

Do NOT delegate when:
- Task requires web search, gh CLI, or MCP tools
- Context exceeds 28k tokens (split first, or keep for Lead Developer)
- Task requires memory across multiple steps
- Architectural decisions with major trade-offs are involved

## Checking Token Estimate Before Delegating

```bash
# Rough token estimate: word count ÷ 0.75
wc -w <file> | awk '{printf "Approx tokens: %.0f\n", $1/0.75}'
```

If estimated prompt + response exceeds 28k tokens, split the task.

## Tool Call Format

```
mcp__ollama__ollama_generate(
  model: "qwen3.5:9b",
  prompt: "<full self-contained prompt>"
)
```

## Prompt Structure

Every Ollama prompt must be fully self-contained — no references to "the file we discussed" or previous context. Include:

```
Language: TypeScript / Python / etc.
Framework: React 18, Node.js 22, etc.
Runtime version: Node 22.x

Task: <precise description of what to implement>

Existing code:
<full file contents — do not summarise>

Requirements:
- <bullet list of exact requirements>
- <edge cases to handle>
- <output format>

Tests required:
- <test framework>
- <what to test>
```

## Handling Output

After `mcp__ollama__ollama_generate` returns:

1. Write the generated code to the correct file path
2. Run tests immediately (`npm test` or `vitest run`)
3. If tests pass: commit (`git add -A && git commit -m "feat: <component>"`)
4. If tests fail: see failure protocol below

## Failure Protocol

| Failures | Action |
|---|---|
| 1-2 | Fix directly, re-run |
| 3+ | Enter Debugging Mode — call Ollama with original context + generated code + full error + "fix and explain" |
| Still failing after 3 Ollama rounds | ASK MODE — notify user via `mcp__nanoclaw__send_message` |

## Debugging Prompt Pattern

```
The following code was generated for <task>:

<generated code>

Running tests produced this error:

<full error output>

Fix the code and explain what was wrong.
```

## Context Limit Warning

If a task requires more than 28k tokens of context, do NOT attempt to compress or summarise — this degrades quality. Instead:

1. Break the task into smaller sub-tasks
2. Call Ollama once per sub-task
3. Integrate results yourself as Lead Developer

If the task genuinely cannot be split (e.g., requires full architectural context), fall back to Claude Sonnet via the Agent SDK and notify the user.

## Fallback Chain

```
mcp__ollama__ollama_generate (qwen3.5:9b, 32k limit)
  ↓ quota exhausted or >32k
Claude 4.6 Sonnet (Agent SDK)
  ↓ unavailable
Notify user and hold task
```
