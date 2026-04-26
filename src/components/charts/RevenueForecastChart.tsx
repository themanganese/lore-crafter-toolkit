import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RevenueForecast } from "@/lib/types";

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

// Rough scaling band for the modelled line — wider when confidence drops.
function bandWidth(c: "high" | "medium" | "low"): number {
  if (c === "high") return 0.05;
  if (c === "medium") return 0.12;
  return 0.22;
}

export function RevenueForecastChart({
  forecast,
  height = 160,
}: {
  forecast: RevenueForecast;
  height?: number;
}) {
  const baseline = forecast.baselineMonthlyUsd;
  // Day 0 is anchored at the modelled day_30 / 30 ≈ daily run-rate proxy of baseline.
  // Recharts plots a piecewise linear; we provide 4 control points.
  const data = [
    {
      day: 0,
      modelled: baseline,
      baseline,
      lo: baseline * (1 - bandWidth(forecast.day30.confidence) * 0.4),
      hi: baseline * (1 + bandWidth(forecast.day30.confidence) * 0.4),
      assumptions: [] as string[],
    },
    {
      day: 30,
      modelled: forecast.day30.revenueUsd,
      baseline,
      lo: forecast.day30.revenueUsd * (1 - bandWidth(forecast.day30.confidence)),
      hi: forecast.day30.revenueUsd * (1 + bandWidth(forecast.day30.confidence)),
      assumptions: forecast.appliedAssumptions.slice(0, 3).map((a) => a.id),
    },
    {
      day: 60,
      modelled: forecast.day60.revenueUsd,
      baseline,
      lo: forecast.day60.revenueUsd * (1 - bandWidth(forecast.day60.confidence)),
      hi: forecast.day60.revenueUsd * (1 + bandWidth(forecast.day60.confidence)),
      assumptions: forecast.appliedAssumptions.slice(0, 4).map((a) => a.id),
    },
    {
      day: 90,
      modelled: forecast.day90.revenueUsd,
      baseline,
      lo: forecast.day90.revenueUsd * (1 - bandWidth(forecast.day90.confidence)),
      hi: forecast.day90.revenueUsd * (1 + bandWidth(forecast.day90.confidence)),
      assumptions: forecast.appliedAssumptions.map((a) => a.id),
    },
  ];

  const maxY = Math.max(...data.map((d) => d.hi), baseline) * 1.05;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          {/* Solid 10%-opacity gold band per spec — no gradient. */}
          <CartesianGrid
            stroke="var(--color-gold)"
            strokeOpacity={0.2}
            strokeDasharray="2 4"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tick={{
              fill: "#8a7050",
              fontSize: 11,
              fontFamily: "var(--font-body)",
            }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
            ticks={[0, 30, 60, 90]}
            tickFormatter={(d) => (d === 0 ? "Day 0" : `${d}d`)}
          />
          <YAxis
            domain={[0, maxY]}
            tick={{
              fill: "#8a7050",
              fontSize: 11,
              fontFamily: "var(--font-body)",
            }}
            tickFormatter={formatUsd}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            content={(props) => {
              const { payload, label } = props;
              if (!payload || payload.length === 0) return null;
              const row = payload[0]?.payload as (typeof data)[number] | undefined;
              if (!row) return null;
              return (
                <div
                  className="bg-card border border-gold/60 rounded-sm px-3 py-2"
                  style={{ fontFamily: "var(--font-display)", fontSize: 12 }}
                >
                  <div className="text-foreground/85 mb-1">
                    {label === 0 ? "Day 0 (baseline)" : `Day ${label}`}
                  </div>
                  <div className="text-gold-bright">Modelled · {formatUsd(row.modelled)}</div>
                  <div className="text-foreground/60">Baseline · {formatUsd(row.baseline)}</div>
                  {row.assumptions.length > 0 && (
                    <div
                      className="mt-1 text-muted-foreground"
                      style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}
                    >
                      Assumptions · {row.assumptions.join(" · ")}
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="hi"
            stroke="none"
            fill="#b08a4a"
            fillOpacity={0.1}
            isAnimationActive
            animationDuration={800}
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="lo"
            stroke="none"
            fill="var(--color-background)"
            isAnimationActive
            animationDuration={800}
            activeDot={false}
          />
          <Line
            type="monotone"
            dataKey="baseline"
            name="Baseline Monthly"
            stroke="var(--color-iron)"
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="modelled"
            name="Modelled"
            stroke="#b08a4a"
            strokeWidth={2}
            dot={{
              r: 3,
              fill: "var(--color-gold-bright)",
              stroke: "#b08a4a",
              strokeWidth: 1,
            }}
            activeDot={{ r: 4, fill: "var(--color-gold-bright)" }}
            isAnimationActive
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
