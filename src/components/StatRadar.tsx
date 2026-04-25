import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { CharacterStat } from "@/lib/types";

export function StatRadar({ stats }: { stats: CharacterStat[] }) {
  const data = stats.map((s) => ({
    label: s.label.length > 14 ? s.label.slice(0, 13) + "…" : s.label,
    value: s.value,
    fullMark: 100,
  }));

  return (
    <div className="w-full aspect-square">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <defs>
            <radialGradient id="radarFill">
              <stop offset="0%" stopColor="var(--color-gold-bright)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0.15} />
            </radialGradient>
          </defs>
          <PolarGrid stroke="var(--color-gold)" strokeOpacity={0.25} />
          <PolarAngleAxis
            dataKey="label"
            tick={{
              fill: "var(--color-foreground)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{
              fill: "var(--color-muted-foreground)",
              fontSize: 9,
              fontFamily: "var(--font-mono)",
            }}
            stroke="var(--color-gold)"
            strokeOpacity={0.2}
          />
          <Radar
            dataKey="value"
            stroke="var(--color-gold-bright)"
            strokeWidth={1.5}
            fill="url(#radarFill)"
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
