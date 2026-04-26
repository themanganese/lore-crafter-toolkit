import type { ScoreBreakdown, RevenueForecast, TrendAnalysis } from "@/lib/types";
import { RevenueForecastChart } from "@/components/charts/RevenueForecastChart";
import { cn } from "@/lib/utils";

interface Props {
  breakdown?: ScoreBreakdown;
  forecast?: RevenueForecast;
  trend?: TrendAnalysis;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-0 px-3 first:pl-0 last:pr-0 border-r border-gold/20 last:border-r-0">
      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-gold-dim">{label}</div>
      <div className="font-display text-sm text-foreground mt-0.5 truncate">{value}</div>
    </div>
  );
}

export function ForgeViewPanel({ breakdown, forecast, trend }: Props) {
  const angle =
    trend?.differentiationAngle ||
    breakdown?.claudeRead ||
    "Strategic synthesis pending — re-run analysis to forge a differentiation angle.";

  const topHook = trend?.hookType || "—";
  const arc = trend?.narrativeArc || "—";
  const levers = trend?.emotionalLevers?.join(" · ") || "—";

  // Recommended lead = the highest-impact rising "lead" pattern from trend output.
  const lead =
    trend?.whatIsWorking?.find((p) => p.tag === "lead")?.pattern ??
    trend?.whatIsWorking?.[0]?.pattern ??
    "—";

  const topLevers = breakdown?.levers?.slice(0, 3) ?? [];

  return (
    <section className="panel-grim p-6 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
      {/* Left sub-zone: synthesis + revenue */}
      <div className="flex flex-col gap-4 min-w-0">
        <div>
          <div className="font-display text-[11px] uppercase tracking-[0.4em] text-gold-dim">
            Forge View · Differentiation Angle
          </div>
          <p
            className="mt-2 font-display italic text-foreground/90 leading-relaxed"
            style={{
              fontSize: 23,
              lineHeight: 1.6,
              display: "-webkit-box",
              WebkitLineClamp: 4,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            “{angle}”
          </p>
        </div>

        {forecast ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold-dim mb-1">
              Revenue Forecast · Day 0 → 90
            </div>
            <RevenueForecastChart forecast={forecast} />
          </div>
        ) : (
          <div className="h-[160px] flex items-center justify-center font-mono text-[11px] text-muted-foreground italic border border-dashed border-gold/25 rounded-sm">
            Revenue forecast pending.
          </div>
        )}

        <div className="flex items-stretch panel-grim bg-parchment/60 px-4 py-2.5">
          <MiniStat label="Top Hook" value={topHook} />
          <MiniStat label="Narrative Arc" value={arc} />
          <MiniStat label="Emotional Levers" value={levers} />
          <MiniStat label="Recommended Lead" value={lead} />
        </div>
      </div>

      {/* Right sub-zone: improvement levers */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="font-display text-[11px] uppercase tracking-[0.4em] text-gold-dim">
          Improvement Levers
        </div>
        {topLevers.length > 0 ? (
          <div className="flex flex-col gap-2">
            {topLevers.map((l) => (
              <div
                key={l.id}
                className="flex items-start gap-3 p-3 border border-gold/30 rounded-sm bg-muted/15"
              >
                <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-sm gold-frame">
                  <span className="font-display text-sm text-gold-bright tabular-nums">
                    +{l.estimatedPointDelta}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="font-display text-sm text-foreground leading-tight">{l.title}</p>
                    {l.trendVelocity && (
                      <span
                        className={cn(
                          "font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border",
                          l.trendVelocity === "rising" &&
                            "bg-gold-bright/15 text-gold-bright border-gold-bright/40",
                          l.trendVelocity === "stable" &&
                            "bg-iron/30 text-foreground/70 border-iron/40",
                          l.trendVelocity === "declining" &&
                            "bg-destructive/12 text-destructive border-destructive/40",
                        )}
                      >
                        {l.trendVelocity}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-0.5 font-body text-[12px] text-muted-foreground leading-snug"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {l.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground italic">
            No levers surfaced. Re-run analysis to derive improvement paths.
          </p>
        )}
      </div>
    </section>
  );
}
