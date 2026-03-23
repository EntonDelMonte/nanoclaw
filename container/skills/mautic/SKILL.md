# Mautic — Local Docker Setup + API Operations

Run Mautic locally on your Mac via Docker Compose, and manage contacts, segments, campaigns, emails, and reports via the Mautic REST API. Used by the Growth Agent for all marketing automation tasks.

---

## Part 1 — Local Docker Installation

### Prerequisites

- Docker Desktop for Mac installed and running
- Docker Compose v2+

### docker-compose.yml

Create a directory `~/mautic/` and add this file:

```yaml
version: "3.8"

services:
  db:
    image: mysql:8.0
    container_name: mautic-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: mauticroot
      MYSQL_DATABASE: mautic
      MYSQL_USER: mautic
      MYSQL_PASSWORD: mauticpassword
    volumes:
      - mautic-db:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 10

  mautic:
    image: mautic/mautic:5-apache
    container_name: mautic
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "8080:80"
    environment:
      MAUTIC_DB_HOST: db
      MAUTIC_DB_PORT: 3306
      MAUTIC_DB_DATABASE: mautic
      MAUTIC_DB_USER: mautic
      MAUTIC_DB_PASSWORD: mauticpassword
      MAUTIC_TRUSTED_PROXIES: "[]"
    volumes:
      - mautic-data:/var/www/html
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/index.php"]
      interval: 30s
      timeout: 10s
      retries: 5

volumes:
  mautic-db:
  mautic-data:
```

### Start Mautic

```bash
cd ~/mautic
docker compose up -d

# Wait ~2 minutes for first-run setup, then open:
open http://localhost:8080
```

Complete the web installer:
1. Database settings are pre-configured via env vars — click "Next"
2. Create admin user: choose a username, email, and password
3. Note the credentials — these are your `MAUTIC_USER` and `MAUTIC_PASSWORD`

### Stop / Restart

```bash
docker compose stop        # stop without removing data
docker compose start       # restart
docker compose down        # stop and remove containers (data volumes persist)
docker compose down -v     # DANGER: removes all data
```

### Enable the API

1. Open http://localhost:8080/s/config/edit
2. Under **API Settings**, enable the API
3. Set **Authentication Method** to `HTTP Basic Auth` (easiest) or `OAuth2`
4. Save

---

## Part 2 — API Operations

### Environment Setup

```bash
export MAUTIC_BASE_URL="http://localhost:8080"
export MAUTIC_USER="your_admin_username"
export MAUTIC_PASSWORD="your_admin_password"
```

### Python Helper

```python
import os
import requests
from requests.auth import HTTPBasicAuth

BASE = os.environ["MAUTIC_BASE_URL"].rstrip("/")
AUTH = HTTPBasicAuth(os.environ["MAUTIC_USER"], os.environ["MAUTIC_PASSWORD"])

def mautic_get(path: str, params: dict = None) -> dict:
    r = requests.get(f"{BASE}/api{path}", auth=AUTH, params=params)
    r.raise_for_status()
    return r.json()

def mautic_post(path: str, data: dict) -> dict:
    r = requests.post(f"{BASE}/api{path}", auth=AUTH, json=data)
    r.raise_for_status()
    return r.json()

def mautic_patch(path: str, data: dict) -> dict:
    r = requests.patch(f"{BASE}/api{path}", auth=AUTH, json=data)
    r.raise_for_status()
    return r.json()

def mautic_delete(path: str) -> dict:
    r = requests.delete(f"{BASE}/api{path}", auth=AUTH)
    r.raise_for_status()
    return r.json()
```

---

### Contacts

```python
# Search contacts
results = mautic_get("/contacts", params={"search": "john@example.com"})
contacts = results["contacts"]

# Create contact
new_contact = mautic_post("/contacts/new", {
    "email": "user@example.com",
    "firstname": "John",
    "lastname": "Doe",
    "company": "Acme Corp",
    "tags": ["prospect", "demo-requested"],
})
contact_id = new_contact["contact"]["id"]

# Update contact
mautic_patch(f"/contacts/{contact_id}/edit", {
    "tags": {"add": ["qualified"], "remove": ["prospect"]},
    "lead_score": 50,
})

# Merge duplicates (merges source into target)
mautic_post(f"/contacts/{target_id}/merge/{source_id}", {})

# Delete contact (🔴 requires Dan approval for bulk ops)
mautic_delete(f"/contacts/{contact_id}/delete")

# Get contact history
history = mautic_get(f"/contacts/{contact_id}/activity")
```

### Segments

```python
# List all segments
segments = mautic_get("/segments")

# Add contact to segment
mautic_post(f"/segments/{segment_id}/contact/{contact_id}/add", {})

# Remove contact from segment
mautic_post(f"/segments/{segment_id}/contact/{contact_id}/remove", {})

# Create dynamic segment by filter
new_segment = mautic_post("/segments/new", {
    "name": "High Score Prospects",
    "description": "Contacts with score > 50 who visited pricing",
    "filters": [
        {
            "glue": "and",
            "field": "lead_score",
            "object": "lead",
            "type": "number",
            "filter": "50",
            "display": "",
            "operator": "gt",
        }
    ],
    "isPublished": True,
})
```

### Campaigns

```python
# List campaigns
campaigns = mautic_get("/campaigns")

# Get campaign contacts
contacts = mautic_get(f"/campaigns/{campaign_id}/contacts")

# Add contact to campaign
mautic_post(f"/campaigns/{campaign_id}/contact/{contact_id}/add", {})

# Clone campaign (use API + manual name update)
# Note: Campaign cloning is done via the UI — use API to get details and recreate

# Pause campaign (set isPublished = false)
mautic_patch(f"/campaigns/{campaign_id}/edit", {"isPublished": False})

# Resume campaign
mautic_patch(f"/campaigns/{campaign_id}/edit", {"isPublished": True})
```

### Emails

```python
# List emails
emails = mautic_get("/emails")

# Get email stats (open rate, click rate)
email_stats = mautic_get(f"/emails/{email_id}/stats")
print(f"Sent: {email_stats.get('totalSent')} | Open rate: {email_stats.get('openRate'):.2%}")

# Create email
new_email = mautic_post("/emails/new", {
    "name": "Welcome Series — Email 1",
    "subject": "Welcome to {contactfield=company}!",
    "fromAddress": "hello@yourdomain.com",
    "fromName": "Your Name",
    "customHtml": "<html><body><p>Hello {contactfield=firstname}!</p></body></html>",
    "isPublished": False,
})

# Send email to segment (🟡 confirm with Dan for >100 contacts)
mautic_post(f"/emails/{email_id}/send", {
    "segments": [segment_id],
})
```

### Lead Scoring

```python
# Read contact score
contact = mautic_get(f"/contacts/{contact_id}")
score = contact["contact"]["points"]

# Adjust score (add points via campaign action — not directly patchable)
# Use the campaign trigger approach or tag-based rules in Mautic UI
```

### Reports

```python
# List available reports
reports = mautic_get("/reports")

# Get specific report data
report_data = mautic_get(f"/reports/{report_id}")
print(report_data["data"])
```

---

## Automation Workflow Design

Before touching the API for campaign changes:

1. Map goal → trigger → actions → exit conditions
2. Use segments as audience gates — check membership before enrolling
3. Favour updating existing campaigns over creating duplicates
4. Test with a single contact ID before applying to a full segment
5. Log all changes to `/workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/analytics/mautic-log.md`

---

## Authority Rules

| Action | Authority |
|--------|-----------|
| Sending to >100 contacts | 🔴 Ask Dan first |
| Deleting contacts or segments | 🔴 Ask Dan first |
| Changing live campaign logic | 🔴 Ask Dan first |
| Creating drafts, updating tags | 🟡 Proceed then confirm |
| Reading reports and stats | 🟢 Autonomous |
| Searching contacts | 🟢 Autonomous |

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `MAUTIC_BASE_URL` | Base URL — `http://localhost:8080` for local Docker |
| `MAUTIC_USER` | Admin username |
| `MAUTIC_PASSWORD` | Admin password |

---

## Useful Commands

```bash
# View Mautic logs
docker logs mautic -f

# Run Mautic CLI (cron jobs, cache clear)
docker exec mautic php /var/www/html/bin/console mautic:segments:update
docker exec mautic php /var/www/html/bin/console mautic:campaigns:update
docker exec mautic php /var/www/html/bin/console cache:clear

# Backup database
docker exec mautic-db mysqldump -u mautic -pmauticpassword mautic > ~/mautic-backup.sql
```

---

## Output to Vault

Log all Mautic operations to `/workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/analytics/mautic-log.md`
