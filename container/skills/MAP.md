---
title: Container Skills — Map of Content
description: Index of all installed container skills. Read this before searching for a skill.
updated: 2026-03-24
status: living document — Skill Link updates on every add/change
---

# Container Skills MAP

> *Skill Link: update this file whenever a skill is created, updated, or removed.*
> *All agents: read this before starting a task to identify relevant skills.*

---

## Vault & Knowledge

| Skill | Description |
|-------|-------------|
| `vault-search` | grep/find patterns for searching the Obsidian vault efficiently |
| `jtag-note-format` | YAML front-matter + JTAG Annotation template and field definitions |
| `map-maintenance` | Create and maintain MAP.md index files in any directory (vault, skills, projects) |
| `obsidian-wikilink` | WikiLink syntax, bidirectional linking, orphan detection |

---

## Development

| Skill | Description |
|-------|-------------|
| `github-operations` | Full git + gh CLI workflow: clone, branch, commit, PR, tag, release |
| `mammouth-api` | Mammouth OpenAI-compatible API: auth, curl/Python patterns, model fallback chain |
| `ollama-delegation` | mcp__ollama__ollama_generate delegation pattern and failure protocol |
| `unit-testing` | Vitest + React Testing Library: component tests, mocking, coverage |
| `web-self-testing` | Playwright headless E2E: container-safe flags, page objects, CI YAML |
| `plan-md-update` | vault plan.md update workflow: phase status, milestones, blockers |
| `skill-candidate-reporting` | Deposit skill discovery notes to /workspace/group/skill-candidates/ |

---

## Community & Growth

| Skill | Description |
|-------|-------------|
| `github-issue-triage` | gh CLI triage: list, classify, label issues/PRs; draft-only, no auto-post |
| `social-sentiment-monitor` | Monitor Reddit, X (Twitter), Telegram mentions; requires TWITTER_BEARER_TOKEN for X |
| `sentiment-analysis` | LLM classifier for 7 emotional signals with confidence scores and escalation flag |
| `community-response-draft` | Draft-then-approve workflow with tone templates per signal type |
| `sentiment-log` | Append-only structured sentiment log entries to vault analytics folder |

---

## Analytics & Market

| Skill | Description |
|-------|-------------|
| `ga4-analytics` | Google Analytics 4 Data API v1: traffic, funnels, retention, cohort data |
| `google-ads-api` | Google Ads API: campaign stats, CTR/CPC/ROAS, audience targeting |
| `linkedin-ads-api` | LinkedIn Marketing API: campaign analytics, impressions, clicks, conversions |
| `crypto-onchain-data` | CoinGecko, Etherscan, Dune Analytics, OpenSea data fetching |
| `market-signal-report` | Structured market signal output to vault analytics folder |
| `mirofish-oasis` | MiroFish-Offline local Docker setup + OASIS simulation via deepseek-r1 |

---

## Marketing Automation

| Skill | Description |
|-------|-------------|
| `mautic` | Mautic local Docker install + full API: contacts, segments, campaigns, emails |

---

## Content & Media

| Skill | Description |
|-------|-------------|
| `pdf-transcriber` | Extract text from PDFs page by page, archive as Markdown in vault |
| `youtube-transcriber` | Fetch YouTube transcripts, archive as Markdown in vault |
| `site-to-skill` | Crawl a site and extract design/content patterns into a skill file |
| `agent-browser` | Browser automation: research, screenshots, forms, web app testing |

---

## System

| Skill | Description |
|-------|-------------|
| `capabilities` | List installed skills, tools, and system info (read-only) |
| `status` | Health check: session context, mounts, tool availability, task snapshot |
