# Switching Dan from Claude Sonnet to Kimi K2.5 (Mammouth)

Use this when Claude API quota runs out and you want to continue using NanoClaw on Mammouth's `kimi-k2.5` model at no extra cost.

> **Scope**: this switches the Claude Code SDK shell — the agent runtime itself. Swarm agents (Researcher, Lead Dev, etc.) already call Mammouth directly and are unaffected.

---

## How it works

Three `.env` variables control the switch:

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_BASE_URL` | Points Claude Code at Mammouth's Anthropic-compatible endpoint |
| `ANTHROPIC_API_KEY` | Mammouth API key (used instead of the Anthropic key OneCLI injects) |
| `CLAUDE_DEFAULT_MODEL` | Writes `"model": "kimi-k2.5"` into each container's `settings.json` |

These are injected into every container's `settings.json` env block at startup. Because `settings.json` env is merged into the Claude Code process environment at launch, it overrides OneCLI's credential injection for that process.

---

## Switch to Kimi K2.5

### 1 — Uncomment the three lines in `.env`

```bash
# Before (Claude — default):
# ANTHROPIC_BASE_URL=https://api.mammouth.ai/v1
# ANTHROPIC_API_KEY=sk-uaf0XKgsVBI6LhRVVGACMQ
# CLAUDE_DEFAULT_MODEL=kimi-k2.5

# After (Mammouth):
ANTHROPIC_BASE_URL=https://api.mammouth.ai/v1
ANTHROPIC_API_KEY=sk-uaf0XKgsVBI6LhRVVGACMQ
CLAUDE_DEFAULT_MODEL=kimi-k2.5
```

### 2 — Restart NanoClaw

```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

### 3 — Verify

Send Dan a simple message. Check the container log to confirm the model:

```bash
tail -f ~/nanoclaw/groups/main/logs/container-*.log | grep -i "model\|kimi\|mammouth"
```

Or just ask Dan: *"what model are you running on?"* — Kimi K2.5 will identify itself differently from Claude.

---

## Switch back to Claude

### 1 — Comment the three lines in `.env`

```bash
# ANTHROPIC_BASE_URL=https://api.mammouth.ai/v1
# ANTHROPIC_API_KEY=sk-uaf0XKgsVBI6LhRVVGACMQ
# CLAUDE_DEFAULT_MODEL=kimi-k2.5
```

### 2 — Restart NanoClaw

```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

---

## Notes

- **No code changes** needed at switch time — only `.env` edits and a restart.
- **Firecrawl** is unaffected (it has its own service and API URL).
- **Session continuity**: containers are ephemeral. Switching models mid-task is fine — Dan's memory lives in `groups/main/` files, not in the container.
- **Mammouth quota**: `kimi-k2.5` consumes Mammouth credits, not Anthropic credits. Monitor at [mammouth.ai](https://mammouth.ai).
- **Fallback**: if `kimi-k2.5` is unavailable on Mammouth, switch `CLAUDE_DEFAULT_MODEL` to `gpt-5.2-chat` or `mistral-large-3` — both work with the same endpoint.
