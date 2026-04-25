import type { Tier } from "./types";

export function scoreToTier(score: number): Tier {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  return "D";
}

export const TIER_LABEL: Record<Tier, string> = {
  S: "Legendary",
  A: "Epic",
  B: "Rare",
  C: "Common",
  D: "Discarded",
};

export const TIER_RING: Record<Tier, string> = {
  S: "ring-tier-s pulse-s-tier",
  A: "ring-tier-a",
  B: "ring-tier-b",
  C: "ring-tier-c",
  D: "ring-tier-d",
};

export const TIER_TEXT: Record<Tier, string> = {
  S: "text-tier-s",
  A: "text-tier-a",
  B: "text-tier-b",
  C: "text-tier-c",
  D: "text-tier-d",
};

export const TIER_BG: Record<Tier, string> = {
  S: "bg-tier-s/15 border-tier-s/60",
  A: "bg-tier-a/15 border-tier-a/50",
  B: "bg-tier-b/15 border-tier-b/50",
  C: "bg-tier-c/20 border-tier-c/50",
  D: "bg-tier-d/30 border-tier-d/50",
};
