import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RankedAd } from "@/lib/silki/rank-ads";
import { deriveMapsTo } from "@/lib/silki/rank-ads";

interface Props {
  entry: RankedAd;
}

const FORMAT_STYLES: Record<RankedAd["format"], string> = {
  VIDEO: "bg-gold/10 text-gold border-gold/40",
  PLAYABLE: "bg-copper/15 text-copper border-copper/50",
  IMAGE: "bg-iron/25 text-foreground/65 border-iron/40",
  STORY: "bg-bronze/15 text-bronze border-bronze/50",
};

function placeholderFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const seed = Math.abs(h) % 1000;
  return `https://picsum.photos/seed/forge-ad-${seed}/128/128`;
}

export function AdCard({ entry }: Props) {
  const { ad, rank, reasons, matchedPatterns, format } = entry;
  const thumb = ad.thumbnailUrl || placeholderFor(ad.id);
  const days = ad.durationDays;
  const hookSubtitle = matchedPatterns[0]
    ? `hook: ${matchedPatterns[0].pattern.toLowerCase()}`
    : ad.network
      ? `network: ${ad.network.toLowerCase()}`
      : "—";
  const mapsTo = deriveMapsTo(matchedPatterns);

  return (
    <article
      tabIndex={0}
      className="group relative grid grid-cols-[36px_56px_1fr_auto] items-center gap-3 px-2 py-2 border border-gold/25 rounded-sm bg-card hover:border-gold/55 hover:bg-gold/5 focus-within:border-gold/55 focus-within:bg-gold/5 transition-colors outline-none"
    >
      {/* Rank */}
      <div
        className="font-display text-[26px] tabular-nums text-right leading-none"
        style={{ color: "#b08a4a" }}
      >
        {rank.toString().padStart(2, "0")}
      </div>

      {/* Thumbnail */}
      <div className="h-14 w-14 rounded-sm overflow-hidden bg-muted shrink-0 border border-border">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.src = placeholderFor(ad.id);
            }}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Hook + subtitle */}
      <div className="min-w-0">
        <div className="font-display text-sm text-foreground truncate">{ad.hookLabel}</div>
        <div className="font-body italic text-[11px] text-muted-foreground truncate">
          {hookSubtitle}
        </div>
      </div>

      {/* Chips */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border border-gold/40 text-gold">
          {ad.network}
        </span>
        {days !== undefined && (
          <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-muted/40 text-foreground/70 border border-border">
            {days}d
          </span>
        )}
        <span
          className={cn(
            "font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border",
            FORMAT_STYLES[format],
          )}
        >
          {format}
        </span>
      </div>

      {/* Hover-expanded reasoning */}
      <div className="col-span-4 grid grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr] transition-[grid-template-rows] duration-200">
        <div className="overflow-hidden">
          <div className="pt-2 mt-1 border-t border-gold/15 space-y-1">
            <p className="font-body text-[12px] text-foreground/85 leading-snug">{ad.hookLabel}</p>
            <p className="font-mono text-[10px] text-muted-foreground italic leading-snug">
              Ranks #{rank.toString().padStart(2, "0")} — {reasons[0]}
              {reasons[1] ? `. ${reasons[1]}` : ""}.
            </p>
            {mapsTo && (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-widest text-gold-dim">
                  Maps to
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-gold-bright/15 text-gold-bright border border-gold-bright/40">
                  {mapsTo}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
