# Fork Customizations

This file documents every local customization in this NanoClaw fork.
**Read this before pulling upstream changes.** When conflicts arise, this
tells you what to keep and what to take from upstream.

---

## What to ALWAYS keep (never take upstream blindly)

### `groups/main/CLAUDE.md` — Dan's identity and instructions
Dan's CLAUDE.md is fully customized. Upstream ships a minimal template.
On every merge, **keep ours** for this file. Do not overwrite it.
If upstream adds structural sections (Authentication, Task Scripts, etc.),
merge them in manually, but never let upstream replace the whole file.

### `groups/main/agents/*.md` — Swarm agent personas
All six agent files are custom to this install:
- `researcher.md`
- `lead-developer.md`
- `copywriter.md`
- `tribe-hub.md`
- `skill-link.md`
- `growth-hacker.md`

Upstream does not ship these. If they appear in a diff, you added them;
take `--ours`.

### `groups/global/CLAUDE.md` — Global swarm formatting rule
We added a rule: swarm agents must use `send_message` with their sender
name. This line must survive merges:
```
If you are a named swarm agent, send ALL results via mcp__nanoclaw__send_message with your sender name.
```

### `src/config.ts` — `TELEGRAM_BOT_POOL` export
We export `TELEGRAM_BOT_POOL` from config. Upstream does not have this.
When resolving config.ts conflicts, keep our `TELEGRAM_BOT_POOL` lines.

### `src/channels/telegram.ts` — Telegram channel
Upstream deleted this file (moved to a skill branch). We keep it because
Telegram is our primary channel. On merge: `git add src/channels/telegram.ts`
(keep ours when it shows as modify/delete).

### `.github/workflows/fork-sync-skills.yml` — Fork CI
Our fork-sync workflow. Upstream deleted their version. Keep ours.

---

## What to ALWAYS take from upstream

### `container/agent-runner/src/index.ts` — Agent runner core
Do NOT add provider chains, model routing, or credential logic here.
The upstream version is the correct one. On merge: `git checkout --theirs
container/agent-runner/src/index.ts` then `git add` it.

### `src/container-runner.ts` — Container spawning
Upstream manages credential injection (via OneCLI). Do not add
`NANOCLAW_CLAUDE_ONLY`, `isMain` routing, or model-selection env vars here.
The only fork-specific addition allowed is:
```typescript
// Inject non-Anthropic provider keys for swarm agent fallback chain
if (process.env.OLLAMA_API_KEY) args.push('-e', `OLLAMA_API_KEY=...`);
if (process.env.MAMMOUTH_API_KEY) args.push('-e', `MAMMOUTH_API_KEY=...`);
```

### All `src/*.ts` core files — Take upstream
`src/index.ts`, `src/ipc.ts`, `src/router.ts`, `src/db.ts`, `src/types.ts`,
`src/task-scheduler.ts`, etc. — take upstream. Our customizations are in
`groups/`, not in `src/`.

---

## Fork-specific environment variables

These are in the launchd plist (`~/Library/LaunchAgents/com.nanoclaw.plist`)
and `.env`. They must survive updates:

| Variable | Purpose | Location |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Primary Telegram bot | `.env`, plist |
| `TELEGRAM_BOT_POOL` | 3 swarm pool bot tokens | `.env`, plist |
| `OLLAMA_API_KEY` | Swarm agent Ollama fallback | `.env`, plist |
| `MAMMOUTH_API_KEY` | Swarm agent Mammouth fallback | `.env`, plist |
| `ONECLI_URL` | OneCLI gateway URL | `.env`, plist |
| `GITHUB_TOKEN` | GitHub access for agents | `.env` |

**Anthropic credentials** are now managed by OneCLI (`onecli secrets list`),
not in `.env`. Do not add `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`
back to `.env`.

---

## Merge checklist

Before running `/update-nanoclaw`:

- [ ] Read this file
- [ ] Commit or stash any in-progress changes
- [ ] Note which conflict strategy to use for each conflicted file above
- [ ] After merge: verify `grammy` and `sharp` are still installed
  (`npm list grammy sharp`)
- [ ] After merge: rebuild container (`./container/build.sh`) if
  `container/agent-runner/` changed
- [ ] After merge: check CHANGELOG.md for `[BREAKING]` entries

---

## Installed skills (not in upstream main)

These were installed from skill branches and must survive upstream resets:

- **Telegram** (`telegram` remote) — `src/channels/telegram.ts`,
  `src/channels/index.ts` import, `grammy` dependency
- **Telegram Swarm** — pool bot logic in `src/telegram.ts`, `src/ipc.ts`,
  `src/config.ts` (TELEGRAM_BOT_POOL), `src/index.ts` (initBotPool call)
- **Ollama Tool** — `container/skills/ollama-tool/`, ollama MCP in
  `container/agent-runner/src/`
- **PDF Transcriber** — `container/skills/pdf-transcriber/`
- **YouTube Transcriber** — `container/skills/youtube-transcriber/`
- **Image Vision** — `src/image.ts`, `sharp` dependency
