// Server functions exposed to the client. All real API calls live in *.server.ts files
// imported only here, so they never leak into the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sensorTowerProvider } from "@/lib/adintel/sensortower.server";
import { extractInsights, draftBrief } from "@/lib/ai/insights.server";
import { generateImage } from "@/lib/scenario/client.server";
import type { AdCreative, CharacterStat, Tier } from "@/lib/types";

export const searchGames = createServerFn({ method: "POST" })
  .inputValidator(z.object({ query: z.string().min(1).max(120) }))
  .handler(async ({ data }) => {
    try {
      const results = await sensorTowerProvider.searchGames(data.query);
      return { results, error: null as string | null };
    } catch (e) {
      console.error("searchGames failed:", e);
      const msg = e instanceof Error ? e.message : "Search failed";
      return { results: [], error: msg };
    }
  });

export const scryAndAnalyze = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      externalId: z.string().min(1),
      platform: z.enum(["ios", "android"]),
      gameName: z.string().min(1),
      vertical: z.string().default(""),
    })
  )
  .handler(async ({ data }) => {
    try {
      const { ads, vertical } = await sensorTowerProvider.fetchTopAds({
        externalId: data.externalId,
        platform: data.platform,
        limit: 24,
      });

      if (ads.length === 0) {
        return {
          ok: false as const,
          error: "SensorTower returned no creatives for this app. Your plan may not include this app's region or vertical.",
          ads: [] as AdCreative[],
          stats: [] as CharacterStat[],
          topHooks: [] as { label: string; description: string; tier: Tier }[],
          codex: [] as string[],
          refinedVertical: data.vertical || vertical,
        };
      }

      const insights = await extractInsights({
        gameName: data.gameName,
        vertical: data.vertical || vertical,
        ads,
      });

      return {
        ok: true as const,
        error: null,
        ads,
        stats: insights.stats,
        topHooks: insights.topHooks,
        codex: insights.codex,
        refinedVertical: insights.refinedVertical,
      };
    } catch (e) {
      console.error("scryAndAnalyze failed:", e);
      const msg = e instanceof Error ? e.message : "Analysis failed";
      return {
        ok: false as const,
        error: msg,
        ads: [] as AdCreative[],
        stats: [] as CharacterStat[],
        topHooks: [] as { label: string; description: string; tier: Tier }[],
        codex: [] as string[],
        refinedVertical: data.vertical,
      };
    }
  });

export const draftCreativeBrief = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      character: z.object({
        name: z.string(),
        vertical: z.string(),
        stats: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            value: z.number(),
            tier: z.enum(["S", "A", "B", "C", "D"]),
            lore: z.string(),
          })
        ),
        topHooks: z.array(
          z.object({
            label: z.string(),
            description: z.string(),
            tier: z.enum(["S", "A", "B", "C", "D"]),
          })
        ),
        codex: z.array(z.string()),
      }),
      targetGameName: z.string().min(1).max(120),
    })
  )
  .handler(async ({ data }) => {
    try {
      const brief = await draftBrief({
        character: data.character,
        targetGameName: data.targetGameName,
      });
      return { ok: true as const, brief, error: null };
    } catch (e) {
      console.error("draftCreativeBrief failed:", e);
      return {
        ok: false as const,
        brief: null,
        error: e instanceof Error ? e.message : "Brief generation failed",
      };
    }
  });

export const generateCreative = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      prompt: z.string().min(8).max(4000),
      width: z.number().int().min(256).max(2048).optional(),
      height: z.number().int().min(256).max(2048).optional(),
    })
  )
  .handler(async ({ data }) => {
    try {
      const r = await generateImage({ prompt: data.prompt, width: data.width, height: data.height });
      return { ok: true as const, ...r, error: null };
    } catch (e) {
      console.error("generateCreative failed:", e);
      return {
        ok: false as const,
        imageUrl: "",
        jobId: "",
        model: "",
        error: e instanceof Error ? e.message : "Generation failed",
      };
    }
  });
