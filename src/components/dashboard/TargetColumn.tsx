import type { ScoreBreakdown, Tier, TrendAnalysis, PatternTag } from "@/lib/types";
import { TierBadge } from "@/components/TierBadge";
import { cn } from "@/lib/utils";

interface Props {
  breakdown?: ScoreBreakdown;
  topHooks: { label: string; description: string; tier: Tier }[];
  trend?: TrendAnalysis;
}

const TAG_STYLES: Record<PatternTag, string> = {
  lead: "bg-gold-bright/20 text-gold-bright border-gold-bright/60",
  safe: "bg-gold/10 text-gold border-gold/40",
  watch: "bg-copper/15 text-copper border-copper/50",
  caution: "bg-bronze/15 text-bronze border-bronze/50",
  filler: "bg-iron/25 text-foreground/60 border-iron/40",
  avoid: "bg-destructive/12 text-destructive border-destructive/40",
};

function WinProbabilityRing({ score, confidence }: { score: number; confidence: string }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="color-mix(in oklab, var(--gold) 15%, transparent)"
            strokeWidth="6"
          />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="var(--color-gold-bright)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 800ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-5xl text-gradient-gold tabular-nums leading-none">
            {score}
          </div>
        </div>
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        / 100 · {confidence} confidence
      </div>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: number }) {
  // Defensive: guard against missing/non-numeric values so the row never
  // collapses to an invisible span. Round to whole numbers for display.
  const n = Number.isFinite(value) ? Math.round(value) : 0;
  const isStrong = n >= 60;
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-gold/15 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/75">
        {label}
      </span>
      <span
        className="font-display text-base tabular-nums"
        style={{ color: isStrong ? "#b08a4a" : "var(--color-bronze)" }}
      >
        {n}
      </span>
    </div>
  );
}

function HookRow({ hook }: { hook: { label: string; description: string; tier: Tier } }) {
  return (
    <div className="group flex items-center gap-2.5 py-1.5">
      <TierBadge tier={hook.tier} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm text-foreground truncate">{hook.label}</div>
        <div className="font-mono text-[10px] text-muted-foreground italic leading-snug max-h-0 overflow-hidden group-hover:max-h-12 transition-[max-height] duration-200">
          {hook.description}
        </div>
      </div>
    </div>
  );
}

export function TargetColumn({ breakdown, topHooks, trend }: Props) {
  const allPatterns = trend ? [...trend.whatIsWorking, ...trend.whatIsSaturating] : [];
  const tableRows = [...allPatterns]
    .sort((a, b) => {
      const w = (p: typeof a) => p.windowAppearances * (p.signalStrength === "high" ? 2 : 1);
      return w(b) - w(a);
    })
    .slice(0, 5);

  return (
    <section className="panel-grim p-6 flex flex-col gap-3 min-h-0 overflow-y-auto">
      <div className="font-display text-[11px] uppercase tracking-[0.4em] text-gold-dim">
        Target
      </div>

      {breakdown ? (
        <WinProbabilityRing score={breakdown.winProbability} confidence={breakdown.confidence} />
      ) : (
        <div className="h-36 flex items-center justify-center font-mono text-[11px] text-muted-foreground italic">
          Awaiting score…
        </div>
      )}

      <div>
        {breakdown ? (
          breakdown.dimensions.map((d) => <StatLine key={d.key} label={d.label} value={d.value} />)
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground italic">
            5-dimension scores pending.
          </p>
        )}
      </div>

      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold-dim mb-1">
          Equipped Hooks ({topHooks.length})
        </div>
        {topHooks.length > 0 ? (
          <div className="divide-y divide-gold/10">
            {topHooks.slice(0, 3).map((h, i) => (
              <HookRow key={i} hook={h} />
            ))}
          </div>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground italic">None equipped.</p>
        )}
      </div>

      {/* Velocity × Signal — moved here from TrendsColumn to free chart space */}
      <div className="border-t border-gold/30 pt-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold-dim mb-1.5">
          Velocity × Signal
        </div>
        {tableRows.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-gold/30">
                <th className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground py-1.5 pr-2">
                  Pattern
                </th>
                <th className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground py-1.5 pr-2 w-16">
                  Tag
                </th>
                <th className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground py-1.5 text-right w-12">
                  Δ
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((p, i) => {
                const delta =
                  p.trendVelocity === "rising"
                    ? `+${p.windowAppearances}`
                    : p.trendVelocity === "declining"
                      ? `−${p.windowAppearances}`
                      : `${p.windowAppearances}`;
                const deltaColor =
                  p.trendVelocity === "rising"
                    ? "text-gold-bright"
                    : p.trendVelocity === "declining"
                      ? "text-destructive/85"
                      : "text-foreground/70";
                return (
                  <tr key={i} className="border-b border-gold/10 last:border-0">
                    <td className="py-1.5 pr-2 font-body text-[12px] text-foreground/85 truncate max-w-[160px]">
                      {p.pattern}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span
                        className={cn(
                          "font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border",
                          TAG_STYLES[p.tag] ?? TAG_STYLES.filler,
                        )}
                      >
                        {p.tag}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "py-1.5 font-mono text-[12px] tabular-nums text-right",
                        deltaColor,
                      )}
                    >
                      {delta}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground italic">
            No patterns detected.
          </p>
        )}
      </div>
    </section>
  );
}
