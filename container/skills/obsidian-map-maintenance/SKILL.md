---
name: obsidian-map-maintenance
description: Create and maintain MAP.md index files in Obsidian vault folders. Required whenever a folder reaches 3+ notes. Tracks all files with descriptions and WikiLink cross-references.
allowed-tools: Bash, Read, Write, Edit, Glob
---

# Obsidian MAP.md Maintenance

MAP.md files are index documents that keep vault folders navigable. Create one when a folder reaches 3 or more notes. Update it whenever files are added, moved, or renamed.

## When to Create a MAP.md

- A folder hits 3 or more `.md` files
- A new project folder is being set up with planned subfolders
- Dan or the Researcher explicitly requests one

## MAP.md Structure

```markdown
---
title: "<Folder Name> — Map of Content"
description: Index of all notes in <Folder Name>.
tags:
  - map-of-content
  - <folder-slug>
created: YYYY-MM-DD
updated: YYYY-MM-DD
maturity: living document
status: Active — update whenever a file is added, moved, or removed
---

# <Folder Name> — MAP

> *Researcher: keep this file updated whenever a note is added, moved, or removed.*

---

## <Section Name>

| File | Description |
|---|---|
| [[NoteTitle]] | One-line description of the note |
| [[NoteTitle2]] | One-line description |

---

## JTAG Annotation
Type: Map of Content
Scope: <Folder or project name>
Maturity: Living document — updated on every file change
Cross-links: [[ParentMap]], [[RelatedNote]]
Key Components: <Comma-separated list of sections in this MAP>
```

## Workflow

### Checking if MAP.md is needed
```bash
# Count markdown files in a folder
find /workspace/extra/obsidian/MnemClaw/projects/<ProjectName> -maxdepth 1 -name "*.md" | wc -l
```

### Listing all files for the index
```bash
find /workspace/extra/obsidian/MnemClaw/projects/<ProjectName> -name "*.md" | sort
```

### Reading existing MAP.md before editing
Always read the current MAP.md before editing — never overwrite without reading first.

### Updating an existing MAP.md
1. Read the current file
2. Add the new entry in the correct section table
3. Update `updated:` in the YAML front-matter
4. Add a WikiLink cross-reference in JTAG Annotation if the new note is closely related

## Rules

- MAP.md entries use `[[WikiLink]]` format — exact note title, no path prefix
- Descriptions are one line maximum — keep them scannable
- Sections group notes by type (Research, Strategy, Analytics, etc.)
- `updated:` must reflect the date of the last MAP.md edit
- Do NOT list MAP.md itself in the index
- Do NOT include files in subfolders — each subfolder gets its own MAP.md
- Keep maturity as `living document` — MAP files are never "stable"

## Project Folder MAP Template

For a standard project folder at `/workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/`:

```markdown
| [[<TLA>-manifest]] | Product overview, goals, user stories, architecture |
| [[<TLA>-plan]] | Phased delivery plan with milestones and blockers |
```

Subfolders (research/, strategy/, marketing/, analytics/, community/) each get their own MAP.md once they hit 3 files.
