# Forge by Silki — frontend

## Product
**Forge** is a Track 3 hackathon submission for Voodoo's Market Intelligence brief. Team name: **Silki**. Submission deadline: **Sunday April 26, 2026, 2:30 PM**.

The product takes a target mobile game, pulls top-performing ads from comparable games via Sensor Tower, runs them through a multi-agent analysis pipeline (orchestrator + score breakdown + revenue forecast + trend analysis + creative analysis), and produces a "Character Dossier" — a structured analysis with a win-probability score, 5-dimension stat breakdown, equipped hooks, trend patterns, and AI-generated creative variants ready for testing.

The brand metaphor is a forge / armory / character codex. UI strings use ceremonial verbs: forge, character, dossier, hook, equipped, gallery, anvil, roster. Never SaaS-isms like analyze, generate, process, dashboard.

## Stack
- **TanStack Start** (React-based meta-framework with file-based routing in `src/routes/`)
- **Bun** as runtime and package manager (`bun install`, `bun run dev`)
- **TypeScript** strict mode
- **Tailwind CSS** with shadcn/ui components (config in `components.json`)
- **Cloudflare Workers** as deploy target (`wrangler.jsonc`)
- **Recharts** for the radar chart and any data viz
- **Lovable** was the initial prompt-to-code editor; this branch (`feat/manan-claude-code-redesign`) is now Claude Code primary. Lovable continues to push to `main` from teammates' edits — keep this branch isolated.

## Architecture
- All API-touching code lives in `*.server.ts` files. TanStack Start ensures these never ship to the browser. API keys stay safe.
- Server functions are defined in `src/lib/server.functions.ts` using `createServerFn`.
- Frontend calls them via `useServerFn` hooks.
- The agent pipeline is in `src/lib/silki/` (orchestrator, ai client, inspired briefs).
- Sensor Tower client: `src/lib/adintel/sensortower.server.ts`.
- Scenario client: `src/lib/scenario/client.server.ts`. Has a `MOCK_SCENARIO=1` env flag that bypasses the live API and returns Picsum placeholders. 
## Code conventions
- Routes are file-based in `src/routes/`. A file at `src/routes/character/$gameId.tsx` becomes `/character/:gameId`.
- Components in `src/components/`. shadcn primitives in `src/components/ui/`. Forge-specific components live close to where they're used (e.g. inside the route file's directory or in `src/components/forge/`).
- Data shapes that match agent outputs live in `src/lib/types.ts`. The `ThoughtAgent` union there is the canonical agent ID list.
- Tailwind only — no inline `style={{}}` for colors or sizes.
- Keep components under ~200 lines. Extract sub-components rather than nesting deeply.
- TypeScript: no `any`. If a type is genuinely unknown, use `unknown` and narrow.

## Visual language
The brand has chosen **warm cream + warm gold** (parchment / illuminated manuscript), not dark slate. Honor this — don't drift toward dark mode "modern SaaS" treatments.

- Background base: `#f7f3ec` (cream/parchment)
- Panel surfaces: white or cream slightly lighter than background
- Borders: `#d4b88a` at 60% opacity, hairline 1px (warm gold)
- Headers: Cinzel serif (or whatever serif the existing site uses — match exactly)
- Body: existing sans
- Large numbers / scores: Cinzel
- No gradients on panel backgrounds — flat fills only
- No drop shadows or modern card-elevation effects — hairline borders carry the weight
- Generous padding: 24px panel-inner, 32px between major sections
- Tag pills use the existing color palette (LEAD = gold, SAFE = cream, WATCH = amber, AVOID = muted) — don't introduce new tag colors

## What good output looks like in this repo
- Small surgical diffs. One component or one route at a time.
- TanStack Start patterns — `createFileRoute`, `loader`, `Route.useLoaderData()`, `createServerFn`. Don't reach for Next.js / Remix / vanilla React patterns that don't fit.
- Server functions for anything touching env vars or external APIs. Never call APIs from client-side code.
- Match the existing visual tokens. Don't introduce new colors, shadows, or fonts.
- Ceremonial Forge voice in all UI copy. "Forge new character" not "create new analysis."
- When data should exist but isn't in the payload yet, hardcode a clearly-labeled mock with a `// TODO:` comment rather than hiding the UI slot.

## Don't
- Don't commit `.env.local` (gitignored, but worth saying).
- Don't add new dependencies without asking — every new package is a new failure mode before the demo.
- Don't refactor working code "for cleanliness" while we're under deadline. Surgical changes only until after submission.
- Don't reintroduce gradients, drop shadows, or dark mode. The cream/gold language is locked.
- Don't push directly to `main` — this branch is `feat/manan-claude-code-redesign` and stays isolated until merged via PR after the hackathon.

## Current priority (Saturday April 26, until 2:30 PM)
1. ⬜ Phase 2 — redesign character dossier from vertical accordion to single-viewport three-column layout (Target / Trends / Gallery) with Forge View hero panel below. Reference: see the current PDF export of the dossier and the user's hand sketch (Target / Trends / Gallery / Forge View).
2. ⬜ Fix StatRadar.tsx width(-1)/height(-1) console warnings.
3. ⬜ Ensure variant thumbnail click opens in new tab via `<a target="_blank">`, route `/character/$gameId/variant/$variantId`.
4. ⬜ Demo polish — verify end-to-end flow with the demo target game (Brawl Stars).
5. ⬜ Record 5-minute video walkthrough as backup before live demo.