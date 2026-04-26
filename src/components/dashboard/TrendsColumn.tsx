import type { ScoreBreakdown, TrendAnalysis, PatternTag } from "@/lib/types";
import { StatRadar } from "@/components/StatRadar";
import { TrendVelocityChart } from "@/components/charts/TrendVelocityChart";
import { cn } from "@/lib/utils";

interface Props {
  breakdown?: ScoreBreakdown;
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

export function TrendsColumn({ breakdown, trend }: Props) {
  const allPatterns = trend ? [...trend.whatIsWorking, ...trend.whatIsSaturating] : [];

  // Sort by appearances * signal weight for the table.
  const tableRows = [...allPatterns]
    .sort((a, b) => {
      const w = (p: typeof a) => p.windowAppearances * (p.signalStrength === "high" ? 2 : 1);
      return w(b) - w(a);
    })
    .slice(0, 5);

  return (
    <section className="panel-grim p-6 flex flex-col gap-5 min-h-0 overflow-y-auto">
      <div className="font-display text-sm uppercase tracking-[0.4em] text-gold-dim">
        Trends · velocity × signal
      </div>

      {breakdown ? (
        <div>
          <StatRadar stats={breakdown.dimensions} />
        </div>
      ) : (
        <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground italic">
          Awaiting score data…
        </div>
      )}

      <div>
        <div className="text-sm uppercase tracking-[0.25em] text-gold-dim mb-1.5">
          Top patterns · trajectory
        </div>
        <TrendVelocityChart patterns={trend?.whatIsWorking ?? []} />
      </div>

      <div>
        <div className="text-sm uppercase tracking-[0.25em] text-gold-dim mb-1.5">
          Velocity × Signal
        </div>
        {tableRows.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gold/30">
                <th className="text-sm uppercase tracking-widest text-muted-foreground py-1.5 pr-2">
                  Pattern
                </th>
                <th className="text-sm uppercase tracking-widest text-muted-foreground py-1.5 pr-2 w-16">
                  Tag
                </th>
                <th className="text-sm uppercase tracking-widest text-muted-foreground py-1.5 text-right w-12">
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
                    <td className="py-1.5 pr-2 text-sm text-foreground/85 truncate max-w-[160px]">
                      {p.pattern}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span
                        className={cn(
                          "text-sm uppercase tracking-widest px-1.5 py-0.5 rounded-sm border",
                          TAG_STYLES[p.tag] ?? TAG_STYLES.filler,
                        )}
                      >
                        {p.tag}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "py-1.5 text-sm tabular-nums text-right",
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
          <p className="text-sm text-muted-foreground italic">
            No patterns detected.
          </p>
        )}
      </div>
    </section>
  );
}
