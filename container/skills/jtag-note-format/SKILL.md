---
name: jtag-note-format
description: Standard combined JTAG note format for all Obsidian vault notes — YAML front-matter block plus JTAG Annotation section. Apply to every new or updated note in the MnemClaw vault.
allowed-tools: Read, Write, Edit
---

# JTAG Note Format

Every note in the MnemClaw vault uses the combined JTAG format. Two required sections — no duplication between them.

## Template

```markdown
---
title: "<Note Title>"
description: "<One-sentence summary>"
tags:
  - <tag1>
  - <tag2>
created: YYYY-MM-DD
updated: YYYY-MM-DD
maturity: draft | developing | stable | evergreen
status: <Active | Archived | In Progress | Superseded>
---

# <Note Title>

<Body content here>

---

## JTAG Annotation
Type: <Note | Research | Plan | Manifest | Strategy | Analytics | Map of Content | Reference>
Scope: <Project or domain this note covers>
Maturity: <draft | developing | stable | evergreen>
Cross-links: [[RelatedNote1]], [[RelatedNote2]]
Key Components: <Comma-separated list of main topics or sections>
```

## Field Definitions

### YAML Front-Matter
| Field | Purpose |
|---|---|
| `title` | Full display title of the note |
| `description` | One sentence — what this note is and why it exists |
| `tags` | Lowercase kebab-case; include project name, type, and domain |
| `created` | ISO date when note was first created |
| `updated` | ISO date of last substantive change — update on every edit |
| `maturity` | `draft` → fresh; `developing` → actively updated; `stable` → settled; `evergreen` → maintained indefinitely |
| `status` | Lifecycle state: Active, Archived, In Progress, Superseded |

### JTAG Annotation Section
| Field | Purpose |
|---|---|
| `Type` | Note classification — see options above |
| `Scope` | The project or domain this note belongs to |
| `Maturity` | Mirrors the YAML field — no discrepancy allowed |
| `Cross-links` | `[[WikiLinks]]` to related notes; minimum 1 if any related note exists |
| `Key Components` | The main sections or topics covered — helps search and summarisation |

## Rules

- Both sections are required — never create a note with only one
- Do NOT duplicate the same field in both sections (e.g., don't repeat description in JTAG)
- Update `updated:` on every substantive edit
- Tags use lowercase kebab-case only
- Cross-links use `[[NoteTitle]]` format — exact title, no path prefix

## Maturity Progression

```
draft → developing → stable → evergreen
```

Move maturity forward when content is substantially complete and verified. Never regress maturity without a reason noted in the body.

## Example: Project Plan Note

```markdown
---
title: "NCA-plan"
description: "Phased delivery plan for the NanoClaw Agent project."
tags:
  - nca
  - plan
  - nanoclaw
  - project-management
created: 2026-03-20
updated: 2026-03-24
maturity: developing
status: Active
---

# NCA — Project Plan

## Phase 0: Scaffold
...

---

## JTAG Annotation
Type: Plan
Scope: NanoClaw Agent (NCA)
Maturity: developing
Cross-links: [[NCA-manifest]], [[NCA-research]]
Key Components: Phase 0 scaffold, Phase 1 core features, Phase 2 integrations, Milestones, Blockers
```
