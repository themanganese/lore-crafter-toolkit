import type { ScoreBreakdown, RevenueForecast, TrendAnalysis, ForecastPeriod } from "@/lib/types";
import { RevenueForecastChart } from "@/components/charts/RevenueForecastChart";
import { cn } from "@/lib/utils";

function formatUsdShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function deltaPct(value: number, baseline: number): string {
  if (!baseline) return "—";
  const pct = ((value - baseline) / baseline) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

function ForecastTile({
  label,
  period,
  baseline,
}: {
  label: string;
  period: ForecastPeriod;
  baseline: number;
}) {
  const delta = deltaPct(period.revenueUsd, baseline);
  const positive = period.revenueUsd >= baseline;
  return (
    <div className="flex-1 min-w-0 px-3 first:pl-0 last:pr-0 border-r border-gold/20 last:border-r-0">
      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-gold-dim">{label}</div>
      <div
        className="font-display text-[26px] tabular-nums leading-none mt-1"
        style={{ color: "#b08a4a" }}
      >
        {formatUsdShort(period.revenueUsd)}
      </div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-widest tabular-nums",
            positive ? "text-gold-bright" : "text-destructive/85",
          )}
        >
          {delta}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          vs baseline · {period.confidence}
        </span>
      </div>
    </div>
  );
}

function CumulativeTile({ total }: { total: number }) {
  return (
    <div className="flex-1 min-w-0 px-3 first:pl-0 last:pr-0 border-r border-gold/20 last:border-r-0">
      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-gold-dim">Q1 Total</div>
      <div
        className="font-display text-[26px] tabular-nums leading-none mt-1"
        style={{ color: "#b08a4a" }}
      >
        {formatUsdShort(total)}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
        Cumulative · 90 days
      </div>
    </div>
  );
}

function SensorTowerStrip({ actuals }: { actuals: RevenueForecast["sensorTowerActuals"] }) {
  const { downloads30d, iapRevenue30d, categoryRank } = actuals ?? {};
  if (!downloads30d && !iapRevenue30d && !categoryRank) return null;
  return (
    <div className="flex items-center gap-3 flex-wrap font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-l-2 border-gold/40 pl-3">
      <span className="text-gold-dim">Sensor Tower · 30D actuals</span>
      {downloads30d !== undefined && (
        <span>
          ↓{" "}
          <span className="text-foreground/85 tabular-nums normal-case tracking-normal">
            {downloads30d.toLocaleString()}
          </span>{" "}
          installs
        </span>
      )}
      {iapRevenue30d !== undefined && (
        <span>
          IAP{" "}
          <span className="text-foreground/85 tabular-nums normal-case tracking-normal">
            {formatUsdShort(iapRevenue30d)}
          </span>
        </span>
      )}
      {categoryRank !== undefined && (
        <span>
          Rank{" "}
          <span className="text-foreground/85 tabular-nums normal-case tracking-normal">
            #{categoryRank}
          </span>
        </span>
      )}
    </div>
  );
}

function InsightCallout({
  tone,
  label,
  body,
}: {
  tone: "risk" | "opportunity";
  label: string;
  body: string;
}) {
  return (
    <div
      className={cn(
        "panel-grim p-3 border-l-4",
        tone === "risk" ? "border-l-destructive/70" : "border-l-gold-bright",
      )}
    >
      <div
        className={cn(
          "font-mono text-[9px] uppercase tracking-[0.25em] mb-1",
          tone === "risk" ? "text-destructive" : "text-gold",
        )}
      >
        {tone === "risk" ? "⚠ " : "↗ "}
        {label}
      </div>
      <p className="font-body text-[12px] text-foreground/85 leading-snug">{body}</p>
    </div>
  );
}

function AssumptionFootnote({ forecast }: { forecast: RevenueForecast }) {
  const total = forecast.appliedAssumptions.length;
  const sensitive = forecast.sensitiveAssumptions ?? [];
  if (total === 0) return null;

  // Map sensitive IDs → labels for hover hint, falling back to the ID alone.
  const labelById = new Map(forecast.appliedAssumptions.map((a) => [a.id, a.label]));

  return (
    <div className="flex items-center gap-2 flex-wrap font-mono text-[10px] tracking-widest text-muted-foreground">
      <span className="uppercase text-gold-dim">
        {total} assumption{total === 1 ? "" : "s"} applied
      </span>
      {sensitive.length > 0 && (
        <>
          <span className="text-gold-dim">·</span>
          <span className="uppercase text-gold-dim">Sensitive</span>
          {sensitive.map((id) => (
            <span
              key={id}
              title={labelById.get(id) ?? id}
              className="px-1.5 py-0.5 rounded-sm border border-bronze/40 bg-bronze/10 text-bronze"
            >
              {id}
            </span>
          ))}
        </>
      )}
    </div>
  );
}

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
    <section className="panel-grim p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold-dim">
                Revenue Forecast · Day 0 → 90
              </div>
              <div className="font-display italic text-[11px] text-foreground/65">
                Baseline: {formatUsdShort(forecast.baselineMonthlyUsd)}/mo
              </div>
            </div>

            {/* Headline strip — milestone run-rates + cumulative total */}
            <div className="flex items-stretch panel-grim bg-parchment/60 px-4 py-2.5">
              <ForecastTile
                label="30 Days"
                period={forecast.day30}
                baseline={forecast.baselineMonthlyUsd}
              />
              <ForecastTile
                label="60 Days"
                period={forecast.day60}
                baseline={forecast.baselineMonthlyUsd}
              />
              <ForecastTile
                label="90 Days"
                period={forecast.day90}
                baseline={forecast.baselineMonthlyUsd}
              />
              <CumulativeTile
                total={
                  forecast.day30.revenueUsd + forecast.day60.revenueUsd + forecast.day90.revenueUsd
                }
              />
            </div>

            <RevenueForecastChart forecast={forecast} height={220} />

            {/* Sensor Tower actuals — real anchors under the modelled curve */}
            <SensorTowerStrip actuals={forecast.sensorTowerActuals} />

            {/* Risk + Opportunity — the qualitative reads from the model */}
            {(forecast.risk || forecast.opportunity) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {forecast.risk && <InsightCallout tone="risk" label="Risk" body={forecast.risk} />}
                {forecast.opportunity && (
                  <InsightCallout
                    tone="opportunity"
                    label="Opportunity"
                    body={forecast.opportunity}
                  />
                )}
              </div>
            )}

            {/* Summary — the model's narrative read */}
            {forecast.summary && (
              <p className="font-display italic text-[13px] text-foreground/85 leading-snug">
                “{forecast.summary}”
              </p>
            )}

            {/* Assumption transparency */}
            <AssumptionFootnote forecast={forecast} />
          </div>
        ) : (
          <div className="h-[220px] flex items-center justify-center font-mono text-[11px] text-muted-foreground italic border border-dashed border-gold/25 rounded-sm">
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
