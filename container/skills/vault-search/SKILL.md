---
name: vault-search
description: Search and navigate the Obsidian vault at /workspace/extra/obsidian using grep and find. Use for vault content lookup, cross-reference discovery, and locating project files before creating new ones.
allowed-tools: Bash, Read, Glob, Grep
---

# Vault Search

Search the Obsidian knowledge vault using bash-based patterns. Always search the vault before creating new notes to avoid duplication.

## Vault Root

```
/workspace/extra/obsidian
```

## Common Search Patterns

### Full-text search (case-insensitive)
```bash
grep -ril "<keyword>" /workspace/extra/obsidian/
```

### Search within a specific subfolder
```bash
grep -ril "<keyword>" /workspace/extra/obsidian/MnemClaw/projects/
```

### Find files by name pattern
```bash
find /workspace/extra/obsidian -name "*<name>*" -type f
```

### Find all files in a project folder
```bash
find /workspace/extra/obsidian/MnemClaw/projects/<ProjectName> -name "*.md" | sort
```

### Find MAP.md files
```bash
find /workspace/extra/obsidian -name "MAP.md"
```

### Search YAML front-matter tags
```bash
grep -rl "tags:.*<tag>" /workspace/extra/obsidian/
```

### Search for WikiLink references
```bash
grep -rl "\[\[<NoteTitle>\]\]" /workspace/extra/obsidian/
```

### Recent files (modified in last 7 days)
```bash
find /workspace/extra/obsidian -name "*.md" -newer /workspace/extra/obsidian -mtime -7 | sort
```

## Workflow

1. Search vault before creating any new note
2. If a related note exists, read it and extend rather than creating a duplicate
3. Check for a MAP.md in the target folder before adding new files
4. After creating or updating a note, update the MAP.md if present

## Project Files Location

```
/workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/
├── manifest.md
├── plan.md
├── MAP.md           ← index of files in this folder (if 3+ files)
├── research/
├── strategy/
├── marketing/
├── analytics/
└── community/
```

## Caution

- Do NOT commit or push the vault — it auto-syncs via Obsidian Git
- Do NOT delete notes — move stale content to `Archive/` instead
- Only the Researcher has full vault write access
