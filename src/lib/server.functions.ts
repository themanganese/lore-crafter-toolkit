// Server functions exposed to the client. All real API calls live in *.server.ts files
// imported only here, so they never leak into the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sensorTowerProvider } from "@/lib/adintel/sensortower.server";
import { extractInsights, draftBrief } from "@/lib/ai/insights.server";
import { generateImage, editImage } from "@/lib/scenario/client.server";
import { runFullAnalysisOrchestrated } from "@/lib/silki/orchestrator.server";
import { startRun, getEvents } from "@/lib/silki/runs.server";
import { callAIChat } from "@/lib/silki/ai.server";
import {
  suggestComparables,
  generateInspiredBriefs,
  type ComparableGame,
  type InspiredBrief,
} from "@/lib/silki/inspired.server";
import type { AdCreative, CharacterStat, Tier } from "@/lib/types";

export type { ComparableGame, InspiredBrief };

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

// Legacy single-call analysis (kept for compatibility, not used by new dashboard)
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
          error: "SensorTower returned no creatives for this app.",
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

// Start a full Silki orchestrated analysis. Returns a runId immediately
// while the orchestrator runs (we await it here so the client gets the
// final payload — events are still emitted live for UI streaming).
export const startAnalysisRun = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      externalId: z.string().min(1),
      platform: z.enum(["ios", "android"]),
      gameName: z.string().min(1),
      vertical: z.string().default(""),
    })
  )
  .handler(async ({ data }) => {
    const runId = startRun();
    // Kick off orchestrator. We await it here (worker doesn't support waitUntil reliably).
    // Client polls getRunEvents while the await resolves.
    const result = await runFullAnalysisOrchestrated({
      runId,
      externalId: data.externalId,
      platform: data.platform,
      gameName: data.gameName,
      vertical: data.vertical,
    });
    return { runId, ...result };
  });

export const getRunEvents = createServerFn({ method: "GET" })
  .inputValidator(z.object({ runId: z.string().min(1) }))
  .handler(async ({ data }) => {
    return getEvents(data.runId);
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

// Edit an existing generation via Scenario img2img
export const editGeneration = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      prompt: z.string().min(4).max(4000),
      sourceImageUrl: z.string().url(),
      strength: z.number().min(0.1).max(0.95).optional(),
    })
  )
  .handler(async ({ data }) => {
    try {
      const r = await editImage({
        prompt: data.prompt,
        sourceImageUrl: data.sourceImageUrl,
        strength: data.strength,
      });
      return { ok: true as const, ...r, error: null };
    } catch (e) {
      console.error("editGeneration failed:", e);
      return {
        ok: false as const,
        imageUrl: "",
        jobId: "",
        model: "",
        error: e instanceof Error ? e.message : "Edit failed",
      };
    }
  });

// Ask AI assistant — streams text through Lovable AI gateway.
export const askAI = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      messages: z
        .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) }))
        .min(1)
        .max(40),
      gameContext: z
        .object({
          name: z.string(),
          vertical: z.string(),
          winProbability: z.number().optional(),
          topHooks: z.array(z.string()).optional(),
          stats: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
          codex: z.array(z.string()).optional(),
          differentiationAngle: z.string().optional(),
        })
        .optional(),
    })
  )
  .handler(async ({ data }) => {
    const ctx = data.gameContext;
    const ctxBlock = ctx
      ? `\n\n[Active game context]\nName: ${ctx.name}\nVertical: ${ctx.vertical}` +
        (ctx.winProbability !== undefined ? `\nWin probability: ${ctx.winProbability}/100` : "") +
        (ctx.differentiationAngle ? `\nWhite-space angle: ${ctx.differentiationAngle}` : "") +
        (ctx.topHooks?.length ? `\nTop hooks: ${ctx.topHooks.join(" | ")}` : "") +
        (ctx.stats?.length ? `\nDimension scores: ${ctx.stats.map((s) => `${s.label}=${s.value}`).join(", ")}` : "") +
        (ctx.codex?.length ? `\nCodex: ${ctx.codex.slice(0, 6).join(" • ")}` : "")
      : "";

    const system = `You are Silki — a senior creative-strategy assistant for mobile-game ad teams.
You help marketers reason about ad-creative performance, hooks, visual patterns, monetisation
levers, and what to test next. Be direct, evidence-led, and specific. Use markdown with short
sections and bullets when helpful. When the user has an active game open, ground every answer
in that game's context first.${ctxBlock}`;

    try {
      const text = await callAIChat({
        system,
        messages: data.messages,
      });
      return { ok: true as const, content: text, error: null };
    } catch (e) {
      console.error("askAI failed:", e);
      return { ok: false as const, content: "", error: e instanceof Error ? e.message : "AI failed" };
    }
  });
