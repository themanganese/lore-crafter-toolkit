// Relevance ranking for SensorTower-scraped competitor ads.
//
// We surface the *target game's own* top creatives in the dossier, so all
// candidate ads share genre/audience by construction. The ranking instead
// asks: which of these ads best expresses the patterns the trend agent has
// flagged as working in the broader market?
//
// Formula (deterministic, no LLM call — patterns are already in cache):
//
//   relevance = (window_appearances * 0.4)
//             + (days_running_normalized * 0.3)
//             + (matches_target_genre   ? 30 : 0)
//             + (matches_target_audience ? 20 : 0)
//
// Where:
//   - window_appearances  = sum of `windowAppearances` for trend patterns
//                           whose keywords overlap the ad's hookLabel/rawText.
//   - days_running_normalized = clamp(durationDays / 100, 0, 1) * 100
//   - matches_target_genre    = ad text overlaps any *rising* pattern keyword
//                                from trend.whatIsWorking
//   - matches_target_audience = ad text overlaps any of trend.emotionalLevers
//
// The `days_running` term puts long-running ads ahead of one-week burns; the
// genre/audience bonuses are coarse but cheap to compute deterministically.

import type { AdCreative, TrendAnalysis, TrendPattern } from "../types";

export type SortKey = "relevance" | "days" | "network" | "format";

export interface RankedAd {
  ad: AdCreative;
  rank: number; // 1-indexed
  score: number;
  reasons: string[]; // short human-readable explanations of the score
  matchedPatterns: TrendPattern[];
  format: "VIDEO" | "PLAYABLE" | "IMAGE" | "STORY";
}

// Pattern-type → core-loop element mapping for the "Maps to" hover tag.
// Keep this small and visible; it lets the UI surface why a specific
// market pattern is relevant to the target game's loop.
export const PATTERN_TO_CORE_LOOP: Record<string, string> = {
  "social-proof": "mass-appeal hook",
  "social proof": "mass-appeal hook",
  proof: "mass-appeal hook",
  ugc: "trust loop",
  celebrity: "credibility loop",
  fail: "tension → relief loop",
  challenge: "skill expression",
  fomo: "scarcity loop",
  team: "co-op session",
  "3v3": "co-op session",
  pvp: "competitive ladder",
  puzzle: "satisfaction beat",
  loot: "reward drop",
  boss: "mastery arc",
  story: "narrative pull",
  build: "progression loop",
  merge: "progression loop",
};

function lower(s: string | undefined): string {
  return (s ?? "").toLowerCase();
}

export function detectFormat(ad: AdCreative): RankedAd["format"] {
  if (ad.videoUrl) {
    const txt = lower(ad.hookLabel) + " " + lower(ad.rawText);
    if (txt.includes("story") || txt.includes("vertical")) return "STORY";
    return "VIDEO";
  }
  const blob = lower(ad.hookLabel) + " " + lower(ad.rawText);
  if (blob.includes("playable") || blob.includes("interactive")) return "PLAYABLE";
  return "IMAGE";
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function patternKeywords(p: TrendPattern): string[] {
  return tokenize(`${p.pattern} ${p.recommendation}`);
}

function overlaps(adText: string[], patternText: string[]): boolean {
  const set = new Set(adText);
  return patternText.some((t) => set.has(t));
}

function mapsTo(matched: TrendPattern[]): string | undefined {
  for (const p of matched) {
    const text = lower(p.pattern);
    for (const [needle, loopElement] of Object.entries(PATTERN_TO_CORE_LOOP)) {
      if (text.includes(needle)) return loopElement;
    }
  }
  return undefined;
}

export function deriveMapsTo(matched: TrendPattern[]): string | undefined {
  return mapsTo(matched);
}

export interface RankAdsArgs {
  ads: AdCreative[];
  trend?: TrendAnalysis;
  targetGameName: string;
}

export function rankAds({ ads, trend }: RankAdsArgs): RankedAd[] {
  const working = trend?.whatIsWorking ?? [];
  const levers = trend?.emotionalLevers?.map((l) => l.toLowerCase()) ?? [];

  const ranked: RankedAd[] = ads.map((ad) => {
    const adTokens = tokenize(`${ad.hookLabel} ${ad.rawText ?? ""}`);
    const matched: TrendPattern[] = working.filter((p) => overlaps(adTokens, patternKeywords(p)));

    const windowAppearances = matched.reduce((sum, p) => sum + (p.windowAppearances || 1), 0);

    const daysRunningNorm = Math.min(1, (ad.durationDays ?? 0) / 100) * 100;

    const matchesTargetGenre = matched.some((p) => p.trendVelocity === "rising");
    const matchesTargetAudience = adTokens.some((t) =>
      levers.some((lever) => lever.includes(t) || t.includes(lever)),
    );

    const score =
      windowAppearances * 0.4 +
      daysRunningNorm * 0.3 +
      (matchesTargetGenre ? 30 : 0) +
      (matchesTargetAudience ? 20 : 0);

    const reasons: string[] = [];
    if (matched.length > 0) {
      reasons.push(
        `Expresses ${matched.length} working pattern${matched.length === 1 ? "" : "s"}: ${matched
          .slice(0, 2)
          .map((p) => p.pattern)
          .join(", ")}`,
      );
    }
    if (ad.durationDays && ad.durationDays >= 30) {
      reasons.push(`Long-running (${ad.durationDays}d) — genre-stable signal`);
    }
    if (matchesTargetAudience) {
      reasons.push("Hooks emotional levers in target audience");
    }
    if (reasons.length === 0) {
      reasons.push("Baseline relevance: same-game scrape, no pattern match yet");
    }

    return {
      ad,
      rank: 0,
      score,
      reasons,
      matchedPatterns: matched,
      format: detectFormat(ad),
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });
  return ranked;
}

export function applySort(ranked: RankedAd[], sort: SortKey): RankedAd[] {
  const out = [...ranked];
  if (sort === "relevance") {
    out.sort((a, b) => a.rank - b.rank);
  } else if (sort === "days") {
    out.sort((a, b) => (b.ad.durationDays ?? 0) - (a.ad.durationDays ?? 0));
  } else if (sort === "network") {
    out.sort((a, b) => a.ad.network.localeCompare(b.ad.network) || a.rank - b.rank);
  } else if (sort === "format") {
    out.sort((a, b) => a.format.localeCompare(b.format) || a.rank - b.rank);
  }
  return out;
}

// "Why this ranking" chips — surface the LLM's mapping logic without making
// a new call. Combine the differentiation_angle (one chip) with up to 2 of
// the strongest working patterns.
export function rankingExplainerChips(trend?: TrendAnalysis): string[] {
  if (!trend) return [];
  const chips: string[] = [];
  const lead = trend.whatIsWorking.find((p) => p.tag === "lead");
  if (lead) {
    const loop = deriveMapsTo([lead]);
    chips.push(
      loop
        ? `${lead.pattern} → ${loop}`
        : `${lead.pattern} ranks high (${lead.windowAppearances}× appearances)`,
    );
  }
  const stable = trend.whatIsWorking.find((p) => p.tag === "safe" && p !== lead);
  if (stable) {
    chips.push(`Long-running ${stable.pattern.toLowerCase()} → genre-stable signal`);
  }
  if (trend.differentiationAngle) {
    const angle = trend.differentiationAngle.replace(/[“”"]/g, "");
    chips.push(angle.length > 70 ? angle.slice(0, 67) + "…" : angle);
  }
  return chips.slice(0, 3);
}
