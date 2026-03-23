---
last_updated: 2026-03-22 20:57 CET
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
    model: minimax-m2:cloud (primary) / claude-sonnet-4-6 / qwen3.5:9b (fallback)
    status: idle
    last_task: ~

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
  2026-03-22:
  - Agent registry restructured: flat agents/ directory under groups/main/
  - Swarm agents: Researcher, Lead Developer, Local Coder, Release Manager, Marketer, Skill Link, Tribe Hub, Growth Agent
  - groups/telegram_main merged into groups/main — single source of truth
  - Project files mapped to MnemClaw/projects/<ProjectName>/ in vault
  - skills-library mount added: /workspace/extra/skills-library (read-only)
  - Heartbeat scheduled tasks created: 08:00, 12:00, 18:00 CET daily
