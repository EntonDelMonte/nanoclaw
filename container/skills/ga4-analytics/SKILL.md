# GA4 Analytics — Google Analytics 4 Data API v1

Pull traffic, funnels, retention, and cohort data from Google Analytics 4 using the Data API v1. Covers OAuth2 service account setup and all reporting operations used by the Growth Agent.

---

## Prerequisites

### 1. Create a Google Cloud Project & Service Account

```bash
# Install the Google Cloud SDK (if not present)
brew install --cask google-cloud-sdk   # macOS

# Authenticate and create project
gcloud auth login
gcloud projects create mnemclaw-analytics --name="MnemClaw Analytics"
gcloud config set project mnemclaw-analytics

# Enable APIs
gcloud services enable analyticsdata.googleapis.com analyticsadmin.googleapis.com

# Create service account
gcloud iam service-accounts create ga4-reader \
  --description="GA4 read-only service account" \
  --display-name="GA4 Reader"

# Generate JSON key
gcloud iam service-accounts keys create ~/ga4-service-account.json \
  --iam-account=ga4-reader@mnemclaw-analytics.iam.gserviceaccount.com
```

### 2. Grant Service Account Access to GA4 Property

1. Go to Google Analytics → Admin → Property Access Management
2. Add the service account email (`ga4-reader@mnemclaw-analytics.iam.gserviceaccount.com`) as a **Viewer**

### 3. Set Environment Variable

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/ga4-service-account.json"
export GA4_PROPERTY_ID="properties/YOUR_PROPERTY_ID"  # e.g. properties/123456789
```

### 4. Install Python Client

```bash
pip install google-analytics-data
```

---

## Operations

### Pull Traffic Report (Sessions, Users, Bounce Rate)

```python
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    RunReportRequest, DateRange, Dimension, Metric
)
import os

client = BetaAnalyticsDataClient()
property_id = os.environ["GA4_PROPERTY_ID"]

request = RunReportRequest(
    property=property_id,
    date_ranges=[DateRange(start_date="30daysAgo", end_date="today")],
    dimensions=[
        Dimension(name="sessionSource"),
        Dimension(name="sessionMedium"),
    ],
    metrics=[
        Metric(name="sessions"),
        Metric(name="activeUsers"),
        Metric(name="newUsers"),
        Metric(name="bounceRate"),
        Metric(name="averageSessionDuration"),
    ],
)
response = client.run_report(request)

for row in response.rows:
    dims = [d.value for d in row.dimension_values]
    mets = [m.value for m in row.metric_values]
    print(dims, mets)
```

### Conversion Funnel Report

```python
request = RunReportRequest(
    property=property_id,
    date_ranges=[DateRange(start_date="30daysAgo", end_date="today")],
    dimensions=[Dimension(name="eventName")],
    metrics=[
        Metric(name="eventCount"),
        Metric(name="conversions"),
        Metric(name="totalRevenue"),
    ],
    dimension_filter={
        "filter": {
            "field_name": "eventName",
            "in_list_filter": {
                "values": ["page_view", "sign_up", "add_to_cart", "purchase"]
            }
        }
    }
)
response = client.run_report(request)
```

### Retention / Cohort Analysis

```python
from google.analytics.data_v1beta.types import (
    RunReportRequest, CohortSpec, Cohort, CohortsRange, DateRange
)

request = RunReportRequest(
    property=property_id,
    cohort_spec=CohortSpec(
        cohorts=[
            Cohort(
                name="cohort_week1",
                dimension="firstSessionDate",
                date_range=DateRange(start_date="7daysAgo", end_date="today"),
            )
        ],
        cohorts_range=CohortsRange(
            granularity="WEEKLY",
            start_offset=0,
            end_offset=4,
        ),
    ),
    metrics=[
        Metric(name="cohortActiveUsers"),
        Metric(name="cohortTotalUsers"),
    ],
)
response = client.run_report(request)
```

### Real-Time Active Users

```python
from google.analytics.data_v1beta.types import RunRealtimeReportRequest

request = RunRealtimeReportRequest(
    property=property_id,
    dimensions=[Dimension(name="country"), Dimension(name="deviceCategory")],
    metrics=[Metric(name="activeUsers")],
)
response = client.run_realtime_report(request)
```

### Via curl (Bearer Token Method)

```bash
# Get access token from service account
pip install google-auth

python3 -c "
import google.auth
import google.auth.transport.requests
creds, _ = google.auth.default(scopes=['https://www.googleapis.com/auth/analytics.readonly'])
creds.refresh(google.auth.transport.requests.Request())
print(creds.token)
"

# Use token in curl
ACCESS_TOKEN="<token>"
PROPERTY_ID="properties/123456789"

curl -X POST \
  "https://analyticsdata.googleapis.com/v1beta/${PROPERTY_ID}:runReport" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "dateRanges": [{"startDate": "30daysAgo", "endDate": "today"}],
    "dimensions": [{"name": "sessionSource"}],
    "metrics": [{"name": "sessions"}, {"name": "conversions"}]
  }'
```

---

## Key Dimensions & Metrics Reference

| Dimension | Description |
|-----------|-------------|
| `sessionSource` | Traffic source (google, direct, etc.) |
| `sessionMedium` | Medium (organic, cpc, email) |
| `sessionCampaignName` | UTM campaign name |
| `landingPage` | Entry page path |
| `deviceCategory` | desktop / mobile / tablet |
| `country` | User country |
| `firstSessionDate` | Date of user's first session |

| Metric | Description |
|--------|-------------|
| `sessions` | Total sessions |
| `activeUsers` | Active users in period |
| `newUsers` | First-time users |
| `conversions` | Conversion event count |
| `totalRevenue` | Revenue from e-commerce |
| `bounceRate` | Single-page session rate |
| `averageSessionDuration` | Avg seconds per session |
| `engagementRate` | Engaged sessions / total sessions |

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON key |
| `GA4_PROPERTY_ID` | GA4 property ID (format: `properties/XXXXXXXXX`) |

---

## Rate Limits

- Data API: 10 requests/second per property
- Daily token quota: 200,000 tokens per property
- Use `limit` and `offset` for pagination on large reports

---

## Output to Vault

Save reports to `/workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/analytics/ga4-report-YYYY-MM-DD.md`
