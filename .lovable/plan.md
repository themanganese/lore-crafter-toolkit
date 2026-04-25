
# CreatorForge — Ad Intelligence × Creative Generator

A dark, soulslike-styled BI tool where every game becomes a "character sheet" of ad-performance stats. Analyze the market, then forge a tailored creative in one pipeline.

## The pipeline (left-to-right)

```text
[ Pick Game ] → [ Pull Top Ads ] → [ AI Insight Extraction ] → [ Character Sheet ] → [ Brief Builder ] → [ Scenario Creative ]
   SensorTower       SensorTower         Lovable AI               BI dashboard         Editable           Scenario REST
```

Every step is visible and re-runnable from a single workspace screen — no hidden magic.

## Core experience

**1. Forge — pick or upload a target game**
- Search SensorTower by name, or paste a game ID (iOS/Android)
- Recently analyzed games shown as "character cards" in a roster grid
- Empty state encourages uploading the first competitor

**2. Scry — pull top-performing ads**
- Server fetches top creatives for that game's vertical from SensorTower (impressions, CTR, run duration, networks)
- Live progress log ("Summoning 47 creatives… analyzing hooks… ranking by impact")
- Each ad lands as a card with thumbnail, hook label, performance tier (S/A/B/C/D)

**3. Character Sheet — the BI dashboard (soulslike layout)**
- AI infers the right 5–7 stats for the game's vertical (e.g. puzzle gets "Satisfaction Beat", "Fail Loop", "Color Pop"; RPG gets "Power Fantasy", "Loot Drop", "Combat Clarity")
- Each stat: 0–100 numeric score, S–D tier badge, one-line "lore" explaining why
- Radar chart on the left, equipped "weapons" (top 3 hooks) on the right, codex tab with raw insights
- "Compare vs another character" overlays two radar charts

**4. Brief Builder — turn insights into a creative spec**
- Auto-drafted creative brief from the strongest stats + hooks
- Editable fields: target hook, mechanic, visual cue, pacing, CTA, target game
- "Tailor for…" picker selects which of *your* games this creative is for

**5. Anvil — Scenario generation**
- Sends the finalized brief to Scenario REST API (text-to-image, model picker)
- Streamed status, results gallery, regenerate / edit prompt / download
- Each generated creative saved to the game's "armory"

## Data products & sharing

- Local-first: characters, briefs, generated creatives saved in browser (IndexedDB)
- Every character sheet, brief, and creative gallery has a "Share as data product" action that exports a self-contained read-only JSON snapshot + a public view URL (signed, no auth)
- Recipients see the full character sheet read-only, can fork into their own workspace

## Visual direction (Dark Souls grim)

- Background `#0d0d0d`, panels `#1a1a1a`, accents gold `#c9a84c` / pale gold `#f0d78c`
- Cinzel/Trajan-style display headings, IBM Plex Mono for stats and codex
- Heavy gold-trimmed borders, weathered parchment textures inside panels, subtle ember particles on hover for S-tier items
- Tier badges glow (S = pulsing gold, A = solid gold, B = bronze, C = iron, D = ash)
- Layout: persistent left rail (roster of analyzed games), main canvas (current step of pipeline), right inspector (raw data / codex)

## Routes

- `/` — Forge (game search + roster)
- `/character/$gameId` — Character sheet (BI dashboard)
- `/character/$gameId/brief` — Brief Builder
- `/character/$gameId/anvil` — Scenario generation + armory
- `/share/$snapshotId` — Public read-only data product view
- `/settings` — API keys (Scenario REST), preferences

## What ships in v1 (full pipeline scope = 5)

All five pipeline stages wired end-to-end with real APIs, the soulslike dashboard, brief builder, Scenario generation, local persistence, and shareable data product snapshots.

---

## Technical notes

- **Stack**: TanStack Start, Tailwind v4, shadcn, Recharts for radar charts
- **SensorTower**: server function calls SensorTower Ad Intelligence API (`/v1/ad_intel/creatives/top`); requires `SENSORTOWER_API_KEY` (will request after plan approval)
- **Scenario**: server function calls `https://api.cloud.scenario.com/v1/generate/txt2img` with `SCENARIO_API_KEY`; polls job status; returns asset URLs
- **AI insight extraction**: Lovable AI Gateway (`google/gemini-3-flash-preview`) with tool-calling for structured stat output; vertical-specific system prompts that infer the right stat axes per game category
- **Local storage**: IndexedDB via `idb` for characters, briefs, creative galleries
- **Data product sharing**: snapshots written to a public `/api/public/snapshot/$id` endpoint backed by Lovable Cloud storage (enable Lovable Cloud) with signed read URLs; no auth required to view
- **Reusable adapter**: SensorTower client behind an `AdIntelProvider` interface so swapping providers later is one file
- **Secrets needed after approval**: `SENSORTOWER_API_KEY`, `SCENARIO_API_KEY`. Lovable AI key is auto-provisioned.
- **No MCP server protocol**: clarified that Scenario REST is used directly (user has REST key, not an MCP endpoint)
