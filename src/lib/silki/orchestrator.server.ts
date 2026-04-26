// Silki Orchestrator — runs all four agents and emits live thinking events.
import type { AdCreative, CharacterStat, Tier, ScoreBreakdown, RevenueForecast, TrendAnalysis, DashboardCuration } from "../types";
import { sensorTowerProvider } from "../adintel/sensortower.server";
import { emit, complete, fail, finishRun } from "./runs.server";
import { runScoreBreakdown } from "./score.server";
import { runTrendAnalysis } from "./trend.server";
import { runRevenueForecast } from "./revenue.server";
import { curateDashboard } from "./curation.server";

export interface OrchestratorResult {
  ok: boolean;
  error?: string;
  ads: AdCreative[];
  refinedVertical: string;
  // Score outputs
  stats: CharacterStat[];
  topHooks: { label: string; description: string; tier: Tier }[];
  codex: string[];
  scoreBreakdown?: ScoreBreakdown;
  // Other agent outputs
  revenueForecast?: RevenueForecast;
  trendAnalysis?: TrendAnalysis;
  curation?: DashboardCuration;
}

export async function runFullAnalysisOrchestrated(args: {
  runId: string;
  externalId: string;
  platform: "ios" | "android";
  gameName: string;
  vertical: string;
}): Promise<OrchestratorResult> {
  const empty: OrchestratorResult = {
    ok: false,
    ads: [],
    refinedVertical: args.vertical,
    stats: [],
    topHooks: [],
    codex: [],
  };

  try {
    emit(args.runId, "orchestrator", `Starting analysis for ${args.gameName}`);

    // Step 1 — SensorTower
    emit(args.runId, "sensortower", `Resolving app id and pulling top creatives (${args.platform})…`);
    const { ads, vertical } = await sensorTowerProvider.fetchTopAds({
      externalId: args.externalId,
      platform: args.platform,
      limit: 24,
    });

    if (ads.length === 0) {
      fail(args.runId, "sensortower", "No creatives returned for this app. Plan may not include this region/vertical.");
      finishRun(args.runId);
      return { ...empty, error: "SensorTower returned no creatives for this app." };
    }
    complete(args.runId, "sensortower", `Pulled ${ads.length} top creatives.`);

    const refinedVerticalSeed = args.vertical || vertical || "";

    // Step 2 — Curation + Trend + Score + Revenue all in parallel.
    // Curation only depends on (gameName, vertical, adsCount), none of which
    // the trio produces, so it doesn't need to block the critical path.
    emit(args.runId, "orchestrator", "Asking AI which metrics to emphasize for this game…");
    emit(args.runId, "trend", "Extracting working / saturating patterns…");
    emit(args.runId, "score", "Scoring 5 dimensions (hook, novelty, fit, alignment, differentiation)…");
    emit(args.runId, "revenue", "Building 30/60/90 day revenue model with named assumptions…");

    const [curationRes, trendRes, scoreRes, revenueRes] = await Promise.allSettled([
      curateDashboard({
        gameName: args.gameName,
        vertical: refinedVerticalSeed,
        adsCount: ads.length,
      }),
      runTrendAnalysis({ gameName: args.gameName, vertical: refinedVerticalSeed, ads }),
      runScoreBreakdown({ gameName: args.gameName, vertical: refinedVerticalSeed, ads }),
      runRevenueForecast({ gameName: args.gameName, vertical: refinedVerticalSeed, adsCount: ads.length }),
    ]);

    let curation: DashboardCuration | undefined;
    if (curationRes.status === "fulfilled") {
      curation = curationRes.value;
      complete(args.runId, "orchestrator", `Focus: ${curation.focus}`);
    } else {
      emit(args.runId, "orchestrator", `Curator skipped (${curationRes.reason?.message ?? curationRes.reason})`, "error");
    }

    let trendAnalysis: TrendAnalysis | undefined;
    if (trendRes.status === "fulfilled") {
      trendAnalysis = trendRes.value;
      complete(args.runId, "trend", `Identified ${trendAnalysis.whatIsWorking.length} working & ${trendAnalysis.whatIsSaturating.length} saturating patterns.`);
    } else {
      emit(args.runId, "trend", `Trend analysis failed: ${trendRes.reason?.message ?? trendRes.reason}`, "error");
    }

    let scoreBreakdown: ScoreBreakdown | undefined;
    let stats: CharacterStat[] = [];
    let topHooks: { label: string; description: string; tier: Tier }[] = [];
    let codex: string[] = [];
    let refinedVertical = refinedVerticalSeed;
    if (scoreRes.status === "fulfilled") {
      scoreBreakdown = scoreRes.value.breakdown;
      stats = scoreRes.value.loreStats;
      topHooks = scoreRes.value.topHooks;
      codex = scoreRes.value.codex;
      refinedVertical = scoreRes.value.refinedVertical || refinedVertical;
      complete(args.runId, "score", `Win probability ${scoreBreakdown.winProbability} (${scoreBreakdown.confidence} confidence).`);
    } else {
      fail(args.runId, "score", `Score breakdown failed: ${scoreRes.reason?.message ?? scoreRes.reason}`);
      finishRun(args.runId);
      return { ...empty, ads, refinedVertical, error: scoreRes.reason?.message ?? "Score breakdown failed" };
    }

    let revenueForecast: RevenueForecast | undefined;
    if (revenueRes.status === "fulfilled") {
      revenueForecast = revenueRes.value;
      complete(args.runId, "revenue", `Baseline ~$${revenueForecast.baselineMonthlyUsd.toLocaleString()}/mo (modelled).`);
    } else {
      emit(args.runId, "revenue", `Revenue forecast failed: ${revenueRes.reason?.message ?? revenueRes.reason}`, "error");
    }

    complete(args.runId, "orchestrator", "Analysis complete — assembling dashboard.");
    finishRun(args.runId);

    return {
      ok: true,
      ads,
      refinedVertical,
      stats,
      topHooks,
      codex,
      scoreBreakdown,
      trendAnalysis,
      revenueForecast,
      curation,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    fail(args.runId, "orchestrator", msg);
    finishRun(args.runId);
    return { ...empty, error: msg };
  }
}
