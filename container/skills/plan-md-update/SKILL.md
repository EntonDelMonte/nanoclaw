---
name: plan-md-update
description: Workflow for keeping plan.md up to date in the Obsidian vault as the Lead Developer progresses through project phases. Update phase status, mark milestones, and note blockers.
allowed-tools: Read, Write, Edit, Bash
---

# plan.md Update Workflow

The Lead Developer is responsible for keeping `plan.md` current. It is the user's primary window into project status — update it at the end of every phase and whenever a blocker is encountered.

## File Location

```
/workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/<TLA>-plan.md
```

Read this path from the task brief. Never assume the path.

## When to Update

| Event | Update Required |
|---|---|
| Phase starts | Mark phase as `In Progress` |
| Phase completes | Mark phase as `Complete`, add completion date |
| Milestone hit | Check off milestone, add date |
| Blocker found | Add to Blockers section with description |
| Blocker resolved | Remove from Blockers, note resolution in phase body |
| Task complete | Final status update — all phases marked, blockers cleared |

## Standard plan.md Format

```markdown
---
title: "<TLA>-plan"
description: "Phased delivery plan for <ProjectName>."
tags:
  - <tla>
  - plan
  - <project-slug>
created: YYYY-MM-DD
updated: YYYY-MM-DD
maturity: developing
status: In Progress
---

# <ProjectName> — Project Plan

## Phase 0: Scaffold
*Status: Complete — YYYY-MM-DD*

- [x] Repo created and initial structure committed
- [x] Dependencies installed
- [x] CI/CD skeleton in place

## Phase 1: Core
*Status: In Progress*

- [x] <Completed task>
- [ ] <Pending task>
- [ ] <Pending task>

## Phase 2: Features
*Status: Pending*

- [ ] <Feature A>
- [ ] <Feature B>

## Phase 3: Polish
*Status: Pending*

- [ ] Code review and refactor
- [ ] E2E tests passing
- [ ] Release notes drafted

## Milestones

| Milestone | Target | Status |
|---|---|---|
| MVP shipped | YYYY-MM-DD | [ ] |
| First user test | YYYY-MM-DD | [ ] |

## Blockers

| Blocker | Since | Notes |
|---|---|---|
| <Blocker description> | YYYY-MM-DD | <What's needed to unblock> |

---

## JTAG Annotation
Type: Plan
Scope: <ProjectName>
Maturity: developing
Cross-links: [[<TLA>-manifest]], [[<TLA>-research]]
Key Components: Phase 0-3 delivery, Milestones, Blockers
```

## Update Steps

1. Read the current plan.md: `Read /workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/<TLA>-plan.md`
2. Identify what changed (phase complete, new blocker, milestone hit)
3. Edit the specific section — do not rewrite the whole file unless restructuring
4. Update `updated:` in YAML front-matter to today's date
5. Save

## Minimal Phase Status Update (Edit pattern)

To mark a phase complete, change:
```
*Status: In Progress*
```
to:
```
*Status: Complete — 2026-03-24*
```

## Adding a Blocker

Append a row to the Blockers table:
```markdown
| Missing MAMMOUTH_API_KEY in container env | 2026-03-24 | Dan to confirm env var name |
```

## Removing a Blocker

Delete the row and add a note to the relevant phase:
```markdown
- [x] ~~MAMMOUTH_API_KEY missing~~ — resolved 2026-03-24, key confirmed
```

## Caution

- Do NOT push or commit the vault — it auto-syncs via Obsidian Git
- Only the Lead Developer updates plan.md — Researcher owns manifest.md
- If plan.md does not exist yet, the Researcher creates the initial version — notify Dan
