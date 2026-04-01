---
name: firecrawl
description: Deep web scraping, full-site crawling, screenshots, and PDF parsing via local self-hosted Firecrawl. Use for JS-rendered pages, large-scale scrapes, or when agent-browser is too slow or verbose.
allowed-tools: Bash
---

# Firecrawl

Firecrawl extracts clean Markdown, structured data, screenshots, and PDFs from any URL — including JS-rendered pages and SPAs. Prefer it over agent-browser for research tasks that need clean text output at scale.

**Self-hosted — no API key required.**

```bash
FIRECRAWL_URL="${FIRECRAWL_API_URL:-http://host.docker.internal:3002}"
```

---

## When to use Firecrawl vs alternatives

| Situation | Tool |
|-----------|------|
| Single page, static HTML | WebFetch |
| Single page, JS-rendered or login-gated | **Firecrawl scrape** |
| Full-site crawl for research | **Firecrawl crawl** |
| Screenshot of a page | **Firecrawl scrape** (screenshot format) |
| Form interaction, step-by-step navigation | agent-browser |
| Bulk URLs, structured output | **Firecrawl batch scrape** |

---

## 1 — Scrape a single URL

Returns clean Markdown by default. Use for research, content extraction, PDF parsing.

```bash
FIRECRAWL_URL="${FIRECRAWL_API_URL:-http://host.docker.internal:3002}"
curl -s -X POST "$FIRECRAWL_URL/v1/scrape" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "formats": ["markdown"]
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['markdown'])"
```

### Request options

```json
{
  "url": "https://example.com",
  "formats": ["markdown", "html", "screenshot", "screenshot@fullPage", "links"],
  "onlyMainContent": true,
  "waitFor": 2000,
  "timeout": 30000,
  "mobile": false,
  "skipTlsVerification": false,
  "headers": { "Cookie": "session=abc" }
}
```

- `formats`: any combination of `markdown`, `html`, `screenshot`, `screenshot@fullPage`, `links`, `rawHtml`
- `onlyMainContent`: strip nav/footer/ads (default `true`)
- `waitFor`: ms to wait for JS to render
- `mobile`: simulate mobile viewport

### Parse PDF from URL

```bash
FIRECRAWL_URL="${FIRECRAWL_API_URL:-http://host.docker.internal:3002}"
curl -s -X POST "$FIRECRAWL_URL/v1/scrape" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/report.pdf", "formats": ["markdown"]}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['markdown'])"
```

### Take a screenshot

```bash
FIRECRAWL_URL="${FIRECRAWL_API_URL:-http://host.docker.internal:3002}"
curl -s -X POST "$FIRECRAWL_URL/v1/scrape" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "formats": ["screenshot@fullPage"]}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['screenshot'])"
# Returns a URL to the screenshot image
```

---

## 2 — Crawl a website

Crawl all pages under a URL. Returns a job ID; poll until complete.

```bash
FIRECRAWL_URL="${FIRECRAWL_API_URL:-http://host.docker.internal:3002}"

# Start crawl
JOB=$(curl -s -X POST "$FIRECRAWL_URL/v1/crawl" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://docs.example.com",
    "limit": 50,
    "maxDepth": 3,
    "scrapeOptions": { "formats": ["markdown"], "onlyMainContent": true }
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Crawl started: $JOB"

# Poll until complete
python3 - <<EOF
import time, urllib.request, json, os

base_url = os.environ.get("FIRECRAWL_API_URL", "http://host.docker.internal:3002")
job_id = "$JOB"

while True:
    req = urllib.request.Request(f"{base_url}/v1/crawl/{job_id}")
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
    status = data["status"]
    print(f"Status: {status} — {data.get('completed',0)}/{data.get('total','?')} pages")
    if status == "completed":
        for page in data["data"]:
            print(f"\n## {page['metadata'].get('title','(no title)')}\n{page['url']}\n")
            print(page["markdown"][:500])
        break
    elif status == "failed":
        print("Crawl failed:", data)
        break
    time.sleep(5)
EOF
```

### Crawl options

```json
{
  "url": "https://example.com",
  "limit": 100,
  "maxDepth": 5,
  "allowBackwardLinks": false,
  "allowExternalLinks": false,
  "includePaths": ["/blog/*", "/docs/*"],
  "excludePaths": ["/admin/*", "/login"],
  "scrapeOptions": {
    "formats": ["markdown"],
    "onlyMainContent": true
  }
}
```

---

## 3 — Map a website (URL discovery only)

Get all URLs from a site without scraping content. Fast, lightweight.

```bash
FIRECRAWL_URL="${FIRECRAWL_API_URL:-http://host.docker.internal:3002}"
curl -s -X POST "$FIRECRAWL_URL/v1/map" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "limit": 200}' \
  | python3 -c "import sys,json; [print(u) for u in json.load(sys.stdin)['links']]"
```

---

## 4 — Batch scrape (multiple URLs)

Scrape many URLs efficiently. Returns a job ID; poll for results.

```bash
python3 - <<'EOF'
import urllib.request, json, os, time

base_url = os.environ.get("FIRECRAWL_API_URL", "http://host.docker.internal:3002")
urls = [
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3"
]

# Start batch
payload = json.dumps({"urls": urls, "formats": ["markdown"]}).encode()
req = urllib.request.Request(
    f"{base_url}/v1/batch/scrape",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST"
)
with urllib.request.urlopen(req) as r:
    job_id = json.loads(r.read())["id"]

print(f"Batch job: {job_id}")

# Poll
while True:
    req = urllib.request.Request(f"{base_url}/v1/batch/scrape/{job_id}")
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
    print(f"Status: {data['status']} — {data.get('completed',0)}/{data.get('total','?')}")
    if data["status"] == "completed":
        for page in data["data"]:
            print(f"\n### {page['url']}\n{page['markdown'][:300]}")
        break
    time.sleep(3)
EOF
```

---

## Error handling

```python
import json, urllib.request, urllib.error, os

def firecrawl_scrape(url):
    base_url = os.environ.get("FIRECRAWL_API_URL", "http://host.docker.internal:3002")
    payload = json.dumps({"url": url, "formats": ["markdown"]}).encode()
    req = urllib.request.Request(
        f"{base_url}/v1/scrape",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
            return data["data"]["markdown"]
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise RuntimeError(f"Firecrawl error {e.code}: {body}")
```

Common errors:
- `429` — rate limited; add `time.sleep(2)` between requests
- `timeout` — add `"waitFor": 5000` for slow JS pages
- Connection refused — Firecrawl may be down; check with `curl http://host.docker.internal:3002/health`

---

## Vault archiving pattern

After scraping, save to vault using the standard note format:

```python
import os, datetime

def save_scrape_to_vault(url, markdown, title):
    slug = title.lower().replace(" ", "-")
    today = datetime.date.today().isoformat()

    note = f"""---
title: "{title}"
source: "{url}"
scraped: {today}
maturity: raw
status: inbox
tags:
  - web-scrape
  - firecrawl
description: "Scraped content from {url}"
---

# {title}

> *Scraped from: `{url}` on {today}*

---

{markdown}

---

## JTAG Annotation
Type: Web Scrape
Scope: <topic>
Maturity: Raw — unreviewed scraped content
Cross-links: <[[related notes]]>
Key Components: <main topics found>
"""

    vault_path = f"/workspace/extra/obsidian/MnemClaw/scrapes/{slug}.md"
    os.makedirs(os.path.dirname(vault_path), exist_ok=True)
    with open(vault_path, "w") as f:
        f.write(note)
    print(f"Saved: {vault_path}")
```

---

## Rules

- Always set `FIRECRAWL_URL="${FIRECRAWL_API_URL:-http://host.docker.internal:3002}"` at the top of each script block
- Use `"onlyMainContent": true` (default) for research — strips ads, nav, footers
- For JS-heavy pages, add `"waitFor": 2000`–`5000` ms
- Batch scrape rather than looping single scrapes when you have 5+ URLs
- Save scraped content to `/workspace/extra/obsidian/MnemClaw/scrapes/` with proper JTAG front-matter
- Update `QUEUE.md` when starting/completing bulk scrape tasks
