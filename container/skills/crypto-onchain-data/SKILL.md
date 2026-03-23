# Crypto & On-Chain Data — CoinGecko, Etherscan, Dune Analytics, OpenSea

Fetch cryptocurrency price data, on-chain metrics, and NFT data from four major sources. Covers CoinGecko (no key), Etherscan API, Dune Analytics API, and OpenSea API in a single skill.

---

## Source 1 — CoinGecko (No API Key Required for Free Tier)

CoinGecko's public API provides price, market cap, volume, and historical data with no authentication required.

### Price Data

```python
import requests

BASE = "https://api.coingecko.com/api/v3"

def cg_get(endpoint: str, params: dict = None) -> dict:
    """CoinGecko request — no auth needed for free tier."""
    r = requests.get(f"{BASE}{endpoint}", params=params)
    r.raise_for_status()
    return r.json()

# Get current price for multiple coins
prices = cg_get("/simple/price", params={
    "ids": "bitcoin,ethereum,solana",
    "vs_currencies": "usd",
    "include_24hr_change": "true",
    "include_market_cap": "true",
    "include_24hr_vol": "true",
})
for coin, data in prices.items():
    print(f"{coin}: ${data['usd']:,.2f} | 24h: {data.get('usd_24h_change', 0):.2f}% | MCap: ${data.get('usd_market_cap', 0):,.0f}")
```

### Historical OHLCV Data

```python
# Get 30-day hourly OHLCV for Bitcoin
ohlcv = cg_get("/coins/bitcoin/ohlc", params={"vs_currency": "usd", "days": 30})
# Returns [[timestamp_ms, open, high, low, close], ...]
import pandas as pd
df = pd.DataFrame(ohlcv, columns=["ts", "open", "high", "low", "close"])
df["date"] = pd.to_datetime(df["ts"], unit="ms")
print(df.tail())
```

### Market Overview — Top Coins by Market Cap

```python
top_coins = cg_get("/coins/markets", params={
    "vs_currency": "usd",
    "order": "market_cap_desc",
    "per_page": 20,
    "page": 1,
    "sparkline": "false",
    "price_change_percentage": "1h,24h,7d",
})
for coin in top_coins:
    print(
        f"{coin['symbol'].upper():>8} | "
        f"${coin['current_price']:>12,.2f} | "
        f"24h: {coin.get('price_change_percentage_24h', 0):>+6.2f}% | "
        f"MCap: ${coin['market_cap']:>15,.0f}"
    )
```

### Trending Coins

```python
trending = cg_get("/search/trending")
for item in trending["coins"]:
    coin = item["item"]
    print(f"{coin['symbol']} — {coin['name']} (rank #{coin['market_cap_rank']})")
```

### Rate Limits (Free Tier)
- 10-30 calls/minute depending on endpoint
- No API key needed for free tier; use `x-cg-demo-api-key` header for higher limits

---

## Source 2 — Etherscan API (On-Chain Metrics)

Etherscan provides Ethereum blockchain data: transactions, balances, contract interactions, and gas metrics.

### Setup

```bash
# Get free API key at https://etherscan.io/register
export ETHERSCAN_API_KEY="your_api_key_here"
```

### ETH Balance and Transactions

```python
import os

ETHERSCAN_BASE = "https://api.etherscan.io/api"
API_KEY = os.environ["ETHERSCAN_API_KEY"]

def etherscan(module: str, action: str, **params) -> dict:
    r = requests.get(ETHERSCAN_BASE, params={
        "module": module,
        "action": action,
        "apikey": API_KEY,
        **params,
    })
    r.raise_for_status()
    data = r.json()
    if data["status"] != "1":
        raise ValueError(f"Etherscan error: {data.get('message', data)}")
    return data["result"]

# ETH balance of an address
address = "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe"
wei_balance = etherscan("account", "balance", address=address, tag="latest")
eth_balance = int(wei_balance) / 1e18
print(f"Balance: {eth_balance:.6f} ETH")

# Recent transactions
txs = etherscan("account", "txlist",
    address=address,
    startblock=0,
    endblock=99999999,
    page=1, offset=10,
    sort="desc"
)
for tx in txs:
    value_eth = int(tx["value"]) / 1e18
    print(f"{tx['hash'][:16]}... | {value_eth:.4f} ETH | Block {tx['blockNumber']}")
```

### Gas Price Tracker

```python
gas = etherscan("gastracker", "gasoracle")
print(f"Safe: {gas['SafeGasPrice']} Gwei | Propose: {gas['ProposeGasPrice']} Gwei | Fast: {gas['FastGasPrice']} Gwei")
```

### ERC-20 Token Transfers

```python
# Get USDC transfers for an address
usdc_contract = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
transfers = etherscan("account", "tokentx",
    address=address,
    contractaddress=usdc_contract,
    page=1, offset=20,
    sort="desc"
)
for tx in transfers:
    amount = int(tx["value"]) / (10 ** int(tx["tokenDecimal"]))
    print(f"{tx['tokenSymbol']}: {amount:,.2f} | From: {tx['from'][:10]}... → {tx['to'][:10]}...")
```

### Contract Verification & ABI

```python
abi = etherscan("contract", "getabi", address="0x1234...your_contract")
```

### Rate Limits
- Free tier: 5 calls/second, 100,000 calls/day
- API key is free — register at etherscan.io

---

## Source 3 — Dune Analytics API (SQL-Based On-Chain Queries)

Dune lets you run SQL queries against indexed blockchain data and fetch results programmatically.

### Setup

```bash
# Get API key at https://dune.com/settings/api
export DUNE_API_KEY="your_dune_api_key"
```

### Execute a Query and Fetch Results

```python
import os
import time

DUNE_BASE = "https://api.dune.com/api/v1"
DUNE_KEY = os.environ["DUNE_API_KEY"]
DUNE_HEADERS = {"X-Dune-API-Key": DUNE_KEY}

def dune_execute(query_id: int, params: dict = None) -> str:
    """Execute a saved Dune query and return execution_id."""
    body = {}
    if params:
        body["query_parameters"] = params
    r = requests.post(f"{DUNE_BASE}/query/{query_id}/execute", headers=DUNE_HEADERS, json=body)
    r.raise_for_status()
    return r.json()["execution_id"]

def dune_wait(execution_id: str, timeout: int = 120) -> dict:
    """Poll until Dune query completes, then return results."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = requests.get(f"{DUNE_BASE}/execution/{execution_id}/status", headers=DUNE_HEADERS)
        r.raise_for_status()
        status = r.json()
        if status["state"] == "QUERY_STATE_COMPLETED":
            results = requests.get(f"{DUNE_BASE}/execution/{execution_id}/results", headers=DUNE_HEADERS)
            return results.json()["result"]
        if status["state"].startswith("QUERY_STATE_FAILED"):
            raise RuntimeError(f"Dune query failed: {status}")
        time.sleep(5)
    raise TimeoutError("Dune query timed out")

# Example: ETH daily active addresses (Dune query #1215383)
exec_id = dune_execute(1215383)
results = dune_wait(exec_id)
for row in results["rows"][:10]:
    print(row)
```

### Fetch Latest Results Without Re-executing (Cached)

```python
def dune_latest(query_id: int) -> list:
    """Get last cached result for a query (no execution cost)."""
    r = requests.get(
        f"{DUNE_BASE}/query/{query_id}/results",
        headers=DUNE_HEADERS,
        params={"limit": 100},
    )
    r.raise_for_status()
    return r.json()["result"]["rows"]

rows = dune_latest(1215383)
```

### Useful Public Dune Queries

| Metric | Query ID |
|--------|----------|
| ETH daily active addresses | 1215383 |
| Uniswap v3 daily volume | 1395810 |
| NFT marketplace volume | 2090432 |
| DeFi protocol TVL changes | 2141234 |

Search https://dune.com for any on-chain metric — most popular queries are publicly shared.

### Rate Limits
- Free tier: 10 executions/month, 40 results fetches/month
- Paid plans available for higher volume

---

## Source 4 — OpenSea API (NFT Data)

OpenSea provides NFT collection stats, floor prices, sales history, and asset data.

### Setup

```bash
# Get API key at https://docs.opensea.io/reference/api-overview
export OPENSEA_API_KEY="your_opensea_api_key"
```

### NFT Collection Stats

```python
import os

OPENSEA_BASE = "https://api.opensea.io/api/v2"
OS_HEADERS = {
    "X-API-KEY": os.environ["OPENSEA_API_KEY"],
    "accept": "application/json",
}

def opensea_get(endpoint: str, params: dict = None) -> dict:
    r = requests.get(f"{OPENSEA_BASE}{endpoint}", headers=OS_HEADERS, params=params)
    r.raise_for_status()
    return r.json()

# Collection stats
slug = "boredapeyachtclub"
stats = opensea_get(f"/collections/{slug}/stats")
print(
    f"Floor: {stats['total']['floor_price']:.3f} ETH | "
    f"Volume 24h: {stats['intervals'][0]['volume']:.2f} ETH | "
    f"Sales 24h: {stats['intervals'][0]['sales']} | "
    f"Owners: {stats['total']['num_owners']:,}"
)
```

### NFT Sales History

```python
sales = opensea_get(f"/events/collection/{slug}", params={
    "event_type": "sale",
    "limit": 20,
})
for event in sales.get("asset_events", []):
    price_eth = int(event["payment"]["quantity"]) / 1e18
    print(f"Token #{event['nft']['identifier']} sold for {price_eth:.3f} ETH")
```

### Trending Collections

```python
trending = opensea_get("/collections", params={
    "order_by": "seven_day_volume",
    "limit": 10,
})
for col in trending.get("collections", []):
    print(f"{col['name']} | Floor: {col.get('floor_price', 'N/A')} ETH | Volume 7d: {col.get('seven_day_volume', 0):.2f} ETH")
```

### Asset Lookup

```python
# Get a specific NFT
asset = opensea_get(f"/chain/ethereum/contract/0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D/nfts/1")
print(asset["nft"]["name"], asset["nft"]["rarity"])
```

### Rate Limits
- Free tier: 4 requests/second
- API key is free — register at opensea.io/developers

---

## Combined Growth Signal Scan

```python
def fetch_market_overview():
    """Pull a combined crypto market snapshot for the Growth Agent."""
    # 1. Top 10 coins by market cap
    top = cg_get("/coins/markets", params={
        "vs_currency": "usd", "order": "market_cap_desc",
        "per_page": 10, "page": 1,
        "price_change_percentage": "24h,7d",
    })
    # 2. Trending coins
    trending = cg_get("/search/trending")
    # 3. ETH gas
    gas = etherscan("gastracker", "gasoracle")
    # 4. Latest NFT volume (from Dune cache)
    nft_volume = dune_latest(2090432)

    return {
        "top_coins": top,
        "trending": [i["item"]["symbol"] for i in trending["coins"]],
        "eth_gas_gwei": gas["ProposeGasPrice"],
        "nft_daily_volume_eth": nft_volume[0] if nft_volume else None,
    }
```

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `ETHERSCAN_API_KEY` | Free key from etherscan.io |
| `DUNE_API_KEY` | Free key from dune.com |
| `OPENSEA_API_KEY` | Free key from opensea.io/developers |

CoinGecko requires no API key for free tier usage.

---

## Output to Vault

Save market snapshots to `/workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/analytics/crypto-signals-YYYY-MM-DD.md`
