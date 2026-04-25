// Provider-adapter interface so we can swap ad intelligence sources later.
import type { AdCreative, Tier } from "./types";

export interface GameSearchResult {
  externalId: string;
  platform: "ios" | "android";
  name: string;
  publisher?: string;
  iconUrl?: string;
  vertical?: string;
}

export interface AdIntelProvider {
  name: string;
  searchGames(query: string): Promise<GameSearchResult[]>;
  fetchTopAds(args: {
    externalId: string;
    platform: "ios" | "android";
    limit?: number;
  }): Promise<{ ads: AdCreative[]; vertical: string }>;
}

// Tier from impression rank
export function rankToTier(rank: number, total: number): Tier {
  const pct = rank / Math.max(1, total);
  if (pct <= 0.05) return "S";
  if (pct <= 0.2) return "A";
  if (pct <= 0.5) return "B";
  if (pct <= 0.8) return "C";
  return "D";
}
