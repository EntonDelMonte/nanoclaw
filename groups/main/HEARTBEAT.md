---
last_updated: 2026-03-24 06:28 CET
system:
  github_user: mnemclaw
  obsidian_vault: /workspace/extra/obsidian
  nanoclaw_project: /workspace/extra/nanoclaw

agents:
  dan:
    model: claude-haiku (primary) / claude-sonnet (complex)
    status: active
    last_task: identity updated to Dan, context window management added
  researcher:
    model: kimi-k2-thinking (primary) / claude-sonnet-4-6 / qwen3.5:9b (fallback)
    status: idle
    last_task: ~
  developer:
    model: claude-sonnet
    status: idle
    last_task: ~
  release_manager:
    model: claude-haiku
    status: idle
    last_task: ~
  marketer:
    model: claude-haiku
    status: idle
    last_task: ~
  local_coder:
    model: ollama/qwen3.5:9b
    status: idle
    last_task: ~
  skill_link:
    model: deepseek-v3.1-terminus (primary) / claude-sonnet-4-6 / qwen3.5:9b (fallback)
    status: idle
    last_task: wrote 28 container skills across all agents
  tribe_hub:
    model: mistral-large-3 (primary) / claude-sonnet-4-6 / qwen3.5:9b (fallback)
    status: idle
    last_task: 5 community skills written
  growth_agent:
    model: minimax-m2.1:cloud (primary) / deepseek-r1-0528 / qwen3.5:9b (fallback)
    status: idle
    last_task: 7 growth/analytics skills written

projects:
  - name: ArtDB
    status: research complete
    phase: manifest done, awaiting kickoff
    blockers: ~
  - name: les-digitales-basel
    status: research complete
    phase: funding shortlist written
    blockers: ~
  - name: mnem-linkpage
    status: complete ✅
    phase: released on GitHub Pages
    blockers: ~

pending:
  - task: Fork EntonDelMonte/littlelink-fo into mnemclaw
    status: blocked
    blocker: Repo is private — collaborator invite not yet accepted. EntonDelMonte must add mnemclaw via GitHub Settings > Collaborators.

notes: |
  2026-03-24:
  - 28 container skills written and indexed in MAP.md
  - Self-improvement loop live: /workspace/group/skill-candidates/
  - Pool bot IPC wiring pending (initBotPool + sendPoolMessage in telegram.ts, IPC sender routing TBD)
  - Architecture.md updated in vault docs/
  - map-maintenance skill: general-purpose MAP.md skill for skills folder + vault
  - Deep research protocol added to Researcher
  - Skill Link: monitoring skill-candidates/ inbox asynchronously
  - DEFAULTS.md: TLA + kebab-case naming conventions defined
  - HAD project folder created for Human Agent Database
  - Frontmatter inheritance proposal written

  2026-03-22:
  - Agent registry restructured: flat agents/ directory under groups/main/
  - Swarm agents: Researcher, Lead Developer, Local Coder, Release Manager, Marketer, Skill Link, Tribe Hub, Growth Agent
  - groups/telegram_main merged into groups/main — single source of truth
  - Project files mapped to MnemClaw/projects/<ProjectName>/ in vault
  - skills-library mount added: /workspace/extra/skills-library (read-only)
  - Heartbeat scheduled tasks created: 08:00, 12:00, 18:00 CET daily
