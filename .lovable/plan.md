## Forge by Silki — Unified Dashboard Rebuild

A full pivot from the dark-souls "Scry / Anvil / Banish" wording into a lighter, game-like UI named **Forge by Silki**, with the four Silki agent outputs (Score Breakdown, Revenue Forecast, Trend Analysis, Creative Analysis) presented on a single expandable dashboard per game.

---

### 1. Rebrand + lighter game-like theme

- Rename everywhere: `CreatorForge` → `Forge by Silki`. Tagline: "Ad intelligence × creative anvil, by Silki."
- Replace the near-black palette with a lighter, parchment/warm-game look (kept warm and premium, not flat-white):
  - Background: warm cream `oklch(0.96 0.015 80)`, subtle paper grain
  - Panels: ivory `oklch(0.99 0.008 85)` with soft shadow + thin gold rule
  - Primary: deep amber gold `oklch(0.62 0.15 70)` (kept brand continuity)
  - Accent (CTA / "in progress"): copper `oklch(0.55 0.18 45)`
  - Text: warm charcoal `oklch(0.22 0.02 60)`
  - Tier colors stay (S = bright amber, A = gold, B = bronze, C = slate, D = ash) but on a light surface
- Drop the heavy scanlines / ember overlays. Keep elegant gold-rule frames around hero panels (the AC-style reference look) and a soft inner glow on hover.
- Headings keep Cinzel for the game-sheet feel, body switches to Inter, mono stays IBM Plex Mono for stat numbers.

### 2. Plain-English action labels

Replace fantasy verbs with clear ones:
- `Scry` → `Analyze` (search button) and `Run analysis` (the agent kickoff)
- `Re-scry` → `Re-run`
- `Banish` → `Remove`
- `Forge a brief` / `Forge` → `Build brief` / `Generate`
- `The Anvil` keeps the name as a section title (it's the generator), but its primary CTA becomes `Generate variant`

### 3. One-page expandable dashboard (`/character/$gameId`)

The current 3-tab layout (Sheet / Ads / Codex) and the separate `/brief` and `/anvil` routes collapse into a single scroll-and-expand dashboard. The only thing that stays per-section is **Trend Analysis**, which is split into its own sub-cards (Working patterns, Saturating patterns, Velocity matrix, Differentiation angle) — each independently expandable.

Section order on the page (each is a collapsible panel, all but the first collapsed by default):

1. **Game header** (always open)
   Hero image of the app icon big, name in large display, publisher · platform · refined vertical, badges (overall Win Probability, Confidence). Right side: `Re-run`, `Share`, `Remove`. AC-style gold frame.

2. **Score Breakdown** (open by default)
   - Big radar of the 5 weighted dimensions (hook strength, visual novelty, platform fit, audience alignment, differentiation)
   - Win-probability gauge + confidence label (high/medium/low)
   - Per-dimension stat rows with tier badges and one-line "lore" line
   - **Improvement Levers** card: ranked list with title, description, estimated point delta, "Apply lever" button (queues for next variant generation)
   - Claude's strategic read paragraph at the bottom

3. **Revenue Forecast** (collapsible)
   - 30 / 60 / 90 day projections as three large stat tiles, each tagged "Sensor Tower data" or "Modelled" with a confidence pill
   - Baseline monthly USD as the headline number
   - Risk + Opportunity callouts (Claude narrative)
   - Applied assumptions table (A01–A07) with hover tooltips
   - "Sensitive assumptions" highlight

4. **Trend Analysis** (collapsible, with **its own sub-sections** as the user requested)
   Inside, each of these is independently expandable:
   - 4a. **What's working** — pattern cards with signal_strength, trend_velocity, window_appearances, output_tag (lead/safe/caution)
   - 4b. **What's saturating** — pattern cards with avoid/caution tags
   - 4c. **Velocity × signal matrix** — small visual grid showing where each pattern lands
   - 4d. **Differentiation angle** — the white-space recommendation, hook type, narrative arc, emotional levers

5. **Top Ads (Reference)** (collapsible)
   The SensorTower creatives grid, same as today's Ads tab, with tier badges.

6. **Brief Builder** (collapsible, inline)
   What lived at `/brief` becomes an inline panel: target game name input, "Auto-draft" button, editable fields (hook, mechanic, visual cue, pacing, CTA, prompt), "Save & generate".

7. **Anvil — Generation Studio** (always open at the bottom)
   - Brief picker on the left, active brief preview on the right
   - `Generate variant` CTA
   - **Thumbnail grid below** of all generations for this game (YouTube-feed style). Clicking any thumbnail opens it in a **new tab** at `/character/$gameId/edit/$generationId` — a focused Scenario edit view with prompt + regenerate + image-to-image edit.
   - Each thumbnail shows variant version (v01, v02), levers applied chips, score delta arrow vs previous

8. **Gallery** (collapsible)
   Per-game gallery containing both generated creatives **and user-uploaded reference images** (mood board). Drag-and-drop or paste URL upload. Filters: All / Generated / Uploaded. Click → lightbox.

The old routes `/character/$gameId/brief` and `/character/$gameId/anvil` redirect to the new single page anchored at the right section. The thumbnail edit view becomes a new route.

### 4. Live AI thinking trace ("Show your work")

When the user runs an analysis (initial or re-run), instead of the current static "Scrying… summoning… ranking…" list we stream the actual thinking. Implementation:

- A new `runFullAnalysis` server function that orchestrates the four Silki-style agent calls in sequence and writes incremental events to a small in-memory stream (per-run id) — the client polls `getRunEvents(runId)` every 800ms.
- Each agent emits human-readable steps as it works:
  - "Pulling top 24 creatives from SensorTower for `royalmatch`…"
  - "Found 18 creatives. Calling Trend Analysis…"
  - "Trend Analysis: identified 6 working patterns and 3 saturating patterns."
  - "Calling Revenue Forecast — applying assumption A01 (ad share 35%)…"
  - "Score Breakdown: weighting hook_strength × 0.25, visual_novelty × 0.20…"
  - "Claude is writing the strategic read…"
- Rendered as a terminal-like panel with a copper "thinking" pulse, ticked off as each step completes. The whole trace is saved on the character so the user can re-open it later from the dashboard ("View AI reasoning").

### 5. Floating Ask AI button

A copper floating action button bottom-right on every page. Clicking opens a slide-in chat panel:

- General Silki creative-strategy assistant + injected context for the **currently open game** (its character name, vertical, top stats, top hooks, codex, recent generations). On `/` (no game open) the assistant works in general mode.
- Streaming responses via Lovable AI (`google/gemini-3-flash-preview`)
- Conversation persisted in IndexedDB per game
- Markdown rendering with `react-markdown`
- Quick prompt chips: "Why is my visual novelty low?", "Suggest 3 hooks", "What should I test next?"

### 6. Determine metrics with Claude

When an analysis runs, we add a small upfront Claude (Lovable AI) call that decides **which metrics matter for this specific game's vertical** and which to suppress. It returns:
- The 5–7 stat axes (already existing) — kept
- Which of the four panels to emphasize (e.g., Revenue Forecast may be flagged "low confidence — collapse by default" if SensorTower returned no revenue data)
- Which assumptions to surface vs. hide as advanced
- A short "what to focus on" caption rendered at the top of the page

This means panels self-curate per game rather than showing every metric to every game.

### 7. Generation thumbnail → edit-in-new-tab flow

- Each `GeneratedCreative` thumbnail in the dashboard's Anvil grid is an `<a target="_blank" href="/character/$gameId/edit/$generationId">`.
- The new edit route opens a clean Scenario editing surface: large preview, prompt textarea, model picker, `Regenerate`, `Edit with instruction` (image-to-image style — second Scenario call seeded with the previous image), and a "Send back to gallery" button.
- Behaves like opening a YouTube video in a new tab — the original dashboard stays put.

### 8. Update Scenario API key

Replace stored `SCENARIO_API_KEY` with the new value `api_g92qS9paMNqu9G83sYKGi96r`. (Existing secret is updated, no new secret added.)

---

### Files / structure (technical)

New / changed:
- `src/styles.css` — light theme palette, parchment textures, gold-rule frame utility
- `src/routes/__root.tsx` — title rebrand, lighter html background, mount FloatingAskAI
- `src/components/Roster.tsx` — rebrand, lighter sidebar (or convert to top nav for the lighter look), copper accents
- `src/routes/index.tsx` — copy: "Forge by Silki", "Analyze" button
- **`src/routes/character.$gameId.tsx`** — replaced with the single expandable dashboard composing all sections
- **New** `src/routes/character.$gameId.brief.tsx` — becomes a thin redirect to `/character/$gameId#brief`
- **New** `src/routes/character.$gameId.anvil.tsx` — thin redirect to `#anvil`
- **New** `src/routes/character.$gameId.edit.$generationId.tsx` — Scenario edit surface
- **New** `src/components/dashboard/*` — `ExpandPanel`, `GameHeader`, `ScoreBreakdownPanel`, `RevenueForecastPanel`, `TrendAnalysisPanel` (with sub-cards `WorkingPatterns`, `SaturatingPatterns`, `VelocityMatrix`, `DifferentiationAngle`), `TopAdsPanel`, `BriefBuilderPanel`, `AnvilPanel`, `GalleryPanel`, `AIThinkingTrace`, `ImprovementLevers`
- **New** `src/components/AskAIFloating.tsx` + slide-in `AskAIPanel.tsx`
- **New** `src/lib/silki/runs.server.ts` — in-memory run-event store (runId → events[])
- **New** `src/lib/silki/orchestrator.server.ts` — orchestrates Trend → Score → Revenue → Creative analysis, emitting events as it runs (mirrors the Python agent shapes from the uploaded specs)
- **New** `src/lib/silki/score.server.ts`, `revenue.server.ts`, `trend.server.ts` — Lovable AI tool-calling impls of the three new agents (the existing `extractInsights` is folded into `score.server.ts` for the dimensional scoring + claude_read)
- `src/lib/server.functions.ts` — adds `runFullAnalysis`, `getRunEvents`, `applyLevers`, `editGeneration`, `askAI`, `addGalleryImage`
- `src/lib/types.ts` — extends `GameCharacter` with `scoreBreakdown`, `revenueForecast`, `trendAnalysis` (typed payloads), `gallery: GalleryItem[]`, `aiThoughts: ThoughtEvent[]`, `chatMessages: ChatMessage[]`
- `src/lib/store.ts` — bump `DB_VERSION` and add migration to default the new fields on existing characters
- `src/lib/scenario/client.server.ts` — add `editImage(prompt, sourceImageUrl)` for the in-tab Scenario editor
- Update `SCENARIO_API_KEY` secret value to `api_g92qS9paMNqu9G83sYKGi96r`

---

### What stays the same

- TanStack Start app shell, IndexedDB local-first storage, SensorTower adapter, Scenario REST integration, share-snapshot URL flow.
- The character-sheet metaphor (radar + tier badges + lore) — it's just expanded with three more agent panels and dressed in a lighter theme.

---

### Out of scope for this pass

- Multi-user / cloud sync (still local-first)
- Video ad generation (Scenario v1 is static images)
- Cross-session market learning loop (the spec calls this out as future work)