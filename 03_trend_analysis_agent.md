# Silki — Agent 03: Trend Analysis
`agent_id: trend_analysis` · `stack: Python` · `api: Claude API`

---

## Purpose

Analyses scraped ads to identify creative patterns, classify each as working or saturating, assign trend velocity, and produce the structured BI brief consumed by Creative Analysis. This is the market intelligence core of Silki.

---

## Root causes fixed in this version

| # | Bug | Fix |
|---|---|---|
| 1 | `dotenv` never loaded — `ANTHROPIC_API_KEY` missing at runtime | Added `load_dotenv()` at top of `agent.py` |
| 2 | `anthropic.Anthropic()` instantiated at module level — runs before `.env` is loaded, raises `AuthenticationError` | Moved client construction inside function body, reads key at call time |
| 3 | `infer_visual_style()`, `infer_pacing()`, `infer_tone()`, `default_formats()`, `infer_style_tokens()`, `extract_negative_tokens()` all called in `brief_builder.py` but never defined anywhere | Implemented all six functions |
| 4 | `game.get("scraped_ads", [])` called on `GameContext` model — `scraped_ads` is on `SharedContext`, not `GameContext` | Fixed `reference_asset_ids` to read from `context.scraped_ads` not `game` |
| 5 | No `asyncio.run()` entry point — module runs nothing when called directly | Added `if __name__ == "__main__"` block |
| 6 | `json.loads()` called on Claude response without try/except — any non-JSON response crashes silently | Added JSON parse error handling with raw text fallback logging |
| 7 | Pydantic v2: `.dict()` deprecated | Replaced with `.model_dump()` |

---

## Inputs (from SharedContext)

| Field | Source | Used for |
|---|---|---|
| `game.genre` | Product extraction | Genre-scoped pattern benchmarking |
| `game.audience_segment` | Product extraction | Audience-pattern fit scoring |
| `game.core_loop` | Product extraction | Mechanic relevance filtering |
| `context.scraped_ads` | SharedContext | Primary analysis input + reference IDs |
| `context.scrape_window_days` | SharedContext | Velocity window for trend classification |

---

## Folder structure

```
agents/trend_analysis/
├── agent.py              # Entry point — asyncio.run(main()) here
├── claude_trend.py       # extract_patterns() + synthesise_differentiation()
├── velocity_matrix.py    # Deterministic output_tag assignment
├── brief_builder.py      # build_bi_brief() — assembles full BI brief
└── models.py             # Pydantic output schema
```

---

## claude_trend.py

```python
# claude_trend.py
import json
import logging
import os
import anthropic

logger = logging.getLogger(__name__)

def _client() -> anthropic.Anthropic:
    # Constructed at call time — load_dotenv() has already run in agent.py
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

def _parse(text: str, context: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.error(f"Claude returned non-JSON for {context}: {text[:200]}")
        raise


def extract_patterns(scraped_ads: list, game: dict) -> dict:
    prompt = f"""You are a mobile game ad intelligence analyst.

Analyse these {len(scraped_ads)} scraped ads and the game context below.

Your task:
1. Identify all creative patterns across the ads (hook types, visual styles, mechanics, narrative arcs, talent usage, pacing)
2. Classify each pattern as: working | saturating
3. Assign trend_velocity: rising | stable | declining
4. Count window_appearances (how many of the scraped ads use this pattern)
5. Write a one-line recommendation per pattern

Game context: {json.dumps(game)}
Scraped ads: {json.dumps(scraped_ads)}

Respond in JSON only. Structure:
{{
  "what_is_working": [
    {{
      "pattern": "string",
      "signal_strength": "high or medium",
      "trend_velocity": "rising or stable or declining",
      "window_appearances": 0,
      "recommendation": "string"
    }}
  ],
  "what_is_saturating": [
    {{
      "pattern": "string",
      "signal_strength": "high or medium",
      "trend_velocity": "rising or stable or declining",
      "window_appearances": 0,
      "recommendation": "string"
    }}
  ]
}}
No preamble."""

    response = _client().messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )
    return _parse(response.content[0].text, "extract_patterns")


def synthesise_differentiation(patterns: dict, game: dict) -> dict:
    prompt = f"""You are a mobile game creative strategist.

Given these working and saturating patterns and the game context, identify:
1. The single clearest white space — what creative direction is rising but underused?
2. The recommended hook type. Choose one: problem-agitate-solve | curiosity-gap | mastery-arc | social-proof | FOMO | challenge
3. The recommended narrative arc (1 sentence)
4. The emotional levers to activate. Choose 1-3 from: FOMO | identity | mastery | curiosity | social-proof | nostalgia | anxiety-relief

Patterns: {json.dumps(patterns)}
Game context: {json.dumps(game)}

Respond in JSON only. Keys: differentiation_angle (str), hook_type (str), narrative_arc (str), emotional_levers (list of str).
No preamble."""

    response = _client().messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    return _parse(response.content[0].text, "synthesise_differentiation")
```

---

## velocity_matrix.py

```python
# velocity_matrix.py

_MATRIX = {
    ("high",   "rising"):   "lead",
    ("high",   "stable"):   "safe",
    ("high",   "declining"):"caution",
    ("medium", "rising"):   "watch",
    ("medium", "stable"):   "filler",
    ("medium", "declining"):"avoid",
}

def apply_matrix(pattern: dict) -> str:
    key = (pattern.get("signal_strength", ""), pattern.get("trend_velocity", ""))
    return _MATRIX.get(key, "neutral")

def enrich_patterns(patterns: list) -> list:
    for p in patterns:
        p["output_tag"] = apply_matrix(p)
    return patterns
```

---

## brief_builder.py

```python
# brief_builder.py
# All helper functions are defined here — nothing is left undefined.

_VISUAL_STYLE_MAP = {
    "casual":      "vibrant illustrated UI",
    "puzzle":      "vibrant illustrated UI",
    "rpg":         "cinematic fantasy",
    "strategy":    "isometric overview",
    "simulation":  "lifestyle photography",
    "hypercasual": "minimal flat design",
}

_PACING_MAP = {
    "casual":      "fast-cut, 3s hook window",
    "puzzle":      "fast-cut, 3s hook window",
    "rpg":         "moderate, 5s story setup",
    "strategy":    "moderate, 5s story setup",
    "hypercasual": "ultra-fast, 1.5s hook",
}

_TONE_MAP = {
    "FOMO":          "urgent, playful challenge",
    "identity":      "aspirational, self-expressive",
    "mastery":       "confident, achievement-focused",
    "curiosity":     "mysterious, question-led",
    "social-proof":  "warm, community-driven",
    "nostalgia":     "warm, retro",
    "anxiety-relief":"calm, reassuring",
}

def infer_visual_style(genre: str) -> str:
    for key, style in _VISUAL_STYLE_MAP.items():
        if key in genre.lower():
            return style
    return "clean gameplay UI"

def infer_pacing(genre: str) -> str:
    for key, pacing in _PACING_MAP.items():
        if key in genre.lower():
            return pacing
    return "fast-cut, 3s hook window"

def infer_tone(emotional_levers: list) -> str:
    if not emotional_levers:
        return "playful, direct"
    primary = emotional_levers[0]
    return _TONE_MAP.get(primary, "playful, direct")

def default_formats(genre: str) -> list:
    return [
        {"type": "static_square", "platform": "Meta Feed",            "dimensions": "1080x1080"},
        {"type": "static_story",  "platform": "Meta Stories / TikTok", "dimensions": "1080x1920"},
    ]

def infer_style_tokens(game: dict, patterns: dict) -> list:
    tokens = []
    genre = game.get("genre", "").lower()
    if "casual" in genre or "puzzle" in genre:
        tokens += ["vibrant", "high-contrast", "UI-forward"]
    if "rpg" in genre:
        tokens += ["cinematic", "dramatic lighting", "character-driven"]
    working = patterns.get("what_is_working", [])
    for p in working:
        if p.get("output_tag") in ("lead", "safe"):
            tokens.append(p["pattern"].lower().replace(" ", "-"))
    return list(dict.fromkeys(tokens))   # dedup, preserve order

def extract_negative_tokens(saturating_patterns: list) -> list:
    return [
        p["pattern"].lower().replace(" ", "-")
        for p in saturating_patterns
        if p.get("signal_strength") == "high"
    ]

def build_bi_brief(
    game: dict,
    scraped_ads: list,        # from SharedContext — NOT from game
    patterns: dict,
    differentiation: dict,
) -> dict:
    from velocity_matrix import enrich_patterns

    enriched_working    = enrich_patterns(patterns.get("what_is_working", []))
    enriched_saturating = enrich_patterns(patterns.get("what_is_saturating", []))

    return {
        "game_context": game,
        "creative_intelligence": {
            "hook_type":             differentiation["hook_type"],
            "hook_window_seconds":   3,
            "emotional_lever":       differentiation["emotional_levers"],
            "narrative_arc":         differentiation["narrative_arc"],
            "visual_style":          infer_visual_style(game.get("genre", "")),
            "pacing":                infer_pacing(game.get("genre", "")),
            "talent":                "none",
            "what_is_working":       enriched_working,
            "what_is_saturating":    enriched_saturating,
            "differentiation_angle": differentiation["differentiation_angle"],
            "copy_direction": {
                "primary_hook": None,    # populated by Creative Analysis
                "cta":          None,
                "tone":         infer_tone(differentiation.get("emotional_levers", [])),
            },
        },
        "generation_spec": {
            "formats":              default_formats(game.get("genre", "")),
            "style_tokens":         infer_style_tokens(game, {"what_is_working": enriched_working}),
            "negative_tokens":      extract_negative_tokens(enriched_saturating),
            "reference_asset_ids":  [ad["ad_id"] for ad in scraped_ads],  # from SharedContext
        },
    }
```

---

## models.py

```python
# models.py
from pydantic import BaseModel
from typing import List

class Pattern(BaseModel):
    pattern:             str
    signal_strength:     str   # high | medium
    trend_velocity:      str   # rising | stable | declining
    window_appearances:  int
    recommendation:      str
    output_tag:          str   # lead | safe | caution | watch | filler | avoid | neutral

class TrendAnalysisOutput(BaseModel):
    what_is_working:     List[Pattern]
    what_is_saturating:  List[Pattern]
    differentiation_angle: str
    hook_type:           str
    narrative_arc:       str
    emotional_levers:    List[str]
    bi_brief:            dict
```

---

## agent.py

```python
# agent.py
import asyncio
import argparse
import json
from dotenv import load_dotenv

load_dotenv()   # must be first — before any import that touches os.environ

from claude_trend  import extract_patterns, synthesise_differentiation
from brief_builder import build_bi_brief
from models        import TrendAnalysisOutput, Pattern


class TrendAnalysisAgent:
    async def run(self, context) -> dict:
        game        = context.game.model_dump()
        scraped_ads = [ad.model_dump() for ad in context.scraped_ads]

        # Degrade gracefully if too few ads
        if len(scraped_ads) < 2:
            return self._degraded_output(game, scraped_ads)

        # Claude call 1 — pattern extraction
        patterns = extract_patterns(scraped_ads, game)

        # Claude call 2 — differentiation synthesis
        differentiation = synthesise_differentiation(patterns, game)

        # Assemble BI brief
        bi_brief = build_bi_brief(
            game=game,
            scraped_ads=scraped_ads,
            patterns=patterns,
            differentiation=differentiation,
        )

        output = TrendAnalysisOutput(
            what_is_working    = [Pattern(**p) for p in patterns.get("what_is_working", [])],
            what_is_saturating = [Pattern(**p) for p in patterns.get("what_is_saturating", [])],
            differentiation_angle = differentiation["differentiation_angle"],
            hook_type             = differentiation["hook_type"],
            narrative_arc         = differentiation["narrative_arc"],
            emotional_levers      = differentiation["emotional_levers"],
            bi_brief              = bi_brief,
        )
        return output.model_dump()

    def _degraded_output(self, game: dict, scraped_ads: list) -> dict:
        return {
            "what_is_working":      [],
            "what_is_saturating":   [],
            "differentiation_angle": "Insufficient ad data — expand scrape window",
            "hook_type":             "problem-agitate-solve",
            "narrative_arc":         "Unknown — data too thin",
            "emotional_levers":      ["curiosity"],
            "bi_brief":              build_bi_brief(
                game=game,
                scraped_ads=scraped_ads,
                patterns={"what_is_working": [], "what_is_saturating": []},
                differentiation={
                    "differentiation_angle": "Insufficient data",
                    "hook_type": "problem-agitate-solve",
                    "narrative_arc": "Unknown",
                    "emotional_levers": ["curiosity"],
                },
            ),
            "_degraded": True,
            "_reason":   f"Only {len(scraped_ads)} ad(s) scraped — minimum 2 required for pattern detection",
        }


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--context",      required=True, help="Path to SharedContext JSON fixture")
    parser.add_argument("--output-brief", action="store_true", help="Pretty-print BI brief only")
    args = parser.parse_args()

    with open(args.context) as f:
        raw = json.load(f)

    class _Game:
        def model_dump(self): return raw["game"]
        def __getattr__(self, k): return raw["game"].get(k)

    class _Ad:
        def __init__(self, d): self._d = d
        def model_dump(self): return self._d

    class _Context:
        game               = _Game()
        scraped_ads        = [_Ad(a) for a in raw.get("scraped_ads", [])]
        scrape_window_days = raw.get("scrape_window_days", 14)

    agent  = TrendAnalysisAgent()
    result = await agent.run(_Context())

    if args.output_brief:
        print(json.dumps(result.get("bi_brief", {}), indent=2))
    else:
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
```

---

## VS Code setup

```bash
python -m venv .venv
source .venv/bin/activate

pip install anthropic pydantic python-dotenv

# Run in isolation
python -m agents.trend_analysis.agent \
  --context tests/fixtures/sample_context.json

# Inspect BI brief only
python -m agents.trend_analysis.agent \
  --context tests/fixtures/sample_context.json \
  --output-brief
```

---

## Key constraints

- `load_dotenv()` is the first statement in `agent.py` — before all imports that read env vars
- `anthropic.Anthropic()` is constructed inside functions, never at module level
- `build_bi_brief()` takes `scraped_ads` from `context.scraped_ads`, never from `game`
- All six brief_builder helpers (`infer_visual_style`, `infer_pacing`, `infer_tone`, `default_formats`, `infer_style_tokens`, `extract_negative_tokens`) are defined in `brief_builder.py`
- Claude returns JSON — always parse with `_parse()` which logs and re-raises on failure
- If fewer than 2 ads are scraped, `_degraded_output()` is returned — never crash
- Use `.model_dump()` not `.dict()` — Pydantic v2
