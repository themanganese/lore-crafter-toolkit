// Revenue Forecast agent — Silki Agent 02 port.
// SensorTower Ad Intelligence plan does not return downloads/revenue, so we
// run the full assumption-based model and let Lovable AI write the narrative.

import type { RevenueForecast, AppliedAssumption, Confidence, ForecastPeriod } from "../types";
import { callAITool } from "./ai.server";

const ASSUMPTIONS: Record<string, { label: string; value: string; reason: string }> = {
  A01: { label: "Ad revenue as % of IAP", value: "35%", reason: "SensorTower does not provide ad revenue." },
  A02: { label: "Day-30 retention", value: "20% (blended)", reason: "No cohort data available." },
  A03: { label: "ARPU per day", value: "$0.15 blended", reason: "No per-user revenue breakdown." },
  A04: { label: "Paid UA multiplier", value: "1.4× organic", reason: "No ad spend data on plan." },
  A05: { label: "Seasonality index", value: "1.0 (neutral)", reason: "No historical seasonality data." },
  A06: { label: "DAU / MAU ratio", value: "0.28 blended", reason: "No DAU data from SensorTower." },
  A07: { label: "Churn half-life", value: "21 days", reason: "No survival curve data." },
};

function decay(days: number, halfLife = 21): number {
  return Math.exp(-0.693 * (days / halfLife));
}

function model(args: { adsCount: number; vertical: string }): {
  baselineMonthlyUsd: number;
  day30: ForecastPeriod;
  day60: ForecastPeriod;
  day90: ForecastPeriod;
  applied: string[];
} {
  // Heuristic baseline driven by competitor "ad presence" — more live creatives
  // implies a larger UA-driven revenue footprint. Strictly modelled.
  const monthlyDownloads = Math.max(8000, args.adsCount * 22000);
  const arpu = 0.15;
  const retention = 0.2;
  const iapRevenue = monthlyDownloads * arpu * retention * 30;
  const adRevenue = iapRevenue * 0.35;
  const totalMonthly = iapRevenue + adRevenue;

  const make = (days: number): ForecastPeriod => ({
    revenueUsd: Math.round(totalMonthly * decay(days) * (days / 30)),
    modelled: true,
    confidence: "low" as Confidence,
  });

  return {
    baselineMonthlyUsd: Math.round(totalMonthly),
    day30: make(30),
    day60: make(60),
    day90: make(90),
    applied: ["A01", "A02", "A03", "A04", "A05", "A07"],
  };
}

export async function runRevenueForecast(args: {
  gameName: string;
  vertical: string;
  adsCount: number;
}): Promise<RevenueForecast> {
  const m = model({ adsCount: args.adsCount, vertical: args.vertical });

  const system = `You are the Silki Revenue Forecast agent. You interpret modelled revenue numbers — you NEVER produce or alter them.
Given a forecast and game context, write:
1. A 2-sentence plain-language summary of trajectory
2. The single biggest 90-day revenue risk
3. The single biggest 90-day revenue opportunity
4. The 1–2 named assumption IDs (e.g. A01, A03) that, if wrong, would most change the forecast
Be specific. Reference the genre/vertical.`;

  const user = `Game: ${args.gameName} (${args.vertical || "unknown vertical"})
Modelled forecast (USD, all modelled):
- Baseline monthly: ${m.baselineMonthlyUsd.toLocaleString()}
- Day 30: ${m.day30.revenueUsd.toLocaleString()}
- Day 60: ${m.day60.revenueUsd.toLocaleString()}
- Day 90: ${m.day90.revenueUsd.toLocaleString()}
Applied assumptions: ${m.applied.join(", ")}
Live ad creatives observed: ${args.adsCount}`;

  type AIOut = { summary: string; risk: string; opportunity: string; sensitive_assumptions: string[] };

  const parsed = await callAITool<AIOut>({
    system,
    user,
    toolName: "submit_revenue_interpretation",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        risk: { type: "string" },
        opportunity: { type: "string" },
        sensitive_assumptions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
      },
      required: ["summary", "risk", "opportunity", "sensitive_assumptions"],
      additionalProperties: false,
    },
  });

  const appliedAssumptions: AppliedAssumption[] = m.applied.map((id) => ({
    id,
    label: ASSUMPTIONS[id]?.label ?? id,
    value: ASSUMPTIONS[id]?.value ?? "",
    reason: ASSUMPTIONS[id]?.reason ?? "",
  }));

  return {
    baselineMonthlyUsd: m.baselineMonthlyUsd,
    day30: m.day30,
    day60: m.day60,
    day90: m.day90,
    appliedAssumptions,
    sensorTowerActuals: {},
    summary: parsed.summary,
    risk: parsed.risk,
    opportunity: parsed.opportunity,
    sensitiveAssumptions: parsed.sensitive_assumptions,
  };
}
