import type { ScoreBreakdown, TrendAnalysis, RevenueForecast } from "@/lib/types";
import { StatRadar } from "@/components/StatRadar";
import { TrendVelocityChart } from "@/components/charts/TrendVelocityChart";
import { RevenueForecastChart } from "@/components/charts/RevenueForecastChart";

interface Props {
  breakdown?: ScoreBreakdown;
  trend?: TrendAnalysis;
  forecast?: RevenueForecast;
}

export function TrendsColumn({ breakdown, trend, forecast }: Props) {
  return (
    <section className="panel-grim p-6 flex flex-col gap-5 min-h-0 overflow-y-auto">
      <div className="font-display text-[11px] uppercase tracking-[0.4em] text-gold-dim">
        Trends · velocity × signal
      </div>

      {breakdown ? (
        <div>
          <StatRadar stats={breakdown.dimensions} />
        </div>
      ) : (
        <div className="h-[240px] flex items-center justify-center font-mono text-[11px] text-muted-foreground italic">
          Awaiting score data…
        </div>
      )}

      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold-dim mb-1.5">
          Top patterns · trajectory
        </div>
        <TrendVelocityChart patterns={trend?.whatIsWorking ?? []} />
      </div>

      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold-dim mb-1.5">
          Revenue · Day 0→90
        </div>
        {forecast ? (
          <RevenueForecastChart forecast={forecast} height={140} />
        ) : (
          <div className="h-[140px] flex items-center justify-center font-mono text-[11px] text-muted-foreground italic border border-dashed border-gold/25 rounded-sm">
            Forecast pending.
          </div>
        )}
      </div>
    </section>
  );
}
