---
name: skill-candidate-reporting
description: Report skill gaps discovered during agent work by depositing structured candidate files to /workspace/group/skill-candidates/. Used by any agent that identifies a missing or inadequate container skill.
allowed-tools: Bash, Write, Read
---

# Skill Candidate Reporting

When you encounter a task that requires a capability not covered by an existing container skill, report it as a skill candidate. Dan and Skill Link will review and commission a new skill.

## Deposit Location

```
/workspace/group/skill-candidates/
```

## When to File a Skill Candidate

- You needed a workflow that no existing SKILL.md covers
- An existing skill is incomplete or missing a critical pattern you needed
- You improvised a multi-step pattern that other agents will likely need repeatedly
- A tool or API integration is used frequently enough to warrant a standard skill

## Candidate File Format

Filename: `<skill-slug>-candidate.md` (kebab-case, unique per gap)

```markdown
---
reported-by: <Agent Name>
date: YYYY-MM-DD
priority: low | medium | high
status: candidate
---

# Skill Candidate: <skill-slug>

## Gap Description
<One paragraph: what task required this capability, and what was missing>

## Proposed Skill Name
`<skill-slug>`

## Proposed Description
<One sentence suitable for a SKILL.md `description:` field>

## Required Capabilities
- <Capability 1>
- <Capability 2>
- <Capability 3>

## Agents That Need This
- <Agent Name> (primary)
- <Agent Name> (also benefits)

## Example Use Case
<Concrete scenario where this skill would be invoked>

## Notes
<Any caveats, related existing skills, or reference links>
```

## How to File

```bash
# Ensure directory exists
mkdir -p /workspace/group/skill-candidates/

# Write candidate file
# Use Write tool with path /workspace/group/skill-candidates/<skill-slug>-candidate.md
```

## Priority Guidelines

| Priority | When |
|---|---|
| `high` | Blocking a current task or will block frequently |
| `medium` | Needed regularly but workaround exists |
| `low` | Would be nice to have; rare use case |

## After Filing

Send a brief Telegram notification:

```
mcp__nanoclaw__send_message(
  sender: "<Your Agent Name>",
  text: "Skill gap filed: *<skill-slug>* — <one-line description>. Priority: <level>."
)
```

Dan will route to Skill Link for review and commissioning.

## What NOT to File

- Skills that already exist in `/workspace/extra/nanoclaw/container/skills/` — check first
- One-off scripts that won't be reused
- Tool-specific quirks already documented in existing skills
- Gaps that can be covered by reading existing documentation

## Checking Existing Skills Before Filing

```bash
ls /workspace/extra/nanoclaw/container/skills/
find /workspace/extra/nanoclaw/container/skills -name "SKILL.md" | xargs grep -li "<keyword>" 2>/dev/null
```
