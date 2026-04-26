import { Hammer, Loader2, Plus } from "lucide-react";
import type { CreativeBrief, GalleryItem, GeneratedCreative } from "@/lib/types";

interface Props {
  gameId: string;
  briefs: CreativeBrief[];
  generations: GeneratedCreative[];
  gallery: GalleryItem[];
  generating: boolean;
  onGenerateFromBrief: (brief: CreativeBrief) => void;
  onComposeBrief: () => void;
}

function variantHref(gameId: string, variantId: string): string {
  return `/character/${gameId}/variant/${variantId}`;
}

export function GalleryColumn({
  gameId,
  briefs,
  generations,
  gallery,
  generating,
  onGenerateFromBrief,
  onComposeBrief,
}: Props) {
  const fallbackVariants =
    generations.length === 0
      ? gallery.filter((g) => g.kind === "generated").slice(0, 8)
      : [];

  return (
    <section className="panel-grim p-5 flex flex-col gap-3 min-h-0 overflow-y-auto">
      {/* ───────── Variants strip ───────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="font-display text-sm uppercase tracking-[0.4em] text-gold-dim">
          Variants ({generations.length || fallbackVariants.length})
        </div>
        <button
          onClick={onComposeBrief}
          className="text-sm uppercase tracking-widest text-gold-dim hover:text-gold-bright flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Compose
        </button>
      </div>
      {generations.length > 0 || fallbackVariants.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {generations.map((g, i) => (
            <a
              key={g.id}
              href={variantHref(gameId, g.id)}
              target="_blank"
              rel="noreferrer"
              className="group shrink-0 w-16 flex flex-col items-center gap-1"
              title={briefs.find((b) => b.id === g.briefId)?.title ?? g.prompt}
            >
              <div className="h-16 w-16 rounded-sm overflow-hidden bg-muted border border-gold/25 group-hover:border-gold/60">
                <img src={g.imageUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <span className="text-sm uppercase tracking-widest text-gold-bright">
                V{(generations.length - i).toString().padStart(2, "0")}
              </span>
            </a>
          ))}
          {generations.length === 0 &&
            fallbackVariants.map((g, i) => (
              <a
                key={g.id}
                href={variantHref(gameId, g.generationId ?? g.id)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 w-16 flex flex-col items-center gap-1"
              >
                <div className="h-16 w-16 rounded-sm overflow-hidden bg-muted border border-gold/25 hover:border-gold/60">
                  <img src={g.imageUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <span className="text-sm uppercase tracking-widest text-gold-bright">
                  V{(fallbackVariants.length - i).toString().padStart(2, "0")}
                </span>
              </a>
            ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No variants forged yet.
        </p>
      )}

      {/* ───────── Saved briefs — forge into variant ───────── */}
      {briefs.length > 0 && (
        <div className="border-t border-gold/15 pt-2 -mt-1">
          <div className="text-sm uppercase tracking-widest text-gold-dim mb-1">
            Saved briefs ({briefs.length}) — forge into variant
          </div>
          <div className="flex flex-wrap gap-1.5">
            {briefs.slice(0, 5).map((b) => (
              <button
                key={b.id}
                onClick={() => onGenerateFromBrief(b)}
                disabled={generating}
                className="px-2 py-1 border border-gold/30 rounded-sm bg-muted/15 hover:bg-gold/10 hover:border-gold/60 disabled:opacity-50 flex items-center gap-1.5 max-w-[180px]"
              >
                {generating ? (
                  <Loader2 className="h-3 w-3 animate-spin text-gold-bright shrink-0" />
                ) : (
                  <Hammer className="h-3 w-3 text-gold-bright shrink-0" />
                )}
                <span className="font-display text-sm text-foreground truncate">{b.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
