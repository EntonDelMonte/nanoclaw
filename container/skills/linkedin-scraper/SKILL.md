---
name: linkedin-scraper
description: Scrape LinkedIn profiles, companies, jobs, and posts via the linkedin-mcp-server running on the host Mac. Exposes tools as mcp__linkedin__* in the container agent. Save results to /workspace/extra/obsidian/MnemClaw/scrapes/linkedin/.
allowed-tools: mcp__linkedin__*, Write, Bash
---

# LinkedIn Scraper

LinkedIn data access via the `linkedin-mcp-server` (by stickerdaniel), running on the Mac host in streamable-HTTP mode. The container calls it through `host.docker.internal:8080`.

> **Prerequisite**: The server must be running on the host before using any tools below. See setup in the NanoClaw agent-runner config and the host launchd service.

---

## Available Tools (`mcp__linkedin__*`)

| Tool | What it does |
|------|-------------|
| `mcp__linkedin__get_person_profile` | Full profile: experience, education, interests, contact_info, posts |
| `mcp__linkedin__get_company_profile` | Company info, posts, jobs |
| `mcp__linkedin__get_company_posts` | Recent posts from a company feed |
| `mcp__linkedin__search_people` | Search people by keyword + optional location |
| `mcp__linkedin__search_jobs` | Search jobs by keyword + location |
| `mcp__linkedin__get_job_details` | Full job posting details |
| `mcp__linkedin__get_sidebar_profiles` | Profiles suggested by LinkedIn on a profile page |
| `mcp__linkedin__get_inbox` | List recent conversations |
| `mcp__linkedin__get_conversation` | Read a conversation by username or thread ID |
| `mcp__linkedin__search_conversations` | Search messages by keyword |
| `mcp__linkedin__send_message` | Send a message (requires confirmation) |
| `mcp__linkedin__connect_with_person` | Send a connection request with optional note |
| `mcp__linkedin__close_session` | Close the browser session cleanly |

---

## Common Usage Patterns

### Scrape a person profile

```
mcp__linkedin__get_person_profile({
  "profile_url": "https://www.linkedin.com/in/username/",
  "sections": ["experience", "education", "contact_info", "posts"]
})
```

Sections available: `experience`, `education`, `interests`, `honors`, `languages`, `contact_info`, `posts`

### Scrape a company

```
mcp__linkedin__get_company_profile({
  "company_url": "https://www.linkedin.com/company/anthropic/",
  "sections": ["posts", "jobs"]
})
```

### Search people

```
mcp__linkedin__search_people({
  "keywords": "machine learning engineer",
  "location": "Basel"
})
```

### Search jobs

```
mcp__linkedin__search_jobs({
  "keywords": "software engineer",
  "location": "Zürich"
})
```

---

## Saving Results to the Vault

Always save scraped data to the `scrapes/linkedin/` subfolder following the standard scrapes structure:

```
/workspace/extra/obsidian/MnemClaw/scrapes/linkedin/
├── MAP.md
├── firstname-lastname.md       ← person profiles
├── company-name.md             ← company profiles
└── jobs-keyword-city.md        ← job search results
```

### Person profile note template

```markdown
---
title: "Firstname Lastname"
tags: [linkedin, person, role/engineer, industry/tech]
description: "LinkedIn profile — Role at Company, City"
source_url: https://www.linkedin.com/in/username/
company: Company Name
role: Job Title
location: City, Country
created: YYYY-MM-DD
updated: YYYY-MM-DD
maturity: seed
status: scraped
---

**Name**: Firstname Lastname
**Role**: Job Title at Company
**Location**: City, Country
**Contact**: email@example.com (if public)

## Experience
- Role — Company (dates)

## Education
- Degree — Institution (dates)

## JTAG Annotation
- Type: data-record
- Scope: linkedin-person
- Maturity: seed
- Cross-links: [[linkedin-MAP]]
- Key Components: experience, education, contact
```

### Company profile note template

```markdown
---
title: "Company Name"
tags: [linkedin, company, industry/healthtech]
description: "LinkedIn company profile — Company Name"
source_url: https://www.linkedin.com/company/slug/
industry: Healthtech
employees: "51-200"
location: City, Country
created: YYYY-MM-DD
updated: YYYY-MM-DD
maturity: seed
status: scraped
---

**Company**: Company Name
**Industry**: Healthtech
**Size**: 51–200 employees
**HQ**: City, Country
**Website**: https://example.com

## Recent Posts
- Summary of recent activity

## JTAG Annotation
- Type: data-record
- Scope: linkedin-company
- Maturity: seed
- Cross-links: [[linkedin-MAP]]
- Key Components: industry, size, posts
```

---

## Rate Limiting & Ethics

- Add **3–5 second delays** between requests — LinkedIn detects rapid sequential calls
- Do not scrape more than **20 profiles per session** — close the session between runs
- Always call `mcp__linkedin__close_session` when done
- Only scrape public data or data from your own connections
- Do not use for mass connection requests or automated messaging without user confirmation

---

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `authentication-in-progress` | Browser profile loading | Wait 10–15s and retry |
| `session expired` | Profile cookie stale | Run `uvx linkedin-scraper-mcp --login` on Mac host, restart service |
| `rate limited` | Too many requests | Wait 60s, reduce request rate |
| `profile not found` | Private/deleted profile | Skip and log |
| `connection refused` | Server not running | Start the host service (see setup) |

---

## Setup Reference

The server runs on the Mac host as a launchd service (`com.nanoclaw.linkedin-mcp`).
Config in `/workspace/extra/nanoclaw/linkedin-mcp/`.

To restart the server manually on the Mac:
```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw.linkedin-mcp
```

To re-authenticate (if session expires):
```bash
uvx linkedin-scraper-mcp --login
launchctl kickstart -k gui/$(id -u)/com.nanoclaw.linkedin-mcp
```
