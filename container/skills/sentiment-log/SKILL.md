---
name: sentiment-log
description: Append structured sentiment and community signal entries to a project's sentiment-log.md in the Obsidian vault.
allowed-tools: Bash(sentiment-log:*), Read, Write
---
# Sentiment Log

## Overview

Write structured, timestamped entries to a project's `community/sentiment-log.md` in the Obsidian vault. Each entry records a detected emotional signal, its platform origin, the source snippet, and the action taken or recommended.

Used by Tribe Hub at the end of each monitoring or triage session to maintain a persistent record of community health trends.

## Prerequisites

- Project vault path: `/workspace/extra/obsidian/MnemClaw/projects/{PROJECT}/community/`
- Directory must exist (create if missing)
- TLA prefix conventions must be followed — read `/workspace/group/DEFAULTS.md` first

## Log File Path

```
/workspace/extra/obsidian/MnemClaw/projects/{PROJECT}/community/{TLA}-sentiment-log.md
```

## Entry Format

Each entry is appended as a YAML-fenced block followed by a markdown section. One entry per detected signal event.

```markdown
---
timestamp: YYYY-MM-DDTHH:MM:SSZ
platform: reddit | twitter | telegram | github | discord
signal: frustration | enthusiasm | confusion | anger | shock | neutral | mixed
intensity: low | medium | high
author: username (anonymise if needed)
url: https://...
escalated_to_dan: true | false
action_taken: labelled | drafted_response | escalated | logged_only | docs_flagged
---

**{SIGNAL} [{INTENSITY}]** — {PLATFORM} — {TIMESTAMP}

> "{SNIPPET — first 200 chars}"
> — @{AUTHOR}

*Classification:* {SIGNAL} | Confidence: {CONFIDENCE}
*Key phrases:* {phrase1}, {phrase2}
*Action:* {ACTION_TAKEN}
{IF response drafted: "*Draft:* See response-drafts-YYYY-MM-DD.md #ISSUE_OR_ID"}
{IF docs gap: "*Docs gap flagged:* {TOPIC}"}

---
```

## Bash — Append entry

```bash
LOG_PATH="/workspace/extra/obsidian/MnemClaw/projects/${PROJECT}/community/${TLA}-sentiment-log.md"

# Create file with header if it doesn't exist
if [ ! -f "$LOG_PATH" ]; then
  mkdir -p "$(dirname "$LOG_PATH")"
  cat > "$LOG_PATH" << 'EOF'
---
title: Sentiment Log
project: PROJECT_NAME
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Sentiment Log

Community signal tracking for PROJECT_NAME. Each entry is one detected emotional signal event.

EOF
fi

# Append a new entry (fill variables before running)
cat >> "$LOG_PATH" << EOF
---
timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
platform: ${PLATFORM}
signal: ${SIGNAL}
intensity: ${INTENSITY}
author: ${AUTHOR}
url: ${URL}
escalated_to_dan: ${ESCALATED}
action_taken: ${ACTION}
---

**${SIGNAL} [${INTENSITY}]** — ${PLATFORM} — $(date -u +"%Y-%m-%d %H:%M UTC")

> "${SNIPPET}"
> — @${AUTHOR}

*Classification:* ${SIGNAL} | Confidence: ${CONFIDENCE}
*Key phrases:* ${KEY_PHRASES}
*Action:* ${ACTION}

---
EOF
```

## Weekly Trend Summary

At the end of a weekly scan, append a trend summary section:

```markdown
## Weekly Summary — YYYY-MM-DD to YYYY-MM-DD

| Signal | Count | % of Total | Trend vs Last Week |
|---|---|---|---|
| frustration | 4 | 22% | +2 |
| enthusiasm | 8 | 44% | +5 |
| confusion | 3 | 17% | -1 |
| neutral | 3 | 17% | 0 |

*Overall health:* Positive momentum — enthusiasm dominant, frustration down.
*Top issue:* Docs gap on "how to configure X" (3 confusion signals).
*Recommended focus:* Write docs page for configuration workflow.
```

## Examples

### Appending a frustration signal from Reddit

```bash
PROJECT="nanoclaw"
TLA="NCL"
PLATFORM="reddit"
SIGNAL="frustration"
INTENSITY="high"
AUTHOR="user123"
URL="https://reddit.com/r/selfhosted/comments/abc123"
SNIPPET="I've been trying to get this working for 3 days. Nothing in the docs makes sense."
CONFIDENCE="0.95"
KEY_PHRASES="3 days, nothing makes sense"
ACTION="drafted_response"
ESCALATED="false"
# Then run the append block above
```

## Notes

- Always use UTC timestamps (ISO 8601 format).
- Anonymise authors if they are private individuals, not public figures or open-source contributors.
- Do not log raw PII — strip email addresses or phone numbers from snippets before logging.
- The log file is append-only. Never delete or edit past entries.
- Update the `updated:` field in the YAML front-matter when appending.
- This file is the source of truth for Tribe Hub's trend reports and community health reviews.
