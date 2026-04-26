import type { CharacterStat } from "@/lib/types";
import { TierBadge } from "./TierBadge";
import { cn } from "@/lib/utils";

export function StatRow({ stat }: { stat: CharacterStat }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <TierBadge tier={stat.tier} size="sm" />
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-2xl text-foreground truncate">{stat.label}</span>
          <span className="text-base text-gold tabular-nums">
            {stat.value.toString().padStart(3, "0")}
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full bg-muted overflow-hidden rounded-sm">
          <div
            className={cn(
              "h-full transition-all",
              stat.tier === "S"
                ? "bg-gold-bright"
                : stat.tier === "A"
                ? "bg-gold"
                : stat.tier === "B"
                ? "bg-bronze"
                : stat.tier === "C"
                ? "bg-iron"
                : "bg-ash"
            )}
            style={{ width: `${stat.value}%` }}
          />
        </div>
        <p className="mt-1.5 text-base text-muted-foreground italic leading-snug">
          {stat.lore}
        </p>
      </div>
    </div>
  );
}
