# Silki — Orchestrator Agent
`agent_id: orchestrator` · `stack: Python` · `role: coordinator`

---

## Purpose

The Orchestrator is the entry point for every Silki analysis run. It receives the raw game app input, fans out tasks to all four specialist agents, collects their outputs, merges them into the final Silki report, and handles failure and retry logic. No specialist agent calls another directly — all communication routes through the Orchestrator.

---

## Responsibilities

| Responsibility | Detail |
|---|---|
| Input ingestion | Accept game URL, App Store link, or manual brief |
| Product extraction | Parse game metadata (genre, core loop, audience, KPIs, monetisation) |
| Task fan-out | Dispatch jobs to all 4 agents with shared context payload |
| Result collection | Await all agent responses with timeout handling |
| Report assembly | Merge outputs into unified Silki report JSON |
| Lever regeneration | Route lever-apply requests to Creative Analysis + Score Breakdown only |
| Feedback routing | Receive user actions (approve / reject / refine / export) and dispatch accordingly |
| Error handling | Retry failed agents, flag partial results, surface confidence degradation |

---

## Folder structure

```
silki/
├── orchestrator/
│   ├── main.py               # Entry point — run this
│   ├── dispatcher.py         # Fan-out, regeneration routing, feedback routing
│   ├── feedback_router.py    # _handle_approve/reject/refine/export + helpers
│   ├── merger.py             # Assembles final report from agent outputs
│   ├── models.py             # Pydantic models: GameInput, SharedContext, RunContext, UserFeedback, SilkiReport
│   ├── run_context_store.py  # In-memory RunContext cache (swap for Redis in prod)
│   └── config.py             # API keys, timeouts, agent endpoints
├── agents/
│   ├── score_breakdown/
│   ├── revenue_forecast/
│   ├── trend_analysis/
│   └── creative_analysis/
├── .env
├── requirements.txt
└── README.md
```

---

## Environment variables

```env
# Anthropic
ANTHROPIC_API_KEY=

# Sensor Tower
SENSOR_TOWER_API_KEY=

# Scenario
SCENARIO_API_KEY=
SCENARIO_API_URL=https://api.scenario.com/v1

# Agent timeouts (seconds)
AGENT_TIMEOUT_SCORE=30
AGENT_TIMEOUT_REVENUE=45
AGENT_TIMEOUT_TREND=30
AGENT_TIMEOUT_CREATIVE=90
```

---

## Shared context payload

Every agent receives this object at dispatch time. Do not let agents call external APIs for data already in this payload.

```python
# models.py
from pydantic import BaseModel
from typing import Optional, List

class GameContext(BaseModel):
    app_id: str
    title: str
    genre: str
    subgenre: Optional[str]
    core_loop: str
    audience_segment: str
    monetisation: str            # freemium | premium | hybrid
    ad_receptivity: str          # high | medium | low
    store: str                   # ios | android | both

class ScrapedAd(BaseModel):
    ad_id: str
    advertiser: str
    platform: str
    format: str                  # static | video | playable
    first_seen: str              # ISO date
    last_seen: str
    raw_url: Optional[str]
    thumbnail_url: Optional[str]

class SharedContext(BaseModel):
    run_id: str
    game: GameContext
    scraped_ads: List[ScrapedAd]  # top 3 from scraper
    scrape_window_days: int        # default 14
```

---

## Run context cache

The `RunContext` object is created once at the start of a Silki run and passed to every subsequent operation — including lever regenerations. Its purpose is to avoid re-running expensive agent work (Sensor Tower calls, pattern extraction, Claude reasoning traces) that hasn't changed.

**Rule: if the input to an agent hasn't changed, do not re-run that agent.**

```python
# models.py (continued)
from typing import Optional

class RunContext(BaseModel):
    run_id: str
    shared_context: SharedContext

    # Cached agent outputs — populated after initial run
    cached_bi_brief: Optional[dict] = None          # from Trend Analysis
    cached_score_context: Optional[dict] = None     # rubric inputs, Sensor Tower data
    cached_revenue_forecast: Optional[dict] = None  # full Revenue Forecast output
    cached_trend_patterns: Optional[dict] = None    # working/saturating patterns
    cached_score_breakdown: Optional[dict] = None   # full Score Breakdown output — never re-run

    # Variant history — grows with each regeneration
    variant_history: list[dict] = []                # list of CreativeAnalysisOutput

    # Regeneration counter
    regen_count: int = 0

    # User feedback signals — appended after each dispatch_feedback() call
    feedback_signals: list[dict] = []               # see UserFeedback model below


class UserFeedback(BaseModel):
    run_id: str
    variant_version: str                            # e.g. "v01", "v02"
    action: str                                     # approve | reject | refine | export
    selected_variant_format: Optional[str] = None  # static_square | static_story
    free_text: Optional[str] = None                # optional user comment
    lever_overrides: Optional[list[str]] = None    # levers user manually selects
    # What the feedback triggers — resolved by dispatch_feedback():
    # approve  → log signal, mark variant as accepted, no re-run
    # reject   → force regeneration with auto-selected next-highest levers
    # refine   → regeneration with user-specified lever_overrides
    # export   → package variant for download, no re-run
```

```python
# run_context_store.py
# In-memory store for the duration of a session.
# Replace with Redis or a DB if you need multi-user concurrency.

_store: dict[str, RunContext] = {}

def save(ctx: RunContext) -> None:
    _store[ctx.run_id] = ctx

def load(run_id: str) -> RunContext | None:
    return _store.get(run_id)

def clear(run_id: str) -> None:
    _store.pop(run_id, None)
```

### What gets cached vs. what gets re-run on regeneration

| Data | Cached after initial run? | Re-run on lever regeneration? | Reason |
|---|---|---|---|
| `SharedContext` (game, scraped ads) | Yes | Never | Input data didn't change |
| Sensor Tower API response | Yes | Never | Same game, same window |
| Trend Analysis BI brief | Yes | Never | Market patterns didn't change |
| Revenue Forecast | Yes | Never | Unrelated to creative mutations |
| Score Breakdown (all 3 sections + grade) | Yes | Never | Data quality doesn't change when creative changes |
| Ad creative rubric scores | No | Yes — recomputed | Mutated brief changes the scores |
| Claude ad read + levers (Creative) | No | Yes — delta only | New variant needs updated read |
| Claude prompt blueprint (Creative) | No | Yes | Mutations change the prompt |
| Scenario generation | No | Yes | New images always needed |

---

## Dispatch logic

```python
# dispatcher.py
import asyncio
from agents.score_breakdown.agent import ScoreBreakdownAgent
from agents.revenue_forecast.agent import RevenueForecastAgent
from agents.trend_analysis.agent import TrendAnalysisAgent
from agents.creative_analysis.agent import CreativeAnalysisAgent

async def dispatch_all(context: SharedContext) -> dict:
    # Phase 1 — run all 4 specialist agents in parallel
    results = await asyncio.gather(
        RevenueForecastAgent().run(context),
        TrendAnalysisAgent().run(context),
        CreativeAnalysisAgent().run(context),
        return_exceptions=True
    )

    keys = ["revenue_forecast", "trend_analysis", "creative_analysis"]
    output = {}
    for key, result in zip(keys, results):
        if isinstance(result, Exception):
            output[key] = {"status": "error", "message": str(result)}
        else:
            output[key] = {"status": "ok", "data": result}

    # Phase 2 — Score Breakdown audits sibling outputs
    # Runs after Phase 1 because it reads sibling agent outputs
    try:
        score_result = await ScoreBreakdownAgent().run(
            context=context,
            revenue_forecast=output.get("revenue_forecast", {}).get("data"),
            trend_analysis=output.get("trend_analysis", {}).get("data"),
            creative_analysis=output.get("creative_analysis", {}).get("data"),
        )
        output["score_breakdown"] = {"status": "ok", "data": score_result}
    except Exception as e:
        output["score_breakdown"] = {"status": "error", "message": str(e)}

    return output
```

Revenue Forecast, Trend Analysis, and Creative Analysis run in **parallel** in Phase 1. Score Breakdown runs in **Phase 2** after all three complete — it is the only agent with sibling dependencies.

---

## Lever regeneration routing

When a user applies levers and requests a new variant, the Orchestrator handles the re-run — **not** the Creative Analysis agent directly. This keeps the re-scoring hand-off clean and centralised.

```python
# dispatcher.py (continued)
from run_context_store import load, save

async def dispatch_regeneration(run_id: str, lever_diff: dict) -> dict:
    ctx = load(run_id)
    if not ctx:
        raise ValueError(f"No active run found for run_id: {run_id}")

    # Creative Analysis regenerates AND self-rescores using cached BI brief
    # Does NOT re-run Trend Analysis, Revenue Forecast, Sensor Tower, or Score Breakdown
    creative_agent = CreativeAnalysisAgent()
    new_creative = await creative_agent.regenerate(
        bi_brief=ctx.cached_bi_brief,
        lever_diff=lever_diff,
        regen_count=ctx.regen_count + 1,
        previous_scores=ctx.variant_history[-1]["creative"]["ad_score"] if ctx.variant_history else None,
        scraped_ads=ctx.shared_context.scraped_ads,
        game=ctx.shared_context.game.dict(),
    )

    # Update run context — variant history grows, Score Breakdown untouched
    ctx.variant_history.append({
        "version": f"v{ctx.regen_count + 2:02d}",
        "levers_applied": lever_diff["apply_levers"],
        "creative": new_creative,
    })
    ctx.regen_count += 1
    save(ctx)

    return {
        "variant_version": f"v{ctx.regen_count + 1:02d}",
        "creative_analysis": new_creative,
        # Score Breakdown, Revenue Forecast, Trend Analysis — all served from cache
        "score_breakdown":   ctx.cached_score_breakdown,
        "revenue_forecast":  ctx.cached_revenue_forecast,
        "trend_analysis":    ctx.cached_trend_patterns,
    }
```

**Two loops, clearly separated:**
- **Within-session edit loop** — `dispatch_regeneration()` above. User-initiated, synchronous, uses cached context. Only Creative Analysis + Score Breakdown re-run.
- **Cross-session market learning loop** — future build. Requires persistent storage of real ad performance data feeding back into Trend Analysis pattern history. Not implemented in v1.

---

## User feedback routing

`dispatch_feedback()` is the Orchestrator function that receives user actions from the UI and decides what to dispatch next. It is the single entry point for all post-generation user interaction — the UI never calls agents directly.

```python
# dispatcher.py (continued)

async def dispatch_feedback(feedback: UserFeedback) -> dict:
    ctx = load(feedback.run_id)
    if not ctx:
        raise ValueError(f"No active run found for run_id: {feedback.run_id}")

    # Log the signal regardless of action
    ctx.feedback_signals.append({
        "variant_version": feedback.variant_version,
        "action": feedback.action,
        "format": feedback.selected_variant_format,
        "free_text": feedback.free_text,
        "timestamp": datetime.utcnow().isoformat(),
    })
    save(ctx)

    # Route based on action
    if feedback.action == "approve":
        return _handle_approve(ctx, feedback)

    elif feedback.action == "reject":
        return await _handle_reject(ctx, feedback)

    elif feedback.action == "refine":
        return await _handle_refine(ctx, feedback)

    elif feedback.action == "export":
        return _handle_export(ctx, feedback)

    else:
        raise ValueError(f"Unknown feedback action: {feedback.action}")
```

### Action handlers

```python
def _handle_approve(ctx: RunContext, feedback: UserFeedback) -> dict:
    # Mark the variant as accepted in history — no re-run
    for entry in ctx.variant_history:
        if entry["version"] == feedback.variant_version:
            entry["approved"] = True
            entry["approved_format"] = feedback.selected_variant_format
    save(ctx)
    return {
        "action": "approve",
        "variant_version": feedback.variant_version,
        "status": "accepted",
        "message": "Variant marked as approved. Export when ready.",
    }


async def _handle_reject(ctx: RunContext, feedback: UserFeedback) -> dict:
    # Auto-select the next highest-impact levers not yet applied
    applied = _all_applied_levers(ctx)
    current_levers = _get_current_levers(ctx)
    next_levers = _pick_next_levers(current_levers, applied, count=2)

    if not next_levers:
        return {
            "action": "reject",
            "status": "exhausted",
            "message": "All available levers have been applied. Consider adjusting the brief.",
        }

    lever_diff = {
        "apply_levers": [l["lever_id"] for l in next_levers],
        "mutations": _levers_to_mutations(next_levers),
        "target_score_delta": {l["lever_id"]: l["estimated_point_delta"] for l in next_levers},
    }
    result = await dispatch_regeneration(ctx.run_id, lever_diff)
    return {"action": "reject", "auto_levers_applied": lever_diff["apply_levers"], **result}


async def _handle_refine(ctx: RunContext, feedback: UserFeedback) -> dict:
    # User has specified which levers to apply — honour exactly
    if not feedback.lever_overrides:
        raise ValueError("refine action requires lever_overrides")

    current_levers = _get_current_levers(ctx)
    selected = [l for l in current_levers if l["lever_id"] in feedback.lever_overrides]

    lever_diff = {
        "apply_levers": feedback.lever_overrides,
        "mutations": _levers_to_mutations(selected),
        "target_score_delta": {l["lever_id"]: l["estimated_point_delta"] for l in selected},
    }
    result = await dispatch_regeneration(ctx.run_id, lever_diff)
    return {"action": "refine", **result}


def _handle_export(ctx: RunContext, feedback: UserFeedback) -> dict:
    # Package the approved variant for download — no re-run
    target = next(
        (v for v in ctx.variant_history if v["version"] == feedback.variant_version),
        None
    )
    if not target:
        raise ValueError(f"Variant {feedback.variant_version} not found in history")

    variants = target["creative"]["variants"]
    if feedback.selected_variant_format:
        variants = [v for v in variants if v["format"] == feedback.selected_variant_format]

    return {
        "action": "export",
        "variant_version": feedback.variant_version,
        "export_package": {
            "variants": variants,
            "score": target["score"],
            "levers_applied": target["levers_applied"],
            "game": ctx.shared_context.game.dict(),
            "exported_at": datetime.utcnow().isoformat(),
        }
    }
```

### Helper functions

```python
def _all_applied_levers(ctx: RunContext) -> list[str]:
    applied = []
    for entry in ctx.variant_history:
        applied.extend(entry.get("levers_applied", []))
    return list(set(applied))

def _get_current_levers(ctx: RunContext) -> list[dict]:
    # Returns lever list from the most recent score output
    if not ctx.variant_history:
        return []
    return ctx.variant_history[-1]["score"].get("levers", [])

def _pick_next_levers(levers: list[dict], applied: list[str], count: int) -> list[dict]:
    # Filters out applied levers, sorts by estimated_point_delta descending
    available = [l for l in levers if l["lever_id"] not in applied]
    return sorted(available, key=lambda l: l["estimated_point_delta"], reverse=True)[:count]

def _levers_to_mutations(levers: list[dict]) -> dict:
    # Converts lever objects into the mutations dict Creative Analysis expects
    return {
        "remove": [l["pattern_affected"] for l in levers if "saturating" in l.get("trend_velocity", "")],
        "add":    [l["pattern_affected"] for l in levers if "rising" in l.get("trend_velocity", "")],
    }
```

### Feedback routing decision table

| User action | Re-runs Creative Analysis? | Re-runs Score Breakdown? | Lever source |
|---|---|---|---|
| `approve` | No | No | — |
| `reject` | Yes | Yes | Auto — next 2 highest-delta levers |
| `refine` | Yes | Yes | User-specified `lever_overrides` |
| `export` | No | No | — |

---

## Report assembly

```python
# merger.py
def assemble_report(context: SharedContext, agent_outputs: dict) -> dict:
    return {
        "run_id": context.run_id,
        "game": context.game.dict(),
        "sections": {
            "score_breakdown":    agent_outputs.get("score_breakdown"),
            "revenue_forecast":   agent_outputs.get("revenue_forecast"),
            "trend_analysis":     agent_outputs.get("trend_analysis"),
            "creative_analysis":  agent_outputs.get("creative_analysis"),
        },
        "report_confidence": compute_overall_confidence(agent_outputs),
        "generated_at": datetime.utcnow().isoformat(),
    }
```

---

## Confidence degradation rules

| Condition | Effect on report confidence |
|---|---|
| Any agent returns error | Confidence capped at Medium |
| Score + Revenue both error | Confidence forced to Low |
| Creative agent errors | Ad generation section marked unavailable, rest unaffected |
| All agents succeed | Confidence determined by data quality signals from Score agent |

---

## VS Code setup

```bash
# 1. Create virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy env template
cp .env.example .env
# Fill in all keys before running

# 4. Run the orchestrator
python orchestrator/main.py --input "https://apps.apple.com/app/your-game"
```

**Recommended VS Code extensions**
- `ms-python.python` — Python language support
- `ms-python.black-formatter` — auto-format on save
- `charliermarsh.ruff` — linting
- `ms-python.vscode-pylance` — type checking
- `dotenv.dotenv-vscode` — .env file highlighting

**VS Code settings** (`.vscode/settings.json`):
```json
{
  "python.defaultInterpreterPath": ".venv/bin/python",
  "editor.formatOnSave": true,
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter"
  }
}
```

---

## requirements.txt

```
anthropic>=0.25.0
httpx>=0.27.0
pydantic>=2.0.0
python-dotenv>=1.0.0
asyncio
tenacity>=8.2.0       # retry logic
rich>=13.0.0          # terminal output formatting
cachetools>=5.3.0     # TTL cache for RunContext (swap for Redis in prod)
```

---

## Key constraints

- Orchestrator never calls Claude or Scenario directly — those belong to specialist agents
- SharedContext is read-only after dispatch — agents cannot mutate it
- Each agent must return within its configured timeout or be marked as errored
- All agent outputs must conform to their declared Pydantic response model
- `RunContext` is created once per run and persists for the session — never recreated mid-session
- On lever regeneration, only Creative Analysis and Score Breakdown re-run — all other cached outputs are served directly
- `variant_history` in RunContext is append-only — previous variants are never overwritten
- `feedback_signals` in RunContext is append-only — every user action is logged before routing
- `dispatch_feedback()` is the only entry point for UI-driven actions — the UI never calls agents directly
- `reject` auto-selects levers; if all levers are exhausted, return `status: exhausted` — do not generate a blank variant
- `export` never triggers a re-run — it packages whatever is already in `variant_history`
- Free-text from `UserFeedback.free_text` is logged only — it is not passed to Claude in v1
