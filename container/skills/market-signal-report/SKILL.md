# Market Signal Report — Growth Agent Output Format

Structured workflow for writing the Growth Agent's market signal reports to the Obsidian vault analytics folder. Defines the output format, file naming conventions, and writing process.

---

## Report Structure

All market signal reports follow this fixed format:

```markdown
---
title: "Market Signal Report — <Asset or Topic>"
date: YYYY-MM-DD
project: <ProjectName>
type: market-signal
confidence: Low | Medium | High
---

# Market Signal Report — <Asset or Topic>
*Generated: YYYY-MM-DD HH:MM UTC*

## Summary

<2-3 sentence executive summary of the current market state and primary signal.>

## Signal

| Field | Value |
|-------|-------|
| Asset | <name, ticker, or topic> |
| Signal | Buy / Sell / Hold / Watch |
| Timeframe | <e.g. 4h, daily, weekly> |
| Entry | <price or zone, or N/A for macro signals> |
| Target | <price or zone, or N/A> |
| Stop | <price, or N/A> |
| Confidence | Low / Medium / High |

## Rationale

<2-3 sentences explaining the signal basis — data sources cited.>

## Supporting Data

### Price & Market Data
<Key metrics from CoinGecko / TradingView / GA4 etc.>

### On-Chain Signals (if applicable)
<Etherscan / Dune metrics if relevant.>

### Ad Performance Context (if applicable)
<Google Ads / LinkedIn Ads data if this is a campaign signal.>

### Simulation Scenario (if applicable)
<MiroFish / deepseek-r1 scenario output summary if used.>

## Risk Flags

- <Flag 1: e.g. "High correlation with BTC — systemic risk">
- <Flag 2: e.g. "Low liquidity on target exchange">

## Confidence Rationale

<1-2 sentences explaining why this confidence level was assigned.>

---
*Confidence levels: Low = 1-2 data sources, conflicting signals | Medium = 3+ sources, directional agreement | High = 4+ sources, strong consensus*
```

---

## Workflow

### Step 1 — Collect Data

```python
import os
from datetime import datetime, timezone

project_name = os.environ.get("PROJECT_NAME", "default")
base_path = f"/workspace/extra/obsidian/MnemClaw/projects/{project_name}/analytics"
today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
```

Collect all relevant data first:
- Price data → use `crypto-onchain-data` skill (CoinGecko)
- On-chain metrics → use `crypto-onchain-data` skill (Etherscan / Dune)
- Ad performance → use `google-ads-api` or `linkedin-ads-api` skills
- Web analytics → use `ga4-analytics` skill
- Scenario context → use `mirofish-oasis` skill if hypothesis testing

### Step 2 — Score Confidence

| Confidence | Criteria |
|------------|----------|
| High | 4+ independent data sources agree; strong directional consensus; low noise |
| Medium | 3+ sources with general agreement; some conflicting signals present |
| Low | 1-2 sources; conflicting signals; high uncertainty or thin data |

**Always apply these risk rules:**
- State confidence level explicitly
- Include a stop-loss level in any entry recommendation
- Flag correlation risk when multiple signals point to the same asset
- Default position sizing: never recommend >5% portfolio in a single speculative position

### Step 3 — Write and Save Report

```python
def write_market_signal_report(
    project_name: str,
    asset: str,
    signal: str,  # Buy / Sell / Hold / Watch
    timeframe: str,
    entry: str,
    target: str,
    stop: str,
    confidence: str,  # Low / Medium / High
    summary: str,
    rationale: str,
    supporting_data: str,
    risk_flags: list[str],
    confidence_rationale: str,
) -> str:
    """Write a market signal report to the vault and return the file path."""
    import os
    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    slug = asset.lower().replace(" ", "-").replace("/", "-")
    filename = f"signal-{slug}-{today}.md"
    filepath = f"/workspace/extra/obsidian/MnemClaw/projects/{project_name}/analytics/{filename}"

    risk_flags_md = "\n".join(f"- {flag}" for flag in risk_flags)

    content = f"""---
title: "Market Signal Report — {asset}"
date: {today}
project: {project_name}
type: market-signal
confidence: {confidence}
---

# Market Signal Report — {asset}
*Generated: {timestamp} UTC*

## Summary

{summary}

## Signal

| Field | Value |
|-------|-------|
| Asset | {asset} |
| Signal | {signal} |
| Timeframe | {timeframe} |
| Entry | {entry} |
| Target | {target} |
| Stop | {stop} |
| Confidence | {confidence} |

## Rationale

{rationale}

## Supporting Data

{supporting_data}

## Risk Flags

{risk_flags_md}

## Confidence Rationale

{confidence_rationale}

---
*Confidence levels: Low = 1-2 data sources, conflicting signals | Medium = 3+ sources, directional agreement | High = 4+ sources, strong consensus*
"""

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w") as f:
        f.write(content)

    return filepath
```

### Step 4 — Update the Signals Index

After writing a report, update or create the signals index:

```python
def update_signals_index(project_name: str, signal_entry: dict) -> None:
    """Append a signal entry to the project's signals index file."""
    index_path = f"/workspace/extra/obsidian/MnemClaw/projects/{project_name}/analytics/signals-index.md"

    entry_line = (
        f"| {signal_entry['date']} | {signal_entry['asset']} | "
        f"{signal_entry['signal']} | {signal_entry['confidence']} | "
        f"[[{signal_entry['filename']}]] |\n"
    )

    if not os.path.exists(index_path):
        header = "# Market Signals Index\n\n| Date | Asset | Signal | Confidence | Report |\n|------|-------|--------|------------|--------|\n"
        with open(index_path, "w") as f:
            f.write(header)

    with open(index_path, "a") as f:
        f.write(entry_line)
```

---

## Full Example — ETH Signal Report

```python
filepath = write_market_signal_report(
    project_name="MnemClaw",
    asset="ETH/USD",
    signal="Watch",
    timeframe="daily",
    entry="$1,850–$1,900",
    target="$2,200",
    stop="$1,720",
    confidence="Medium",
    summary=(
        "ETH is forming a potential accumulation base after a 22% drawdown. "
        "On-chain data shows decreasing exchange inflows and rising staking deposits. "
        "Signal is Watch pending confirmation of daily close above $1,920."
    ),
    rationale=(
        "CoinGecko shows 7d volume +18% vs prior week with stable market cap. "
        "Etherscan shows net outflows from exchanges of 45,000 ETH over 7 days. "
        "Dune query shows DeFi TVL stabilising after decline."
    ),
    supporting_data="""### Price Data
- Current: $1,882
- 7d change: -3.2%
- 30d change: -22.1%
- Volume 24h: $8.2B

### On-Chain
- Exchange inflows (7d): -45,000 ETH (bullish)
- Staking deposits (7d): +12,000 ETH (bullish)
- Gas price avg: 18 Gwei (low activity)""",
    risk_flags=[
        "High BTC correlation — macro sell-off would invalidate thesis",
        "SEC ETF ruling uncertainty adds headline risk",
    ],
    confidence_rationale=(
        "Medium confidence: 3 independent sources (price, exchange flow, TVL) agree on direction, "
        "but conflicting macro signals prevent High rating."
    ),
)
print(f"Report saved: {filepath}")
```

---

## File Naming Convention

```
signal-<asset-slug>-YYYY-MM-DD.md
```

Examples:
- `signal-eth-usd-2026-03-24.md`
- `signal-btc-usd-2026-03-24.md`
- `signal-google-ads-campaign-alpha-2026-03-24.md`
- `signal-linkedin-q1-campaign-2026-03-24.md`

---

## Vault Path

All reports go to:
```
/workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/analytics/
```

The analytics folder is the Growth Agent's exclusive write scope. Never write outside it.
