---
name: social-sentiment-monitor
description: Monitor community mentions and conversations on Reddit, X (Twitter), and Telegram public channels using the agent-browser and web search tools.
allowed-tools: Bash(social-sentiment-monitor:*), WebSearch, Read, Write
---
# Social Sentiment Monitor

## Overview

Systematically scan Reddit, X (Twitter), and Telegram public channels for mentions of a project, keyword, or brand. Collects raw mentions, threads, and conversation snippets for downstream sentiment classification. Designed for Tribe Hub's community monitoring workflow.

## Prerequisites

- `agent-browser` skill available (for authenticated or JS-heavy pages)
- `WebSearch` tool available (for quick surface-level mention scans)
- Optional: Reddit API credentials (`REDDIT_CLIENT_ID`, `REDDIT_SECRET`) for higher rate limits via `curl`
- Optional: X/Twitter API bearer token (`TWITTER_BEARER_TOKEN`) for search API

## Usage

### Keyword scan across all platforms

Invoke this skill, then pass the target keywords and project name. The skill will:

1. Search Reddit via the public JSON API (no auth needed for read-only)
2. Search X via public web search or API if token available
3. Scan Telegram via `t.me` public channel search
4. Return a structured list of mentions with: platform, url, timestamp, snippet, author

### Reddit — public JSON search

```bash
# Search Reddit without auth (rate-limited to ~60 req/min)
curl -s -H "User-Agent: MnemClaw/1.0" \
  "https://www.reddit.com/search.json?q=KEYWORD&sort=new&limit=25&t=day" \
  | jq '.data.children[] | {platform:"reddit", url:.data.url, author:.data.author, title:.data.title, body:.data.selftext[:200], created:.data.created_utc}'

# Search a specific subreddit
curl -s -H "User-Agent: MnemClaw/1.0" \
  "https://www.reddit.com/r/SUBREDDIT/search.json?q=KEYWORD&restrict_sr=1&sort=new&limit=25" \
  | jq '.data.children[] | {platform:"reddit/r/SUBREDDIT", url:.data.url, author:.data.author, title:.data.title}'
```

### X (Twitter) — API v2 recent search

```bash
# Requires TWITTER_BEARER_TOKEN
curl -s -H "Authorization: Bearer $TWITTER_BEARER_TOKEN" \
  "https://api.twitter.com/2/tweets/search/recent?query=KEYWORD%20-is%3Aretweet&max_results=20&tweet.fields=created_at,author_id,text" \
  | jq '.data[] | {platform:"twitter", id:.id, text:.text, created:.created_at}'
```

If no API token: use `WebSearch` with query `"KEYWORD" site:twitter.com OR site:x.com` and extract results.

### Telegram — public channel search

```bash
# Use agent-browser to scan public Telegram channels
# Open channel: agent-browser open https://t.me/s/CHANNEL_NAME
# Then snapshot and extract text content
```

Use `WebSearch` with `"KEYWORD" site:t.me` to discover relevant public channels first.

## Examples

### Full scan for a project named "NanoClaw"

```bash
# Reddit
curl -s -H "User-Agent: MnemClaw/1.0" \
  "https://www.reddit.com/search.json?q=nanoclaw&sort=new&limit=10&t=week" \
  | jq '.data.children[] | {platform:"reddit", title:.data.title, url:.data.url, created:.data.created_utc}'

# X via WebSearch fallback
# Use WebSearch tool: query = '"nanoclaw" site:x.com OR site:twitter.com'
```

## Output Format

Return mentions as a JSON array:

```json
[
  {
    "platform": "reddit",
    "url": "https://reddit.com/r/...",
    "author": "username",
    "timestamp": "2026-03-23T10:00:00Z",
    "snippet": "First 200 chars of post/comment...",
    "keyword_matched": "nanoclaw"
  }
]
```

Pass this array to the `sentiment-analysis` skill for classification.

## Notes

- Reddit public API: no auth required, 60 req/min limit. For higher volume use OAuth2 app credentials.
- X API: free tier allows 500k tweet reads/month on basic plan. Bearer token required.
- Telegram: only public channels accessible without user account. Use `t.me/s/CHANNEL` URL pattern for web-readable view.
- Discord: no public search API — monitor via bot integration, not this skill.
- Always respect platform rate limits. Add `sleep 1` between bulk requests.
- Do not store raw PII (email addresses, phone numbers) from scraped content.
