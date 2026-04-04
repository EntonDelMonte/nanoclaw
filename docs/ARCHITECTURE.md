# NanoClaw — System Architecture

> *Keep this document updated whenever a new agent, mount, skill, or channel is added.*

---

## Overview

NanoClaw is a single Node.js process running on the host machine. It listens on one or more messaging channels (Telegram, WhatsApp, Slack, Discord, Gmail), routes each conversation to an isolated Linux container, and runs a Claude Agent SDK session inside it. Each conversation group gets its own container with its own filesystem namespace.

```
┌─────────────────────────────────────────────────────────┐
│  HOST MACHINE (macOS / Linux)                           │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │  NanoClaw Host Process (Node.js)               │    │
│  │  src/index.ts — orchestrator                   │    │
│  │                                                │    │
│  │  Channels      → src/channels/registry.ts      │    │
│  │  Router        → src/router.ts                 │    │
│  │  Container     → src/container-runner.ts       │    │
│  │  Scheduler     → src/task-scheduler.ts         │    │
│  │  IPC watcher   → src/ipc.ts                    │    │
│  │  Database      → src/db.ts (SQLite)            │    │
│  │  Mammouth Proxy→ src/mammouth-proxy.ts :3099   │    │
│  └──────────────────┬─────────────────────────────┘    │
│                     │ spawn container per group         │
│  ┌──────────────────▼─────────────────────────────┐    │
│  │  Container Runtime (Docker / Apple Container)  │    │
│  │  Image: nanoclaw-agent:latest                  │    │
│  │                                                │    │
│  │  ┌─────────────────────────────────────────┐   │    │
│  │  │  Agent Container (per group)            │   │    │
│  │  │  claude-code + agent-browser            │   │    │
│  │  │  pdftotext (poppler-utils)              │   │    │
│  │  │  chromium (browser automation)          │   │    │
│  │  │  gh CLI (GitHub)                        │   │    │
│  │  └─────────────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Host Process — Key Responsibilities

| Module | Role |
|---|---|
| `src/index.ts` | Main loop — polls channels, dispatches to containers, handles responses |
| `src/channels/registry.ts` | Self-registering channel system (Telegram, WhatsApp, etc.) |
| `src/router.ts` | Formats inbound messages for the agent; routes outbound back to channels |
| `src/container-runner.ts` | Builds mount list, spawns containers, parses output via sentinel markers |
| `src/task-scheduler.ts` | Runs cron/interval scheduled tasks by re-triggering containers |
| `src/ipc.ts` | Watches `data/ipc/<group>/` for agent-initiated tasks and follow-up messages |
| `src/db.ts` | SQLite store — messages, sessions, groups, tasks, router state |
| `src/mammouth-proxy.ts` | HTTP adapter on `:3099` — receives Anthropic-format requests, rewrites model to `kimi-k2.5`, injects Mammouth API key, forwards to `api.mammouth.ai` |
| `src/config.ts` | Central config — paths, timeouts, trigger pattern, container image name |

---

## Container Image — `nanoclaw-agent:latest`

Built from `container/Dockerfile` (Node 22 slim base).

| Tool | Purpose |
|---|---|
| `@anthropic-ai/claude-code` | Claude Agent SDK runner |
| `agent-browser` | Chromium browser automation |
| `chromium` | Headless browser (Playwright backend) |
| `poppler-utils` (`pdftotext`) | PDF text extraction |
| `gh` CLI | GitHub API operations |
| `git` | Version control operations |
| `python3` | Scripting and data processing |
| `yt-dlp` | Video/audio download |
| `ffmpeg` | Audio/video processing |
| `sharp` (npm) | Image resizing and processing |

**Rebuild command (run on host):**
```bash
cd /path/to/nanoclaw && ./container/build.sh
```

> After any Dockerfile or skill change, the container must be rebuilt on the host.

---

## Container Filesystem — Mount Map

Each container gets a private filesystem namespace. Mounts vary by group type.

### Main Group (`groups/main/` — Dan)

| Container Path | Host Path | Access | Contents |
|---|---|---|---|
| `/workspace/project` | `<nanoclaw-root>/` | **read-only** | NanoClaw source, CLAUDE.md, skills |
| `/workspace/project/.env` | `/dev/null` | read-only | Secrets masked |
| `/workspace/group` | `groups/main/` | **read-write** | Dan's memory, CLAUDE.md, HEARTBEAT.md, authority-table.md, agents registry |
| `/workspace/ipc` | `data/ipc/main/` | read-write | Message queue, task queue, input |
| `/home/node/.claude` | `data/sessions/main/.claude/` | read-write | Skills, session state, settings |
| `/workspace/extra/obsidian` | `~/obsidian/` | **read-write** | Obsidian knowledge vault |
| `/workspace/extra/nanoclaw` | `~/nanoclaw/` | **read-write** | NanoClaw project files |
| `/workspace/extra/skills-library` | `~/Documents/Github/_skills/` | **read-only** | Local skills library (700+ skills) |

### Non-Main Groups

| Container Path | Host Path | Access | Contents |
|---|---|---|---|
| `/workspace/group` | `groups/<folder>/` | read-write | Group memory, CLAUDE.md |
| `/workspace/global` | `groups/global/` | **read-only** | Shared global memory |
| `/workspace/ipc` | `data/ipc/<folder>/` | read-write | Message queue, task queue, input |
| `/home/node/.claude` | `data/sessions/<folder>/.claude/` | read-write | Skills, session state |
| *(additional mounts)* | per group config | configurable | Extra paths defined in group settings |

---

## IPC Directory Structure

Each group gets an isolated IPC namespace at `data/ipc/<group>/`:

```
data/ipc/<group>/
├── messages/     ← outbound messages the agent wants to send
├── tasks/        ← scheduled tasks the agent creates (CronCreate etc.)
└── input/        ← follow-up messages delivered to the running container
```

The host IPC watcher (`src/ipc.ts`) polls these directories and processes files as they appear.

### Interrupt Control

Send `/stop` in any registered Telegram chat to immediately kill the active container. The host writes the `_close` sentinel to `data/ipc/<group>/input/` (graceful shutdown), then calls `docker stop` on the container if it doesn't exit promptly. Implemented via `GroupQueue.forceStop()` in `src/group-queue.ts`, intercepted before message storage in `src/index.ts`.

---

## Skills System

Skills are Markdown files in `container/skills/<name>/SKILL.md`. They are synced into each group's `/home/node/.claude/skills/` before every container spawn, making them available as slash commands inside the agent.

### Container Skills (available to all agents)

28 skills installed. Full index at `/workspace/extra/nanoclaw/container/skills/MAP.md` — read this before starting any task to identify relevant skills.

Key categories:

| Category | Skills |
|---|---|
| Vault & Knowledge | `vault-search`, `jtag-note-format`, `map-maintenance`, `obsidian-wikilink` |
| Development | `github-operations`, `mammouth-api`, `ollama-delegation`, `unit-testing`, `web-self-testing`, `plan-md-update`, `skill-candidate-reporting` |
| Community & Growth | `github-issue-triage`, `social-sentiment-monitor`, `sentiment-analysis`, `community-response-draft`, `sentiment-log` |
| Analytics & Market | `ga4-analytics`, `google-ads-api`, `linkedin-ads-api`, `crypto-onchain-data`, `market-signal-report`, `mirofish-oasis` |
| Marketing Automation | `mautic` (local Docker + API) |
| Content & Media | `pdf-transcriber`, `youtube-transcriber`, `site-to-skill`, `agent-browser` |
| System | `capabilities`, `status` |

### Self-Improvement Loop

Agents deposit skill discovery notes to `/workspace/group/skill-candidates/` using the `skill-candidate-reporting` skill. Skill Link monitors this inbox, formalises qualifying patterns into new SKILL.md files, and notifies the user on every create/update.

### Local Skills Library (`/workspace/extra/skills-library/`)

Available to the main group container. Dan and all agents search here before the internet.

| Source | Path | Format |
|---|---|---|
| `agent-skills-hub` | `agent-skills-hub/skills/*/SKILL.md` | Standard SKILL.md (700+ skills) |
| `agency-agents` | `agency-agents/**/*.md` | Agent persona prompts by domain |
| `www-impeccable` | `www-impeccable/` | Design and web skills |
| `godogen` | `godogen/` | Game dev and generative skills |

**Skill gap workflow:** Dan identifies gaps, searches all local library subfolders → Obsidian Skill Repo → web, then delegates authoring to Skill Link. Skill Link manages all SKILL.md creation and maintenance. Installing existing skills from upstream uses the `/update-skills` host skill.

---

## Credential Flow

Secrets (API keys, tokens) are **never** mounted into containers. `.env` is explicitly shadowed to `/dev/null` inside the main group container.

### OneCLI Gateway

OneCLI (`@onecli-sh/sdk`) handles Anthropic credentials. `container-runner.ts` calls `onecli.applyContainerConfig(args)` which adds two Docker env vars to every container spawn:

- `HTTPS_PROXY=<onecli-url>` — OneCLI's HTTPS MITM proxy; intercepts all outbound HTTPS traffic from containers
- `CLAUDE_CODE_OAUTH_TOKEN=<token>` — long-lived token injected into requests to Anthropic

### Mammouth Adapter Proxy

Dan runs on kimi-k2.5 via Mammouth rather than Anthropic. The Mammouth proxy (`src/mammouth-proxy.ts`) runs on port 3099 of the host and is started at NanoClaw startup.

**Why a proxy is needed:**
- OneCLI intercepts all container HTTPS traffic and replaces the Authorization header with an Anthropic token — direct container → `api.mammouth.ai` calls would have their auth overwritten
- The Claude Code SDK validates model names against its known list; `kimi-k2.5` is not a Claude model name and is rejected before any network call

**How it works:**
1. Container's Claude Code SDK sends requests to `http://host.docker.internal:3099` (HTTP → not intercepted by OneCLI's HTTPS proxy)
2. Host-side proxy receives the Anthropic-format request
3. Proxy replaces `Authorization` header with the real Mammouth API key
4. Proxy rewrites the `model` field to `kimi-k2.5`
5. Proxy forwards to `https://api.mammouth.ai/v1` (from the host process, outside the container — outside OneCLI scope)

**Relevant `.env` keys:**

| Key | Value | Purpose |
|---|---|---|
| `ANTHROPIC_BASE_URL` | `http://host.docker.internal:3099` | Points Claude Code SDK at the local proxy |
| `ANTHROPIC_API_KEY` | `mammouth-proxy` | Dummy — proxy replaces it with `MAMMOUTH_API_KEY` |
| `CLAUDE_DEFAULT_MODEL` | `claude-sonnet-4-6` | Valid Claude model name; proxy remaps to `MAMMOUTH_TARGET_MODEL` |
| `MAMMOUTH_TARGET_MODEL` | `kimi-k2.5` | The model the proxy rewrites all requests to |
| `MAMMOUTH_API_KEY` | `sk-...` | Real Mammouth API key — only used by the host-side proxy |

### Other Provider Keys

Per-group secrets (e.g. `GITHUB_TOKEN`, `MAMMOUTH_API_KEY`) are injected via `data/sessions/<folder>/.claude/settings.json` `env` block. `OLLAMA_API_KEY` and `MAMMOUTH_API_KEY` are also passed directly as Docker `-e` env vars so the agent-runner can use them for direct Mammouth/Ollama API calls.

### SDK-Level Quota Fallback

The Claude MAX plan fires `rate_limit_event` at the SDK level before any HTTP request — OneCLI never sees it. The agent-runner detects this and switches providers:

1. kimi-k2.5 via Mammouth proxy (primary) — for Dan
2. Ollama `deepseek-v3.1:671b` at `https://ollama.com/v1` — first fallback
3. Mammouth `deepseek-v3.1-terminus` at `https://api.mammouth.ai/v1` — second fallback

Session is reset on provider switch. Implemented in `container/agent-runner/src/index.ts` (`fallbackChain`, `quotaExhausted` detection).

### External API Providers

| Provider | Purpose | Key |
|---|---|---|
| Mammouth (`api.mammouth.ai/v1`) | Dan's primary model (kimi-k2.5) via local proxy; also used by swarm agents directly | `MAMMOUTH_API_KEY` |
| Anthropic | Claude Agent SDK fallback; OneCLI injects token | via OneCLI |
| Ollama cloud (`ollama.com/v1`) | Cloud-hosted open models — `deepseek-v3.1:671b` | `OLLAMA_API_KEY` |
| Ollama (local) | Local models — `qwen3.5:9b`, `minimax-m2:cloud`, `minimax-m2.1:cloud` | no key required |

---

## Message Flow

```
Channel message arrives
        │
        ▼
Trigger check (@Andy / configured name)
        │  no trigger → drop (main group: no trigger required)
        ▼
Store message in SQLite
        │
        ▼
GroupQueue — serialize concurrent messages per group
        │
        ▼
Spawn container (or reuse if within IDLE_TIMEOUT=30min)
        │
        ▼
Pass message via stdin as JSON → agent processes
        │
        ▼
Agent outputs JSON between sentinel markers
        │
        ▼
Router formats response → Channel sends reply
        │
        ▼
Follow-up messages (IPC input/) → delivered to running container
```

---

## Agent Swarm — MnemClaw

Dan (main group) orchestrates a flat registry of specialised swarm agents via the Claude Agent Teams feature (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`).

### Telegram Bots

| Bot | Role | Type |
|---|---|---|
| `@mnem_alpha_bot` | Dan — orchestrator, user interface | Main polling bot |
| Pool bot 0–2 | Dynamically renamed to active agent (e.g. Researcher, Lead Developer) | 3× send-only pool bots (`TELEGRAM_BOT_POOL`) |

Pool bots rename via `setMyName` whenever a different sender takes over a bot slot (`poolCurrentOwner[]` tracks current owner per index). If rename fails (rate-limited ~1/10 min per bot), the message is prefixed with a bold sender header (`*SenderName*\n`) as a fallback. Implemented in `src/channels/telegram.ts` (`initBotPool`, `sendPoolMessage`). IPC `sender` field routed through `src/ipc.ts`.

### Agent Registry (`/workspace/group/agents/`)

| File | Agent | Primary Model | Domain | Project output |
|---|---|---|---|---|
| `researcher.md` | Researcher | `deepseek-v3.1-terminus` (Mammouth) | Research, vault, knowledge synthesis, strategy, analytics | `manifest.md`, `plan.md`, `research/`, `strategy/`, `analytics/` |
| `lead-developer.md` | Lead Developer | `qwen3-coder-plus` (Mammouth) | Code implementation, GitHub, testing | GitHub repo |
| `release-manager.md` | Release Manager | Claude Haiku | Versioning, changelogs, GitHub releases, deploys | GitHub releases |
| `local-coder.md` | Local Coder | `qwen3.5:9b` (Ollama, 32k ctx) | Headless coding worker — component/unit tasks delegated by Lead Developer | GitHub repo (via Lead Developer) |
| `marketer.md` | Marketer | Claude Haiku | Copywriting, positioning, campaigns, SEO | `marketing/` |
| `skill-link.md` | Skill Link | `deepseek-v3.1-terminus` (Mammouth) | Skill authoring, SKILL.md management, swarm integrations | `container/skills/`, vault Skill Repo |
| `tribe-hub.md` | Tribe Hub | `mistral-large-3` (Mammouth) | Social presence, sentiment analysis, Emotional Detection | `community/` |
| `growth-agent.md` | Growth Agent | `minimax-m2.1:cloud` (Ollama) | Analytics, ads, Mautic automation, market forecasting | `analytics/` |

**Dan's model:** `kimi-k2.5` via Mammouth proxy (transparent — Claude Code SDK sees `claude-sonnet-4-6`, proxy rewrites to `kimi-k2.5` before forwarding). Fallback chain: Ollama `deepseek-v3.1:671b` → Mammouth `deepseek-v3.1-terminus` → `qwen3.5:9b` local.

**Model fallback chain for swarm agents:** primary cloud model → Claude 4.6 Sonnet (complex tasks) → `qwen3.5:9b` (Ollama local fallback)

**Lead Developer coding worker:** delegates code generation to `qwen3-coder-plus` via Mammouth; falls back to `qwen3.5:9b` (32k limit — large tasks held if quota exhausted)

### Dan's Responsibilities

- Primary user interface for all domains
- Product ownership — always asks for project name before starting
- Skill gap identification and delegation
- Session state via `HEARTBEAT.md`
- Spawns agents in parallel for independent tasks
- Enforces the Authority Table — escalates 🔴 decisions to user, proceeds autonomously on 🟢

### Scraper Output

All scraped data lives in the Obsidian vault under `MnemClaw/scrapes/`, with the target site as a subfolder:

```
MnemClaw/scrapes/
├── onedoc/
│   ├── MAP.md
│   └── dr-med-saskia-herrmann.md
├── bookem/
│   └── bookem-com.md
└── <site>/
    └── <slug>.md
```

- Folder name = domain short name (kebab-case, no TLD)
- One file per scraped unit
- `MAP.md` created once a site folder has 20+ files

Container path: `/workspace/extra/obsidian/MnemClaw/scrapes/<site>/<slug>.md`

### Project File Structure

All project research, manifests, and plans live in the Obsidian vault under `MnemClaw/projects/`:

```
MnemClaw/projects/<ProjectName>/
├── manifest.md       ← product manifest (Researcher)
├── plan.md           ← phased project plan (Researcher creates, Lead Developer updates)
├── research/         ← background research and references (Researcher)
├── strategy/         ← business model, roadmap, GTM (Researcher)
├── marketing/        ← copy, campaigns, positioning (Marketer)
├── analytics/        ← metrics reports, ad performance, Mautic logs (Researcher + Growth Agent)
└── community/        ← sentiment logs, issue triage, contributor notes (Tribe Hub)
```

---

## Group Structure

```
groups/
├── global/
│   └── CLAUDE.md          ← shared baseline (capabilities, formatting, memory)
└── main/                  ← Dan's group (Telegram main, tg:189895863)
    ├── CLAUDE.md           ← Dan orchestrator config
    ├── HEARTBEAT.md        ← live system state
    ├── authority-table.md  ← user-gated decisions (3-tier: 🔴 always ask / 🟡 confirm / 🟢 autonomous)
    ├── agents/             ← flat agent registry
    │   ├── researcher.md
    │   ├── lead-developer.md
    │   ├── release-manager.md
    │   ├── marketer.md
    │   ├── local-coder.md
    │   ├── skill-link.md
    │   ├── tribe-hub.md
    │   └── growth-agent.md
    ├── skill-candidates/   ← self-improvement inbox (agents deposit discovery notes here)
    ├── attachments/        ← downloaded files (PDFs, etc.)
    ├── conversations/      ← searchable session history
    └── logs/               ← container logs
```

---

## Key File Paths (Host)

| Path | Contents |
|---|---|
| `groups/global/CLAUDE.md` | Shared agent baseline — capabilities, formatting, memory pattern |
| `groups/main/CLAUDE.md` | Dan orchestrator instructions |
| `groups/main/HEARTBEAT.md` | Live system state — updated each session |
| `groups/main/authority-table.md` | Decision registry — 3-tier authority across all project phases |
| `groups/main/agents/*.md` | Swarm agent role definitions |
| `data/sessions/main/.claude/settings.json` | Per-group env vars (GITHUB_TOKEN, SDK flags) |
| `data/ipc/main/` | Main group IPC namespace |
| `store/messages.db` | SQLite — all messages, sessions, tasks, groups |
| `container/Dockerfile` | Container image definition |
| `container/skills/` | Skills synced to all containers |
| `~/.config/nanoclaw/mount-allowlist.json` | Security allowlist for additional mounts |
| `~/.config/nanoclaw/sender-allowlist.json` | Allowlist of trusted senders |

---

## Authority Table

`groups/main/authority-table.md` defines which decisions require user input across all 6 project lifecycle phases. It is user-editable only — agents must not modify it.

### 3-Tier System

| Tier | Meaning | Behaviour |
|------|---------|-----------|
| 🔴 Always Ask | User must approve before action | Dan pauses and asks |
| 🟡 Proceed then Confirm | Dan acts, then reports outcome | Dan proceeds, notifies user |
| 🟢 Autonomous | Dan decides independently | No user interaction needed |

### Phases Covered

| Phase | Examples of decisions |
|-------|-----------------------|
| 1 — Pre-Manifest | Project scope, name, target market, build vs. buy |
| 2 — Foundation | Tech stack, repo creation, domain registration |
| 3 — Alpha / Beta | Feature prioritisation, breaking changes, public testers |
| 4 — Launch | Launch date, pricing, go-to-market channel selection |
| 5 — Scaling | Paid infrastructure, hiring, major pivots |
| 6 — Maintenance | Deprecation, EOL, handoff to community |
| Trading | Position sizing, new instruments, risk limit changes |

All swarm agents surface 🔴 decisions to Dan, who escalates to the user. Agents may act on 🟢 items autonomously.

---

## Scheduled Tasks

Tasks created by agents via `CronCreate` / `mcp__nanoclaw__schedule_task` are stored in SQLite and executed by `src/task-scheduler.ts`. The scheduler polls every 60 seconds, spawns a container for due tasks, and passes the task prompt as the agent input.

**Dan's active scheduled tasks:**
- 08:00 CET — Heartbeat check (fires if HEARTBEAT.md updated within 6h)
- 12:00 CET — Heartbeat check
- 18:00 CET — Heartbeat check

---

## Service Management

```bash
# macOS (launchd)
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl kickstart -k gui/$(id -u)/com.nanoclaw   # restart (code changes only)
# unload + load required for env var / plist changes

# Linux (systemd)
systemctl --user start nanoclaw
systemctl --user stop nanoclaw
systemctl --user restart nanoclaw
```
