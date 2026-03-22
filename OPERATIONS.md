# NanoClaw Operations Guide

Running and maintaining NanoClaw without Claude Code. This covers the full lifecycle: build, configure, run, debug, and common traps.

---

## Prerequisites

- Node.js 20+
- Docker Desktop (running)
- Ollama (if using local models)

---

## Build

```bash
npm install          # install host dependencies
npm run build        # compile TypeScript → dist/
./container/build.sh # build the agent Docker image
```

Rebuild the container image whenever you change anything under `container/`.

### Forcing a clean container rebuild

BuildKit caches aggressively. `--no-cache` alone won't invalidate `COPY` steps — the builder volume retains stale files.

```bash
docker builder prune -f   # nuke the build cache
./container/build.sh      # then rebuild cleanly
```

---

## Environment — `.env`

All secrets live in `.env` at the project root. **Critical formatting rules:**

- Each variable must be on its own line. No trailing content on the same line.
- No trailing whitespace on token values — use `echo $VAR | tr -d '[:space:]'` to verify in the shell.
- After any change, sync to the container env file:

```bash
cp .env data/env/env
```

`data/env/env` is mounted read-only into every container. The host process reads from `.env` directly.

### Current variables

```bash
CLAUDE_CODE_OAUTH_TOKEN=...    # Anthropic auth
TELEGRAM_BOT_TOKEN=...         # Main Telegram bot
TELEGRAM_BOT_POOL=token1,token2  # Pool bots (comma-separated, no spaces)
GITHUB_TOKEN=...               # GitHub PAT (repo scope)
```

> **GITHUB_TOKEN is NOT automatically forwarded to containers.** It must also be added to `data/sessions/<group>/.claude/settings.json` (see Container Secrets below).

---

## Service Management (macOS launchd)

```bash
# Start
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist

# Stop
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist

# Restart (fast, no plist reload)
launchctl kickstart -k gui/$(id -u)/com.nanoclaw

# Full reload — required after editing the plist (env vars, paths)
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist

# Check status (PID + last exit code)
launchctl list | grep nanoclaw
# PID of "-" = not running. Exit code 1 = crashed.
```

### Plist must use absolute paths

Every path in the plist must be the real absolute path. If you move the project directory, update **all** of these:

- `ProgramArguments` → path to `dist/index.js`
- `WorkingDirectory`
- `StandardOutPath` and `StandardErrorPath`

After editing: `launchctl unload` + `launchctl load` (not just kickstart).

### Adding env vars to launchd

Variables the host process needs (e.g. `TELEGRAM_BOT_POOL`) go in the plist's `EnvironmentVariables` dict:

```xml
<key>EnvironmentVariables</key>
<dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/Users/oflorian/.local/bin</string>
    <key>HOME</key>
    <string>/Users/oflorian</string>
    <key>TELEGRAM_BOT_POOL</key>
    <string>token1,token2</string>
</dict>
```

Then do a full unload/load cycle.

---

## Development Mode

```bash
# Stop the launchd service first to avoid port/process conflicts
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist

npm run dev   # TypeScript watch + hot reload

# When done
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
```

Logs go to stdout in dev mode. In production they go to `logs/nanoclaw.log` and `logs/nanoclaw.error.log`.

---

## Registering a Telegram Chat

```bash
# Main chat (no trigger required, elevated privileges)
npx tsx setup/index.ts --step register -- \
  --jid "tg:<chat-id>" \
  --name "<display-name>" \
  --folder "main" \
  --trigger "@Andy" \
  --channel telegram \
  --no-trigger-required \
  --is-main

# Additional group (trigger required)
npx tsx setup/index.ts --step register -- \
  --jid "tg:<chat-id>" \
  --name "<display-name>" \
  --folder "telegram_<group-name>" \
  --trigger "@Andy" \
  --channel telegram
```

Get a chat's ID: send `/chatid` to the bot in Telegram.

---

## Mounting Extra Directories into Containers

Containers only see what's explicitly mounted. To mount additional host paths:

### Step 1 — Add to the mount allowlist

`~/.config/nanoclaw/mount-allowlist.json` must exist and use this exact format. **Plain strings do not work** — the fields `path` and `allowReadWrite` are required:

```json
{
  "allowedRoots": [
    {
      "path": "/absolute/host/path",
      "allowReadWrite": true,
      "description": "Human-readable label"
    }
  ],
  "blockedPatterns": [],
  "nonMainReadOnly": true
}
```

The allowlist is cached in memory — restart the service after changing it.

### Step 2 — Add to the group's container config

Update the `container_config` column in SQLite for the target group:

```bash
sqlite3 store/messages.db "UPDATE registered_groups
  SET container_config = '{\"additionalMounts\":[
    {\"hostPath\":\"/absolute/host/path\",\"containerPath\":\"alias\",\"readonly\":false}
  ]}'
  WHERE jid = 'tg:189895863'"
```

The directory appears inside the container at `/workspace/extra/<alias>`.

Non-main groups always get read-only mounts regardless of the `readonly` flag (controlled by `nonMainReadOnly` in the allowlist).

---

## Container Secrets (GITHUB_TOKEN etc.)

Environment variables set in `.env` are **not** forwarded to containers — `.env` is explicitly shadowed with `/dev/null` inside the container for security. To inject a secret into the container agent, add it to the group's Claude Code settings:

```bash
python3 -c "
import json
path = 'data/sessions/<group>/.claude/settings.json'
with open(path) as f:
    d = json.load(f)
d['env']['GITHUB_TOKEN'] = 'ghp_...'
with open(path, 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
"
```

This file is read by Claude Code on container startup. Changes take effect on the next container spawn — no service restart needed.

> `settings.json` is created once (if missing) by the container runner. After that it is never overwritten, so edits are safe.

---

## Killing a Stuck Container

```bash
# List running agent containers
docker ps --filter "name=nanoclaw" --format "table {{.Names}}\t{{.Status}}"

# Kill one
docker stop nanoclaw-telegram-main-<timestamp>

# Kill all
docker ps --filter "name=nanoclaw" -q | xargs docker stop
```

The host service detects the container exit and will respawn on the next inbound message.

---

## Logs

```bash
# Live log stream
tail -f logs/nanoclaw.log

# Errors only
tail -f logs/nanoclaw.error.log

# Filter for a specific group
tail -f logs/nanoclaw.log | grep "Florian"

# Filter for mount/container issues
tail -f logs/nanoclaw.log | grep -i "mount\|container\|error\|FATAL"

# Ollama activity
tail -f logs/nanoclaw.log | grep -i "ollama\|pool"

# Pool bot activity
tail -f logs/nanoclaw.log | grep -i "pool"
```

`launchd` caches log output — the file may not update until the buffer flushes. Check the timestamp of the file vs the current time before assuming the log is current:

```bash
ls -la logs/nanoclaw.error.log && date
```

---

## Common Corner Cases

### Bot receives messages but never responds

1. Check service is running: `launchctl list | grep nanoclaw` — PID should not be `-`
2. Check for mount errors in the log — `Cannot read properties of undefined (reading 'startsWith')` means the mount allowlist has plain strings instead of `{path, allowReadWrite}` objects
3. Check for container errors: `tail -50 logs/nanoclaw.log | grep -i error`
4. Trigger a fresh container: kill any running container with `docker stop`

### Typing indicator appears but no reply

The container is spawning but crashing. Check:

```bash
tail -30 logs/nanoclaw.error.log
```

Most common cause: mount validation failure (see allowlist format above).

### GITHUB_TOKEN not available inside container

`GITHUB_TOKEN` must be in `data/sessions/<group>/.claude/settings.json` under `env`. The `.env` file is not forwarded. Strip whitespace before storing:

```bash
echo -n "ghp_yourtoken" | cat -A   # should show no trailing ^M or spaces
```

### `.env` variables not parsed (merged onto one line)

Each variable must be on its own line. If two variables appear concatenated (e.g. `TOKEN=abc123NEXT_VAR=...`), a missing newline is the cause. Open `.env` in a text editor and verify manually.

### Service starts but immediately exits (launchd exit code 1)

Old path in the plist. Verify:

```bash
grep "nanoclaw" ~/Library/LaunchAgents/com.nanoclaw.plist
```

All paths must reflect the current project location. After fixing: `launchctl unload` + `launchctl load`.

### `/workspace/extra/obsidian` is empty or missing

1. Verify Docker Desktop has file sharing access to the path (Docker Desktop → Settings → Resources → File Sharing)
2. Verify the path is in the mount allowlist
3. Verify `container_config` in SQLite has the mount entry
4. Test Docker access directly: `docker run --rm -v "/path/to/dir:/test:ro" alpine ls /test`

### Container build seems stale after code changes

```bash
docker builder prune -f && ./container/build.sh
```

### Pool bots don't appear in Telegram

1. Verify `TELEGRAM_BOT_POOL` is set in both `.env` and the launchd plist
2. Check `logs/nanoclaw.log` for `Pool bot initialized` entries at startup
3. All pool bots must be added to the Telegram group and have Group Privacy disabled
4. Bot names update via `setMyName` — Telegram caches names client-side, restart your Telegram app if names don't update

---

## SQLite Quick Reference

```bash
# Open the database
sqlite3 store/messages.db

# List registered groups
SELECT jid, name, folder, is_main, container_config FROM registered_groups;

# Show recent messages
SELECT chat_jid, sender_name, content, timestamp FROM messages ORDER BY timestamp DESC LIMIT 20;

# Show scheduled tasks
SELECT id, group_folder, prompt, schedule_type, schedule_value, status, next_run FROM scheduled_tasks;

# Delete a registered group
DELETE FROM registered_groups WHERE jid = 'tg:...';
```
