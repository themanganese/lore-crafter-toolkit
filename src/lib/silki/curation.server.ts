// Curation agent — picks which dashboard sections to emphasize / collapse for this game.
import type { DashboardCuration } from "../types";
import { callAITool } from "./ai.server";

export async function curateDashboard(args: {
  gameName: string;
  vertical: string;
  adsCount: number;
}): Promise<DashboardCuration> {
  const system = `You are the Silki dashboard curator. Given a game and its scraped ad data,
decide which of these dashboard panels matter most for THIS game and which to collapse:
- score (creative score breakdown + improvement levers)
- revenue (90-day revenue forecast — modelled, low confidence by default)
- trend (working/saturating creative patterns)
- ads (raw ads grid)

Return:
- focus: one tight sentence telling the user what to look at first.
- emphasizedSections: 1-2 sections to open by default (always include "score").
- collapsedSections: any sections that should start collapsed (e.g. revenue if confidence is low for the genre, ads if there are very few).
- hiddenAssumptions: optional list of assumption IDs (A01..A07) that would just be noise for this game.

Be opinionated. Never repeat the same section in both arrays.`;

  const user = `Game: ${args.gameName}
Vertical: ${args.vertical || "unknown"}
Live ad creatives observed: ${args.adsCount}`;

  type AIOut = {
    focus: string;
    emphasizedSections: ("score" | "revenue" | "trend" | "ads")[];
    collapsedSections: ("score" | "revenue" | "trend" | "ads")[];
    hiddenAssumptions?: string[];
  };

  const parsed = await callAITool<AIOut>({
    system,
    user,
    toolName: "submit_curation",
    parameters: {
      type: "object",
      properties: {
        focus: { type: "string" },
        emphasizedSections: {
          type: "array",
          items: { type: "string", enum: ["score", "revenue", "trend", "ads"] },
        },
        collapsedSections: {
          type: "array",
          items: { type: "string", enum: ["score", "revenue", "trend", "ads"] },
        },
        hiddenAssumptions: { type: "array", items: { type: "string" } },
      },
      required: ["focus", "emphasizedSections", "collapsedSections"],
      additionalProperties: false,
    },
  });

  // Always emphasize score
  const emph = new Set(parsed.emphasizedSections);
  emph.add("score");
  const coll = new Set(parsed.collapsedSections.filter((s) => !emph.has(s)));

  return {
    focus: parsed.focus,
    emphasizedSections: [...emph],
    collapsedSections: [...coll],
    hiddenAssumptions: parsed.hiddenAssumptions ?? [],
  };
}
