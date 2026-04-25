import { useState } from "react";
import {
  Loader2,
  Sword,
  ScrollText,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Lightbulb,
  ChevronDown,
} from "lucide-react";
import type {
  ScoreBreakdown,
  RevenueForecast,
  TrendAnalysis,
  TrendPattern,
  ImprovementLever,
  AdCreative,
  ThoughtEvent,
  GalleryItem,
  GeneratedCreative,
  CreativeBrief,
} from "@/lib/types";
import { StatRadar } from "@/components/StatRadar";
import { StatRow } from "@/components/StatRow";
import { TierBadge } from "@/components/TierBadge";
import { AdCard } from "@/components/AdCard";
import { cn } from "@/lib/utils";

// ─── Score Breakdown Panel ────────────────────────────────────────
export function ScoreBreakdownPanel({
  breakdown,
  loreStats,
  topHooks,
  codex,
}: {
  breakdown: ScoreBreakdown;
  loreStats: import("@/lib/types").CharacterStat[];
  topHooks: { label: string; description: string; tier: import("@/lib/types").Tier }[];
  codex: string[];
}) {
  return (
    <div className="space-y-6">
      {/* Win prob + radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 flex flex-col items-center justify-center text-center p-4 gold-frame">
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim">
            Win Probability
          </div>
          <div className="font-display text-6xl text-gradient-gold mt-1 tabular-nums">
            {breakdown.winProbability}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            / 100 · {breakdown.confidence} confidence
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-bronze via-gold to-gold-bright"
              style={{ width: `${breakdown.winProbability}%` }}
            />
          </div>
        </div>
        <div className="lg:col-span-2 panel-grim p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim mb-2">
            5-Dimension Stat Radar
          </div>
          <StatRadar stats={breakdown.dimensions} />
        </div>
      </div>

      {/* Dimension rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {breakdown.dimensions.map((s) => (
          <StatRow key={s.key} stat={s} />
        ))}
      </div>

      {/* Improvement levers */}
      {breakdown.levers.length > 0 && (
        <div>
          <h4 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-3 flex items-center gap-2">
            <Lightbulb className="h-3.5 w-3.5" />
            Improvement Levers
          </h4>
          <div className="space-y-2">
            {breakdown.levers.map((lever) => (
              <LeverRow key={lever.id} lever={lever} />
            ))}
          </div>
        </div>
      )}

      {/* Strategic read */}
      {breakdown.claudeRead && (
        <div className="panel-grim p-4 bg-parchment border-l-4 border-l-gold">
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim mb-2 flex items-center gap-2">
            <Sparkles className="h-3 w-3" />
            Strategic Read
          </div>
          <p className="font-body text-sm text-foreground/90 leading-relaxed">
            {breakdown.claudeRead}
          </p>
        </div>
      )}

      {/* Lore stats + top hooks */}
      {loreStats.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-gold-dim flex items-center gap-2 hover:text-gold">
            <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
            Vertical-specific lore stats ({loreStats.length})
          </summary>
          <div className="mt-3 space-y-1">
            {loreStats.map((s) => (
              <StatRow key={s.key} stat={s} />
            ))}
          </div>
        </details>
      )}

      {/* Top hooks */}
      {topHooks.length > 0 && (
        <div>
          <h4 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-3 flex items-center gap-2">
            <Sword className="h-3.5 w-3.5" />
            Equipped Hooks
          </h4>
          <div className="space-y-2">
            {topHooks.map((h, i) => (
              <div key={i} className="border border-border/60 rounded-sm p-3 bg-muted/20 flex items-start gap-3">
                <TierBadge tier={h.tier} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm text-foreground">{h.label}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground italic leading-snug">
                    {h.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Codex */}
      {codex.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-gold-dim flex items-center gap-2 hover:text-gold">
            <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
            <ScrollText className="h-3 w-3" />
            Codex insights ({codex.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {codex.map((line, i) => (
              <li key={i} className="flex items-start gap-2 font-mono text-xs text-foreground/85 leading-relaxed">
                <span className="text-gold mt-0.5">⌑</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LeverRow({ lever }: { lever: ImprovementLever }) {
  return (
    <div className="border border-border/70 rounded-sm p-3 bg-muted/15 flex items-start gap-3">
      <div className="h-9 w-9 rounded-sm gold-frame flex items-center justify-center shrink-0">
        <span className="font-display text-sm text-gold-bright">+{lever.estimatedPointDelta}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-display text-sm text-foreground">{lever.title}</p>
          {lever.trendVelocity && (
            <span
              className={cn(
                "font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm",
                lever.trendVelocity === "rising" && "bg-gold/15 text-gold-bright",
                lever.trendVelocity === "stable" && "bg-iron/30 text-foreground/70",
                lever.trendVelocity === "declining" && "bg-destructive/15 text-destructive"
              )}
            >
              {lever.trendVelocity}
            </span>
          )}
        </div>
        <p className="mt-1 font-body text-xs text-muted-foreground leading-relaxed">
          {lever.description}
        </p>
      </div>
    </div>
  );
}

// ─── Revenue Forecast Panel ───────────────────────────────────────
export function RevenueForecastPanel({ forecast }: { forecast: RevenueForecast }) {
  const periods: { key: string; label: string; period: import("@/lib/types").ForecastPeriod }[] = [
    { key: "30", label: "30 Days", period: forecast.day30 },
    { key: "60", label: "60 Days", period: forecast.day60 },
    { key: "90", label: "90 Days", period: forecast.day90 },
  ];
  return (
    <div className="space-y-5">
      {/* Headline baseline */}
      <div className="flex items-end justify-between flex-wrap gap-3 border-b border-border pb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim">
            Baseline Monthly Revenue
          </div>
          <div className="font-display text-4xl text-gradient-gold tabular-nums mt-1">
            ${forecast.baselineMonthlyUsd.toLocaleString()}
          </div>
        </div>
        {forecast.sensorTowerActuals.downloads30d !== undefined && (
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              SensorTower 30d Downloads
            </div>
            <div className="font-mono text-lg text-foreground tabular-nums">
              {forecast.sensorTowerActuals.downloads30d.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Three period tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {periods.map(({ key, label, period }) => (
          <div key={key} className="gold-frame p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-gold-dim">
                {label}
              </span>
              <span
                className={cn(
                  "font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm",
                  period.confidence === "high" && "bg-gold/15 text-gold",
                  period.confidence === "medium" && "bg-bronze/20 text-bronze",
                  period.confidence === "low" && "bg-iron/30 text-muted-foreground"
                )}
              >
                {period.confidence}
              </span>
            </div>
            <div className="font-display text-2xl text-foreground tabular-nums mt-2">
              ${period.revenueUsd.toLocaleString()}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
              {period.modelled ? "Modelled" : "Sensor Tower data"}
            </div>
          </div>
        ))}
      </div>

      {/* Risk + Opportunity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="panel-grim p-4 border-l-4 border-l-destructive/70">
          <div className="font-mono text-[10px] uppercase tracking-widest text-destructive flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3 w-3" /> Risk
          </div>
          <p className="font-body text-xs text-foreground/85 leading-relaxed">{forecast.risk}</p>
        </div>
        <div className="panel-grim p-4 border-l-4 border-l-gold-bright">
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3 w-3" /> Opportunity
          </div>
          <p className="font-body text-xs text-foreground/85 leading-relaxed">
            {forecast.opportunity}
          </p>
        </div>
      </div>

      {forecast.summary && (
        <div className="panel-grim p-4 bg-parchment">
          <p className="font-body text-sm text-foreground/90 leading-relaxed italic">
            "{forecast.summary}"
          </p>
        </div>
      )}

      {/* Assumptions */}
      {forecast.appliedAssumptions.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-gold-dim flex items-center gap-2 hover:text-gold">
            <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
            Applied assumptions ({forecast.appliedAssumptions.length})
          </summary>
          <div className="mt-3 border border-border rounded-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    ID
                  </th>
                  <th className="text-left px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    Assumption
                  </th>
                  <th className="text-left px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {forecast.appliedAssumptions.map((a) => (
                  <tr key={a.id} className="border-t border-border/60" title={a.reason}>
                    <td className="px-3 py-2 font-mono text-[10px] text-gold-dim">{a.id}</td>
                    <td className="px-3 py-2 font-body text-foreground/90">{a.label}</td>
                    <td className="px-3 py-2 font-mono text-foreground tabular-nums">{a.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {forecast.sensitiveAssumptions.length > 0 && (
            <div className="mt-2 font-mono text-[10px] text-bronze">
              Sensitive: {forecast.sensitiveAssumptions.join(", ")}
            </div>
          )}
        </details>
      )}
    </div>
  );
}

// ─── Trend Analysis Panel (with sub-sections) ─────────────────────
export function TrendAnalysisPanel({ trend }: { trend: TrendAnalysis }) {
  return (
    <div className="space-y-3">
      <TrendSubSection
        title="What's Working"
        icon={<TrendingUp className="h-3.5 w-3.5 text-gold-bright" />}
        defaultOpen
      >
        <PatternList patterns={trend.whatIsWorking} />
      </TrendSubSection>

      <TrendSubSection
        title="What's Saturating"
        icon={<TrendingDown className="h-3.5 w-3.5 text-destructive" />}
      >
        <PatternList patterns={trend.whatIsSaturating} />
      </TrendSubSection>

      <TrendSubSection
        title="Velocity × Signal Matrix"
        icon={<Activity className="h-3.5 w-3.5 text-gold" />}
      >
        <VelocityMatrix patterns={[...trend.whatIsWorking, ...trend.whatIsSaturating]} />
      </TrendSubSection>

      <TrendSubSection
        title="Differentiation Angle"
        icon={<Sparkles className="h-3.5 w-3.5 text-copper" />}
      >
        <div className="space-y-3">
          <div className="panel-grim p-4 bg-parchment border-l-4 border-l-copper">
            <p className="font-display text-base text-foreground leading-relaxed">
              {trend.differentiationAngle}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <MetaTile label="Hook Type" value={trend.hookType} />
            <MetaTile label="Narrative Arc" value={trend.narrativeArc} />
            <MetaTile
              label="Emotional Levers"
              value={trend.emotionalLevers.join(" · ")}
            />
          </div>
        </div>
      </TrendSubSection>
    </div>
  );
}

function TrendSubSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-sm overflow-hidden bg-muted/15">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gold/5 transition-colors text-left"
      >
        {icon}
        <span className="font-display text-sm text-foreground flex-1">{title}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 text-gold-dim transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border/60">{children}</div>
      )}
    </div>
  );
}

function PatternList({ patterns }: { patterns: TrendPattern[] }) {
  if (!patterns.length) {
    return (
      <p className="font-mono text-xs text-muted-foreground italic py-2">
        No patterns detected.
      </p>
    );
  }
  return (
    <div className="space-y-2 mt-2">
      {patterns.map((p, i) => (
        <div key={i} className="panel-grim p-3 flex items-start gap-3">
          <PatternTag tag={p.tag} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="font-display text-sm text-foreground">{p.pattern}</p>
              <span className="font-mono text-[10px] text-muted-foreground">
                ×{p.windowAppearances}
              </span>
              <span
                className={cn(
                  "font-mono text-[9px] uppercase tracking-widest",
                  p.trendVelocity === "rising" && "text-gold-bright",
                  p.trendVelocity === "stable" && "text-bronze",
                  p.trendVelocity === "declining" && "text-destructive"
                )}
              >
                {p.trendVelocity}
              </span>
            </div>
            <p className="mt-1 font-body text-xs text-muted-foreground leading-relaxed">
              {p.recommendation}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PatternTag({ tag }: { tag: import("@/lib/types").PatternTag }) {
  const styles: Record<typeof tag, string> = {
    lead: "bg-gold-bright/20 text-gold-bright border-gold-bright/60",
    safe: "bg-gold/15 text-gold border-gold/50",
    watch: "bg-copper/15 text-copper border-copper/50",
    caution: "bg-bronze/20 text-bronze border-bronze/50",
    filler: "bg-iron/25 text-foreground/60 border-iron/50",
    avoid: "bg-destructive/15 text-destructive border-destructive/50",
  };
  return (
    <span
      className={cn(
        "shrink-0 font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded-sm border",
        styles[tag]
      )}
    >
      {tag}
    </span>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-sm p-3 bg-card">
      <div className="font-mono text-[9px] uppercase tracking-widest text-gold-dim">{label}</div>
      <div className="font-body text-sm text-foreground mt-1">{value}</div>
    </div>
  );
}

function VelocityMatrix({ patterns }: { patterns: TrendPattern[] }) {
  // 2x3 grid: rows = signal (high/medium), cols = velocity (rising/stable/declining)
  const cells: Record<string, TrendPattern[]> = {};
  for (const p of patterns) {
    const k = `${p.signalStrength}|${p.trendVelocity}`;
    cells[k] = cells[k] ?? [];
    cells[k].push(p);
  }
  const sigs: ("high" | "medium")[] = ["high", "medium"];
  const vels: ("rising" | "stable" | "declining")[] = ["rising", "stable", "declining"];
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th></th>
            {vels.map((v) => (
              <th
                key={v}
                className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground p-2"
              >
                {v}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sigs.map((sig) => (
            <tr key={sig}>
              <th className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground p-2 text-right">
                {sig} signal
              </th>
              {vels.map((vel) => {
                const list = cells[`${sig}|${vel}`] ?? [];
                return (
                  <td
                    key={vel}
                    className={cn(
                      "border border-border/60 p-2 align-top min-w-[100px]",
                      sig === "high" && vel === "rising" && "bg-gold-bright/10",
                      sig === "medium" && vel === "declining" && "bg-destructive/8"
                    )}
                  >
                    {list.length === 0 ? (
                      <span className="text-muted-foreground/50 font-mono text-[10px]">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {list.map((p, i) => (
                          <li
                            key={i}
                            className="font-body text-[11px] text-foreground/85 leading-snug"
                          >
                            {p.pattern}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Top Ads grid ─────────────────────────────────────────────────
export function TopAdsPanel({ ads }: { ads: AdCreative[] }) {
  if (!ads.length) {
    return (
      <p className="font-mono text-xs text-muted-foreground italic">
        No reference ads available.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {ads.map((ad) => (
        <AdCard key={ad.id} ad={ad} />
      ))}
    </div>
  );
}

// ─── AI thinking trace ───────────────────────────────────────────
export function AIThinkingTrace({
  events,
  active,
}: {
  events: ThoughtEvent[];
  active: boolean;
}) {
  if (!events.length && !active) return null;
  return (
    <div className="bg-foreground/95 text-background border border-gold/40 rounded-sm overflow-hidden font-mono text-[11px]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gold/30 bg-foreground">
        {active && <Loader2 className="h-3 w-3 animate-spin text-gold-bright" />}
        <span className="text-gold-bright tracking-widest uppercase">
          {active ? "Silki is thinking…" : "AI reasoning trace"}
        </span>
        <span className="text-background/50 ml-auto">{events.length} steps</span>
      </div>
      <ul className="max-h-64 overflow-y-auto px-3 py-2 space-y-1.5">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-2">
            <StatusDot status={e.status} />
            <span className="text-gold-bright/80 uppercase tracking-widest text-[9px] shrink-0 w-20">
              {e.agent}
            </span>
            <span
              className={cn(
                "leading-snug",
                e.status === "error" && "text-red-300",
                e.status === "done" && "text-background/85",
                e.status === "in_progress" && "text-background"
              )}
            >
              {e.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusDot({ status }: { status: ThoughtEvent["status"] }) {
  if (status === "done")
    return <CheckCircle2 className="h-3 w-3 text-gold-bright shrink-0 mt-0.5" />;
  if (status === "error")
    return <AlertTriangle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />;
  return <span className="h-2 w-2 rounded-full bg-copper think-pulse shrink-0 mt-1" />;
}

// ─── Gallery panel ───────────────────────────────────────────────
export function GalleryPanel({
  items,
  onUpload,
  onDelete,
}: {
  items: GalleryItem[];
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "generated" | "uploaded">("all");
  const filtered = items.filter((i) => filter === "all" || i.kind === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {(["all", "generated", "uploaded"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest rounded-sm border transition-colors",
                filter === f
                  ? "border-gold/60 bg-gold/10 text-gold-bright"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <label className="gold-frame px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-gold-bright hover:bg-gold/10 cursor-pointer">
          Upload reference
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {filtered.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground italic py-6 text-center">
          No images yet — upload references or generate creatives below.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((it) => (
            <div key={it.id} className="panel-grim overflow-hidden group relative">
              <div className="aspect-square bg-muted">
                <img src={it.imageUrl} alt={it.caption ?? ""} className="h-full w-full object-cover" />
              </div>
              <div className="px-2 py-1.5 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "font-mono text-[9px] uppercase tracking-widest",
                    it.kind === "generated" ? "text-gold" : "text-bronze"
                  )}
                >
                  {it.kind}
                </span>
                <button
                  onClick={() => onDelete(it.id)}
                  className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Anvil (Generation Studio) ───────────────────────────────────
export function AnvilPanel({
  briefs,
  generations,
  gameId,
  onGenerate,
  generating,
  activeBriefId,
  setActiveBriefId,
}: {
  briefs: CreativeBrief[];
  generations: GeneratedCreative[];
  gameId: string;
  onGenerate: (brief: CreativeBrief) => void;
  generating: boolean;
  activeBriefId?: string;
  setActiveBriefId: (id: string) => void;
}) {
  const activeBrief = briefs.find((b) => b.id === activeBriefId) ?? briefs[0];

  return (
    <div className="space-y-5">
      {briefs.length === 0 ? (
        <div className="panel-grim p-8 text-center">
          <p className="font-mono text-xs text-muted-foreground">
            No briefs yet. Build a brief above to feed the anvil.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          <aside className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim mb-1">
              Briefs
            </div>
            {briefs.map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveBriefId(b.id)}
                className={cn(
                  "w-full text-left panel-grim p-3 transition-colors",
                  activeBrief?.id === b.id && "border-gold/60 bg-gold/5"
                )}
              >
                <div className="font-display text-sm text-foreground">{b.title}</div>
                <div className="font-mono text-[10px] text-muted-foreground mt-1 truncate">
                  For {b.targetGameName}
                </div>
              </button>
            ))}
          </aside>
          <div className="space-y-3">
            {activeBrief && (
              <div className="gold-frame p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h4 className="font-display text-base text-foreground">
                      {activeBrief.title}
                    </h4>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      For {activeBrief.targetGameName}
                    </p>
                  </div>
                  <button
                    onClick={() => onGenerate(activeBrief)}
                    disabled={generating}
                    className="btn-copper px-4 py-2 font-display tracking-wider text-sm flex items-center gap-2 rounded-sm disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Generate variant
                  </button>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground bg-muted/30 border border-border rounded-sm p-3 max-h-32 overflow-y-auto leading-relaxed">
                  {activeBrief.prompt}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* YouTube-style thumbnail feed */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim mb-3">
          Generations ({generations.length}) — click any to edit in a new tab
        </div>
        {generations.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground italic">
            No variants forged yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {generations.map((g, i) => (
              <a
                key={g.id}
                href={`/character/${gameId}/edit/${g.id}`}
                target="_blank"
                rel="noreferrer"
                className="panel-grim overflow-hidden group block"
              >
                <div className="aspect-video bg-muted relative">
                  <img
                    src={g.imageUrl}
                    alt=""
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <span className="absolute top-1.5 left-1.5 font-mono text-[9px] uppercase tracking-widest bg-foreground/85 text-background px-1.5 py-0.5 rounded-sm">
                    v{(generations.length - i).toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="p-2">
                  <div className="font-mono text-[10px] text-foreground/80 truncate">
                    {g.prompt.slice(0, 60)}…
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground mt-0.5">
                    {new Date(g.createdAt).toLocaleString()}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
