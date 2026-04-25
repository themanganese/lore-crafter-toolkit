// Inspired-by-Top-Ads agent — server only.
// Pulls top creatives from a small set of comparable games (manual or auto-suggested
// from the same vertical), then asks Claude to synthesize 3–4 actionable creative
// briefs the user can immediately forge. The target game's existing brief / character
// sheet is intentionally ignored — comparable games' top ads ARE the brief.

import { sensorTowerProvider } from "@/lib/adintel/sensortower.server";
import type { GameSearchResult } from "@/lib/adintel/types";
import type { AdCreative } from "@/lib/types";
import { callAITool } from "./ai.server";

export interface ComparableGame {
  externalId: string;
  platform: "ios" | "android";
  name: string;
  publisher?: string;
  iconUrl?: string;
  vertical?: string;
}

export interface InspiredBrief {
  id: string;
  title: string;
  sourceGame: string;          // which comparable game inspired it
  sourceHook: string;          // the original hook line we drew from
  targetHook: string;          // adapted hook for the user's game
  mechanic: string;
  visualCue: string;
  pacing: string;
  cta: string;
  notes: string;
  prompt: string;              // Scenario text-to-image prompt
}

// ─── Comparable discovery ────────────────────────────────────────

/**
 * Auto-suggest 3 comparable games from the same vertical/category.
 * Strategy: search SensorTower for the vertical keyword and return top results
 * that aren't the target game itself.
 */
export async function suggestComparables(args: {
  targetExternalId: string;
  targetName: string;
  vertical: string;
  limit?: number;
}): Promise<ComparableGame[]> {
  const limit = args.limit ?? 3;
  const verticalQuery = (args.vertical || "").trim();
  if (!verticalQuery) return [];

  const queries = [verticalQuery, `${verticalQuery} game`, verticalQuery.split(/\s+/)[0]];
  const seen = new Set<string>([args.targetExternalId]);
  const seenNames = new Set<string>([args.targetName.toLowerCase()]);
  const out: ComparableGame[] = [];

  for (const q of queries) {
    if (out.length >= limit) break;
    let results: GameSearchResult[] = [];
    try {
      results = await sensorTowerProvider.searchGames(q);
    } catch {
      continue;
    }
    for (const r of results) {
      if (out.length >= limit) break;
      if (seen.has(r.externalId)) continue;
      const lower = r.name.toLowerCase();
      if (seenNames.has(lower)) continue;
      seen.add(r.externalId);
      seenNames.add(lower);
      out.push({
        externalId: r.externalId,
        platform: r.platform,
        name: r.name,
        publisher: r.publisher,
        iconUrl: r.iconUrl,
        vertical: r.vertical,
      });
    }
  }
  return out;
}

// ─── Inspired brief synthesis ────────────────────────────────────

interface ComparableAdsBundle {
  game: ComparableGame;
  ads: AdCreative[];
}

async function fetchAdsForComparables(comparables: ComparableGame[]) {
  const settled = await Promise.allSettled(
    comparables.map(async (c) => {
      const { ads } = await sensorTowerProvider.fetchTopAds({
        externalId: c.externalId,
        platform: c.platform,
        limit: 12,
      });
      return { game: c, ads } as ComparableAdsBundle;
    })
  );
  const bundles: ComparableAdsBundle[] = [];
  const failures: { name: string; error: string }[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") bundles.push(s.value);
    else failures.push({ name: "unknown", error: s.reason?.message ?? String(s.reason) });
  }
  return { bundles, failures };
}

export async function generateInspiredBriefs(args: {
  targetGameName: string;
  vertical: string;
  comparables: ComparableGame[];
  briefsCount?: number;
}): Promise<{
  briefs: InspiredBrief[];
  comparablesUsed: { name: string; adsCount: number }[];
  failures: { name: string; error: string }[];
}> {
  if (!args.comparables.length) {
    return { briefs: [], comparablesUsed: [], failures: [] };
  }

  const { bundles, failures } = await fetchAdsForComparables(args.comparables);

  if (bundles.length === 0) {
    return { briefs: [], comparablesUsed: [], failures };
  }

  // Build a compact, ranked summary of every comparable's top ads.
  const compInput = bundles.map((b) => ({
    game: b.game.name,
    publisher: b.game.publisher,
    ads: b.ads.slice(0, 8).map((a, i) => ({
      rank: i + 1,
      tier: a.tier,
      network: a.network,
      hook: a.hookLabel,
      copy: a.rawText?.slice(0, 220),
      duration_days: a.durationDays,
    })),
  }));

  const briefsCount = Math.max(2, Math.min(5, args.briefsCount ?? 4));

  const system = `You are the Silki "Inspired by Top Ads" creative director.

You are given top-performing ads from several COMPARABLE mobile games (same vertical as the user's target game). Your job is to derive ${briefsCount} brand-new creative briefs the target game team should ship NEXT.

CRITICAL RULES:
- The target game has NO existing brief — you do NOT adapt anything from it. The vertical and name are anchors only.
- Every brief must be EVIDENCE-LED — pick a specific competitor ad as the inspiration source and reference its hook/copy.
- Do not blandly generalise. Each brief should feel like a concrete shot list.
- Spread inspiration across DIFFERENT comparable games and DIFFERENT creative angles (don't make 3 briefs from the same competitor).
- Each brief includes a Scenario img2img-ready text-to-image prompt: a single still frame describing subject, environment, lighting, composition, art style.
- Titles are punchy (≤6 words), CTAs are imperative (≤4 words).`;

  const user = `Target game: ${args.targetGameName}
Vertical: ${args.vertical || "unknown"}

Comparable games and their top ads:
${JSON.stringify(compInput, null, 2)}

Produce ${briefsCount} inspired briefs.`;

  type AIOut = {
    briefs: {
      title: string;
      source_game: string;
      source_hook: string;
      target_hook: string;
      mechanic: string;
      visual_cue: string;
      pacing: string;
      cta: string;
      notes: string;
      scenario_prompt: string;
    }[];
  };

  const parsed = await callAITool<AIOut>({
    system,
    user,
    toolName: "submit_inspired_briefs",
    parameters: {
      type: "object",
      properties: {
        briefs: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              source_game: { type: "string", description: "Which comparable game inspired this" },
              source_hook: { type: "string", description: "The competitor hook/copy line we drew from" },
              target_hook: { type: "string", description: "Adapted hook for the target game" },
              mechanic: { type: "string" },
              visual_cue: { type: "string" },
              pacing: { type: "string" },
              cta: { type: "string" },
              notes: { type: "string" },
              scenario_prompt: { type: "string" },
            },
            required: [
              "title",
              "source_game",
              "source_hook",
              "target_hook",
              "mechanic",
              "visual_cue",
              "pacing",
              "cta",
              "notes",
              "scenario_prompt",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["briefs"],
      additionalProperties: false,
    },
  });

  const briefs: InspiredBrief[] = parsed.briefs.map((b) => ({
    id: crypto.randomUUID(),
    title: b.title,
    sourceGame: b.source_game,
    sourceHook: b.source_hook,
    targetHook: b.target_hook,
    mechanic: b.mechanic,
    visualCue: b.visual_cue,
    pacing: b.pacing,
    cta: b.cta,
    notes: b.notes,
    prompt: b.scenario_prompt,
  }));

  return {
    briefs,
    comparablesUsed: bundles.map((b) => ({ name: b.game.name, adsCount: b.ads.length })),
    failures,
  };
}
