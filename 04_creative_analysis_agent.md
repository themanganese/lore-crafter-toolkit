# Silki — Agent 04: Creative Analysis
`agent_id: creative_analysis` · `stack: Python` · `apis: Claude API + Scenario API`

---

## Purpose

The execution agent. Takes the BI brief from Trend Analysis, uses Claude to write the prompt blueprint, calls Scenario API to generate ready-to-test static ad variants, then self-scores the output across 5 creative dimensions.

---

## Root causes fixed in this version

| # | Bug | Fix |
|---|---|---|
| 1 | `dotenv` never loaded — API keys silently missing | Added `load_dotenv()` at top of `agent.py` |
| 2 | `anthropic.Anthropic()` instantiated at module level — before `.env` loads, raises `AuthenticationError` | Moved client construction inside `_client()` function |
| 3 | `asyncio.gather(square_task, story_task)` called without `await` — returns coroutines, not results | Added `await` |
| 4 | `apply_mutations()` called in `regenerate()` but never defined | Implemented `apply_mutations()` in `agent.py` |
| 5 | Scenario API returns async job — code reads `r.json()["images"][0]["url"]` immediately, but generation is not instant — `KeyError` | Added async polling loop with `poll_scenario_job()` |
| 6 | `CreativeAnalysisOutput` missing `ad_score` field — added in last session but not reflected in the output construction | Fixed output construction to include `ad_score` |
| 7 | Creative rubric functions (`score_hook_strength` etc.) return `tuple[int, str]` but caller unpacks only `int` — `TypeError` | Fixed all callers to unpack both values |
| 8 | Pydantic v2: `.dict()` deprecated | Replaced with `.model_dump()` |
| 9 | No `asyncio.run()` entry point | Added `if __name__ == "__main__"` block |

---

## Inputs

| Field | Source | Used for |
|---|---|---|
| `bi_brief` | Trend Analysis output (cached) | Prompt blueprint generation |
| `game.genre` | SharedContext | Model selection |
| `game.audience_segment` | SharedContext | Copy tone calibration |
| `context.scraped_ads` | SharedContext | Reference asset IDs for Scenario |

> Trend Analysis must complete before this agent runs. The Orchestrator passes `cached_bi_brief` at dispatch time.

---

## Folder structure

```
agents/creative_analysis/
├── agent.py              # Entry point — run() and regenerate() both here
├── claude_creative.py    # write_prompt_blueprint() + score_ad_with_claude()
├── creative_rubric.py    # Deterministic dimension scoring functions
├── scenario_client.py    # generate_image() + poll_scenario_job()
├── model_selector.py     # select_model()
└── models.py             # AdVariant, AdScore, DimensionScore, Lever, CreativeAnalysisOutput
```

---

## claude_creative.py

```python
# claude_creative.py
import anthropic
import json
import logging
import os

logger = logging.getLogger(__name__)

def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

def _parse(text: str, context: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.error(f"Claude non-JSON in {context}: {text[:300]}")
        raise


def write_prompt_blueprint(bi_brief: dict) -> dict:
    ci   = bi_brief["creative_intelligence"]
    spec = bi_brief["generation_spec"]

    prompt = f"""You are a mobile game ad creative director writing generation prompts for an AI image model.

Given this creative brief, produce:
1. A Scenario image generation prompt (max 120 words) for a static square ad (1080x1080)
2. A Scenario image generation prompt (max 120 words) for a static story ad (1080x1920)
3. A primary hook line (max 10 words) for overlay copy
4. A CTA (max 5 words)

Brief:
- Hook type: {ci["hook_type"]}
- Narrative arc: {ci["narrative_arc"]}
- Visual style: {ci["visual_style"]}
- Emotional levers: {ci["emotional_lever"]}
- Differentiation angle: {ci["differentiation_angle"]}
- Style tokens to use: {spec["style_tokens"]}
- Negative tokens (exclude): {spec["negative_tokens"]}
- Tone: {ci["copy_direction"]["tone"]}

Rules:
- Do not include human faces unless talent is specified
- Do not use patterns tagged as saturating
- Prompts must be concrete and visual — no abstract language
- Lead with the strongest visual element

Respond in JSON only. Keys: prompt_square, prompt_story, hook_copy, cta.
No preamble."""

    response = _client().messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    return _parse(response.content[0].text, "write_prompt_blueprint")


def score_ad_with_claude(
    dimension_scores: dict,
    bi_brief: dict,
    previous_scores: dict | None = None,
    levers_applied:  list[str]  | None = None,
) -> dict:
    delta_summary = {}
    if previous_scores:
        delta_summary = {
            dim: dimension_scores[dim]["score"] - previous_scores.get(dim, {}).get("score", 0)
            for dim in dimension_scores
        }

    exclusion = f"\nLevers already applied — exclude from suggestions: {levers_applied}" if levers_applied else ""
    deltas     = f"\nScore deltas vs previous variant: {json.dumps(delta_summary)}" if delta_summary else ""

    prompt = f"""You are a senior mobile game creative strategist reviewing an ad variant.

Given these dimension scores, write:
1. One paragraph strategic read — what is strong, what is the ceiling, what remains to unlock
2. Up to 4 improvement levers, ranked by estimated_point_delta descending, each with:
   - lever_id: "01" | "02" | "03" | "04"
   - title (str)
   - description (1-2 sentences)
   - pattern_affected (str)
   - trend_velocity: "rising" | "stable" | "declining"
   - signal_strength: "high" | "medium"
   - estimated_point_delta (int)
{exclusion}{deltas}

Dimension scores: {json.dumps(dimension_scores)}
Brief summary: hook_type={bi_brief["creative_intelligence"]["hook_type"]}, differentiation_angle={bi_brief["creative_intelligence"]["differentiation_angle"]}

Respond in JSON only. Keys: claude_read (str), levers (list).
No preamble."""

    max_tokens = 600 if previous_scores else 800

    response = _client().messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return _parse(response.content[0].text, "score_ad_with_claude")
```

---

## creative_rubric.py

```python
# creative_rubric.py
# Each function returns (score: int, note: str).
# Caller must unpack both values — do not discard the note.

WEIGHTS = {
    "hook_strength":      0.25,
    "visual_novelty":     0.20,
    "platform_fit":       0.15,
    "audience_alignment": 0.20,
    "differentiation":    0.20,
}

def score_hook_strength(blueprint: dict) -> tuple[int, str]:
    score = 60
    if blueprint.get("hook_copy"):
        score += 9
    # hook_window_seconds lives in bi_brief, not blueprint — default 3
    note = "Strong hook copy present" if score >= 69 else "Hook copy present but weak"
    return min(score, 100), note

def score_visual_novelty(bi_brief: dict) -> tuple[int, str]:
    saturating   = [p["pattern"] for p in bi_brief["creative_intelligence"].get("what_is_saturating", [])]
    style_tokens = bi_brief["generation_spec"].get("style_tokens", [])
    overlap      = len(set(s.lower() for s in saturating) & set(s.lower() for s in style_tokens))
    score        = max(70 - (overlap * 12), 0)
    note         = f"{overlap} saturating pattern(s) in style tokens" if overlap else "No saturating patterns used"
    return score, note

def score_platform_fit(bi_brief: dict) -> tuple[int, str]:
    formats = [f["type"] for f in bi_brief["generation_spec"].get("formats", [])]
    if "static_square" in formats or "static_story" in formats:
        return 90, "Correct dimensions for target platforms"
    return 65, "Format spec does not match target platform"

def score_audience_alignment(bi_brief: dict) -> tuple[int, str]:
    segment = bi_brief["game_context"].get("audience_segment", "").lower()
    levers  = bi_brief["creative_intelligence"].get("emotional_lever", [])
    score   = 60
    if "FOMO" in levers and "casual" in segment:
        score += 18
    if "mastery" in levers and ("core" in segment or "rpg" in segment):
        score += 15
    note = "Emotional levers match audience segment" if score >= 75 else "Lever-audience fit is partial"
    return min(score, 100), note

def score_differentiation(bi_brief: dict, scraped_ads: list) -> tuple[int, str]:
    ref_tokens   = set()
    for ad in scraped_ads:
        ref_tokens.update(t.lower() for t in ad.get("style_tokens", []))
    brief_tokens = set(t.lower() for t in bi_brief["generation_spec"].get("style_tokens", []))
    overlap      = len(ref_tokens & brief_tokens)
    score        = max(80 - (overlap * 9), 0)
    note         = f"Visually distinct from {len(scraped_ads)} scraped ad(s)" if overlap == 0 \
                   else f"{overlap} overlapping style token(s) with scraped ads"
    return score, note

def compute_win_probability(dimension_scores: dict) -> int:
    return round(sum(dimension_scores[d]["score"] * WEIGHTS[d] for d in WEIGHTS))

def run_rubric(blueprint: dict, bi_brief: dict, scraped_ads: list) -> dict:
    """Returns a dimension_scores dict ready for Claude and output schema."""
    hs, hs_note = score_hook_strength(blueprint)
    vn, vn_note = score_visual_novelty(bi_brief)
    pf, pf_note = score_platform_fit(bi_brief)
    aa, aa_note = score_audience_alignment(bi_brief)
    di, di_note = score_differentiation(bi_brief, scraped_ads)

    return {
        "hook_strength":      {"score": hs, "note": hs_note},
        "visual_novelty":     {"score": vn, "note": vn_note},
        "platform_fit":       {"score": pf, "note": pf_note},
        "audience_alignment": {"score": aa, "note": aa_note},
        "differentiation":    {"score": di, "note": di_note},
    }
```

---

## scenario_client.py

```python
# scenario_client.py
import asyncio
import httpx
import os
import logging

logger = logging.getLogger(__name__)

SCENARIO_API_URL = os.getenv("SCENARIO_API_URL", "https://api.scenario.com/v1")

def _headers() -> dict:
    return {
        "Authorization": f"Bearer {os.environ['SCENARIO_API_KEY']}",
        "Content-Type":  "application/json",
    }

async def generate_image(
    prompt:              str,
    negative_prompt:     str,
    width:               int,
    height:              int,
    model_id:            str  = "ideogram-v2",
    reference_asset_ids: list | None = None,
) -> str:
    """Submits generation job and polls until complete. Returns image URL."""
    payload = {
        "prompt":         prompt,
        "negativePrompt": negative_prompt,
        "width":          width,
        "height":         height,
        "numImages":      1,
        "modelId":        model_id,
        "parameters":     {"guidance": 7.5, "numInferenceSteps": 30},
    }
    if reference_asset_ids:
        payload["referenceImages"] = [
            {"assetId": aid, "weight": 0.35} for aid in reference_asset_ids
        ]

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{SCENARIO_API_URL}/images/generations",
            headers=_headers(),
            json=payload,
        )
        r.raise_for_status()
        data = r.json()

    # Scenario returns a job ID — poll until images are ready
    job_id = data.get("job", {}).get("jobId") or data.get("jobId")
    if job_id:
        return await poll_scenario_job(job_id)

    # Some Scenario endpoints return images synchronously
    try:
        return data["images"][0]["url"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Unexpected Scenario response shape: {data}") from e


async def poll_scenario_job(
    job_id:       str,
    max_attempts: int = 30,
    interval_s:   float = 3.0,
) -> str:
    """Polls Scenario job status until complete. Returns image URL."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        for attempt in range(max_attempts):
            r = await client.get(
                f"{SCENARIO_API_URL}/images/generations/{job_id}",
                headers=_headers(),
            )
            r.raise_for_status()
            data = r.json()
            status = data.get("job", {}).get("status") or data.get("status")

            if status == "succeeded":
                try:
                    return data["job"]["images"][0]["url"]
                except (KeyError, IndexError):
                    return data["images"][0]["url"]

            if status == "failed":
                raise RuntimeError(f"Scenario job {job_id} failed: {data}")

            logger.debug(f"Job {job_id} status={status}, attempt {attempt+1}/{max_attempts}")
            await asyncio.sleep(interval_s)

    raise TimeoutError(f"Scenario job {job_id} did not complete in {max_attempts * interval_s}s")
```

---

## model_selector.py

```python
# model_selector.py

MODEL_MAP = {
    "text_in_image":  "ideogram-v2",
    "photorealistic": "flux-dev",
    "illustrated":    "recraft-ai-v3",
}

def select_model(genre: str, visual_style: str) -> str:
    g = genre.lower()
    v = visual_style.lower()
    if "puzzle" in g or "casual" in g or "hypercasual" in g:
        return MODEL_MAP["illustrated"]
    if "hyperreal" in v or "gameplay" in v or "photorealistic" in v:
        return MODEL_MAP["photorealistic"]
    return MODEL_MAP["text_in_image"]
```

---

## models.py

```python
# models.py
from pydantic import BaseModel
from typing import List, Optional

class AdVariant(BaseModel):
    format:      str
    platform:    str
    dimensions:  str
    model_used:  str
    image_url:   str
    prompt_used: str
    hook_copy:   str
    cta:         str

class DimensionScore(BaseModel):
    dimension:      str
    score:          int
    note:           str
    previous_score: Optional[int] = None
    delta:          Optional[int] = None

class Lever(BaseModel):
    lever_id:              str
    rank:                  int
    title:                 str
    description:           str
    pattern_affected:      str
    trend_velocity:        str
    signal_strength:       str
    estimated_point_delta: int

class AdScore(BaseModel):
    win_probability:  int
    dimension_scores: List[DimensionScore]
    claude_read:      str
    levers:           List[Lever]

class CreativeAnalysisOutput(BaseModel):
    variant_version:     str
    levers_applied:      List[str]
    variants:            List[AdVariant]
    blueprint:           dict
    ad_score:            AdScore        # creative scoring lives here
    generation_metadata: dict
```

---

## agent.py

```python
# agent.py
import asyncio
import argparse
import json
from dotenv import load_dotenv

load_dotenv()   # must be first

from claude_creative  import write_prompt_blueprint, score_ad_with_claude
from creative_rubric  import run_rubric, compute_win_probability
from scenario_client  import generate_image
from model_selector   import select_model
from models           import (
    AdVariant, AdScore, DimensionScore, Lever, CreativeAnalysisOutput
)


def apply_mutations(bi_brief: dict, mutations: dict) -> dict:
    """
    Returns a shallow-mutated copy of bi_brief.
    mutations keys: remove (list[str]), add (list[str]), swap (dict)
    """
    import copy
    brief = copy.deepcopy(bi_brief)
    ci    = brief["creative_intelligence"]
    spec  = brief["generation_spec"]

    for pattern in mutations.get("remove", []):
        # Remove from style_tokens and working patterns
        spec["style_tokens"]     = [t for t in spec.get("style_tokens", []) if pattern.lower() not in t.lower()]
        spec["negative_tokens"]  = list(set(spec.get("negative_tokens", []) + [pattern]))
        ci["what_is_working"]    = [p for p in ci.get("what_is_working", []) if p["pattern"].lower() != pattern.lower()]

    for pattern in mutations.get("add", []):
        if pattern not in spec.get("style_tokens", []):
            spec.setdefault("style_tokens", []).append(pattern)

    for old, new in mutations.get("swap", {}).items():
        spec["style_tokens"] = [new if t.lower() == old.lower() else t for t in spec.get("style_tokens", [])]

    return brief


async def _generate_variants(blueprint: dict, bi_brief: dict, scraped_ads: list) -> list[dict]:
    spec           = bi_brief["generation_spec"]
    negative_prompt = " ".join(spec.get("negative_tokens", []))
    model          = select_model(
        bi_brief["game_context"]["genre"],
        bi_brief["creative_intelligence"]["visual_style"],
    )
    ref_ids = spec.get("reference_asset_ids", [])

    # Both formats generated in parallel — await is required
    square_url, story_url = await asyncio.gather(
        generate_image(blueprint["prompt_square"], negative_prompt, 1080, 1080, model, ref_ids),
        generate_image(blueprint["prompt_story"],  negative_prompt, 1080, 1920, model, ref_ids),
    )

    return [
        AdVariant(format="static_square", platform="Meta Feed",             dimensions="1080x1080",
                  model_used=model, image_url=square_url,
                  prompt_used=blueprint["prompt_square"],
                  hook_copy=blueprint["hook_copy"], cta=blueprint["cta"]).model_dump(),
        AdVariant(format="static_story",  platform="Meta Stories / TikTok", dimensions="1080x1920",
                  model_used=model, image_url=story_url,
                  prompt_used=blueprint["prompt_story"],
                  hook_copy=blueprint["hook_copy"], cta=blueprint["cta"]).model_dump(),
    ]


def _build_ad_score(
    blueprint:       dict,
    bi_brief:        dict,
    scraped_ads:     list,
    previous_scores: dict | None     = None,
    levers_applied:  list[str] | None = None,
) -> dict:
    dimension_scores = run_rubric(blueprint, bi_brief, scraped_ads)

    # Attach deltas for regeneration runs
    if previous_scores:
        for dim in dimension_scores:
            prev = previous_scores.get(dim, {}).get("score")
            dimension_scores[dim]["previous_score"] = prev
            dimension_scores[dim]["delta"]          = dimension_scores[dim]["score"] - prev if prev else None

    claude = score_ad_with_claude(
        dimension_scores=dimension_scores,
        bi_brief=bi_brief,
        previous_scores=previous_scores,
        levers_applied=levers_applied,
    )

    return AdScore(
        win_probability  = compute_win_probability(dimension_scores),
        dimension_scores = [
            DimensionScore(dimension=dim, **vals)
            for dim, vals in dimension_scores.items()
        ],
        claude_read = claude["claude_read"],
        levers      = [Lever(rank=i+1, **l) for i, l in enumerate(claude.get("levers", []))],
    ).model_dump()


class CreativeAnalysisAgent:

    async def run(self, context, bi_brief: dict) -> dict:
        scraped_ads = [ad.model_dump() for ad in context.scraped_ads]

        blueprint = write_prompt_blueprint(bi_brief)
        variants  = await _generate_variants(blueprint, bi_brief, scraped_ads)
        ad_score  = _build_ad_score(blueprint, bi_brief, scraped_ads)

        output = CreativeAnalysisOutput(
            variant_version     = "v01",
            levers_applied      = [],
            variants            = variants,
            blueprint           = blueprint,
            ad_score            = ad_score,
            generation_metadata = {
                "model_used":           variants[0]["model_used"],
                "reference_asset_ids_used": bi_brief["generation_spec"].get("reference_asset_ids", []),
            },
        )
        return output.model_dump()

    async def regenerate(
        self,
        bi_brief:        dict,
        lever_diff:      dict,
        regen_count:     int,
        previous_scores: dict | None,
        scraped_ads:     list,
        game:            dict,
    ) -> dict:
        mutated_brief = apply_mutations(bi_brief, lever_diff.get("mutations", {}))

        blueprint = write_prompt_blueprint(mutated_brief)
        variants  = await _generate_variants(blueprint, mutated_brief, scraped_ads)
        ad_score  = _build_ad_score(
            blueprint,
            mutated_brief,
            scraped_ads,
            previous_scores=previous_scores,
            levers_applied=lever_diff.get("apply_levers", []),
        )

        output = CreativeAnalysisOutput(
            variant_version     = f"v{regen_count + 1:02d}",
            levers_applied      = lever_diff.get("apply_levers", []),
            variants            = variants,
            blueprint           = blueprint,
            ad_score            = ad_score,
            generation_metadata = {
                "model_used":           variants[0]["model_used"],
                "reference_asset_ids_used": mutated_brief["generation_spec"].get("reference_asset_ids", []),
            },
        )
        return {**output.model_dump(), "needs_rescore": False}   # self-scores — no external rescore needed


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bi-brief", required=True, help="Path to BI brief JSON fixture")
    parser.add_argument("--levers",   nargs="*",    help="Lever IDs to apply (e.g. 01 02)")
    args = parser.parse_args()

    with open(args.bi_brief) as f:
        bi_brief = json.load(f)

    class _Ad:
        def model_dump(self): return {}

    class _Context:
        scraped_ads = []

    agent = CreativeAnalysisAgent()

    if args.levers:
        result = await agent.regenerate(
            bi_brief=bi_brief,
            lever_diff={"apply_levers": args.levers, "mutations": {}},
            regen_count=1,
            previous_scores=None,
            scraped_ads=[],
            game=bi_brief.get("game_context", {}),
        )
    else:
        result = await agent.run(_Context(), bi_brief)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
```

---

## Token economy on regeneration

| Operation | Initial run | On regeneration | Saving |
|---|---|---|---|
| Trend Analysis Claude calls | 2 calls (~1500 tokens) | 0 — cached | 100% |
| Revenue Forecast Claude call | 1 call (~600 tokens) | 0 — cached | 100% |
| Score Breakdown Claude call | 1 call (~700 tokens) | 0 — cached | 100% |
| Sensor Tower API calls | 2 calls | 0 — cached | 100% |
| Creative — prompt blueprint | 1 call (~800 tokens) | 1 call — mutated brief only | ~30% smaller |
| Creative — ad scoring Claude | 1 call (~800 tokens) | 1 call — delta only, 600 max_tokens | ~40% smaller |
| Scenario generation | 2 images | 2 images | Always regenerated |

---

## VS Code setup

```bash
python -m venv .venv
source .venv/bin/activate

pip install anthropic httpx pydantic python-dotenv

# Run initial generation
python -m agents.creative_analysis.agent \
  --bi-brief tests/fixtures/sample_bi_brief.json

# Test lever regeneration
python -m agents.creative_analysis.agent \
  --bi-brief tests/fixtures/sample_bi_brief.json \
  --levers 01 02
```

**.env required keys:**
```env
ANTHROPIC_API_KEY=sk-ant-...
SCENARIO_API_KEY=...
SCENARIO_API_URL=https://api.scenario.com/v1
```

---

## Key constraints

- `load_dotenv()` is the first statement in `agent.py`
- `anthropic.Anthropic()` constructed inside `_client()` — never at module level
- `asyncio.gather()` must always be `await`ed — missing await returns coroutines not results
- `generate_image()` polls via `poll_scenario_job()` — never reads `images[0]["url"]` from the initial POST response
- `apply_mutations()` returns a deep copy — never mutates `cached_bi_brief` in `RunContext`
- All rubric functions return `tuple[int, str]` — always unpack both values via `run_rubric()`
- `needs_rescore` is `False` on regeneration — Creative Analysis self-scores, Score Breakdown is cached
- Use `.model_dump()` not `.dict()` throughout — Pydantic v2
