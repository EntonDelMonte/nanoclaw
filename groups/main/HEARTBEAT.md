---
last_updated: 2026-03-24 20:30 CET
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
    model: deepseek-v3.1-terminus (primary) / claude-sonnet-4-6 / llama3.3:70b Ollama cloud (fallback)
    status: idle
    last_task: trsr project migrated from dox, TSR-mvp.md written, vercel-com site-to-skill crawled
  developer:
    model: qwen3-coder-plus (primary) / claude-sonnet-4-6 / qwen3:32b Ollama cloud (fallback)
    status: idle
    last_task: trsr Phase 1 complete — drops API, PostGIS queries, socket.io, drop markers, card, creation modal
copywriter:
    model: claude-haiku
    status: idle
    last_task: MTL brand voice guidelines + full site copy written and deployed
skill_link:
    model: deepseek-v3.1-terminus (primary) / claude-sonnet-4-6 / qwen3.5:9b (fallback)
    status: idle
    last_task: wrote 28 container skills across all agents
  tribe_hub:
    model: mistral-large-3 (primary) / claude-sonnet-4-6 / qwen3.5:9b (fallback)
    status: idle
    last_task: 5 community skills written
  growth_hacker:
    model: minimax-m2.1:cloud (primary) / deepseek-r1-0528 / qwen3.5:9b (fallback)
    status: idle
    last_task: 7 growth/analytics skills written

projects:
  - name: Human Agent Database (HAD)
    status: research complete
    phase: manifest migrated, awaiting kickoff
    blockers: ~
  - name: les-digitales-basel
    status: research complete
    phase: funding shortlist written
    blockers: ~
  - name: Motile (MTL)
    status: active
    phase: motile-website live on GitHub Pages — real copy deployed, brand voice in vault
    blockers: ~
  - name: trsr (TSR)
    status: active
    phase: Phase 1 complete — drops API, PostGIS, socket.io realtime, drop markers, card + voting, creation modal. API needs docker compose up locally; Vercel frontend auto-deployed.
    blockers: ~

pending: []

notes: |
  2026-03-24:
  - 28 container skills written and indexed in MAP.md
  - Self-improvement loop live: /workspace/group/skill-candidates/
  - Pool bot fix shipped: sender header prepended when setMyName rate-limited; built, needs NanoClaw restart
  - Architecture.md updated in vault docs/
  - map-maintenance skill: general-purpose MAP.md skill for skills folder + vault
  - Deep research protocol added to Researcher
  - Skill Link: monitoring skill-candidates/ inbox asynchronously
  - DEFAULTS.md: TLA + kebab-case naming conventions defined
  - HAD project folder created for Human Agent Database
  - Frontmatter inheritance proposal written

  2026-03-22:
  - Agent registry restructured: flat agents/ directory under groups/main/
  - Swarm agents: Researcher, Lead Developer, Copywriter, Skill Link, Tribe Hub, Growth Hacker
  - groups/telegram_main merged into groups/main — single source of truth
  - Project files mapped to MnemClaw/projects/<ProjectName>/ in vault
  - skills-library mount added: /workspace/extra/skills-library (read-only)
  - Heartbeat scheduled tasks created: 08:00, 12:00, 18:00 CET daily
