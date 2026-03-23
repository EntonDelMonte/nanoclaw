# MiroFish / OASIS — Local Simulation & Hypothesis Testing

Run multi-agent swarm simulations locally on your Mac using MiroFish-Offline (an English fork of MiroFish built on the CAMEL-AI OASIS framework). Covers local Docker install, formulating hypotheses, running simulations, and interpreting output. For high-stakes forecasting tasks, use `deepseek-r1-0528` via Mammouth API instead.

---

## What is MiroFish / OASIS?

**MiroFish** is an open-source AI prediction engine that builds a "digital sandbox" to simulate future outcomes. You feed it a document (news article, financial report, strategy doc), it builds a knowledge graph, generates hundreds of AI agent personas, and simulates how they interact — surfacing emergent behaviours, opinion shifts, and scenario trajectories.

**OASIS** (Open Agent Social Interaction Simulations) is the underlying simulation framework from CAMEL-AI. It supports up to 1 million agents performing 23 social actions (follow, comment, repost, like, etc.) and accurately reproduces real information propagation patterns.

**MiroFish-Offline** is the English-language, fully local fork using Neo4j + Ollama — no cloud APIs required.

**Important caveat**: MiroFish outputs are qualitative scenario narratives, not precise probability estimates. Use them for strategic exploration, not hard numerical forecasts.

---

## Part 1 — Local Docker Installation (Mac)

### Prerequisites

- Docker Desktop for Mac (with sufficient resources — see hardware note)
- At least 32GB RAM and a GPU recommended; 16GB works for small simulations
- 50GB+ free disk space (model weights are large)

### Hardware Note

MiroFish-Offline uses `qwen2.5:32b` by default, which requires ~20GB RAM for the model alone. If your Mac has 16GB RAM, use `qwen2.5:7b` instead — set `MODEL_NAME=qwen2.5:7b` in `.env`.

### Install Steps

```bash
# Clone the offline fork
git clone https://github.com/nikmcfly/MiroFish-Offline.git ~/mirofish
cd ~/mirofish

# Copy environment config
cp .env.example .env

# Edit .env if needed (e.g. change model to qwen2.5:7b for 16GB RAM)
# KEY settings in .env:
# OLLAMA_BASE_URL=http://ollama:11434/v1
# MODEL_NAME=qwen2.5:32b  (or qwen2.5:7b for 16GB RAM)
# NEO4J_URI=bolt://neo4j:7687
# NEO4J_USER=neo4j
# NEO4J_PASSWORD=mirofish123

# Start all services
docker compose up -d

# Pull the AI model into Ollama (this takes time — qwen2.5:32b is ~20GB)
docker exec mirofish-ollama ollama pull qwen2.5:32b
# Or for 16GB RAM:
# docker exec mirofish-ollama ollama pull qwen2.5:7b

# Wait for all services to be ready (~3-5 minutes on first run)
docker compose logs -f mirofish-backend  # watch for "Application startup complete"

# Open the UI
open http://localhost:3000
```

### Stop / Restart

```bash
cd ~/mirofish
docker compose stop     # pause
docker compose start    # resume
docker compose down     # remove containers (Neo4j data persists in volumes)
```

---

## Part 2 — Formulating a Hypothesis

Before running a simulation, define your hypothesis clearly:

### Hypothesis Template

```
CONTEXT: [What is the situation? What document/data are you feeding in?]
HYPOTHESIS: [What do you predict will happen? What behaviour or outcome are you testing?]
VARIABLES: [What key variables will you inject or modify?]
AGENTS: [What stakeholder types should be represented? e.g. retail investors, institutional traders, competitors, regulators]
TIMEFRAME: [Simulated time horizon — e.g. 7 days of social reaction, 30-day market scenario]
SUCCESS CRITERIA: [How will you judge the simulation output? What patterns confirm or refute the hypothesis?]
```

### Example — Market Reaction Hypothesis

```
CONTEXT: New regulatory announcement restricting DeFi lending in the EU.
HYPOTHESIS: Retail crypto holders will panic-sell within 48 hours; institutional players will buy the dip.
VARIABLES: Inject the regulatory press release as the source document.
AGENTS: Include retail traders (high emotion, low information), institutional traders (analytical, contrarian), DeFi protocol teams (defensive), regulators (neutral observers).
TIMEFRAME: 7-day simulation
SUCCESS CRITERIA: If >60% of retail agents post sell signals and institutional agents post buy signals, hypothesis is confirmed.
```

---

## Part 3 — Running a Simulation

### Via the Web UI (http://localhost:3000)

1. Click **New Simulation**
2. **Upload source document** — paste text or upload a PDF/article
3. **Configure agents**: set agent count (start with 50-200 for testing), persona diversity, and social network structure
4. **Inject variables**: use the "God Mode" panel to add real-time events mid-simulation
5. **Start simulation** — watch agents interact in real time
6. **Query the Report Agent** for structured analysis

### Via Python API (headless)

```python
import requests

BASE = "http://localhost:8000"  # MiroFish backend

# Create a new simulation
sim = requests.post(f"{BASE}/api/simulations", json={
    "title": "EU DeFi Regulation Impact",
    "source_text": "EU Commission announces new DeFi lending restrictions...",
    "agent_count": 100,
    "simulation_days": 7,
    "personas": ["retail_investor", "institutional_trader", "defi_protocol_team", "regulator"],
}).json()
sim_id = sim["id"]

# Start the simulation
requests.post(f"{BASE}/api/simulations/{sim_id}/start")

# Poll for completion
import time
while True:
    status = requests.get(f"{BASE}/api/simulations/{sim_id}/status").json()
    print(f"Status: {status['state']} | Progress: {status['progress']}%")
    if status["state"] in ("completed", "failed"):
        break
    time.sleep(30)

# Get the report
report = requests.get(f"{BASE}/api/simulations/{sim_id}/report").json()
print(report["summary"])
print(report["key_insights"])
```

---

## Part 4 — Alternative: deepseek-r1 Scenario Simulation via Mammouth

When MiroFish is too slow or unavailable, use `deepseek-r1-0528` via Mammouth for structured hypothesis testing:

```python
from openai import OpenAI
import os

client = OpenAI(
    base_url="https://api.mammouth.ai/v1",
    api_key=os.environ["MAMMOUTH_API_KEY"],
)

hypothesis = """
You are a scenario simulation engine. I will give you a hypothesis and context.
Generate a structured probabilistic scenario analysis with:
1. Most likely scenario (with confidence %)
2. Alternative scenarios (2-3, each with confidence %)
3. Key pivot variables that could shift outcomes
4. Signals to watch for each scenario
5. Recommended action for each scenario

HYPOTHESIS: [INSERT HYPOTHESIS]
CONTEXT: [INSERT CONTEXT]
TIMEFRAME: [INSERT TIMEFRAME]
"""

response = client.chat.completions.create(
    model="deepseek-r1-0528",
    messages=[
        {"role": "system", "content": "You are an expert scenario planner and probabilistic forecaster."},
        {"role": "user", "content": hypothesis},
    ],
    temperature=0.7,
    max_tokens=4000,
)

print(response.choices[0].message.content)
```

---

## Part 5 — Interpreting Output

### What MiroFish Output Means

| Output Type | What it Tells You | What it Does NOT Tell You |
|---|---|---|
| Agent consensus patterns | Which narrative "won" in the simulation | Exact probability of real-world outcome |
| Opinion drift over time | How fast sentiment shifts under pressure | Precise price targets or vote shares |
| Polarisation clusters | Which stakeholder groups diverge | That this will happen in reality |
| Emergent behaviours | Unexpected dynamics that models miss | Timing with precision |

### Output Interpretation Checklist

1. **Dominant narrative**: What did most agents converge on? Is it the expected outcome?
2. **Polarisation**: Did agent groups split sharply? High polarisation = high real-world uncertainty
3. **Outlier agents**: Any minority positions that could represent tail risks?
4. **Speed of consensus**: Fast convergence = low information ambiguity; slow = contested outcome
5. **Sensitivity test**: Re-run with one key variable changed — if outcomes flip, that variable is critical

### Confidence Framing

Always frame MiroFish outputs with:
- "Scenario exploration suggests..." (not "The model predicts...")
- Assign qualitative confidence: Low / Medium / High based on agent consensus strength
- Flag herd bias: LLM agents tend toward consensus — minority signals may be underrepresented

---

## Environment Variables Required

| Variable | Description |
|----------|-------------|
| `MAMMOUTH_API_KEY` | For deepseek-r1-0528 fallback via Mammouth API |

MiroFish-Offline itself requires no external API keys — runs entirely via local Docker + Ollama.

---

## Output to Vault

Save simulation reports to `/workspace/extra/obsidian/MnemClaw/projects/<ProjectName>/analytics/simulation-YYYY-MM-DD.md`

Include:
- Hypothesis statement
- Input document summary
- Key scenario findings
- Confidence level: Low / Medium / High
- Recommended watch signals
