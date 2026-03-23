---
name: github-issue-triage
description: Triage GitHub issues and PRs using the gh CLI — list, classify, label, and draft initial responses. Designed for community-facing triage without auto-posting.
allowed-tools: Bash(github-issue-triage:*), Read, Write
---
# GitHub Issue Triage

## Overview

List, classify, and label open GitHub issues and PRs using the `gh` CLI. Produces a triage report with recommended actions and draft responses. Never posts directly — all responses are drafted for human review.

Covers the full Tribe Hub triage workflow: bug vs feature vs question vs docs vs duplicate classification, labelling, contributor recognition, and FAQ gap identification.

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth status`)
- `GH_TOKEN` environment variable set, or `gh auth login` completed
- Write access to the target repo for adding labels

## Usage

### List open issues

```bash
# All open issues, newest first
gh issue list --repo OWNER/REPO --state open --limit 25 --json number,title,labels,createdAt,author,body

# Issues with no label (untriaged)
gh issue list --repo OWNER/REPO --state open --label "" --limit 25
```

### List open PRs

```bash
gh pr list --repo OWNER/REPO --state open --limit 20 --json number,title,labels,author,createdAt,additions,deletions
```

### View a single issue in full

```bash
gh issue view ISSUE_NUMBER --repo OWNER/REPO --json number,title,body,labels,comments
```

### Apply a label

```bash
gh issue edit ISSUE_NUMBER --repo OWNER/REPO --add-label "bug"
gh issue edit ISSUE_NUMBER --repo OWNER/REPO --add-label "good first issue"
gh issue edit ISSUE_NUMBER --repo OWNER/REPO --add-label "question"
gh issue edit ISSUE_NUMBER --repo OWNER/REPO --add-label "documentation"
gh issue edit ISSUE_NUMBER --repo OWNER/REPO --add-label "duplicate"
```

### Close a duplicate

```bash
# Add duplicate label, close with comment reference — draft only, do not run without approval
gh issue close ISSUE_NUMBER --repo OWNER/REPO --comment "Duplicate of #ORIGINAL_NUMBER"
```

## Classification Rules

| Category | Signals | Label(s) |
|---|---|---|
| Bug | "doesn't work", "error", "crash", stack trace present | `bug` |
| Feature request | "would be great if", "support for", "add X" | `enhancement` |
| Question / Support | "how do I", "is it possible", "confused about" | `question` |
| Documentation gap | Repeating "how to" with no docs link | `documentation` |
| Good first issue | Small scope, isolated, clear reproduction | `good first issue` |
| Duplicate | Same root cause as existing open issue | `duplicate` |
| Needs repro | Bug with no steps to reproduce | `needs-repro` |

## Triage Workflow

```bash
# Step 1: fetch untriaged issues
ISSUES=$(gh issue list --repo OWNER/REPO --state open --limit 25 \
  --json number,title,body,labels,author,createdAt)

# Step 2: for each issue with empty labels array, classify using LLM reasoning
# Step 3: apply labels via gh issue edit
# Step 4: draft response text (do not post — save to triage-report.md)
# Step 5: surface report to Dan for approval
```

## Output — Triage Report Format

Write the triage report to `/workspace/extra/obsidian/MnemClaw/projects/PROJECT/community/triage-report-YYYY-MM-DD.md`:

```markdown
# Triage Report — YYYY-MM-DD

## Issues Reviewed: N

| # | Title | Classification | Labels Applied | Action | Draft Response |
|---|---|---|---|---|---|
| 12 | "App crashes on startup" | Bug | bug, needs-repro | Request repro steps | "Thanks for reporting! Could you share..." |
| 13 | "How to configure X" | Question | question, documentation | Link to docs or flag gap | "Great question! The docs for this are..." |

## FAQ Gaps Identified
- "How to configure X" appeared 3 times this week — docs page needed

## Contributor Notes
- @username opened their first issue — welcome message drafted
```

## Notes

- Always use `--json` flag for machine-readable output, not default table view.
- `gh` CLI must have `repo` scope for label writes. Check with `gh auth status`.
- Never post comments or close issues without Dan's explicit approval — draft only.
- For large repos (500+ issues), filter by `--since` date: `gh issue list --search "is:open created:>2026-03-01"`.
- Label creation (if labels don't exist): `gh label create "needs-repro" --repo OWNER/REPO --color "#e11d48"`.
