// Score Breakdown agent — Lovable AI port of Silki Agent 01.
// Produces 5 weighted dimension scores, win probability, confidence,
// strategic read, and ranked improvement levers.

import type { AdCreative, ScoreBreakdown, ImprovementLever, Confidence, CharacterStat, Tier } from "../types";
import { scoreToTier } from "../tier";
import { callAITool } from "./ai.server";

const DIMENSIONS = [
  { key: "hook_strength", label: "Hook Strength", weight: 0.25 },
  { key: "visual_novelty", label: "Visual Novelty", weight: 0.2 },
  { key: "platform_fit", label: "Platform Fit", weight: 0.15 },
  { key: "audience_alignment", label: "Audience Alignment", weight: 0.2 },
  { key: "differentiation", label: "Differentiation", weight: 0.2 },
];

function computeConfidence(adCount: number): Confidence {
  if (adCount >= 12) return "high";
  if (adCount >= 5) return "medium";
  return "low";
}

function clampTier(t: string): Tier {
  return (["S", "A", "B", "C", "D"] as Tier[]).includes(t as Tier) ? (t as Tier) : "C";
}

export async function runScoreBreakdown(args: {
  gameName: string;
  vertical: string;
  ads: AdCreative[];
}): Promise<{
  breakdown: ScoreBreakdown;
  refinedVertical: string;
  topHooks: { label: string; description: string; tier: Tier }[];
  codex: string[];
  loreStats: CharacterStat[]; // legacy "character sheet" axes (5-7) for backwards compat
}> {
  const adSummary = args.ads.slice(0, 24).map((a, i) => ({
    rank: i + 1,
    network: a.network,
    hook: a.hookLabel,
    text: a.rawText?.slice(0, 240),
    tier: a.tier,
  }));

  const system = `You are a senior mobile-game ad-creative strategist (Silki Score Breakdown agent).
Score the competitor's top ads on 5 fixed dimensions: hook_strength, visual_novelty, platform_fit, audience_alignment, differentiation.
Each dimension is 0–100. Be strict and ground every score in evidence from the ad list.

Then rank up to 4 IMPROVEMENT LEVERS (concrete creative changes that would raise the weakest dimensions). Each lever has a title, 1–2 sentence description, and an estimated point delta (1–25).

Also produce:
- 3 TOP HOOKS (most repeated/successful angles)
- 5–8 CODEX bullets — raw insight (patterns, mechanics, what's missing)
- A short Claude-style strategic read (one paragraph)
- A 2–4 word refined vertical label

Optionally produce 5–7 vertical-specific "lore stats" for the character sheet flavor. Examples per vertical:
- Puzzle: "Satisfaction Beat", "Fail Loop Tension", "Color Pop"
- RPG: "Power Fantasy", "Loot Drop Energy", "Combat Clarity"
- Casino: "Win Anticipation", "Symbol Pop", "Free-Spin Tease"

Be ruthless and specific. Cite evidence.`;

  const user = `Game: ${args.gameName}
Reported vertical: ${args.vertical || "unknown"}
Top ads (ranked):
${JSON.stringify(adSummary, null, 2)}`;

  type AIOut = {
    refined_vertical: string;
    dimensions: { key: string; value: number; lore: string }[];
    levers: {
      title: string;
      description: string;
      pattern_affected?: string;
      trend_velocity?: "rising" | "stable" | "declining";
      estimated_point_delta: number;
    }[];
    top_hooks: { label: string; description: string; tier: string }[];
    codex: string[];
    lore_stats: { key: string; label: string; value: number; lore: string }[];
    claude_read: string;
  };

  const parsed = await callAITool<AIOut>({
    system,
    user,
    toolName: "submit_score_breakdown",
    parameters: {
      type: "object",
      properties: {
        refined_vertical: { type: "string" },
        dimensions: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              key: { type: "string", enum: DIMENSIONS.map((d) => d.key) },
              value: { type: "number", minimum: 0, maximum: 100 },
              lore: { type: "string" },
            },
            required: ["key", "value", "lore"],
            additionalProperties: false,
          },
        },
        levers: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              pattern_affected: { type: "string" },
              trend_velocity: { type: "string", enum: ["rising", "stable", "declining"] },
              estimated_point_delta: { type: "number", minimum: 1, maximum: 25 },
            },
            required: ["title", "description", "estimated_point_delta"],
            additionalProperties: false,
          },
        },
        top_hooks: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              description: { type: "string" },
              tier: { type: "string", enum: ["S", "A", "B"] },
            },
            required: ["label", "description", "tier"],
            additionalProperties: false,
          },
        },
        codex: { type: "array", minItems: 5, maxItems: 10, items: { type: "string" } },
        lore_stats: {
          type: "array",
          minItems: 5,
          maxItems: 7,
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              value: { type: "number", minimum: 0, maximum: 100 },
              lore: { type: "string" },
            },
            required: ["key", "label", "value", "lore"],
            additionalProperties: false,
          },
        },
        claude_read: { type: "string" },
      },
      required: ["refined_vertical", "dimensions", "levers", "top_hooks", "codex", "lore_stats", "claude_read"],
      additionalProperties: false,
    },
  });

  const dimMap = new Map(parsed.dimensions.map((d) => [d.key, d]));
  const dimensions: CharacterStat[] = DIMENSIONS.map((d) => {
    const got = dimMap.get(d.key);
    const value = Math.max(0, Math.min(100, Math.round(got?.value ?? 50)));
    return {
      key: d.key,
      label: d.label,
      value,
      tier: scoreToTier(value),
      lore: got?.lore ?? "—",
    };
  });

  const winProbability = Math.round(
    DIMENSIONS.reduce((acc, d) => {
      const got = dimMap.get(d.key);
      return acc + (got?.value ?? 50) * d.weight;
    }, 0)
  );

  const confidence = computeConfidence(args.ads.length);

  const levers: ImprovementLever[] = parsed.levers.map((l, i) => ({
    id: `L${(i + 1).toString().padStart(2, "0")}`,
    title: l.title,
    description: l.description,
    patternAffected: l.pattern_affected,
    trendVelocity: l.trend_velocity,
    estimatedPointDelta: Math.round(l.estimated_point_delta),
  }));

  return {
    breakdown: {
      winProbability,
      confidence,
      dimensions,
      claudeRead: parsed.claude_read,
      levers,
    },
    refinedVertical: parsed.refined_vertical,
    topHooks: parsed.top_hooks.map((h) => ({
      label: h.label,
      description: h.description,
      tier: clampTier(h.tier),
    })),
    codex: parsed.codex,
    loreStats: parsed.lore_stats.map((s) => ({
      key: s.key,
      label: s.label,
      value: Math.max(0, Math.min(100, Math.round(s.value))),
      tier: scoreToTier(s.value),
      lore: s.lore,
    })),
  };
}
