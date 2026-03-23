---
name: obsidian-wikilink
description: Obsidian WikiLink cross-linking patterns — how to create, resolve, and maintain [[WikiLinks]] across vault notes. Ensures consistent internal linking and prevents broken references.
allowed-tools: Bash, Read, Write, Edit, Grep
---

# Obsidian WikiLink Cross-Linking

WikiLinks connect related notes in the Obsidian vault. Use them in body text, MAP.md tables, and JTAG Annotation Cross-links fields.

## Syntax

```
[[NoteTitle]]              — link using exact note title (no .md extension)
[[NoteTitle|Display Text]] — link with custom display text
[[Folder/NoteTitle]]       — link with path (use only when titles are ambiguous)
```

## Rules

1. Always use the exact note title — Obsidian resolves by title, not filename
2. Omit `.md` extension
3. Prefer bare `[[NoteTitle]]` over `[[Folder/NoteTitle]]` unless disambiguation is needed
4. Add WikiLinks both ways: if Note A links to Note B, Note B should link back to Note A (bidirectional)
5. Never create a WikiLink to a note that does not exist — check first

## Checking if a Note Exists

```bash
# Find note by title (case-insensitive)
find /workspace/extra/obsidian -name "<NoteTitle>.md" -type f

# Or search for it
grep -ril "<NoteTitle>" /workspace/extra/obsidian/ --include="*.md" | head -5
```

## Finding Orphaned or Broken Links

```bash
# List all WikiLinks used in a note
grep -o '\[\[[^\]]*\]\]' /workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/<TLA>-manifest.md

# Find all notes that link to a given title
grep -rl "\[\[<NoteTitle>\]\]" /workspace/extra/obsidian/
```

## When to Add Cross-Links

| Situation | Action |
|---|---|
| Creating a new project note | Link to manifest.md and plan.md |
| Creating a research note | Link to the relevant manifest and any prior research |
| Creating a strategy note | Link to manifest.md, competitor research |
| Updating a note with new references | Add WikiLinks inline at first mention |
| MAP.md entry | Use `[[NoteTitle]]` in the table — always |
| JTAG Annotation Cross-links | List 1-3 most relevant WikiLinks |

## Bidirectional Linking Pattern

When you add `[[NoteB]]` to Note A, open Note B and add `[[NoteA]]` in its JTAG Cross-links (or body if contextually appropriate).

```bash
# Example: after adding [[NCA-research]] to NCA-manifest, update NCA-research
grep -n "Cross-links" /workspace/extra/obsidian/MnemClaw/projects/NCA/NCA-research.md
# Then edit to add [[NCA-manifest]] if not present
```

## WikiLinks in JTAG Annotation

The `Cross-links:` field in the JTAG Annotation section takes a comma-separated list:

```
Cross-links: [[NCA-manifest]], [[NCA-plan]], [[Competitive-Landscape]]
```

Minimum: 1 link if any related note exists. Maximum: keep it to 3-5 most relevant.

## WikiLinks in MAP.md Tables

```markdown
| [[NCA-manifest]] | Product overview, goals, user stories, architecture |
| [[NCA-plan]] | Phased delivery plan with milestones |
```

The WikiLink goes in the first column. Description in the second. No extra formatting.
