---
name: mammouth-api
description: Call the Mammouth OpenAI-compatible API for Researcher (deepseek-v3.1-terminus) and Lead Developer (qwen3-coder-plus) primary models. Includes auth pattern, request format, and fallback handling.
allowed-tools: Bash
---

# Mammouth API

Mammouth provides an OpenAI-compatible REST API for large frontier models. Used as the primary model for both Researcher and Lead Developer agents.

## Endpoint

```
Base URL: https://api.mammouth.ai/v1
Auth: Bearer $MAMMOUTH_API_KEY
```

## Models

| Agent | Model | Use Case |
|---|---|---|
| Researcher | `deepseek-v3.1-terminus` | Deep research, synthesis, knowledge work |
| Lead Developer | `qwen3-coder-plus` | Code generation, implementation, architecture |

## curl Pattern

```bash
curl -s https://api.mammouth.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${MAMMOUTH_API_KEY}" \
  -d '{
    "model": "deepseek-v3.1-terminus",
    "messages": [
      {"role": "system", "content": "<system prompt>"},
      {"role": "user", "content": "<user prompt>"}
    ],
    "temperature": 0.7,
    "max_tokens": 4096
  }' | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['choices'][0]['message']['content'])"
```

## Python Pattern

```python
import os, requests

def mammouth_call(prompt: str, model: str = "deepseek-v3.1-terminus", system: str = "") -> str:
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {os.environ['MAMMOUTH_API_KEY']}"
    }
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    resp = requests.post(
        "https://api.mammouth.ai/v1/chat/completions",
        headers=headers,
        json={"model": model, "messages": messages, "temperature": 0.7, "max_tokens": 4096}
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]
```

## Auth Check

```bash
# Verify key is set
echo "Key present: $([ -n "$MAMMOUTH_API_KEY" ] && echo YES || echo NO)"

# Test connectivity
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${MAMMOUTH_API_KEY}" \
  https://api.mammouth.ai/v1/models
```

## Fallback Chain

If Mammouth is unavailable or quota is exhausted:

1. Researcher → Claude 4.6 Sonnet (Agent SDK)
2. Lead Developer → Claude 4.6 Sonnet (Agent SDK)
3. Both → `qwen3.5:9b` via `mcp__ollama__ollama_generate` (32k context limit — hold large tasks)

When falling back to Ollama, notify the user via `mcp__nanoclaw__send_message` if context requirements exceed 32k tokens.

## Rate Limits and Errors

| HTTP Code | Meaning | Action |
|---|---|---|
| 401 | Invalid API key | Check `$MAMMOUTH_API_KEY` env var |
| 429 | Rate limit hit | Wait 60s, retry once, then fall back |
| 503 | Service unavailable | Fall back to Claude Sonnet immediately |
| 200 | Success | Parse `choices[0].message.content` |

## Context Size Guidelines

- `deepseek-v3.1-terminus`: large context — suitable for full-document synthesis
- `qwen3-coder-plus`: large context — suitable for multi-file code generation
- Ollama `qwen3.5:9b`: 32k tokens — split tasks before delegating
