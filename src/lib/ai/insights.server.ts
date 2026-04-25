// AI insight extraction — runs server-side, calls Claude via the shared helper.
// Used by the legacy single-call analysis path and by draftBrief.

import type { AdCreative, CharacterStat, Tier } from "../types";
import { scoreToTier } from "../tier";
import { callAITool } from "@/lib/silki/ai.server";

function tierClamp(t: string): Tier {
  return (["S", "A", "B", "C", "D"] as Tier[]).includes(t as Tier) ? (t as Tier) : "C";
}

export async function extractInsights(args: {
  gameName: string;
  vertical: string;
  ads: AdCreative[];
}): Promise<{
  stats: CharacterStat[];
  topHooks: { label: string; description: string; tier: Tier }[];
  codex: string[];
  refinedVertical: string;
}> {
  const adSummary = args.ads.slice(0, 24).map((a, i) => ({
    rank: i + 1,
    network: a.network,
    hook: a.hookLabel,
    text: a.rawText?.slice(0, 240),
    tier: a.tier,
  }));

  const system = `You are a senior mobile-game ad-creative strategist. You analyze a competitor game's top-performing ads and produce a "character sheet" of performance traits, scored 0-100.

Pick 5-7 STAT AXES that genuinely matter for THIS game's vertical (puzzle vs RPG vs casino vs hypercasual differ). Examples — pick what fits, do NOT reuse blindly:
- Puzzle: "Satisfaction Beat", "Fail Loop Tension", "Color Pop", "Aha Moment Clarity"
- RPG/Soulslike: "Power Fantasy", "Loot Drop Energy", "Combat Clarity", "World Atmosphere"
- Casino/Slots: "Win Anticipation", "Symbol Pop", "Free-Spin Tease"
- Hypercasual: "Snackability", "Restart Loop", "Visual Novelty"

For each stat: a numeric 0-100 score, a short LORE line (1 sentence) that reads like a Dark Souls item description and explains why the score is what it is.

Then: 3 TOP HOOKS (the most repeated/successful creative angles), each with a short description.
Then: 5-8 CODEX bullets of raw insight — patterns, mechanics, visual cues, what's missing.
Refine the vertical name into a tight 2-4 word label.

Be ruthless and specific. Cite signal from the ad list.`;

  const user = `Game: ${args.gameName}
Reported vertical: ${args.vertical}
Top ads (ranked):
${JSON.stringify(adSummary, null, 2)}`;

  type AIOut = {
    refined_vertical: string;
    stats: { key: string; label: string; value: number; lore: string }[];
    top_hooks: { label: string; description: string; tier: string }[];
    codex: string[];
  };

  const parsed = await callAITool<AIOut>({
    system,
    user,
    toolName: "submit_character_sheet",
    parameters: {
      type: "object",
      properties: {
        refined_vertical: { type: "string" },
        stats: {
          type: "array",
          minItems: 5,
          maxItems: 7,
          items: {
            type: "object",
            properties: {
              key: { type: "string", description: "snake_case slug" },
              label: { type: "string" },
              value: { type: "number", minimum: 0, maximum: 100 },
              lore: { type: "string" },
            },
            required: ["key", "label", "value", "lore"],
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
        codex: {
          type: "array",
          minItems: 5,
          maxItems: 10,
          items: { type: "string" },
        },
      },
      required: ["refined_vertical", "stats", "top_hooks", "codex"],
      additionalProperties: false,
    },
  });

  return {
    refinedVertical: parsed.refined_vertical,
    stats: parsed.stats.map((s) => ({
      key: s.key,
      label: s.label,
      value: Math.max(0, Math.min(100, Math.round(s.value))),
      tier: scoreToTier(s.value),
      lore: s.lore,
    })),
    topHooks: parsed.top_hooks.map((h) => ({
      label: h.label,
      description: h.description,
      tier: tierClamp(h.tier),
    })),
    codex: parsed.codex,
  };
}

// Build an editable creative brief from a character sheet + target game.
export async function draftBrief(args: {
  character: {
    name: string;
    vertical: string;
    stats: CharacterStat[];
    topHooks: { label: string; description: string }[];
    codex: string[];
  };
  targetGameName: string;
}): Promise<{
  title: string;
  targetHook: string;
  mechanic: string;
  visualCue: string;
  pacing: string;
  cta: string;
  notes: string;
  prompt: string;
}> {
  const system = `You are a creative director for mobile game UA ads. Given a competitor's "character sheet" of winning patterns, you draft a creative brief tailored for the user's game. Be specific and shippable.`;

  const user = `Competitor character: ${args.character.name} (${args.character.vertical})
Top stats: ${args.character.stats.map((s) => `${s.label} ${s.value}`).join(", ")}
Top hooks: ${args.character.topHooks.map((h) => `${h.label} — ${h.description}`).join(" | ")}
Codex insights:
${args.character.codex.map((c) => `- ${c}`).join("\n")}

Target game (the user's): ${args.targetGameName}

Draft a creative brief that adapts the competitor's winning patterns for the target game.`;

  type AIOut = {
    title: string;
    target_hook: string;
    mechanic: string;
    visual_cue: string;
    pacing: string;
    cta: string;
    notes: string;
    scenario_prompt: string;
  };

  const p = await callAITool<AIOut>({
    system,
    user,
    toolName: "submit_brief",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        target_hook: { type: "string" },
        mechanic: { type: "string" },
        visual_cue: { type: "string" },
        pacing: { type: "string" },
        cta: { type: "string" },
        notes: { type: "string" },
        scenario_prompt: {
          type: "string",
          description:
            "Detailed text-to-image prompt for Scenario, describing a single still frame that captures the ad's core hook. Include style, lighting, composition, and subject.",
        },
      },
      required: [
        "title",
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
  });

  return {
    title: p.title,
    targetHook: p.target_hook,
    mechanic: p.mechanic,
    visualCue: p.visual_cue,
    pacing: p.pacing,
    cta: p.cta,
    notes: p.notes,
    prompt: p.scenario_prompt,
  };
}
