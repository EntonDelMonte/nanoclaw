# LinkedIn Ads API — Campaign Analytics, Impressions, Clicks, Conversions

Fetch LinkedIn Ads campaign analytics via the LinkedIn Marketing API v2. Covers OAuth2 token setup, token refresh, and all reporting operations used by the Growth Agent.

---

## Prerequisites

### 1. Create a LinkedIn App

1. Go to https://www.linkedin.com/developers/apps/new
2. Create an app linked to a LinkedIn Company Page
3. Under **Products**, request access to:
   - **Marketing Developer Platform** (for Ads API — requires approval)
   - **Sign In with LinkedIn** (for OAuth token generation)
4. Note your `Client ID` and `Client Secret`

### 2. OAuth2 Token Setup (Local)

LinkedIn uses OAuth2 Authorization Code flow. Generate tokens locally:

```bash
pip install requests requests-oauthlib
```

```python
# generate_linkedin_token.py
import os
import webbrowser
from requests_oauthlib import OAuth2Session

CLIENT_ID = os.environ["LINKEDIN_CLIENT_ID"]
CLIENT_SECRET = os.environ["LINKEDIN_CLIENT_SECRET"]
REDIRECT_URI = "http://localhost:8080/callback"
SCOPES = ["r_ads", "r_ads_reporting", "rw_ads"]

oauth = OAuth2Session(CLIENT_ID, redirect_uri=REDIRECT_URI, scope=SCOPES)
auth_url, state = oauth.authorization_url("https://www.linkedin.com/oauth/v2/authorization")

print(f"Visit: {auth_url}")
webbrowser.open(auth_url)

# Paste the full redirect URL after authorization
redirect_response = input("Paste the full redirect URL here: ")
token = oauth.fetch_token(
    "https://www.linkedin.com/oauth/v2/accessToken",
    authorization_response=redirect_response,
    client_secret=CLIENT_SECRET,
)
print("Access token:", token["access_token"])
print("Refresh token:", token.get("refresh_token", "N/A — LinkedIn tokens expire in 60 days"))
print("Expires in:", token["expires_in"], "seconds")
```

### 3. Token Refresh

LinkedIn access tokens expire in 60 days. Refresh them before they expire:

```python
import requests
import os

def refresh_linkedin_token(refresh_token: str) -> dict:
    """Refresh LinkedIn OAuth2 access token using refresh token."""
    response = requests.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": os.environ["LINKEDIN_CLIENT_ID"],
            "client_secret": os.environ["LINKEDIN_CLIENT_SECRET"],
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    response.raise_for_status()
    return response.json()

# Usage
new_tokens = refresh_linkedin_token(os.environ["LINKEDIN_REFRESH_TOKEN"])
print("New access token:", new_tokens["access_token"])
print("New expiry:", new_tokens["expires_in"], "seconds")
```

Note: Refresh tokens themselves expire in 365 days. Store both tokens in env vars and rotate on use.

### 4. Set Environment Variables

```bash
export LINKEDIN_CLIENT_ID="your_client_id"
export LINKEDIN_CLIENT_SECRET="your_client_secret"
export LINKEDIN_ACCESS_TOKEN="your_access_token"
export LINKEDIN_REFRESH_TOKEN="your_refresh_token"
export LINKEDIN_ACCOUNT_ID="your_sponsored_account_id"  # numeric, without urn:li:
```

---

## Operations

### Helper — Authenticated Request

```python
import requests
import os

BASE_URL = "https://api.linkedin.com/v2"

def li_get(endpoint: str, params: dict = None) -> dict:
    headers = {
        "Authorization": f"Bearer {os.environ['LINKEDIN_ACCESS_TOKEN']}",
        "LinkedIn-Version": "202401",
    }
    response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, params=params)
    response.raise_for_status()
    return response.json()
```

### Get Ad Account Info

```python
data = li_get(
    "/adAccountsV2",
    params={"q": "search", "search.type.values[0]": "BUSINESS"}
)
for account in data.get("elements", []):
    print(account["id"], account["name"], account["currency"])
```

### List Campaigns

```python
account_urn = f"urn:li:sponsoredAccount:{os.environ['LINKEDIN_ACCOUNT_ID']}"
data = li_get(
    "/adCampaignsV2",
    params={
        "q": "search",
        "search.account.values[0]": account_urn,
        "search.status.values[0]": "ACTIVE",
    }
)
for campaign in data.get("elements", []):
    print(campaign["id"], campaign["name"], campaign["status"])
```

### Campaign Analytics — Impressions, Clicks, Conversions, Spend

```python
from datetime import datetime, timedelta

# Date range: last 30 days
end = datetime.today()
start = end - timedelta(days=30)

campaign_id = "YOUR_CAMPAIGN_ID"
campaign_urn = f"urn:li:sponsoredCampaign:{campaign_id}"

data = li_get(
    "/adAnalyticsV2",
    params={
        "q": "analytics",
        "pivot": "CAMPAIGN",
        "dateRange.start.year": start.year,
        "dateRange.start.month": start.month,
        "dateRange.start.day": start.day,
        "dateRange.end.year": end.year,
        "dateRange.end.month": end.month,
        "dateRange.end.day": end.day,
        "campaigns[0]": campaign_urn,
        "fields": "impressions,clicks,costInLocalCurrency,conversions,externalWebsiteConversions,clicks,leadGenerationMailContactInfoShares",
    }
)
for element in data.get("elements", []):
    print(
        f"Impressions: {element.get('impressions', 0)} | "
        f"Clicks: {element.get('clicks', 0)} | "
        f"Spend: {element.get('costInLocalCurrency', 0):.2f} | "
        f"Conversions: {element.get('conversions', 0)} | "
        f"Leads: {element.get('leadGenerationMailContactInfoShares', 0)}"
    )

    # Calculate CTR and CPC
    impressions = element.get("impressions", 0)
    clicks = element.get("clicks", 0)
    cost = float(element.get("costInLocalCurrency", 0))
    ctr = clicks / impressions if impressions > 0 else 0
    cpc = cost / clicks if clicks > 0 else 0
    print(f"CTR: {ctr:.2%} | CPC: ${cpc:.2f}")
```

### Multi-Campaign Analytics (All Active Campaigns)

```python
# First get all campaign IDs
account_urn = f"urn:li:sponsoredAccount:{os.environ['LINKEDIN_ACCOUNT_ID']}"
campaigns_data = li_get(
    "/adCampaignsV2",
    params={"q": "search", "search.account.values[0]": account_urn}
)

params = {
    "q": "analytics",
    "pivot": "CAMPAIGN",
    "dateRange.start.year": start.year,
    "dateRange.start.month": start.month,
    "dateRange.start.day": start.day,
    "dateRange.end.year": end.year,
    "dateRange.end.month": end.month,
    "dateRange.end.day": end.day,
    "fields": "impressions,clicks,costInLocalCurrency,conversions",
}
for i, campaign in enumerate(campaigns_data.get("elements", [])[:10]):
    params[f"campaigns[{i}]"] = f"urn:li:sponsoredCampaign:{campaign['id']}"

data = li_get("/adAnalyticsV2", params=params)
```

### Get Audience Targeting Facets

```python
# Get available job titles for targeting
data = li_get("/adTargetingFacets", params={"q": "adAccount", "facetUrn": "urn:li:adTargetingFacet:titles"})

# Get audience size estimate
import json
response = requests.post(
    f"{BASE_URL}/audienceCountsV2",
    headers={
        "Authorization": f"Bearer {os.environ['LINKEDIN_ACCESS_TOKEN']}",
        "Content-Type": "application/json",
    },
    json={
        "audienceCriteria": {
            "include": {
                "and": [{
                    "or": {
                        "urn:li:adTargetingFacet:titles": ["urn:li:title:100"]
                    }
                }]
            }
        }
    }
)
print(response.json())
```

---

## Key Metrics Reference

| Metric Field | Description |
|---|---|
| `impressions` | Number of ad impressions |
| `clicks` | Total ad clicks |
| `costInLocalCurrency` | Total spend in account currency |
| `conversions` | Total conversion count |
| `externalWebsiteConversions` | Website conversion events |
| `leadGenerationMailContactInfoShares` | Lead form submissions |
| `videoViews` | Video ad views |
| `follows` | New followers from ads |

**Calculated metrics:**
- CTR = `clicks / impressions`
- CPC = `costInLocalCurrency / clicks`
- CPM = `(costInLocalCurrency / impressions) * 1000`
- CPL = `costInLocalCurrency / leadGenerationMailContactInfoShares`

---

## Token Expiry Management

```bash
# Check when your token expires (decode JWT)
python3 -c "
import base64, json, os
token = os.environ['LINKEDIN_ACCESS_TOKEN']
payload = token.split('.')[1]
payload += '=' * (4 - len(payload) % 4)
data = json.loads(base64.b64decode(payload))
import datetime
exp = datetime.datetime.fromtimestamp(data['exp'])
print(f'Token expires: {exp}')
"
```

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `LINKEDIN_CLIENT_ID` | OAuth app Client ID |
| `LINKEDIN_CLIENT_SECRET` | OAuth app Client Secret |
| `LINKEDIN_ACCESS_TOKEN` | Current access token (60-day TTL) |
| `LINKEDIN_REFRESH_TOKEN` | Refresh token (365-day TTL) |
| `LINKEDIN_ACCOUNT_ID` | Sponsored account numeric ID |

---

## Rate Limits

- Standard: 100 requests/day
- Marketing Developer Platform: 10,000 requests/day
- Analytics API: 200 requests/day

---

## Output to Vault

Save reports to `/workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/analytics/linkedin-ads-YYYY-MM-DD.md`
