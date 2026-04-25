# Silki — Agent 01: Score Breakdown
`agent_id: score_breakdown` · `stack: Python` · `apis: Claude API + Sensor Tower API`

---

## Purpose

Score Breakdown is Silki's **data trust auditor**. It does not evaluate ad creative — that lives in Creative Analysis. Its job is to assess how much the user should trust everything Silki produces in a given run: the trend patterns, the revenue forecast, and the generated ads.

It produces:
- Individual scores per data quality section
- A composite **Data Trust Grade** (A / B / C / D)
- Per-section improvement recommendations
- A global top 3 priority list
- A plain-language data quality read from Claude

---

## Responsibilities

| Responsibility | Detail |
|---|---|
| Scrape quality score | Sample size, advertiser diversity, recency, pattern signal strength |
| Revenue forecast quality score | Assumption count, assumption impact weight, Sensor Tower coverage |
| Generation quality score | Scenario completeness, model selection appropriateness, reference asset availability |
| Composite grade | Weighted A / B / C / D across all three sections |
| Per-section recs | What to improve within each section |
| Global top 3 | Highest-impact actions across all sections, ranked |
| Plain-language read | Claude's 2–3 sentence honest summary of the run's data health |

---

## Sequencing

Score Breakdown runs in **Phase 2** — after Revenue Forecast, Trend Analysis, and Creative Analysis all complete. It is the only agent that receives sibling outputs as inputs.

```
Phase 1 (parallel):  Revenue Forecast | Trend Analysis | Creative Analysis
                                          ↓
Phase 2 (sequential): Score Breakdown ← reads all three outputs
```

---

## Inputs

| Field | Source | Used for |
|---|---|---|
| `scraped_ads` | SharedContext | Scrape quality scoring |
| `scrape_window_days` | SharedContext | Recency scoring |
| `revenue_forecast.applied_assumptions` | Revenue Forecast output | Assumption burden scoring |
| `revenue_forecast.sensor_tower_actuals` | Revenue Forecast output | ST coverage scoring |
| `trend_analysis.what_is_working` | Trend Analysis output | Pattern signal quality |
| `creative_analysis.variants` | Creative Analysis output | Generation completeness |
| `creative_analysis.generation_metadata` | Creative Analysis output | Model selection check |

---

## Section 1 — Scrape quality

Evaluates how reliable the ad pattern data is.

```python
# scrape_quality.py

SCRAPE_WEIGHTS = {
    "dataset_size":          0.35,
    "advertiser_diversity":  0.30,
    "scrape_recency":        0.20,
    "pattern_signal":        0.15,
}

def score_dataset_size(scraped_ads: list) -> tuple[int, str, list[str]]:
    n = len(scraped_ads)
    if n >= 10: return 100, f"{n} ads — strong sample", []
    if n >= 5:  return 70,  f"{n} ads — adequate sample", ["Expand scrape to 30 days to capture more creatives"]
    if n >= 3:  return 45,  f"{n} ads — thin sample, patterns are indicative only", [
        "Expand scrape window to 30 days",
        "Add TikTok Creative Center as a second scrape source",
    ]
    return 20, f"{n} ad(s) — insufficient for pattern detection", [
        "Scrape window must cover at least 3 unique advertisers before patterns are meaningful",
    ]

def score_advertiser_diversity(scraped_ads: list) -> tuple[int, str, list[str]]:
    n = len(set(ad["advertiser"] for ad in scraped_ads))
    if n >= 4: return 100, f"{n} advertisers — diverse", []
    if n >= 2: return 60,  f"{n} advertisers — limited diversity", ["Add more advertiser sources to reduce single-player bias"]
    return 30, f"{n} advertiser — single-source data, high bias risk", [
        "Data reflects one advertiser's strategy, not market patterns",
        "Re-scrape targeting 4+ distinct advertisers",
    ]

def score_scrape_recency(scrape_window_days: int, scraped_ads: list) -> tuple[int, str, list[str]]:
    avg_appearances = sum(ad.get("window_appearances", 1) for ad in scraped_ads) / max(len(scraped_ads), 1)
    recency = 100 if scrape_window_days <= 14 else 70 if scrape_window_days <= 30 else 40
    signal  = 100 if avg_appearances >= 5 else 60
    score   = round((recency * 0.6) + (signal * 0.4))
    recs    = []
    if scrape_window_days > 30:
        recs.append("Tighten scrape window to 14–30 days for fresher signals")
    if avg_appearances < 5:
        recs.append("Low average ad appearances — patterns may be noise rather than signal")
    return score, f"{scrape_window_days}-day window, avg {round(avg_appearances, 1)} appearances per ad", recs

def score_pattern_signal(trend_patterns: dict) -> tuple[int, str, list[str]]:
    working = trend_patterns.get("what_is_working", [])
    high_signal = [p for p in working if p.get("signal_strength") == "high"]
    rising      = [p for p in working if p.get("trend_velocity") == "rising"]
    score = min(60 + (len(high_signal) * 15) + (len(rising) * 10), 100)
    recs  = [] if score >= 75 else ["More ad data needed to distinguish signal from noise in pattern detection"]
    return score, f"{len(high_signal)} high-signal patterns, {len(rising)} rising", recs

def compute_scrape_score(scraped_ads, scrape_window_days, trend_patterns) -> dict:
    ds_score,  ds_note,  ds_recs  = score_dataset_size(scraped_ads)
    adv_score, adv_note, adv_recs = score_advertiser_diversity(scraped_ads)
    rec_score, rec_note, rec_recs = score_scrape_recency(scrape_window_days, scraped_ads)
    pat_score, pat_note, pat_recs = score_pattern_signal(trend_patterns)

    weighted = round(
        ds_score  * SCRAPE_WEIGHTS["dataset_size"] +
        adv_score * SCRAPE_WEIGHTS["advertiser_diversity"] +
        rec_score * SCRAPE_WEIGHTS["scrape_recency"] +
        pat_score * SCRAPE_WEIGHTS["pattern_signal"]
    )

    return {
        "section": "scrape_quality",
        "section_score": weighted,
        "dimensions": [
            {"name": "Dataset size",         "score": ds_score,  "note": ds_note},
            {"name": "Advertiser diversity",  "score": adv_score, "note": adv_note},
            {"name": "Scrape recency",        "score": rec_score, "note": rec_note},
            {"name": "Pattern signal",        "score": pat_score, "note": pat_note},
        ],
        "section_recs": ds_recs + adv_recs + rec_recs + pat_recs,
    }
```

---

## Section 2 — Revenue forecast quality

Evaluates how trustworthy the revenue figures are.

```python
# revenue_quality.py

REVENUE_WEIGHTS = {
    "sensor_tower_coverage": 0.40,
    "assumption_burden":     0.35,
    "assumption_impact":     0.25,
}

ASSUMPTION_IMPACT = {
    "A01": {"label": "Ad revenue as % of IAP",  "impact": "medium"},
    "A02": {"label": "Day-30 retention rate",    "impact": "high"},
    "A03": {"label": "ARPU",                     "impact": "high"},
    "A04": {"label": "Paid UA multiplier",       "impact": "medium"},
    "A05": {"label": "Seasonality index",        "impact": "low"},
    "A06": {"label": "DAU/MAU ratio",            "impact": "medium"},
    "A07": {"label": "Churn curve shape",        "impact": "high"},
}

def score_st_coverage(sensor_tower_actuals: dict) -> tuple[int, str, list[str]]:
    key_fields = ["downloads_last_30d", "revenue_last_30d", "category_rank"]
    present = [f for f in key_fields if sensor_tower_actuals.get(f) is not None]
    score = round((len(present) / len(key_fields)) * 100)
    missing = [f for f in key_fields if f not in present]
    recs = [f"Missing Sensor Tower field: {f} — revenue figures for this are modelled" for f in missing]
    return score, f"{len(present)}/{len(key_fields)} Sensor Tower fields available", recs

def score_assumption_burden(applied: list) -> tuple[int, str, list[str]]:
    n = len(applied)
    if n == 0: return 100, "No assumptions applied — all data sourced directly", []
    if n <= 2: return 75,  f"{n} assumption(s) — manageable", []
    if n <= 4: return 50,  f"{n} assumptions — forecast is partially modelled", [
        "Connect a MMP (Adjust, AppsFlyer) to replace retention and ARPU assumptions",
    ]
    return 25, f"{n} assumptions — forecast is largely modelled, treat as directional only", [
        "Revenue figures have low reliability — do not use for budget decisions",
        "Connect Sensor Tower + MMP data to ground the forecast",
    ]

def score_assumption_impact(applied: list) -> tuple[int, str, list[str]]:
    high = [a for a in applied if ASSUMPTION_IMPACT.get(a, {}).get("impact") == "high"]
    if not high:      return 100, "No high-impact assumptions", []
    if len(high) == 1: return 65, f"1 high-impact assumption: {ASSUMPTION_IMPACT[high[0]]['label']}", [
        f"Replace assumption {high[0]} ({ASSUMPTION_IMPACT[high[0]]['label']}) with real data for highest forecast accuracy"
    ]
    labels = [ASSUMPTION_IMPACT[a]["label"] for a in high]
    return 30, f"{len(high)} high-impact assumptions: {', '.join(labels)}", [
        f"Priority: replace {ASSUMPTION_IMPACT[high[0]]['label']} (A{high[0][-2:]}) — largest forecast sensitivity",
        "Consider these revenue figures a planning range only",
    ]

def compute_revenue_score(revenue_forecast: dict) -> dict:
    applied   = revenue_forecast.get("applied_assumptions", [])
    st_data   = revenue_forecast.get("sensor_tower_actuals", {})
    applied_ids = [a["assumption_id"] for a in applied] if applied and isinstance(applied[0], dict) else applied

    st_score,  st_note,  st_recs  = score_st_coverage(st_data)
    ab_score,  ab_note,  ab_recs  = score_assumption_burden(applied_ids)
    ai_score,  ai_note,  ai_recs  = score_assumption_impact(applied_ids)

    weighted = round(
        st_score * REVENUE_WEIGHTS["sensor_tower_coverage"] +
        ab_score * REVENUE_WEIGHTS["assumption_burden"] +
        ai_score * REVENUE_WEIGHTS["assumption_impact"]
    )

    # Build assumption detail list for UI display
    assumption_detail = [
        {
            "assumption_id": aid,
            "label": ASSUMPTION_IMPACT.get(aid, {}).get("label", aid),
            "impact": ASSUMPTION_IMPACT.get(aid, {}).get("impact", "unknown"),
        }
        for aid in applied_ids
    ]

    return {
        "section": "revenue_forecast_quality",
        "section_score": weighted,
        "dimensions": [
            {"name": "Sensor Tower coverage", "score": st_score, "note": st_note},
            {"name": "Assumption burden",      "score": ab_score, "note": ab_note},
            {"name": "Assumption impact",      "score": ai_score, "note": ai_note},
        ],
        "assumption_detail": assumption_detail,
        "section_recs": st_recs + ab_recs + ai_recs,
    }
```

---

## Section 3 — Generation quality

Evaluates how complete and appropriate the ad generation was.

```python
# generation_quality.py

GENERATION_WEIGHTS = {
    "variant_completeness": 0.50,
    "model_appropriateness": 0.30,
    "reference_asset_use":   0.20,
}

def score_variant_completeness(variants: list) -> tuple[int, str, list[str]]:
    expected_formats = {"static_square", "static_story"}
    produced = {v["format"] for v in variants}
    missing  = expected_formats - produced
    if not missing: return 100, "All expected formats generated", []
    return 50, f"Missing formats: {', '.join(missing)}", [
        f"Re-run generation — {f} variant failed or was skipped" for f in missing
    ]

def score_model_appropriateness(metadata: dict, genre: str) -> tuple[int, str, list[str]]:
    model = metadata.get("model_used", "")
    genre_lower = genre.lower()
    appropriate = (
        ("puzzle" in genre_lower or "casual" in genre_lower) and "recraft" in model or
        "hyperreal" in genre_lower and "flux" in model or
        "ideogram" in model   # safe default for text-in-image
    )
    if appropriate:
        return 90, f"Model {model} is well-suited for {genre}", []
    return 60, f"Model {model} may not be optimal for {genre}", [
        f"Consider switching to recraft-ai-v3 for {genre} genre — better stylistic fit"
    ]

def score_reference_asset_use(metadata: dict, scraped_ads: list) -> tuple[int, str, list[str]]:
    ref_ids = metadata.get("reference_asset_ids_used", [])
    if ref_ids and len(scraped_ads) >= 2:
        return 100, f"{len(ref_ids)} scraped ad(s) used as style reference", []
    if scraped_ads:
        return 60, "Generated without scraped ad style references", [
            "Pass scraped ad IDs as reference assets to Scenario for better market alignment"
        ]
    return 40, "No scraped ads available for reference", [
        "Expand scrape to provide visual anchors for generation"
    ]

def compute_generation_score(creative_analysis: dict, game: dict) -> dict:
    variants  = creative_analysis.get("variants", [])
    metadata  = creative_analysis.get("generation_metadata", {})
    genre     = game.get("genre", "")

    vc_score, vc_note, vc_recs = score_variant_completeness(variants)
    ma_score, ma_note, ma_recs = score_model_appropriateness(metadata, genre)
    ra_score, ra_note, ra_recs = score_reference_asset_use(metadata, [])

    weighted = round(
        vc_score * GENERATION_WEIGHTS["variant_completeness"] +
        ma_score * GENERATION_WEIGHTS["model_appropriateness"] +
        ra_score * GENERATION_WEIGHTS["reference_asset_use"]
    )

    return {
        "section": "generation_quality",
        "section_score": weighted,
        "dimensions": [
            {"name": "Variant completeness",   "score": vc_score, "note": vc_note},
            {"name": "Model appropriateness",  "score": ma_score, "note": ma_note},
            {"name": "Reference asset use",    "score": ra_score, "note": ra_note},
        ],
        "section_recs": vc_recs + ma_recs + ra_recs,
    }
```

---

## Composite grade

```python
# composite.py

SECTION_WEIGHTS = {
    "scrape_quality":            0.40,
    "revenue_forecast_quality":  0.35,
    "generation_quality":        0.25,
}

def compute_composite(sections: dict) -> dict:
    raw = sum(
        sections[s]["section_score"] * SECTION_WEIGHTS[s]
        for s in SECTION_WEIGHTS
    )
    raw = round(raw)

    if raw >= 80: grade, label = "A", "High trust"
    elif raw >= 65: grade, label = "B", "Moderate trust"
    elif raw >= 45: grade, label = "C", "Low trust — use with caution"
    else:           grade, label = "D", "Very low trust — data insufficient"

    return {
        "composite_score": raw,
        "grade": grade,
        "label": label,
    }
```

### Grade reference

| Grade | Score range | Meaning |
|---|---|---|
| A | 80–100 | Strong data — patterns and forecast are reliable |
| B | 65–79 | Solid data with minor gaps — treat revenue as estimates |
| C | 45–64 | Thin data — patterns are directional, forecast unreliable |
| D | 0–44 | Insufficient data — run is informational only |

---

## Global top 3 priority list

After all three sections compute their per-section recommendations, the Orchestrator assembles a global priority list by selecting the highest-impact recommendations across sections.

```python
# priority_list.py

IMPACT_RANK = {"high": 3, "medium": 2, "low": 1}

def build_global_top3(section_outputs: list[dict]) -> list[dict]:
    all_recs = []
    for section in section_outputs:
        for rec in section.get("section_recs", []):
            # Each rec is a string — tag it with its section and infer impact
            all_recs.append({
                "section": section["section"],
                "recommendation": rec,
                "expected_impact": infer_impact(rec, section["section_score"]),
            })

    # Sort by impact descending, deduplicate, take top 3
    sorted_recs = sorted(all_recs, key=lambda r: IMPACT_RANK.get(r["expected_impact"], 0), reverse=True)
    seen = set()
    top3 = []
    for rec in sorted_recs:
        key = rec["recommendation"][:60]   # dedupe on first 60 chars
        if key not in seen:
            seen.add(key)
            top3.append({"rank": len(top3) + 1, **rec})
        if len(top3) == 3:
            break

    return top3

def infer_impact(rec: str, section_score: int) -> str:
    # Low section score = higher impact to fix
    if section_score < 45: return "high"
    if section_score < 65: return "medium"
    return "low"
```

---

## Claude API call

Claude receives all three section outputs and writes the plain-language data quality read.

```python
# claude_auditor.py
import anthropic, json

client = anthropic.Anthropic()

def write_data_quality_read(
    composite: dict,
    scrape_section: dict,
    revenue_section: dict,
    generation_section: dict,
    global_top3: list,
) -> str:
    prompt = f"""
You are a data analyst reviewing the quality of a mobile game market intelligence report.

The report has been scored across three sections. Write a 2-3 sentence plain-language summary that:
1. States the overall data trust grade and what it means in plain terms
2. Identifies the single biggest data gap limiting this run
3. States what fixing the top priority action would unlock

Be direct. If the data is thin, say so. Do not soften low grades.

Composite: {json.dumps(composite)}
Scrape quality score: {scrape_section["section_score"]}
Revenue quality score: {revenue_section["section_score"]}
Generation quality score: {generation_section["section_score"]}
Top priority action: {global_top3[0]["recommendation"] if global_top3 else "none"}

Respond with a single plain-text paragraph only. No JSON, no bullet points, no preamble.
    """

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=200,    # short — one paragraph only
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text.strip()
```

### Example output

> This run earns a B — solid patterns and well-generated ads, but the revenue forecast leans heavily on modelled assumptions, particularly ARPU and retention. The biggest data gap is Sensor Tower revenue coverage: without real IAP data, the 30/60/90-day projections are directional at best. Connecting an MMP like Adjust would replace the two highest-impact assumptions and push this run to an A.

---

## Output schema

```python
# models.py
from pydantic import BaseModel
from typing import List

class Dimension(BaseModel):
    name: str
    score: int          # 0-100
    note: str           # one-line explanation

class Section(BaseModel):
    section: str        # scrape_quality | revenue_forecast_quality | generation_quality
    section_score: int  # 0-100
    dimensions: List[Dimension]
    section_recs: List[str]     # specific actions to improve this section

class GlobalRec(BaseModel):
    rank: int           # 1 | 2 | 3
    section: str
    recommendation: str
    expected_impact: str    # high | medium | low

class ScoreBreakdownOutput(BaseModel):
    composite_score: int        # 0-100
    grade: str                  # A | B | C | D
    label: str                  # plain label for the grade
    sections: List[Section]     # scrape, revenue, generation — in that order
    global_top3: List[GlobalRec]
    data_quality_read: str      # Claude's plain-language paragraph
```

---

## Caching behaviour

Score Breakdown runs once per session after Phase 1 completes. Its full output is cached in `RunContext.cached_score_breakdown`. It is never re-run on lever regeneration — data quality does not change when creative changes.

```python
# After initial run — stored by Orchestrator
ctx.cached_score_breakdown = score_breakdown_output.dict()

# On lever regeneration — served directly, no re-run, no API calls
return ctx.cached_score_breakdown
```

---

## Folder structure

```
agents/score_breakdown/
├── agent.py                # Main agent class — run() only, no rescore()
├── scrape_quality.py       # Section 1 scoring
├── revenue_quality.py      # Section 2 scoring
├── generation_quality.py   # Section 3 scoring
├── composite.py            # Grade computation across sections
├── priority_list.py        # Global top 3 assembly
├── claude_auditor.py       # Claude plain-language read
└── models.py               # Pydantic output schema
```

---

## VS Code setup

Run in isolation (requires sibling agent fixture outputs):
```bash
python -m agents.score_breakdown.agent \
  --context tests/fixtures/sample_context.json \
  --revenue-forecast tests/fixtures/sample_revenue_forecast.json \
  --trend-analysis tests/fixtures/sample_trend_analysis.json \
  --creative-analysis tests/fixtures/sample_creative_analysis.json
```

---

## Key constraints

- Score Breakdown evaluates **data quality only** — it never evaluates ad creative
- All dimension and section scores are computed deterministically — Claude writes one paragraph only
- This agent runs once per session after Phase 1 — no `rescore()` method, fully cached after first run
- Section recs are strings, not objects — keep them short and actionable (one sentence each)
- `global_top3` must draw from section recs — Claude does not generate its own actions
- The composite grade is derived from section scores — Claude does not assign or influence the grade
- If any sibling agent errored, Score Breakdown must still run with available data and note the gap explicitly in `data_quality_read`
- Claude's paragraph must not contradict the grade — a grade D run should not read as "mostly fine"
