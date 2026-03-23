# Google Ads API — Campaign Stats, CTR/CPC/ROAS, Audience Targeting

Fetch campaign performance data from Google Ads API using the Python client library. Covers local credentials setup, GAQL queries, and key performance metrics used by the Growth Agent.

---

## Prerequisites

### 1. Google Cloud OAuth2 Setup

```bash
# Enable the Google Ads API in your Cloud project
gcloud services enable googleads.googleapis.com

# Create OAuth2 credentials (Desktop app type)
# → Google Cloud Console → APIs & Services → Credentials → Create OAuth Client ID → Desktop app
# Download the client_secret.json
```

### 2. Apply for Google Ads Developer Token

1. Sign in to your Google Ads account
2. Go to Tools & Settings → API Center
3. Apply for a developer token (Basic access is sufficient for reporting)
4. Note your `developer-token` value

### 3. Install Python Client

```bash
pip install google-ads
```

### 4. Create Local Credentials File

Create `~/google-ads.yaml`:

```yaml
developer_token: YOUR_DEVELOPER_TOKEN
client_id: YOUR_OAUTH_CLIENT_ID
client_secret: YOUR_OAUTH_CLIENT_SECRET
refresh_token: YOUR_REFRESH_TOKEN
login_customer_id: YOUR_MANAGER_ACCOUNT_ID  # optional, for MCC
use_proto_plus: True
```

**Generate the refresh token:**

```bash
python3 -c "
from google_auth_oauthlib.flow import InstalledAppFlow
flow = InstalledAppFlow.from_client_secrets_file(
    'client_secret.json',
    scopes=['https://www.googleapis.com/auth/adwords']
)
creds = flow.run_local_server(port=0)
print('Refresh token:', creds.refresh_token)
"
```

### 5. Set Environment Variable

```bash
export GOOGLE_ADS_CONFIGURATION_FILE_PATH=~/google-ads.yaml
export GOOGLE_ADS_CUSTOMER_ID=YOUR_CUSTOMER_ID  # without dashes
```

---

## Operations

### Initialize Client

```python
from google.ads.googleads.client import GoogleAdsClient
import os

client = GoogleAdsClient.load_from_storage(
    os.path.expanduser("~/google-ads.yaml")
)
ga_service = client.get_service("GoogleAdsService")
customer_id = os.environ["GOOGLE_ADS_CUSTOMER_ID"]
```

### List All Campaigns with Status

```python
query = """
    SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign_budget.amount_micros
    FROM campaign
    ORDER BY campaign.id
"""
stream = ga_service.search_stream(customer_id=customer_id, query=query)
for batch in stream:
    for row in batch.results:
        budget = row.campaign_budget.amount_micros / 1_000_000
        print(f"{row.campaign.name} | {row.campaign.status.name} | ${budget:.2f}/day")
```

### Campaign Performance — CTR, CPC, ROAS (Last 30 Days)

```python
query = """
    SELECT
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversion_rate
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status = 'ENABLED'
    ORDER BY metrics.conversions DESC
"""
stream = ga_service.search_stream(customer_id=customer_id, query=query)
for batch in stream:
    for row in batch.results:
        m = row.metrics
        cost = m.cost_micros / 1_000_000
        roas = m.conversions_value / cost if cost > 0 else 0
        cpc = m.average_cpc / 1_000_000
        print(
            f"{row.campaign.name} | "
            f"Impressions: {m.impressions} | "
            f"Clicks: {m.clicks} | "
            f"CTR: {m.ctr:.2%} | "
            f"CPC: ${cpc:.2f} | "
            f"Cost: ${cost:.2f} | "
            f"Conv: {m.conversions:.0f} | "
            f"ROAS: {roas:.2f}x"
        )
```

### Keyword Performance

```python
query = """
    SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group.name,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.average_cpc,
        metrics.conversions
    FROM keyword_view
    WHERE segments.date DURING LAST_30_DAYS
      AND ad_group_criterion.status = 'ENABLED'
    ORDER BY metrics.clicks DESC
    LIMIT 50
"""
stream = ga_service.search_stream(customer_id=customer_id, query=query)
for batch in stream:
    for row in batch.results:
        kw = row.ad_group_criterion.keyword
        m = row.metrics
        cpc = m.average_cpc / 1_000_000
        print(f"[{kw.match_type.name}] {kw.text} | Clicks: {m.clicks} | CPC: ${cpc:.2f} | Conv: {m.conversions:.0f}")
```

### Audience Targeting — User List Sizes

```python
query = """
    SELECT
        user_list.name,
        user_list.size_for_search,
        user_list.size_for_display,
        user_list.membership_status,
        user_list.type
    FROM user_list
    WHERE user_list.membership_status = 'OPEN'
    ORDER BY user_list.size_for_search DESC
"""
stream = ga_service.search_stream(customer_id=customer_id, query=query)
for batch in stream:
    for row in batch.results:
        ul = row.user_list
        print(f"{ul.name} | Search: {ul.size_for_search} | Display: {ul.size_for_display}")
```

### Ad Group Performance

```python
query = """
    SELECT
        ad_group.name,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr
    FROM ad_group
    WHERE segments.date DURING LAST_7_DAYS
    ORDER BY metrics.conversions DESC
"""
stream = ga_service.search_stream(customer_id=customer_id, query=query)
for batch in stream:
    for row in batch.results:
        m = row.metrics
        cost = m.cost_micros / 1_000_000
        print(f"{row.ad_group.name} ({row.campaign.name}) | Cost: ${cost:.2f} | CTR: {m.ctr:.2%}")
```

---

## GAQL Reference

Google Ads Query Language (GAQL) uses SQL-like syntax:

```sql
SELECT <fields>
FROM <resource>
WHERE <conditions>
  AND segments.date DURING LAST_30_DAYS  -- or: LAST_7_DAYS, THIS_MONTH, etc.
ORDER BY <field> DESC
LIMIT 100
```

Available resources: `campaign`, `ad_group`, `keyword_view`, `ad_group_ad`, `user_list`, `geographic_view`, `search_term_view`

---

## Key Metrics Reference

| Metric | Description | Notes |
|--------|-------------|-------|
| `metrics.impressions` | Ad impressions | |
| `metrics.clicks` | Clicks | |
| `metrics.ctr` | Click-through rate | Already a ratio (0.0–1.0) |
| `metrics.cost_micros` | Cost in micros | Divide by 1,000,000 for USD |
| `metrics.average_cpc` | Avg cost per click (micros) | Divide by 1,000,000 |
| `metrics.conversions` | Conversion count | |
| `metrics.conversions_value` | Revenue from conversions | |
| `metrics.conversion_rate` | Conversions / clicks | |

**ROAS calculation:** `conversions_value / (cost_micros / 1_000_000)`

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `GOOGLE_ADS_CONFIGURATION_FILE_PATH` | Path to `google-ads.yaml` |
| `GOOGLE_ADS_CUSTOMER_ID` | Google Ads customer ID (no dashes) |

---

## Rate Limits

- Basic access: 15,000 operations/day
- Standard access: higher (requires application)
- Search stream: no per-query limit but subject to daily quota

---

## Output to Vault

Save reports to `/workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/analytics/google-ads-YYYY-MM-DD.md`
