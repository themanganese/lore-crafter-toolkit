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

function looksLikeUnifiedAppId(value: string) {
  return /^[a-f0-9]{24}$/i.test(value);
}

async function resolveUnifiedAppId(externalId: string, platform: "ios" | "android") {
  if (looksLikeUnifiedAppId(externalId)) return externalId;

  const appIdType = platform === "ios" ? "itunes" : "android";
  const meta = await stFetch(`/v1/unified/apps`, {
    app_ids: externalId,
    app_id_type: appIdType,
  });

  const apps = (meta?.apps ?? (Array.isArray(meta) ? meta : [])) as unknown[];
  const first = apps?.[0] as Record<string, unknown> | undefined;
  const unifiedId = first?.unified_app_id;

  return typeof unifiedId === "string" && unifiedId.length > 0 ? unifiedId : externalId;
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

  async fetchTopAds({ externalId, platform, limit = 24 }) {
    const resolvedExternalId = await resolveUnifiedAppId(externalId, platform);

    // SensorTower's `limit` param only accepts {10, 50, 100}.
    const apiLimit = limit <= 10 ? 10 : limit <= 50 ? 50 : 100;

    const baseParams = {
      app_ids: resolvedExternalId,
      start_date: isoDaysAgo(90),
      end_date: isoDaysAgo(0),
      countries: DEFAULT_COUNTRIES,
      networks: DEFAULT_NETWORKS,
      ad_types: DEFAULT_AD_TYPES,
      display_breakdown: "true",
      limit: apiLimit,
    };

    let raw: unknown;
    try {
      raw = await stFetch(`/v1/unified/ad_intel/creatives`, baseParams);
    } catch {
      // Fall back to a narrower US-only Facebook+TikTok query.
      raw = await stFetch(`/v1/unified/ad_intel/creatives`, {
        ...baseParams,
        countries: "US",
        networks: "Facebook,TikTok",
        start_date: isoDaysAgo(30),
      });
    }

    const root = (raw ?? {}) as Record<string, unknown>;
    // Sensor Tower returns `ad_units: [...]` as the canonical list.
    const list = (root.ad_units ??
      root.creatives ??
      root.data ??
      root.results ??
      (Array.isArray(raw) ? raw : [])) as unknown[];
    const arr = (Array.isArray(list) ? list : []) as Record<string, unknown>[];

    // Sort by share of voice descending so tier ranking is meaningful.
    arr.sort((a, b) => Number(b.share ?? 0) - Number(a.share ?? 0));

    // Try to enrich vertical via app metadata.
    let vertical = "";
    try {
      const meta = await stFetch(`/v1/unified/apps`, {
        app_ids: resolvedExternalId,
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

    const ads: AdCreative[] = arr.slice(0, limit).map((unit, idx) => {
      // Each ad_unit holds one or more `creatives` (asset variants).
      const creatives = (unit.creatives as Record<string, unknown>[] | undefined) ?? [];
      const first = creatives[0] ?? {};

      const network = (unit.network ?? "Unknown") as string;
      const adType = (unit.ad_type ?? "") as string;
      const share = Number(unit.share ?? 0);

      // Asset URLs — choose the friendliest preview for each asset type.
      const thumb = (first.thumb_url ??
        first.preview_url ??
        first.creative_url) as string | undefined;
      const isVideo = adType.includes("video") || Number(first.video_duration ?? 0) > 0;
      const videoUrl = isVideo
        ? ((first.creative_url ?? first.preview_url) as string | undefined)
        : undefined;

      // Days running between first_seen_at / last_seen_at on the ad_unit.
      let durationDays: number | undefined;
      const firstSeen = unit.first_seen_at as string | undefined;
      const lastSeen = unit.last_seen_at as string | undefined;
      if (firstSeen && lastSeen) {
        const ms = Date.parse(lastSeen) - Date.parse(firstSeen);
        if (Number.isFinite(ms) && ms >= 0) durationDays = Math.round(ms / 86400000);
      }

      const message = (first.message as string | undefined)?.trim();

      return {
        id: String(unit.id ?? unit.phashion_group ?? `ad-${idx}`),
        thumbnailUrl: thumb,
        videoUrl,
        network,
        hookLabel: message && message.length > 0
          ? message.slice(0, 80)
          : `${network} ${adType || "creative"} #${idx + 1}`,
        firstSeen,
        lastSeen,
        // `share` is share-of-voice (0–1). Scale to a pseudo impressions number for display.
        estImpressions: share > 0 ? Math.round(share * 1_000_000) : undefined,
        durationDays,
        tier: rankToTier(idx, arr.length),
        rawText: message,
      };
    });

    return { ads, vertical: vertical || "Mobile Game" };
  },
};
