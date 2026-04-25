// Core domain types for Forge by Silki

export type Tier = "S" | "A" | "B" | "C" | "D";

export interface AdCreative {
  id: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  network: string;
  hookLabel: string;
  firstSeen?: string;
  lastSeen?: string;
  estImpressions?: number;
  durationDays?: number;
  tier: Tier;
  rawText?: string;
}

export interface CharacterStat {
  key: string;
  label: string;
  value: number; // 0-100
  tier: Tier;
  lore: string;
}

// ─── Silki agent outputs ──────────────────────────────────────────

export type Confidence = "high" | "medium" | "low";

export interface ImprovementLever {
  id: string;
  title: string;
  description: string;
  patternAffected?: string;
  trendVelocity?: "rising" | "stable" | "declining";
  estimatedPointDelta: number;
  applied?: boolean;
}

export interface ScoreBreakdown {
  winProbability: number; // 0-100
  confidence: Confidence;
  dimensions: CharacterStat[]; // hook_strength, visual_novelty, platform_fit, audience_alignment, differentiation
  claudeRead: string;
  levers: ImprovementLever[];
}

export interface ForecastPeriod {
  revenueUsd: number;
  modelled: boolean;
  confidence: Confidence;
}

export interface AppliedAssumption {
  id: string; // A01..A07
  label: string;
  value: string;
  reason: string;
}

export interface RevenueForecast {
  baselineMonthlyUsd: number;
  day30: ForecastPeriod;
  day60: ForecastPeriod;
  day90: ForecastPeriod;
  appliedAssumptions: AppliedAssumption[];
  sensorTowerActuals: {
    downloads30d?: number;
    iapRevenue30d?: number;
    categoryRank?: number;
  };
  summary: string;
  risk: string;
  opportunity: string;
  sensitiveAssumptions: string[];
}

export type PatternTag = "lead" | "safe" | "caution" | "watch" | "filler" | "avoid";

export interface TrendPattern {
  pattern: string;
  signalStrength: "high" | "medium";
  trendVelocity: "rising" | "stable" | "declining";
  windowAppearances: number;
  recommendation: string;
  tag: PatternTag;
}

export interface TrendAnalysis {
  whatIsWorking: TrendPattern[];
  whatIsSaturating: TrendPattern[];
  differentiationAngle: string;
  hookType: string;
  narrativeArc: string;
  emotionalLevers: string[];
}

// Per-game curation: which panels to emphasize / hide
export interface DashboardCuration {
  focus: string;
  emphasizedSections: ("score" | "revenue" | "trend" | "ads")[];
  collapsedSections: ("score" | "revenue" | "trend" | "ads")[];
  hiddenAssumptions?: string[];
}

// ─── Live AI thinking trace ──────────────────────────────────────

export type ThoughtStatus = "pending" | "in_progress" | "done" | "error";
export type ThoughtAgent = "orchestrator" | "sensortower" | "trend" | "score" | "revenue" | "creative";

export interface ThoughtEvent {
  id: string;
  agent: ThoughtAgent;
  message: string;
  status: ThoughtStatus;
  ts: string; // ISO
}

// ─── Brief / Generation / Gallery ────────────────────────────────

export interface CreativeBrief {
  id: string;
  title: string;
  targetGameName: string;
  targetHook: string;
  mechanic: string;
  visualCue: string;
  pacing: string;
  cta: string;
  notes?: string;
  prompt: string;
  createdAt: string;
}

export interface GeneratedCreative {
  id: string;
  briefId: string;
  imageUrl: string;
  prompt: string;
  model: string;
  createdAt: string;
  variantVersion?: string; // v01, v02
  leversApplied?: string[];
  parentId?: string;       // when this is an edit of a previous generation
}

export type GalleryItemKind = "generated" | "uploaded";

export interface GalleryItem {
  id: string;
  kind: GalleryItemKind;
  imageUrl: string;          // data URL for uploads, http for generations
  caption?: string;
  createdAt: string;
  generationId?: string;     // when kind === 'generated'
}

// ─── Ask AI ──────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

// ─── Game character ─────────────────────────────────────────────

export interface GameCharacter {
  id: string;
  externalId?: string;
  platform: "ios" | "android" | "unknown";
  name: string;
  publisher?: string;
  vertical: string;
  iconUrl?: string;
  createdAt: string;
  updatedAt: string;

  status: "draft" | "scrying" | "analyzed" | "error";
  errorMessage?: string;

  // Legacy + Score outputs
  ads: AdCreative[];
  stats: CharacterStat[];
  topHooks: { label: string; description: string; tier: Tier }[];
  codex: string[];
  briefs: CreativeBrief[];
  generations: GeneratedCreative[];

  // New Silki-style payloads
  scoreBreakdown?: ScoreBreakdown;
  revenueForecast?: RevenueForecast;
  trendAnalysis?: TrendAnalysis;
  curation?: DashboardCuration;
  aiThoughts: ThoughtEvent[];
  gallery: GalleryItem[];
  chatMessages: ChatMessage[];
}

export interface SnapshotPayload {
  version: 1;
  exportedAt: string;
  character: GameCharacter;
}
