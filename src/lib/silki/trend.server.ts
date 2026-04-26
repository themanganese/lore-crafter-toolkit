// Trend Analysis agent — Silki Agent 03 port.
import type { TrendAnalysis, TrendPattern, PatternTag } from "../types";
import { callAITool } from "./ai.server";
import type { AdCreative } from "../types";

function applyMatrix(signal: "high" | "medium", velocity: "rising" | "stable" | "declining"): PatternTag {
  const matrix: Record<string, PatternTag> = {
    "high|rising": "lead",
    "high|stable": "safe",
    "high|declining": "caution",
    "medium|rising": "watch",
    "medium|stable": "filler",
    "medium|declining": "avoid",
  };
  return matrix[`${signal}|${velocity}`] ?? "filler";
}

export async function runTrendAnalysis(args: {
  gameName: string;
  vertical: string;
  ads: AdCreative[];
}): Promise<TrendAnalysis> {
  const adSummary = args.ads.slice(0, 18).map((a, i) => ({
    rank: i + 1,
    network: a.network,
    hook: a.hookLabel,
    text: a.rawText?.slice(0, 200),
    duration_days: a.durationDays,
  }));

  const system = `You are the Silki Trend Analysis agent — a mobile game ad intelligence analyst.
Given the scraped top ads for a competitor, identify creative PATTERNS across them and classify each as working or saturating. Assign trend_velocity (rising/stable/declining) and signal_strength (high/medium). Count window_appearances (how many ads share the pattern).

Be terse. Strict length limits:
- pattern: ≤ 8 words
- recommendation: ≤ 15 words, one line, imperative
- differentiation_angle: ≤ 20 words
- narrative_arc: one short sentence

Pick only the strongest patterns — quality over quantity. Then synthesise:
- The single clearest WHITE SPACE / differentiation angle
- A recommended hook_type (problem-agitate-solve | curiosity gap | mastery arc | social proof | FOMO | challenge)
- A one-sentence narrative_arc
- 1–3 emotional_levers from: FOMO, identity, mastery, curiosity, social proof, nostalgia, anxiety relief

Be evidence-led. Do not invent patterns not visible in the ads.`;

  const user = `Game: ${args.gameName} (${args.vertical || "unknown vertical"})
Top ads:
${JSON.stringify(adSummary, null, 2)}`;

  type AIOut = {
    what_is_working: { pattern: string; signal_strength: "high" | "medium"; trend_velocity: "rising" | "stable" | "declining"; window_appearances: number; recommendation: string }[];
    what_is_saturating: { pattern: string; signal_strength: "high" | "medium"; trend_velocity: "rising" | "stable" | "declining"; window_appearances: number; recommendation: string }[];
    differentiation_angle: string;
    hook_type: string;
    narrative_arc: string;
    emotional_levers: string[];
  };

  const parsed = await callAITool<AIOut>({
    system,
    user,
    // Trend is pattern classification + short recommendations — Haiku 4.5 handles
    // this well at 2–3× the decode speed of Sonnet, which dominates trend latency.
    model: "claude-haiku-4-5",
    toolName: "submit_trend_analysis",
    parameters: {
      type: "object",
      properties: {
        what_is_working: {
          type: "array",
          minItems: 2,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              pattern: { type: "string" },
              signal_strength: { type: "string", enum: ["high", "medium"] },
              trend_velocity: { type: "string", enum: ["rising", "stable", "declining"] },
              window_appearances: { type: "number" },
              recommendation: { type: "string" },
            },
            required: ["pattern", "signal_strength", "trend_velocity", "window_appearances", "recommendation"],
            additionalProperties: false,
          },
        },
        what_is_saturating: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              pattern: { type: "string" },
              signal_strength: { type: "string", enum: ["high", "medium"] },
              trend_velocity: { type: "string", enum: ["rising", "stable", "declining"] },
              window_appearances: { type: "number" },
              recommendation: { type: "string" },
            },
            required: ["pattern", "signal_strength", "trend_velocity", "window_appearances", "recommendation"],
            additionalProperties: false,
          },
        },
        differentiation_angle: { type: "string" },
        hook_type: { type: "string" },
        narrative_arc: { type: "string" },
        emotional_levers: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
      },
      required: ["what_is_working", "what_is_saturating", "differentiation_angle", "hook_type", "narrative_arc", "emotional_levers"],
      additionalProperties: false,
    },
  });

  const enrich = (p: AIOut["what_is_working"][number]): TrendPattern => ({
    pattern: p.pattern,
    signalStrength: p.signal_strength,
    trendVelocity: p.trend_velocity,
    windowAppearances: Math.max(0, Math.round(p.window_appearances)),
    recommendation: p.recommendation,
    tag: applyMatrix(p.signal_strength, p.trend_velocity),
  });

  return {
    whatIsWorking: parsed.what_is_working.map(enrich),
    whatIsSaturating: parsed.what_is_saturating.map(enrich),
    differentiationAngle: parsed.differentiation_angle,
    hookType: parsed.hook_type,
    narrativeArc: parsed.narrative_arc,
    emotionalLevers: parsed.emotional_levers,
  };
}
