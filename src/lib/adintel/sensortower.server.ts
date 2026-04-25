// SensorTower Ad Intelligence adapter.
// Server-only — never import in client code.
//
// Endpoints used (SensorTower API v1):
//   GET /v1/{platform}/search_entities?term=...&entity_type=app
//   GET /v1/{platform}/ad_intel/network_analysis/creatives
//
// Auth: Authorization: Bearer ${SENSORTOWER_API_KEY}
//
// SensorTower's response shapes vary by plan tier. We defensively normalize
// what we need and surface a graceful error otherwise.

import type { AdCreative } from "../types";
import { rankToTier, type AdIntelProvider, type GameSearchResult } from "./types";

const ST_BASE = "https://api.sensortower.com";

function authHeaders() {
  const key = process.env.SENSORTOWER_API_KEY;
  if (!key) throw new Error("SENSORTOWER_API_KEY is not configured");
  return {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
}

async function stFetch(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(ST_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { headers: authHeaders() });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SensorTower ${res.status} ${res.statusText} on ${path}: ${text.slice(0, 240)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`SensorTower returned non-JSON on ${path}: ${text.slice(0, 200)}`);
  }
}

// Try iOS first, fall back to Android.
async function searchOnePlatform(
  query: string,
  platform: "ios" | "android"
): Promise<GameSearchResult[]> {
  try {
    const data = await stFetch(`/v1/${platform}/search_entities`, {
      term: query,
      entity_type: "app",
      limit: 10,
    });
    const apps = (data?.apps ?? data?.results ?? data ?? []) as unknown[];
    return (Array.isArray(apps) ? apps : [])
      .map((app) => {
        const a = app as Record<string, unknown>;
        const id = (a.app_id ?? a.id ?? a.bundle_id) as string | number | undefined;
        if (!id) return null;
        return {
          externalId: String(id),
          platform,
          name: (a.name ?? a.title ?? "Unknown") as string,
          publisher: (a.publisher_name ?? a.publisher ?? a.developer_name) as string | undefined,
          iconUrl: (a.icon ?? a.icon_url ?? a.image_url) as string | undefined,
          vertical: (a.category ?? a.primary_category ?? a.genre) as string | undefined,
        } as GameSearchResult;
      })
      .filter(Boolean) as GameSearchResult[];
  } catch (e) {
    console.warn(`SensorTower search ${platform} failed:`, e);
    return [];
  }
}

export const sensorTowerProvider: AdIntelProvider = {
  name: "SensorTower",

  async searchGames(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const [ios, android] = await Promise.all([
      searchOnePlatform(trimmed, "ios"),
      searchOnePlatform(trimmed, "android"),
    ]);
    // Dedupe by name+publisher, prefer iOS result first
    const seen = new Set<string>();
    const merged: GameSearchResult[] = [];
    for (const r of [...ios, ...android]) {
      const key = `${r.name}::${r.publisher ?? ""}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
    return merged.slice(0, 12);
  },

  async fetchTopAds({ externalId, platform, limit = 24 }) {
    let raw: unknown;
    try {
      raw = await stFetch(`/v1/${platform}/ad_intel/network_analysis/creatives`, {
        app_ids: externalId,
        period: "month",
        limit,
      });
    } catch (e) {
      // Fallback to generic top creatives endpoint name
      raw = await stFetch(`/v1/${platform}/ad_intel/creatives`, {
        app_ids: externalId,
        limit,
      });
    }

    const root = raw as Record<string, unknown>;
    const list = (root.creatives ?? root.data ?? root.results ?? raw ?? []) as unknown[];
    const arr = Array.isArray(list) ? list : [];

    let vertical = "";

    const ads: AdCreative[] = arr.slice(0, limit).map((row, idx) => {
      const r = row as Record<string, unknown>;
      vertical = vertical || ((r.category ?? r.genre ?? "") as string);
      const impressions = Number(r.impressions ?? r.estimated_impressions ?? r.share ?? 0) || undefined;
      const network = (r.network ?? r.ad_network ?? r.platform ?? "Unknown") as string;
      return {
        id: String(r.creative_id ?? r.id ?? `ad-${idx}`),
        thumbnailUrl: (r.thumbnail_url ?? r.preview_url ?? r.image_url) as string | undefined,
        videoUrl: (r.video_url ?? r.asset_url) as string | undefined,
        network,
        hookLabel: (r.hook ?? r.title ?? r.headline ?? `Creative ${idx + 1}`) as string,
        firstSeen: (r.first_seen ?? r.first_seen_at) as string | undefined,
        lastSeen: (r.last_seen ?? r.last_seen_at) as string | undefined,
        estImpressions: impressions,
        durationDays: Number(r.duration ?? r.days_running) || undefined,
        tier: rankToTier(idx, arr.length),
        rawText: (r.description ?? r.transcript ?? r.text) as string | undefined,
      };
    });

    return { ads, vertical: vertical || "Mobile Game" };
  },
};
