import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/types";

const TIER_STYLES: Record<Tier, string> = {
  S: "bg-gold-bright/20 text-gold-bright border-gold-bright/70 pulse-s-tier",
  A: "bg-gold/15 text-gold border-gold/60",
  B: "bg-bronze/20 text-bronze border-bronze/60",
  C: "bg-iron/30 text-foreground/70 border-iron/60",
  D: "bg-ash/40 text-muted-foreground border-ash/60",
};

export function TierBadge({
  tier,
  size = "md",
  className,
}: {
  tier: Tier;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass =
    size === "sm"
      ? "h-6 w-6 text-xs"
      : size === "lg"
      ? "h-12 w-12 text-2xl"
      : "h-8 w-8 text-base";
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-sm border font-display font-bold tracking-tight",
        sizeClass,
        TIER_STYLES[tier],
        className
      )}
    >
      {tier}
    </div>
  );
}
