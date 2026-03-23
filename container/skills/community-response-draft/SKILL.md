---
name: community-response-draft
description: Draft community responses to GitHub issues, social mentions, and direct feedback — structured for Dan's review and approval before any posting.
allowed-tools: Bash(community-response-draft:*), Read, Write
---
# Community Response Draft

## Overview

Produces structured draft responses to community feedback (GitHub issues, Reddit threads, Twitter replies, Telegram messages). Every draft is held for Dan's explicit approval — nothing is posted automatically.

Drafts are written in Tribe Hub's tone: warm, empirical, grounded. Thank contributors by name. Acknowledge bugs without promising timelines. De-escalate hostile messages; never match hostile tone.

## Prerequisites

- Source item: platform, author, original text, and sentiment classification (from `sentiment-analysis` skill)
- Dan's approval channel available (Telegram via `mcp__nanoclaw__send_message`)

## Tone Reference

| Situation | Tone |
|---|---|
| Bug report | Acknowledge clearly, thank reporter, ask for repro steps if missing, no timeline promises |
| Feature request | Thank, confirm it's been logged, share if it aligns with roadmap direction |
| Question | Answer directly or link to docs, flag if docs gap detected |
| Frustration | Empathise first, then help; avoid defensive language |
| Enthusiasm | Match energy, be genuine, encourage sharing |
| Anger / hostility | De-escalate only; do not defend, do not match tone; involve Dan if public callout |
| Confusion | Provide clear steps; flag for documentation improvement |

## Draft Workflow

### Step 1 — Gather context

```
Source: {PLATFORM} — {URL}
Author: {AUTHOR}
Original text: {TEXT}
Sentiment: {SIGNAL} ({INTENSITY})
Project: {PROJECT_NAME}
```

### Step 2 — Select template

Choose the appropriate template below and adapt it with specifics.

### Step 3 — Write the draft

Fill the template. Keep responses:
- Under 150 words for social platforms (Reddit, X, Telegram)
- Under 300 words for GitHub issue comments
- Warm opening (thank by name if possible)
- Clear body (answer, acknowledge, or de-escalate)
- Optional CTA (link to docs, ask for repro steps, etc.)

### Step 4 — Format for approval

```markdown
## Draft Response — {PLATFORM} #{ID or URL}

*Author:* {AUTHOR}
*Signal:* {SENTIMENT_SIGNAL} ({INTENSITY})
*Recommended action:* Post as reply / Close as duplicate / Label and respond

---
DRAFT:

{RESPONSE TEXT}

---
*Awaiting Dan's approval before posting.*
```

### Step 5 — Send to Dan via Telegram

Use `mcp__nanoclaw__send_message` with `sender: "Tribe Hub"`:

```
*Tribe Hub — Draft Ready for Review*
Platform: {PLATFORM} | Author: @{AUTHOR}
Signal: {SENTIMENT_SIGNAL}
Draft: "{First 80 chars of response}..."
Reply APPROVE, EDIT, or SKIP.
```

## Templates

### Bug acknowledgement

```
Hi @{AUTHOR}, thanks for reporting this! We've reproduced the issue on our end.
{IF repro steps missing: "Could you share the steps to reproduce, your OS, and version?"}
We've tagged it as a bug and it's in our backlog. We'll update this thread when there's progress.
```

### Feature request

```
Thanks for the suggestion, @{AUTHOR}! This is a great idea — {brief why it resonates}.
We've logged it as an enhancement. {IF roadmap aligned: "It aligns with our upcoming work on X."}
Keep the ideas coming!
```

### Question / support

```
Hey @{AUTHOR}! {DIRECT ANSWER or "Great question —"}
{ANSWER or link to docs}
{IF docs gap: "We'll improve the docs on this too."}
Let us know if you hit anything else!
```

### De-escalation (frustration)

```
Hi @{AUTHOR}, really sorry to hear you've been struggling with this.
That experience isn't what we want for you. Let's fix it — {specific offer: "can you share X?"}
We're here to help and will stay on this until it's resolved.
```

### Anger / hostile (escalate to Dan first)

```
[DO NOT DRAFT INDEPENDENTLY — escalate to Dan with: platform, author, screenshot/URL, signal: anger/high]
```

## Output Files

Save all drafts to:
`/workspace/extra/obsidian/MnemClaw/projects/{PROJECT}/community/response-drafts-YYYY-MM-DD.md`

Append each draft as a new section. Dan reviews the file or acts on Telegram notification.

## Notes

- Never post directly. This skill only writes drafts and sends Telegram notifications.
- If Dan approves via Telegram, a separate step (manually or via a future post skill) handles the actual posting.
- For GitHub: approved comment text can be posted with `gh issue comment ISSUE_NUMBER --repo OWNER/REPO --body "TEXT"`.
- For Reddit/X/Telegram: approved text is sent back to the user to post manually (no bot posting without explicit integration).
- Thank first-time contributors specifically — check if this is their first issue/PR.
