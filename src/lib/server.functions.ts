// Server functions exposed to the client. All real API calls live in *.server.ts files
// imported only here, so they never leak into the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sensorTowerProvider } from "@/lib/adintel/sensortower.server";
import { extractInsights, draftBrief } from "@/lib/ai/insights.server";
import { generateImage, editImage } from "@/lib/scenario/client.server";
import {
  runFullAnalysisOrchestrated,
  type OrchestratorResult,
} from "@/lib/silki/orchestrator.server";
import { startRun, getEvents, setResult, getResult } from "@/lib/silki/runs.server";
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

// Kick off a full Silki orchestrated analysis. Returns runId immediately;
// the orchestrator runs in the background and emits events to the in-memory
// run store. The client polls getRunEvents to stream the trace and calls
// getRunResult once `done` to fetch the final payload.
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
    // Fire-and-forget. Errors are captured into the run store as a result
    // so the client poller can surface them.
    void runFullAnalysisOrchestrated({
      runId,
      externalId: data.externalId,
      platform: data.platform,
      gameName: data.gameName,
      vertical: data.vertical,
    })
      .then((result) => setResult(runId, result as unknown as Record<string, unknown>))
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Analysis failed";
        setResult(runId, { ok: false, error: msg });
      });
    return { runId };
  });

export const getRunEvents = createServerFn({ method: "GET" })
  .inputValidator(z.object({ runId: z.string().min(1) }))
  .handler(async ({ data }) => {
    return getEvents(data.runId);
  });

export const getRunResult = createServerFn({ method: "GET" })
  .inputValidator(z.object({ runId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const r = getResult(data.runId);
    return { done: r.done, result: r.result as OrchestratorResult | null };
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

// ─── Inspired by Top Ads ──────────────────────────────────────────
// Suggest 3 comparable games from the same vertical.
export const suggestComparableGames = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      targetExternalId: z.string().min(1),
      targetName: z.string().min(1),
      vertical: z.string().default(""),
      limit: z.number().int().min(1).max(6).optional(),
    })
  )
  .handler(async ({ data }) => {
    try {
      const comparables = await suggestComparables({
        targetExternalId: data.targetExternalId,
        targetName: data.targetName,
        vertical: data.vertical,
        limit: data.limit,
      });
      return { ok: true as const, comparables, error: null };
    } catch (e) {
      console.error("suggestComparableGames failed:", e);
      return {
        ok: false as const,
        comparables: [] as ComparableGame[],
        error: e instanceof Error ? e.message : "Comparable lookup failed",
      };
    }
  });

// Pull top ads from the chosen comparables and synthesize 3-4 inspired briefs.
export const generateInspiredBriefsFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      targetGameName: z.string().min(1).max(160),
      vertical: z.string().default(""),
      comparables: z
        .array(
          z.object({
            externalId: z.string().min(1),
            platform: z.enum(["ios", "android"]),
            name: z.string().min(1),
            publisher: z.string().optional(),
            iconUrl: z.string().optional(),
            vertical: z.string().optional(),
          })
        )
        .min(1)
        .max(5),
      briefsCount: z.number().int().min(2).max(5).optional(),
    })
  )
  .handler(async ({ data }) => {
    try {
      const r = await generateInspiredBriefs({
        targetGameName: data.targetGameName,
        vertical: data.vertical,
        comparables: data.comparables,
        briefsCount: data.briefsCount,
      });
      return { ok: true as const, ...r, error: null };
    } catch (e) {
      console.error("generateInspiredBriefsFn failed:", e);
      return {
        ok: false as const,
        briefs: [] as InspiredBrief[],
        comparablesUsed: [] as { name: string; adsCount: number }[],
        failures: [] as { name: string; error: string }[],
        error: e instanceof Error ? e.message : "Inspired brief generation failed",
      };
    }
  });
