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

Every scrape goes to `/workspace/extra/obsidian/MnemClaw/scrapes/<site-folder>/` — one subfolder per website, one `.md` file per page, plus a `<site>.csv` with one row per page.

### Folder structure

```
scrapes/
└── onedoc/
    ├── CRAWL_STATUS.json     ← resumable crawl state (see below)
    ├── onedoc.csv            ← one row per entry, all attributes as columns
    ├── MAP.md                ← index (create when 3+ files exist)
    └── dr-med-saskia-herrmann.md
    └── ...
```

### Markdown note format (one per page)

Extract all available structured fields from the scraped content and put them in YAML front-matter. Body should be a clean human-readable summary.

```python
import os, re, datetime, unicodedata

def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")

def save_page(site_folder, slug, fields: dict, body: str):
    """
    site_folder: e.g. "onedoc"
    slug:        unique slug for this page (from URL or title)
    fields:      dict of all extracted structured attributes
    body:        clean markdown body text
    """
    today = datetime.date.today().isoformat()
    vault_dir = f"/workspace/extra/obsidian/MnemClaw/scrapes/{site_folder}"
    os.makedirs(vault_dir, exist_ok=True)

    # Build YAML front-matter from all fields
    yaml_lines = ["---"]
    for k, v in fields.items():
        if isinstance(v, list):
            yaml_lines.append(f"{k}:")
            for item in v:
                yaml_lines.append(f"  - {item}")
        elif isinstance(v, bool):
            yaml_lines.append(f"{k}: {'true' if v else 'false'}")
        else:
            safe = str(v).replace('"', '\\"')
            yaml_lines.append(f'{k}: "{safe}"')
    yaml_lines += [
        f'scraped: "{today}"',
        'maturity: raw',
        'status: inbox',
        'tags:',
        '  - web-scrape',
        '  - firecrawl',
        f'  - {site_folder}',
        '---',
    ]

    note = "\n".join(yaml_lines) + f"\n\n{body}\n\n---\n\n## JTAG Annotation\n\n- **Type**: Web Scrape\n- **Scope**: {site_folder}\n- **Maturity**: Raw\n- **Cross-links**: [[{site_folder} MAP]]\n"

    path = f"{vault_dir}/{slug}.md"
    with open(path, "w") as f:
        f.write(note)
    return path
```

### CSV export (one row per page, all attributes as columns)

Use `csv.DictWriter` with `extrasaction="ignore"`. Multi-value fields (lists) as semicolon-separated strings. **Always open in append mode with `newline=""`** so partial runs don't lose data.

```python
import csv, os

def append_to_csv(site_folder, fieldnames, row: dict):
    csv_path = f"/workspace/extra/obsidian/MnemClaw/scrapes/{site_folder}/{site_folder}.csv"
    write_header = not os.path.exists(csv_path)
    # Flatten lists to semicolon strings
    flat = {k: (";".join(v) if isinstance(v, list) else v) for k, v in row.items()}
    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        if write_header:
            writer.writeheader()
        writer.writerow(flat)
```

---

## Resumable crawl status

For any bulk scrape, maintain a compact `CRAWL_STATUS.json` in the site folder. Read it at the start of every run to skip already-completed URLs. Write it after every saved page.

### Format

```json
{
  "site": "onedoc",
  "started": "2026-04-01",
  "updated": "2026-04-01T19:30:00",
  "total_discovered": 850,
  "done": ["slug-1", "slug-2", "..."],
  "failed": [{"slug": "slug-x", "url": "...", "error": "timeout"}],
  "queue": ["slug-3", "slug-4", "..."]
}
```

### Usage pattern

```python
import json, os, datetime

STATUS_PATH = "/workspace/extra/obsidian/MnemClaw/scrapes/{site}/{site}.CRAWL_STATUS.json"

def load_status(site):
    path = STATUS_PATH.format(site=site)
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {"site": site, "started": datetime.date.today().isoformat(),
            "done": [], "failed": [], "queue": []}

def save_status(site, status):
    path = STATUS_PATH.format(site=site)
    status["updated"] = datetime.datetime.now().isoformat(timespec="seconds")
    with open(path, "w") as f:
        json.dump(status, f, indent=2)

# At start of run:
status = load_status("onedoc")
done_set = set(status["done"])

# Before scraping each URL:
if slug in done_set:
    continue  # already done — skip

# After saving a page successfully:
status["done"].append(slug)
save_status("onedoc", status)
```

---

## Rules

- Always set `FIRECRAWL_URL="${FIRECRAWL_API_URL:-http://host.docker.internal:3002}"` at the top of each script block
- Use `"onlyMainContent": true` (default) for research — strips ads, nav, footers
- **Always use `"waitFor": 2000`–`5000` ms** for JS-heavy pages to capture dynamically rendered data (addresses, phone numbers, prices, etc.)
- Batch scrape rather than looping single scrapes when you have 5+ URLs
- **Save to `scrapes/<site-folder>/`** — one subfolder per website, never dump files in the scrapes root
- **One `.md` per page** with all structured attributes in YAML front-matter
- **One CSV per site** (`<site>.csv`) — append mode, one row per page, all attributes as columns
- **Maintain `CRAWL_STATUS.json`** — write after every saved page so any interruption is resumable
- Update `QUEUE.md` when starting/pausing/completing bulk scrape tasks
