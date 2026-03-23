# Authority Table

> **SYSTEM RULE — READ BEFORE ACTING**
>
> This file is maintained exclusively by the user. No agent may modify it.
> All agents must consult this table before taking any action listed below.
> When in doubt, stop and ask — never assume consent.

---

## How Agents Must Apply This Table

1. **Before acting**, check whether the action appears in the 🔴 or 🟡 category.
2. **For 🔴 decisions**: stop, summarise the decision and options via `send_message`, and wait for explicit user confirmation before proceeding.
3. **For 🟡 decisions**: proceed, then immediately send a brief confirmation message.
4. **For 🟢 decisions**: act freely, no interruption needed.
5. **When uncertain**: treat the action as 🔴 and ask.

Subagents surface decisions to AlphaBot, who relays them to the user — never bypass AlphaBot for user-facing approvals.

---

## Phase 1 — Pre-Manifest (Idea to Validation)

| Decision | 🔴/🟡/🟢 | Owner → asks |
|---|---|---|
| Approving the idea brief (problem statement, vision, assumptions) | 🔴 | Researcher → AlphaBot |
| Validating user personas and target audience | 🔴 | Researcher → AlphaBot |
| Approving opportunity sizing and market research conclusions | 🔴 | Researcher → AlphaBot |
| Deciding to proceed to manifest (go/no-go on idea) | 🔴 | AlphaBot |
| Approving feasibility study trade-offs (technical, financial, operational) | 🔴 | Strategist → AlphaBot |
| Approving pitch deck before sharing externally | 🔴 | Marketer → AlphaBot |
| Scoping the MVP (what's in, what's out) | 🔴 | AlphaBot |
| Drafting idea brief, personas, research notes | 🟢 | Researcher |
| Running user interviews (internal analysis only) | 🟢 | Researcher |

---

## Phase 2 — Product Manifest (Foundation)

| Decision | 🔴/🟡/🟢 | Owner → asks |
|---|---|---|
| **Project name** | 🔴 | AlphaBot (always asks first) |
| Approving the product manifest (vision, goals, scope, success metrics) | 🔴 | AlphaBot |
| Technical architecture decisions at "points of no return" (stack, infra, database) | 🔴 | Developer → AlphaBot |
| Approving the v1 roadmap and milestone timeline | 🔴 | Strategist → AlphaBot |
| Business model selection (OSS / open core / freemium / closed) | 🔴 | Strategist → AlphaBot |
| Brand identity (name, logo, domain, tagline, visual identity) | 🔴 | AlphaBot |
| Swarm role assignments for the project | 🔴 | AlphaBot |
| Risk assessment decisions (accepting, mitigating, or deferring a risk) | 🔴 | Strategist → AlphaBot |
| Drafting manifest, roadmap, architecture overview | 🟡 | Researcher / Developer |
| Creating project folder structure in vault | 🟢 | Researcher |

---

## Phase 3 — Closed Launch (Alpha / Beta)

| Decision | 🔴/🟡/🟢 | Owner → asks |
|---|---|---|
| Approving the PRD before development begins | 🔴 | AlphaBot |
| Selecting beta testers (who gets access) | 🔴 | AlphaBot |
| Approving design specs before implementation (wireframes, mockups) | 🔴 | AlphaBot |
| Deciding to promote from alpha to beta | 🔴 | AlphaBot |
| Approving internal release notes before distribution | 🟡 | Release Manager → AlphaBot |
| Bug priority decisions (critical path vs. deferred) | 🟡 | Developer → AlphaBot |
| Development sprints, commits, internal builds | 🟢 | Developer |
| QA test execution and bug triage | 🟢 | Developer |
| Drafting PRD, design specs, test plans | 🟢 | Researcher / Developer |

---

## Phase 4 — Open Launch (Public Release)

| Decision | 🔴/🟡/🟢 | Owner → asks |
|---|---|---|
| Launch go/no-go | 🔴 | AlphaBot |
| Publishing to public (`npm publish`, GitHub release, making repo public, App Store) | 🔴 | Release Manager → AlphaBot |
| Approving press kit and press releases before distribution | 🔴 | Marketer → AlphaBot |
| Approving marketing collateral (website, social posts, ads, emails) before publishing | 🔴 | Marketer → AlphaBot |
| Authorising paid ad spend (budget, platform, targeting) | 🔴 | Marketer → AlphaBot |
| Influencer or partnership outreach | 🔴 | Marketer → AlphaBot |
| Pricing (setting initial prices, tiers, free limits) | 🔴 | Strategist → AlphaBot |
| Official community responses (GitHub issues, PRs, forums, social) | 🔴 | Community Manager → AlphaBot |
| Posting on social media or sending emails on behalf of the user | 🔴 | Marketer → AlphaBot |
| Drafting launch plan, press kit, onboarding docs, marketing collateral | 🟢 | Marketer / Researcher |
| Setting up analytics dashboards and KPI tracking | 🟢 | Analyst |

---

## Phase 5 — Scaling & Operations

| Decision | 🔴/🟡/🟢 | Owner → asks |
|---|---|---|
| Approving scaling roadmap (infrastructure, team, feature expansion) | 🔴 | Strategist → AlphaBot |
| Hiring or contracting (new team members, contractors, agencies) | 🔴 | AlphaBot |
| Partnerships and integrations (external agreements) | 🔴 | AlphaBot |
| Paid infrastructure changes (cloud tier upgrades, new services, CDN, databases) | 🔴 | Developer → AlphaBot |
| Domain registration or transfer | 🔴 | AlphaBot |
| Approving financial models, revenue projections, burn rate decisions | 🔴 | Strategist → AlphaBot |
| Changing prices or subscription tiers | 🔴 | Strategist → AlphaBot |
| Repo deletion or archiving | 🔴 | AlphaBot |
| Feature expansion decisions (what gets built next) | 🔴 | AlphaBot |
| Drafting scaling roadmap, customer success playbook, financial models | 🟢 | Strategist / Analyst |
| Infrastructure implementation within approved scope | 🟢 | Developer |
| Analytics reporting and performance reviews | 🟢 | Analyst |

---

## Phase 6 — Support & Maintenance

| Decision | 🔴/🟡/🟢 | Owner → asks |
|---|---|---|
| Publishing knowledge base articles or support docs publicly | 🟡 | Community Manager → AlphaBot |
| Changing SLA terms or support commitments | 🔴 | AlphaBot |
| Deprecating or sunsetting a feature | 🔴 | AlphaBot |
| Drafting FAQs, troubleshooting guides, tutorials | 🟢 | Community Manager / Researcher |
| Bug triage and issue prioritisation | 🟢 | Community Manager / Developer |
| Routine maintenance commits and patches | 🟢 | Developer |

---

## Skill Development (Cross-phase)

| Decision | 🔴/🟡/🟢 | Owner → asks |
|---|---|---|
| Creating a new `SKILL.md` in `container/skills/` | 🟡 | Skill Link → notifies user after |
| Updating an existing `SKILL.md` | 🟡 | Skill Link → notifies user after |
| Deleting or deprecating a skill | 🔴 | Skill Link → AlphaBot |
| Promoting a skill candidate from inbox to active skill | 🟡 | Skill Link → notifies user after |
| Authoring skills, searching local sources, testing commands | 🟢 | Skill Link |

---

## Trading (Cross-phase)

| Decision | 🔴/🟡/🟢 | Owner → asks |
|---|---|---|
| Any trade entry, exit, or rebalancing actually executed | 🔴 | Trader → AlphaBot |
| Strategy changes (new asset class, changed risk tolerance) | 🔴 | Trader → AlphaBot |
| Market research, signal generation, analysis, reporting | 🟢 | Trader |

---

## Always Autonomous (any phase)

| Action |
|---|
| Research, web searches, vault notes, reading files |
| Drafting any document — until the point of external publishing or execution |
| Internal commits on private branches not yet released |
| Updating HEARTBEAT.md and authority-table reads |
| Analytics, generating reports, reading metrics |
| Creating or updating NanoClaw scheduled tasks |
| Writing new NanoClaw skills — Skill Link notifies user immediately after creation or update |

---

*Last edited by: user — 2026-03-22 21:00 CET*
