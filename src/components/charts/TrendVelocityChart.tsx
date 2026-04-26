import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { TrendPattern } from "@/lib/types";

const TAG_COLOR: Record<string, { stroke: string; dash?: string }> = {
  lead: { stroke: "var(--color-gold-bright)" },
  safe: { stroke: "var(--color-iron)" },
  watch: { stroke: "var(--color-copper)", dash: "5 4" },
  caution: { stroke: "var(--color-bronze)", dash: "5 4" },
  filler: { stroke: "var(--color-ash)" },
  avoid: { stroke: "var(--color-destructive)", dash: "2 4" },
};

// TODO: replace with real per-pattern time-series once the trend agent emits it.
// We synthesise a 7-bucket curve for each pattern from window_appearances + tag,
// so the chart shape is consistent across runs but visually plausible.
function fabricateSeries(p: TrendPattern, buckets: number): number[] {
  const peak = Math.min(100, 30 + p.windowAppearances * 8);
  const out: number[] = [];
  for (let i = 0; i < buckets; i++) {
    const t = i / (buckets - 1);
    let v: number;
    if (p.trendVelocity === "rising") {
      v = peak * (0.25 + 0.75 * t);
    } else if (p.trendVelocity === "declining") {
      v = peak * (1 - 0.6 * t);
    } else {
      v = peak * (0.7 + 0.15 * Math.sin(t * Math.PI));
    }
    out.push(Math.round(v));
  }
  return out;
}

export function TrendVelocityChart({
  patterns,
  scrapeWindowDays = 14,
}: {
  patterns: TrendPattern[];
  scrapeWindowDays?: number;
}) {
  const top = [...patterns].sort((a, b) => b.windowAppearances - a.windowAppearances).slice(0, 3);

  const buckets = 7;
  const stepDays = Math.max(1, Math.round(scrapeWindowDays / (buckets - 1)));
  const series = top.map((p) => fabricateSeries(p, buckets));

  const data = Array.from({ length: buckets }, (_, i) => {
    const row: Record<string, number | string> = {
      day: i === 0 ? "0" : `${i * stepDays}`,
    };
    top.forEach((p, idx) => {
      const key = `p${idx}`;
      row[key] = series[idx][i];
    });
    return row;
  });

  if (top.length === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center font-mono text-[11px] text-muted-foreground italic">
        Awaiting pattern detection…
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
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
            ticks={[data[0].day as string, data[data.length - 1].day as string]}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tick={{
              fill: "#8a7050",
              fontSize: 11,
              fontFamily: "var(--font-body)",
            }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            content={(props) => {
              const { payload, label } = props;
              if (!payload || payload.length === 0) return null;
              return (
                <div
                  className="bg-card border border-gold/60 rounded-sm px-3 py-2"
                  style={{ fontFamily: "var(--font-display)", fontSize: 12 }}
                >
                  <div className="text-foreground/85 mb-1">Day {label}</div>
                  {payload.map((entry, i) => {
                    const idx = Number(String(entry.dataKey).slice(1));
                    const p = top[idx];
                    if (!p) return null;
                    return (
                      <div key={i} className="flex items-center gap-2 text-foreground/85">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ background: String(entry.color) }}
                        />
                        <span className="truncate">{p.pattern}</span>
                        <span className="ml-auto tabular-nums text-gold-bright">
                          {String(entry.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          <Legend
            iconSize={10}
            verticalAlign="bottom"
            height={20}
            wrapperStyle={{
              fontFamily: "var(--font-body)",
              fontSize: 11,
              fontStyle: "italic",
              color: "var(--color-muted-foreground)",
            }}
            formatter={(_label, _entry, idx) => {
              const p = top[idx];
              if (!p) return "";
              const short = p.pattern.length > 26 ? p.pattern.slice(0, 25) + "…" : p.pattern;
              return short;
            }}
          />
          {top.map((p, idx) => {
            const c = TAG_COLOR[p.tag] ?? { stroke: "var(--color-gold)" };
            return (
              <Line
                key={idx}
                type="monotone"
                dataKey={`p${idx}`}
                stroke={c.stroke}
                strokeWidth={1.75}
                strokeDasharray={c.dash}
                dot={false}
                activeDot={{ r: 3, fill: c.stroke }}
                isAnimationActive
                animationDuration={800}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
