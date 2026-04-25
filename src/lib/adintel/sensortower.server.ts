// SensorTower Ad Intelligence adapter — server-only.
// Aligned to the unified v1 endpoints documented in the official Postman
// collection. Auth is via `auth_token` query parameter (NOT Bearer).
//
// Endpoints used:
//   GET /v1/unified/search_entities?entity_type=app&term=...
//   GET /v1/unified/ad_intel/creatives?app_ids=...&start_date=...&end_date=...
//   GET /v1/unified/apps?app_ids=...&app_id_type=unified  (metadata enrichment)

import type { AdCreative } from "../types";
import { rankToTier, type AdIntelProvider, type GameSearchResult } from "./types";

const ST_BASE = "https://api.sensortower.com";

// Default networks & ad types — broad coverage so every vertical returns data.
const DEFAULT_NETWORKS =
  "TikTok,Facebook,Instagram,Unity,Admob,Applovin,Mintegral,Pangle,Youtube";
const DEFAULT_AD_TYPES =
  "video,video-interstitial,playable,image,banner,full_screen";
const DEFAULT_COUNTRIES = "US,GB,CA,AU,DE,FR,JP";

function authToken() {
  const key = process.env.SENSORTOWER_API_KEY;
  if (!key) throw new Error("SENSORTOWER_API_KEY is not configured");
  return key;
}

async function stFetch(
  path: string,
  params: Record<string, string | number | undefined>
) {
  const url = new URL(ST_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("auth_token", authToken());
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `SensorTower ${res.status} on ${path}: ${text.slice(0, 240)}`
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`SensorTower returned non-JSON on ${path}: ${text.slice(0, 200)}`);
  }
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function pickPlatform(app: Record<string, unknown>): "ios" | "android" {
  const os = (app.os ?? app.platform ?? app.primary_platform) as string | undefined;
  if (typeof os === "string" && os.toLowerCase().includes("android")) return "android";
  // Unified results sometimes carry both — default to ios for ranking display.
  return "ios";
}

export const sensorTowerProvider: AdIntelProvider = {
  name: "SensorTower",

  async searchGames(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const data = await stFetch(`/v1/unified/search_entities`, {
      entity_type: "app",
      term: trimmed,
      limit: 12,
    });

    // Unified search returns an array of apps directly, or under a key.
    const list = (Array.isArray(data) ? data : data?.apps ?? data?.results ?? []) as unknown[];

    const seen = new Set<string>();
    const out: GameSearchResult[] = [];
    for (const item of list) {
      const a = item as Record<string, unknown>;
      const id =
        (a.unified_app_id ?? a.app_id ?? a.id ?? a.entity_id) as
          | string
          | number
          | undefined;
      if (!id) continue;
      const key = String(id);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        externalId: key,
        platform: pickPlatform(a),
        name: (a.name ?? a.title ?? "Unknown") as string,
        publisher: (a.publisher_name ??
          a.publisher ??
          a.unified_publisher_name ??
          a.developer_name) as string | undefined,
        iconUrl: (a.icon ?? a.icon_url ?? a.image_url) as string | undefined,
        vertical: (a.category_name ??
          a.primary_category ??
          a.category ??
          a.genre) as string | undefined,
      });
    }
    return out;
  },

  async fetchTopAds({ externalId, limit = 24 }) {
    // Try wide window first (90 days, multi-country, all major networks).
    const baseParams = {
      app_ids: externalId,
      start_date: isoDaysAgo(90),
      end_date: isoDaysAgo(0),
      countries: DEFAULT_COUNTRIES,
      networks: DEFAULT_NETWORKS,
      ad_types: DEFAULT_AD_TYPES,
      display_breakdown: "true",
      limit,
    };

    let raw: unknown;
    try {
      raw = await stFetch(`/v1/unified/ad_intel/creatives`, baseParams);
    } catch (e) {
      // Fall back to a narrower US-only TikTok+Facebook query.
      raw = await stFetch(`/v1/unified/ad_intel/creatives`, {
        ...baseParams,
        countries: "US",
        networks: "TikTok,Facebook",
        start_date: isoDaysAgo(30),
      });
    }

    const root = raw as Record<string, unknown>;
    const list = (root.creatives ??
      root.data ??
      root.results ??
      (Array.isArray(raw) ? raw : [])) as unknown[];
    const arr = Array.isArray(list) ? list : [];

    // Try to enrich vertical via app metadata.
    let vertical = "";
    try {
      const meta = await stFetch(`/v1/unified/apps`, {
        app_ids: externalId,
        app_id_type: "unified",
      });
      const apps = (meta?.apps ?? (Array.isArray(meta) ? meta : [])) as unknown[];
      const first = apps?.[0] as Record<string, unknown> | undefined;
      vertical = ((first?.category_name ??
        first?.primary_category ??
        first?.category ??
        first?.genre ??
        "") as string) || "";
    } catch {
      // optional
    }

    const ads: AdCreative[] = arr.slice(0, limit).map((row, idx) => {
      const r = row as Record<string, unknown>;
      const network = (r.network ??
        r.ad_network ??
        r.publisher_network ??
        "Unknown") as string;
      const impressions = Number(
        r.impressions ?? r.share_of_voice ?? r.share ?? r.spend ?? 0
      ) || undefined;

      // Asset URLs — Sensor Tower returns various keys per asset type.
      const thumbnailUrl = (r.thumbnail_url ??
        r.preview_url ??
        r.image_url ??
        r.creative_url ??
        r.asset_thumbnail_url) as string | undefined;
      const videoUrl = (r.video_url ??
        r.asset_url ??
        r.creative_video_url) as string | undefined;

      vertical = vertical || ((r.category ?? r.genre ?? "") as string);

      return {
        id: String(r.creative_id ?? r.id ?? r.asset_id ?? `ad-${idx}`),
        thumbnailUrl,
        videoUrl,
        network,
        hookLabel: (r.hook ??
          r.title ??
          r.headline ??
          r.ad_text ??
          `Creative ${idx + 1}`) as string,
        firstSeen: (r.first_seen_at ?? r.first_seen ?? r.start_date) as
          | string
          | undefined,
        lastSeen: (r.last_seen_at ?? r.last_seen ?? r.end_date) as
          | string
          | undefined,
        estImpressions: impressions,
        durationDays: Number(r.duration ?? r.days_running) || undefined,
        tier: rankToTier(idx, arr.length),
        rawText: (r.description ?? r.transcript ?? r.ad_text ?? r.text) as
          | string
          | undefined,
      };
    });

    return { ads, vertical: vertical || "Mobile Game" };
  },
};
