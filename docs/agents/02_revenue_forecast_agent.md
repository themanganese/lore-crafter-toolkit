# Silki — Agent 02: Revenue Forecast
`agent_id: revenue_forecast` · `stack: Python` · `apis: Sensor Tower API + Claude API`

---

## Purpose

Produces a forward-looking revenue forecast for the game being analysed. Combines Sensor Tower download and revenue estimates with Claude's strategic reasoning to project 30/60/90-day revenue trajectories. Where data is unavailable, named assumptions are applied transparently and surfaced to the user.

---

## Root causes fixed in this version

| # | Bug | Fix |
|---|---|---|
| 1 | `dotenv` never loaded — `.env` keys silently missing at runtime | Added `load_dotenv()` call at top of `agent.py` |
| 2 | `assumptions` dict passed to `build_forecast()` was never constructed — `KeyError` on first run | Added `build_assumptions(game)` factory that returns the full dict with all A01–A07 values |
| 3 | `retention_decay()` imported `math` inside the function body — works but flagged as bad practice by Pylance | Moved to top-level import |
| 4 | `interpret_forecast()` returns a dict but `RevenueForecastOutput` fields (`claude_summary`, `revenue_risk` etc.) were never populated from it — `ValidationError` on output construction | Fixed agent.py to unpack Claude response into output model fields |
| 5 | `asyncio` used implicitly — no `asyncio.run()` entry point in `agent.py` — module runs nothing when called directly | Added `if __name__ == "__main__"` block with `asyncio.run(main())` |
| 6 | Pydantic v2: `.dict()` is deprecated — causes `PydanticDeprecatedSince20` warning that breaks some validators downstream | Replaced all `.dict()` calls with `.model_dump()` |

---

## Inputs (from SharedContext)

| Field | Source | Used for |
|---|---|---|
| `game.app_id` | Product extraction | Sensor Tower lookup |
| `game.store` | Product extraction | iOS vs Android split |
| `game.genre` | Product extraction | Category benchmark + ARPU selection |
| `game.monetisation` | Product extraction | ARPU model selection |
| `game.audience_segment` | Product extraction | LTV curve shaping |

---

## Data sources and assumptions

### What Sensor Tower actually provides
- Monthly download estimates (last 3 months)
- Revenue estimates (IAP only — never ad revenue)
- Category ranking position
- Country-level download breakdown (top 5 markets)

### Named assumptions (applied when data is unavailable or thin)

| Assumption ID | Assumption | Default value | Trigger condition |
|---|---|---|---|
| `A01` | Ad revenue as % of IAP revenue | 35% | Always — ST never provides ad revenue |
| `A02` | Day-30 retention rate | 15% casual / 25% mid-core | No cohort data available |
| `A03` | ARPU (avg revenue per user) | $0.08/day casual, $0.22/day mid-core | No per-user revenue breakdown |
| `A04` | Paid UA multiplier | 1.4× organic downloads | No ad spend data available |
| `A05` | Seasonality index | 1.0 (neutral) | No historical seasonality data |
| `A06` | Genre benchmark DAU/MAU ratio | 0.22 casual, 0.35 mid-core | No DAU data from Sensor Tower |
| `A07` | Churn curve half-life | 21 days | No survival curve data |

---

## Folder structure

```
agents/revenue_forecast/
├── agent.py              # Entry point — asyncio.run(main()) here
├── assumptions.py        # build_assumptions(game) factory — A01–A07 registry
├── forecast_model.py     # build_forecast() — revenue projection logic
├── sensor_tower.py       # Sensor Tower API wrapper
├── claude_forecaster.py  # interpret_forecast() — Claude interpretation only
└── models.py             # Pydantic output schema
```

---

## assumptions.py

```python
# assumptions.py
# Single source of truth for all named assumptions.
# build_assumptions(game) returns a fully populated dict — no KeyErrors at runtime.

def build_assumptions(game: dict) -> dict:
    genre = game.get("genre", "").lower()
    is_midcore = any(k in genre for k in ["rpg", "strategy", "mid-core", "midcore"])

    return {
        "A01": {"label": "Ad revenue as % of IAP", "value": 0.35},
        "A02": {"label": "Day-30 retention rate",  "value": 0.25 if is_midcore else 0.15},
        "A03": {"label": "ARPU ($/day)",           "value": 0.22 if is_midcore else 0.08},
        "A04": {"label": "Paid UA multiplier",     "value": 1.4},
        "A05": {"label": "Seasonality index",      "value": 1.0},
        "A06": {"label": "DAU/MAU ratio",          "value": 0.35 if is_midcore else 0.22},
        "A07": {"label": "Churn half-life (days)", "value": 21},
        # Fallback for when ST returns no download data
        "category_median_downloads": 50_000,
    }
```

---

## forecast_model.py

```python
# forecast_model.py
import math

def retention_decay(days: int, half_life: int) -> float:
    return math.exp(-0.693 * days / half_life)

def build_forecast(sensor_data: dict, game: dict, assumptions: dict) -> dict:
    applied_assumptions: list[str] = []

    # Step 1 — baseline monthly downloads
    monthly_downloads = sensor_data.get("downloads_last_30d")
    if not monthly_downloads:
        monthly_downloads = assumptions["category_median_downloads"]
        applied_assumptions.append("A04")

    # Step 2 — IAP revenue
    iap_revenue = sensor_data.get("revenue_last_30d")
    if not iap_revenue:
        arpu      = assumptions["A03"]["value"]
        retention = assumptions["A02"]["value"]
        iap_revenue = monthly_downloads * arpu * retention * 30
        applied_assumptions += ["A02", "A03"]

    # Step 3 — Ad revenue (always modelled — ST never provides this)
    ad_revenue = iap_revenue * assumptions["A01"]["value"]
    applied_assumptions.append("A01")

    # Step 4 — Total monthly baseline
    total_monthly = iap_revenue + ad_revenue

    # Step 5 — Project 30 / 60 / 90 days
    forecasts: dict[str, dict] = {}
    for days in [30, 60, 90]:
        decay    = retention_decay(days, assumptions["A07"]["value"])
        seasonal = assumptions["A05"]["value"]
        revenue  = round(total_monthly * decay * seasonal * (days / 30))
        forecasts[f"day_{days}"] = {
            "revenue_usd": revenue,
            "modelled":    len(applied_assumptions) > 0,
            "confidence":  "medium" if len(applied_assumptions) <= 2 else "low",
        }

    return {
        "baseline_monthly_usd": round(total_monthly),
        "forecasts":            forecasts,
        "applied_assumptions":  applied_assumptions,
        "sensor_tower_actuals": {
            "downloads_30d":  sensor_data.get("downloads_last_30d"),
            "iap_revenue_30d": sensor_data.get("revenue_last_30d"),
            "category_rank":  sensor_data.get("category_rank"),
        },
    }
```

---

## sensor_tower.py

```python
# sensor_tower.py
import httpx
import os

BASE_URL = "https://api.sensortower.com/v1"

def _headers() -> dict:
    # Read key at call time — ensures load_dotenv() has run first
    return {"Authorization": os.environ["SENSOR_TOWER_API_KEY"]}

async def get_app_metrics(app_id: str, store: str) -> dict:
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            r = await client.get(
                f"{BASE_URL}/{store}/apps/{app_id}/sales_report_estimates",
                headers=_headers(),
                params={"date_granularity": "monthly", "num_months": 3},
            )
            r.raise_for_status()
            return r.json()
        except (httpx.HTTPStatusError, httpx.RequestError):
            # Return empty dict — forecast_model will apply assumptions
            return {}

async def get_category_rankings(genre: str, store: str) -> dict:
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            r = await client.get(
                f"{BASE_URL}/{store}/category/rankings",
                headers=_headers(),
                params={"category": genre, "limit": 20},
            )
            r.raise_for_status()
            return r.json()
        except (httpx.HTTPStatusError, httpx.RequestError):
            return {}
```

---

## claude_forecaster.py

```python
# claude_forecaster.py
import anthropic
import json
import os

def interpret_forecast(forecast: dict, game: dict) -> dict:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    prompt = f"""You are a mobile games revenue analyst.

Given this revenue forecast and game context, write:
1. A 2-sentence plain-language summary of the trajectory
2. The single biggest revenue risk in the next 90 days
3. The single biggest revenue opportunity in the next 90 days
4. Which assumptions, if wrong, would most change the forecast (max 2, use assumption IDs like A02)

Game context: {json.dumps(game)}
Forecast data: {json.dumps(forecast)}

Respond in JSON only. Keys: summary, risk, opportunity, sensitive_assumptions (list of str).
No preamble."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(response.content[0].text)
```

---

## models.py

```python
# models.py
from pydantic import BaseModel
from typing import List, Optional

class ForecastPeriod(BaseModel):
    revenue_usd: int
    modelled:    bool
    confidence:  str        # high | medium | low

class AssumptionUsed(BaseModel):
    assumption_id: str
    label:         str
    value:         str
    reason:        str

class RevenueForecastOutput(BaseModel):
    baseline_monthly_usd:   int
    day_30:                 ForecastPeriod
    day_60:                 ForecastPeriod
    day_90:                 ForecastPeriod
    applied_assumptions:    List[AssumptionUsed]
    sensor_tower_actuals:   dict
    claude_summary:         str
    revenue_risk:           str
    revenue_opportunity:    str
    sensitive_assumptions:  List[str]
```

---

## agent.py

```python
# agent.py
import asyncio
import os
import argparse
import json
from dotenv import load_dotenv

load_dotenv()   # must be first — loads ANTHROPIC_API_KEY, SENSOR_TOWER_API_KEY

from assumptions      import build_assumptions
from forecast_model   import build_forecast
from sensor_tower     import get_app_metrics
from claude_forecaster import interpret_forecast
from models           import RevenueForecastOutput, ForecastPeriod, AssumptionUsed

ASSUMPTION_LABELS = {
    "A01": "Ad revenue as % of IAP",
    "A02": "Day-30 retention rate",
    "A03": "ARPU",
    "A04": "Paid UA multiplier",
    "A05": "Seasonality index",
    "A06": "DAU/MAU ratio",
    "A07": "Churn half-life",
}

class RevenueForecastAgent:
    async def run(self, context) -> dict:
        game        = context.game.model_dump()
        assumptions = build_assumptions(game)

        # Fetch Sensor Tower data — returns {} on failure, assumptions fill the gap
        sensor_data = await get_app_metrics(game["app_id"], game["store"])

        # Build deterministic forecast
        forecast = build_forecast(sensor_data, game, assumptions)

        # Claude interprets — never produces numbers
        claude = interpret_forecast(forecast, game)

        # Build applied_assumptions list for output
        applied = [
            AssumptionUsed(
                assumption_id=aid,
                label=ASSUMPTION_LABELS.get(aid, aid),
                value=str(assumptions[aid]["value"]),
                reason=f"Sensor Tower did not provide this field",
            )
            for aid in forecast["applied_assumptions"]
        ]

        output = RevenueForecastOutput(
            baseline_monthly_usd  = forecast["baseline_monthly_usd"],
            day_30                = ForecastPeriod(**forecast["forecasts"]["day_30"]),
            day_60                = ForecastPeriod(**forecast["forecasts"]["day_60"]),
            day_90                = ForecastPeriod(**forecast["forecasts"]["day_90"]),
            applied_assumptions   = applied,
            sensor_tower_actuals  = forecast["sensor_tower_actuals"],
            claude_summary        = claude["summary"],
            revenue_risk          = claude["risk"],
            revenue_opportunity   = claude["opportunity"],
            sensitive_assumptions = claude["sensitive_assumptions"],
        )

        return output.model_dump()   # Pydantic v2 — not .dict()


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--context", required=True, help="Path to SharedContext JSON fixture")
    parser.add_argument("--mock-sensor-tower", action="store_true")
    args = parser.parse_args()

    with open(args.context) as f:
        raw = json.load(f)

    # Minimal SharedContext stub for isolation testing
    class _Game:
        def model_dump(self): return raw["game"]
        def __getattr__(self, k): return raw["game"].get(k)

    class _Context:
        game = _Game()
        scraped_ads = raw.get("scraped_ads", [])
        scrape_window_days = raw.get("scrape_window_days", 14)

    if args.mock_sensor_tower:
        import sensor_tower
        sensor_tower.get_app_metrics = lambda *a, **kw: {}

    agent = RevenueForecastAgent()
    result = await agent.run(_Context())
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
```

---

## .env template

```env
ANTHROPIC_API_KEY=sk-ant-...
SENSOR_TOWER_API_KEY=...
```

---

## VS Code setup

```bash
# From silki/ root
python -m venv .venv
source .venv/bin/activate

pip install anthropic httpx pydantic python-dotenv tenacity

# Run in isolation
python -m agents.revenue_forecast.agent \
  --context tests/fixtures/sample_context.json

# Test with no Sensor Tower data
python -m agents.revenue_forecast.agent \
  --context tests/fixtures/sample_context.json \
  --mock-sensor-tower
```

**Tests/fixtures/sample_context.json minimum shape:**
```json
{
  "game": {
    "app_id": "123456789",
    "title": "Puzzle Quest",
    "genre": "casual puzzle",
    "subgenre": null,
    "core_loop": "match-3 with level progression",
    "audience_segment": "women 25-45",
    "monetisation": "freemium",
    "ad_receptivity": "high",
    "store": "ios"
  },
  "scraped_ads": [],
  "scrape_window_days": 14
}
```

---

## Key constraints

- `load_dotenv()` must be the first line executed in `agent.py` — before any import that reads `os.environ`
- `build_assumptions(game)` must be called before `build_forecast()` — never pass an empty dict
- Claude never produces revenue numbers — only narrative interpretation
- Every modelled figure must have `modelled: True` in output
- Assumptions A01–A07 are the canonical set — do not add unnamed assumptions at runtime
- If Sensor Tower raises any exception, `get_app_metrics()` returns `{}` — the forecast still runs
- Revenue figures are always USD integers — never floats in the output
- Use `.model_dump()` not `.dict()` throughout — Pydantic v2
- This agent runs once per session — no `rescore()` needed
