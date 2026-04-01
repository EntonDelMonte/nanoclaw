# GitHub Sync

The nanoclaw repo at `/Users/oflorian/nanoclaw` is automatically committed and pushed to GitHub every 30 minutes.

**Repo:** https://github.com/EntonDelMonte/nanoclaw

---

## How It Works

A macOS launchd agent (`com.nanoclaw.gitpush`) runs every 30 minutes:

1. `git add -A` — stages all changes not excluded by `.gitignore`
2. Commits with a timestamped message (`auto-sync: YYYY-MM-DD HH:MM`) if anything is staged
3. `git push origin main` — pushes to GitHub

The job skips the commit step if there are no changes, so the history stays clean.

---

## What Gets Tracked

### Tracked
- `src/` — all TypeScript source files
- `groups/main/CLAUDE.md` — Dan's memory and instructions
- `groups/main/HEARTBEAT.md` — system status and project state
- `groups/main/authority-table.md` — user-gated decision registry
- `groups/main/agents/*.md` — specialist agent definitions
- `groups/global/CLAUDE.md` — global agent instructions
- `package.json`, `package-lock.json`, `tsconfig.json`, etc.
- `.gitignore`, `CLAUDE.md`, `README.md`

### Not Tracked (excluded by `.gitignore`)
| Path | Reason |
|------|--------|
| `store/` | SQLite databases, auth credentials |
| `data/` | Session files, IPC queues, container data |
| `logs/` | Runtime logs |
| `node_modules/` | Dependencies |
| `dist/` | Build output |
| `.env` | Secrets |
| `groups/` subfolders other than `main/` and `global/` | Per-group runtime state |

---

## Launchd Job

**Plist location:** `~/Library/LaunchAgents/com.nanoclaw.gitpush.plist`

**Log file:** `/Users/oflorian/nanoclaw/logs/gitpush.log`

### Management Commands

```bash
# Check status
launchctl list | grep gitpush

# Reload after editing the plist
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.gitpush.plist
launchctl load ~/Library/LaunchAgents/com.nanoclaw.gitpush.plist

# Run manually (for immediate push)
git -C ~/nanoclaw add -A && git -C ~/nanoclaw commit -m "manual sync" && git -C ~/nanoclaw push origin main

# View logs
tail -f ~/nanoclaw/logs/gitpush.log
```

---

## Git Remotes

| Remote | URL | Purpose |
|--------|-----|---------|
| `origin` | https://github.com/EntonDelMonte/nanoclaw | Your fork — auto-push target |
| `upstream` | https://github.com/qwibitai/nanoclaw | NanoClaw core upstream |
| `telegram` | https://github.com/qwibitai/nanoclaw-telegram | Telegram channel source |

To pull upstream NanoClaw updates into your fork, use the `/update-nanoclaw` skill in Claude Code.

---

## Changing the Sync Interval

Edit `~/Library/LaunchAgents/com.nanoclaw.gitpush.plist` and change the `StartInterval` value (in seconds):

| Interval | Value |
|----------|-------|
| 15 minutes | `900` |
| 30 minutes | `1800` (current) |
| 1 hour | `3600` |

Then reload:
```bash
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.gitpush.plist
launchctl load ~/Library/LaunchAgents/com.nanoclaw.gitpush.plist
```

---

## Disabling Auto-Sync

```bash
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.gitpush.plist
```

To remove permanently, also delete the plist:
```bash
rm ~/Library/LaunchAgents/com.nanoclaw.gitpush.plist
```
