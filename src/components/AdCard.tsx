import type { AdCreative } from "@/lib/types";
import { TierBadge } from "./TierBadge";
import { ImageOff } from "lucide-react";

export function AdCard({ ad }: { ad: AdCreative }) {
  return (
    <div className="panel-grim rounded-sm overflow-hidden group">
      <div className="aspect-square bg-muted/40 relative flex items-center justify-center overflow-hidden">
        {ad.thumbnailUrl ? (
          <img
            src={ad.thumbnailUrl}
            alt={ad.hookLabel}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <ImageOff className="h-8 w-8 text-muted-foreground" />
        )}
        <div className="absolute top-2 left-2">
          <TierBadge tier={ad.tier} size="sm" />
        </div>
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-background/80 backdrop-blur font-mono text-[10px] uppercase tracking-wider text-muted-foreground border border-border">
          {ad.network}
        </div>
      </div>
      <div className="p-3">
        <p className="font-display text-sm text-foreground line-clamp-2 leading-snug">
          {ad.hookLabel}
        </p>
        {ad.estImpressions ? (
          <p className="mt-1 font-mono text-[10px] text-gold-dim tabular-nums">
            ~{Intl.NumberFormat("en", { notation: "compact" }).format(ad.estImpressions)} imp
            {ad.durationDays ? ` · ${ad.durationDays}d` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
