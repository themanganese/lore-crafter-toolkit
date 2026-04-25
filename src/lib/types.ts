// Core domain types for CreatorForge

export type Tier = "S" | "A" | "B" | "C" | "D";

export interface AdCreative {
  id: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  network: string;            // e.g. "Meta", "TikTok", "AppLovin"
  hookLabel: string;          // short AI-extracted label
  firstSeen?: string;         // ISO date
  lastSeen?: string;
  estImpressions?: number;
  durationDays?: number;
  tier: Tier;
  rawText?: string;           // OCR / description if available
}

export interface CharacterStat {
  key: string;                // machine slug, e.g. "hook_strength"
  label: string;              // display name, e.g. "Hook Strength"
  value: number;              // 0–100
  tier: Tier;
  lore: string;               // one-line explanation
}

export interface GameCharacter {
  id: string;                 // local UUID
  externalId?: string;        // SensorTower app id
  platform: "ios" | "android" | "unknown";
  name: string;
  publisher?: string;
  vertical: string;           // e.g. "Match-3 Puzzle", "Action RPG"
  iconUrl?: string;
  createdAt: string;
  updatedAt: string;

  // Pipeline state
  status: "draft" | "scrying" | "analyzed" | "error";
  errorMessage?: string;

  // Results
  ads: AdCreative[];
  stats: CharacterStat[];
  topHooks: { label: string; description: string; tier: Tier }[]; // "equipped weapons"
  codex: string[];            // raw insight bullets
  briefs: CreativeBrief[];
  generations: GeneratedCreative[];
}

export interface CreativeBrief {
  id: string;
  title: string;
  targetGameName: string;     // the user's own game
  targetHook: string;
  mechanic: string;
  visualCue: string;
  pacing: string;
  cta: string;
  notes?: string;
  prompt: string;             // composed prompt for Scenario
  createdAt: string;
}

export interface GeneratedCreative {
  id: string;
  briefId: string;
  imageUrl: string;
  prompt: string;
  model: string;
  createdAt: string;
}

export interface SnapshotPayload {
  version: 1;
  exportedAt: string;
  character: GameCharacter;
}
