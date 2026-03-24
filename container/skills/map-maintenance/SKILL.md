---
name: map-maintenance
description: Create and maintain MAP.md index files in any directory. General-purpose — works for the skills folder, vault folders, project folders, or any collection of files that needs a navigable index.
allowed-tools: Bash, Read, Write, Edit, Glob
---

# MAP.md Maintenance

MAP.md files are living index documents that make directories navigable and discoverable. Create one when a folder reaches 3+ files. Update it whenever files are added, moved, renamed, or removed.

## When to Create a MAP.md

- A folder reaches 3 or more `.md` files
- A new folder is being set up with planned content
- An agent or user explicitly requests one

## Workflow

### 1. Scan the directory
```bash
# List all markdown files in the target folder (non-recursive)
find <target-dir> -maxdepth 1 -name "*.md" ! -name "MAP.md" | sort

# Count files to decide if MAP.md is needed
find <target-dir> -maxdepth 1 -name "*.md" ! -name "MAP.md" | wc -l
```

### 2. Read existing MAP.md before editing
Always read the current MAP.md first — never overwrite without reading.

### 3. Create or update
- **Create**: write the full MAP.md using the template below
- **Update**: edit only the affected rows; update `updated:` date

## MAP.md Template

```markdown
---
title: "<Folder Name> — Map of Content"
description: Index of all files in <Folder Name>.
updated: YYYY-MM-DD
status: living document — update whenever a file is added, moved, or removed
---

# <Folder Name> — MAP

> *<Responsible agent>: keep this file updated whenever a file is added, moved, or removed.*

---

## <Section Name>

| File | Description |
|------|-------------|
| `filename` or [[WikiLink]] | One-line description |

---
```

## Entry Format

Choose format based on context:

| Context | Entry format |
|---------|-------------|
| Obsidian vault | `[[NoteTitle]]` — WikiLink, exact title, no path |
| Skills directory | `` `skill-folder-name` `` — code-formatted folder name |
| Other directories | `filename.md` — plain filename |

## Rules

- One line per file — descriptions are scannable, not exhaustive
- Group entries into logical sections (e.g. by type, domain, or phase)
- Never list MAP.md itself in the index
- Never include files from subfolders — each subfolder gets its own MAP.md
- Always update `updated:` to today's date after any edit
- Meta/system files (like this skill) stay out of the index

## Subfolders

If a subfolder grows to 3+ files, create its own MAP.md there. Add a reference to it in the parent MAP.md under a "Subfolders" section:

```markdown
## Subfolders

| Folder | Description |
|--------|-------------|
| `subfolder/` | Brief description — see subfolder/MAP.md |
```
