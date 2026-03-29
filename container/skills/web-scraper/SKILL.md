---
name: web-scraper
description: Scrape web content using three tiers — WebFetch (static pages), agent-browser/Playwright (JS-heavy pages), and Python stdlib (bulk/structured). Covers robots.txt, rate limiting, anti-detection, and saving results to workspace.
allowed-tools: Bash(web-scraper:*), Read, Write, WebFetch
---

# Web Scraper

## Tier Selection — Which Tool to Use

| Situation | Tool |
|-----------|------|
| Static page, no JavaScript needed | **Tier 1 — WebFetch** |
| Page requires JS execution, user interactions, infinite scroll, SPAs | **Tier 2 — agent-browser** |
| Scraping 10+ URLs in bulk, parsing structured HTML tables, CSV output | **Tier 3 — Python stdlib** |
| Page blocks curl/requests (bot detection) | **Tier 2 — agent-browser** |

Always try Tier 1 first. Only escalate if the page is blank, missing data, or JS-rendered.

---

## Before You Scrape

### Check robots.txt

```bash
# Fetch and read the site's robots.txt before scraping
curl -sA "Mozilla/5.0 (compatible; ResearchBot/1.0)" https://example.com/robots.txt
```

Respect `Disallow` rules. If `Crawl-delay` is specified, honour it. If scraping is disallowed for your use case, do not proceed.

### Rate limiting rule

Add a delay between requests — minimum **1–2 seconds** for polite crawling, **3–5 seconds** for cautious crawling. Never hammer a server with back-to-back requests.

---

## Tier 1 — WebFetch (Simplest)

Use the built-in `WebFetch` tool for any static page. No code needed, no browser overhead. Best for: documentation, blog posts, news articles, API responses, any page that renders without JavaScript.

```
WebFetch url="https://example.com/article" prompt="Extract the main article text and all links"
```

WebFetch fetches the URL, converts HTML to Markdown, and lets you prompt over the content. It handles redirects and basic HTTP automatically.

**Limitations:** Does not execute JavaScript. If the page content is loaded dynamically (blank body in the response, `loading...` spinners, React/Vue/Angular SPAs), use Tier 2.

---

## Tier 2 — agent-browser (JS-Heavy Pages)

Use the `agent-browser` CLI when the page requires JavaScript execution, login sessions, cookie handling, or user interactions. The container has Chromium at `/usr/bin/chromium` and the `agent-browser` package installed globally.

### Environment (already set in container)

```bash
AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```

### Basic scrape: navigate and extract text

```bash
# Open page and get a snapshot of the DOM
agent-browser open https://example.com/products
agent-browser snapshot          # Full accessibility tree as text
agent-browser snapshot -i       # Interactive elements only (refs like @e1, @e2)
agent-browser snapshot -s "#main"  # Scope to a CSS selector
```

```bash
# Get text from a specific element
agent-browser get text @e1

# Get the full page HTML
agent-browser get html @e1

# Get a link URL
agent-browser get attr @e1 href

# Get the page title and current URL
agent-browser get title
agent-browser get url
```

### Wait for elements (use auto-wait, not sleep)

```bash
# Wait for a specific element to appear
agent-browser wait @e1

# Wait for text to appear anywhere on the page
agent-browser wait --text "Loaded"

# Wait for network activity to settle (good for SPAs)
agent-browser wait --load networkidle

# Wait for a URL pattern (after navigation)
agent-browser wait --url "**/dashboard"
```

Never use `agent-browser wait 5000` (arbitrary millisecond sleep) — always wait for a condition.

### Handling pagination

```bash
# Page 1
agent-browser open https://example.com/listings?page=1
agent-browser snapshot -i
agent-browser get html @e1  # Extract listing container

# Find and click "Next" button
agent-browser find text "Next" click
agent-browser wait --load networkidle
agent-browser snapshot -i   # Re-snapshot after navigation

# Repeat for each page, or increment ?page= parameter directly
```

For URL-based pagination, increment the query parameter in a loop using Tier 3 (Python) for efficiency.

### Taking screenshots

```bash
# Screenshot to a named path (save to workspace)
agent-browser screenshot /workspace/group/screenshot-$(date +%s).png

# Full-page screenshot
agent-browser screenshot --full /workspace/group/fullpage.png

# Save as PDF
agent-browser pdf /workspace/group/page.pdf
```

### Cookie/session handling

```bash
# Login and save session state
agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --url "**/dashboard"
agent-browser state save /workspace/group/auth.json

# Later — restore session and scrape behind login
agent-browser state load /workspace/group/auth.json
agent-browser open https://app.example.com/data
agent-browser snapshot
```

### Anti-detection: User-Agent

The `agent-browser` package uses a realistic browser User-Agent by default (Chromium). If a site still blocks you, run JavaScript to confirm:

```bash
agent-browser eval "navigator.userAgent"
```

If you need to set a custom UA for a Playwright script (see below), pass it in launch args.

### Inline Playwright script (when agent-browser CLI is insufficient)

For complex scraping logic (loops, conditional navigation, structured data extraction), write a Node.js script and run it directly:

```javascript
// /workspace/group/scrape.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.AGENT_BROWSER_EXECUTABLE_PATH || '/usr/bin/chromium',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
  ],
});

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

const page = await context.newPage();

const results = [];

const urls = [
  'https://example.com/page/1',
  'https://example.com/page/2',
];

for (const url of urls) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Extract data using locators
  const title = await page.title();
  const body = await page.locator('article').innerText().catch(() => '');

  results.push({ url, title, body });

  // Rate limit: wait 2 seconds between pages
  await new Promise(r => setTimeout(r, 2000));
}

await browser.close();

// Save results
import { writeFileSync } from 'fs';
writeFileSync('/workspace/group/scraped-results.json', JSON.stringify(results, null, 2));
console.log(`Scraped ${results.length} pages → /workspace/group/scraped-results.json`);
```

```bash
node /workspace/group/scrape.mjs
```

---

## Tier 3 — Python stdlib (Bulk / Structured Scraping)

Use Python when scraping many URLs in a loop, parsing HTML tables, or outputting CSV/JSON. Only stdlib is guaranteed (`urllib`, `html.parser`, `csv`, `json`) — do not assume `requests`, `beautifulsoup4`, or `lxml` are installed.

### Fetch a single page

```python
#!/usr/bin/env python3
# /workspace/group/fetch_page.py
import urllib.request
import time

def fetch(url, delay=2):
    """Fetch a URL with a realistic User-Agent and rate-limit delay."""
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
                          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status != 200:
                print(f"[WARN] {url} returned HTTP {resp.status}")
                return None
            html = resp.read().decode('utf-8', errors='replace')
            time.sleep(delay)  # Rate limit
            return html
    except urllib.error.HTTPError as e:
        print(f"[ERROR] HTTP {e.code} fetching {url}")
        return None
    except urllib.error.URLError as e:
        print(f"[ERROR] URL error fetching {url}: {e.reason}")
        return None
    except Exception as e:
        print(f"[ERROR] Unexpected error fetching {url}: {e}")
        return None
```

### Parse HTML with html.parser

```python
from html.parser import HTMLParser

class TableParser(HTMLParser):
    """Extract all table rows and cells from an HTML page."""
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.rows = []
        self.current_row = []
        self.current_cell = []

    def handle_starttag(self, tag, attrs):
        if tag == 'table': self.in_table = True
        elif tag == 'tr' and self.in_table: self.in_row = True
        elif tag in ('td', 'th') and self.in_row: self.in_cell = True

    def handle_endtag(self, tag):
        if tag == 'table':
            self.in_table = False
        elif tag == 'tr' and self.in_row:
            self.rows.append(self.current_row)
            self.current_row = []
            self.in_row = False
        elif tag in ('td', 'th') and self.in_cell:
            self.current_row.append(''.join(self.current_cell).strip())
            self.current_cell = []
            self.in_cell = False

    def handle_data(self, data):
        if self.in_cell:
            self.current_cell.append(data)


def extract_tables(html):
    parser = TableParser()
    parser.feed(html)
    return parser.rows
```

### Extract links

```python
from html.parser import HTMLParser

class LinkParser(HTMLParser):
    def __init__(self, base_url=''):
        super().__init__()
        self.links = []
        self.base_url = base_url

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            attrs_dict = dict(attrs)
            href = attrs_dict.get('href', '')
            if href and not href.startswith('#'):
                self.links.append(href)

def extract_links(html, base_url=''):
    parser = LinkParser(base_url)
    parser.feed(html)
    return parser.links
```

### Bulk scrape with CSV output

```python
#!/usr/bin/env python3
# /workspace/group/bulk_scrape.py
import csv
import json
import time
import urllib.request
from html.parser import HTMLParser

URLS = [
    'https://example.com/item/1',
    'https://example.com/item/2',
    'https://example.com/item/3',
]

OUTPUT_CSV  = '/workspace/group/scraped_data.csv'
OUTPUT_JSON = '/workspace/group/scraped_data.json'

def fetch(url, delay=2):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
            time.sleep(delay)
            return html
    except Exception as e:
        print(f'[ERROR] {url}: {e}')
        return None

class TitleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self._in_title = False
        self.title = ''
    def handle_starttag(self, tag, attrs):
        if tag == 'title': self._in_title = True
    def handle_endtag(self, tag):
        if tag == 'title': self._in_title = False
    def handle_data(self, data):
        if self._in_title: self.title += data

def get_title(html):
    p = TitleParser()
    p.feed(html)
    return p.title.strip()

results = []
for url in URLS:
    print(f'Fetching: {url}')
    html = fetch(url, delay=2)
    if html:
        title = get_title(html)
        results.append({'url': url, 'title': title, 'chars': len(html)})
        print(f'  → {title}')
    else:
        results.append({'url': url, 'title': '', 'chars': 0})

# Save JSON
with open(OUTPUT_JSON, 'w') as f:
    json.dump(results, f, indent=2)

# Save CSV
with open(OUTPUT_CSV, 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['url', 'title', 'chars'])
    writer.writeheader()
    writer.writerows(results)

print(f'\nDone. {len(results)} pages → {OUTPUT_JSON} and {OUTPUT_CSV}')
```

```bash
python3 /workspace/group/bulk_scrape.py
```

---

## Saving Scraped Content

Always save to a deterministic path so the agent can reference it later.

| Target | Path pattern |
|--------|-------------|
| Scraper vault (default) | `/workspace/extra/obsidian/MnemClaw/scraper/<slug>-YYYY-MM-DD.md` |
| Group workspace | `/workspace/group/<slug>-YYYY-MM-DD.json` |
| Temporary / one-off | `/workspace/group/scrape-<timestamp>.txt` |

```bash
# Example: save with today's date
DATE=$(date +%Y-%m-%d)
python3 /workspace/group/bulk_scrape.py
# script writes to OUTPUT_JSON defined inside
```

To save a Markdown note to the scraper vault:

```bash
DATE=$(date +%Y-%m-%d)
mkdir -p /workspace/extra/obsidian/MnemClaw/scraper
cat > /workspace/extra/obsidian/MnemClaw/scraper/example-site-${DATE}.md << 'EOF'
---
title: Web Scrape — Example Site
date: 2026-03-27
source: https://example.com
---

# Scraped Content

...paste or write content here...
EOF
```

---

## Error Handling Reference

| Error | Likely cause | Fix |
|-------|-------------|-----|
| Empty/blank page body | JavaScript-rendered content | Escalate to Tier 2 |
| HTTP 403 Forbidden | Missing or blocked User-Agent | Add realistic UA header |
| HTTP 429 Too Many Requests | Rate-limited | Increase delay to 5–10s, add jitter |
| HTTP 404 | Bad URL or page removed | Skip and log, continue |
| Timeout | Slow server or heavy page | Increase timeout, retry once |
| `--no-sandbox` required | Container/Docker environment | Always include in Playwright launch args |
| Element not found (Playwright) | Element not yet rendered | Use `agent-browser wait @selector` not sleep |
| `robots.txt` disallows | Ethical/legal constraint | Do not scrape; use official API or data export |

---

## Notes

- Always set a realistic `User-Agent`. Default Python `urllib` and `curl` UAs are commonly blocked.
- Respect `robots.txt` and `Crawl-delay` values. Scraping disallowed paths may violate the site's ToS.
- Add `--no-sandbox --disable-gpu --disable-dev-shm-usage` to every Playwright launch inside the container — these are required and safe in this environment.
- Use Playwright's auto-wait locators (`page.locator(...).innerText()`) rather than `waitForTimeout`. Auto-wait is faster and more reliable.
- For large scraping jobs (100+ pages), log progress to a file and resume from checkpoint if the job fails mid-way.
- Store credentials and session files in `/workspace/group/` (never commit them to git).
