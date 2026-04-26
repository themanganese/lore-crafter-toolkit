import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { CharacterStat } from "@/lib/types";

// Single radar — used by the Trends column. Wrapping in a sized container
// avoids the recharts width(-1)/height(-1) warning that fires when the parent
// has zero dimensions on first paint.
export function StatRadar({ stats }: { stats: CharacterStat[] }) {
  const data = stats.map((s) => ({
    label: s.label.length > 14 ? s.label.slice(0, 13) + "…" : s.label,
    value: s.value,
    fullMark: 100,
  }));

  return (
    <div className="w-full" style={{ minHeight: 240 }}>
      <ResponsiveContainer width="100%" aspect={1.2} minHeight={240}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--color-gold)" strokeOpacity={0.2} strokeDasharray="2 3" />
          <PolarAngleAxis
            dataKey="label"
            tick={{
              fill: "var(--color-foreground)",
              fontSize: 16,
              fontFamily: "var(--font-body)",
            }}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="value"
            stroke="var(--color-gold-bright)"
            strokeWidth={1.5}
            strokeOpacity={0.6}
            fill="var(--color-gold)"
            fillOpacity={0.15}
            isAnimationActive
            animationDuration={800}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
