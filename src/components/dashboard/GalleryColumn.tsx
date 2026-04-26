import { Hammer, Image as ImageIcon, Loader2, Plus, Sparkles } from "lucide-react";
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

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
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
  // Generations are the canonical "variant" objects; gallery may also contain
  // uploaded refs, but for this column we surface generations.
  const variants = generations.slice(0, 3);

  // Fall back to generated gallery items if generations array is empty
  // (e.g. legacy character data).
  const fallback =
    variants.length === 0 ? gallery.filter((g) => g.kind === "generated").slice(0, 3) : [];

  return (
    <section className="panel-grim p-6 flex flex-col gap-5 min-h-0 overflow-y-auto">
      <div className="font-display text-[11px] uppercase tracking-[0.4em] text-gold-dim">
        Gallery · variants & briefs
      </div>

      {/* Variant thumbnails */}
      <div className="space-y-3">
        {variants.length > 0 &&
          variants.map((g, i) => {
            const version = `V${(generations.length - i).toString().padStart(2, "0")}`;
            const brief = briefs.find((b) => b.id === g.briefId);
            return (
              <a
                key={g.id}
                href={variantHref(gameId, g.id)}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 p-2 border border-gold/30 rounded-sm hover:border-gold/60 hover:bg-gold/5 transition-colors"
              >
                <div className="h-16 w-16 rounded-sm overflow-hidden bg-muted shrink-0 border border-border">
                  <img
                    src={g.imageUrl}
                    alt=""
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-gold-bright">
                      {version}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {relativeTime(g.createdAt)}
                    </span>
                  </div>
                  <div className="font-display text-sm text-foreground truncate mt-0.5">
                    {brief?.title ?? "Untitled brief"}
                  </div>
                </div>
              </a>
            );
          })}

        {variants.length === 0 &&
          fallback.map((g) => (
            <a
              key={g.id}
              href={variantHref(gameId, g.generationId ?? g.id)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-2 border border-gold/30 rounded-sm hover:border-gold/60 hover:bg-gold/5"
            >
              <div className="h-16 w-16 rounded-sm overflow-hidden bg-muted shrink-0 border border-border">
                <img src={g.imageUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[9px] uppercase tracking-widest text-gold-bright">
                  V01
                </div>
                <div className="font-display text-sm text-foreground truncate mt-0.5">
                  {relativeTime(g.createdAt)}
                </div>
              </div>
            </a>
          ))}

        {variants.length === 0 && fallback.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-4 border border-dashed border-gold/30 rounded-sm">
            <ImageIcon className="h-4 w-4 text-gold-dim" />
            <span className="font-mono text-[11px] text-muted-foreground italic">
              No variants forged yet.
            </span>
          </div>
        )}
      </div>

      {/* Briefs list */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold-dim mb-1.5">
          Briefs ({briefs.length})
        </div>
        {briefs.length > 0 ? (
          <ul className="space-y-1.5">
            {briefs.slice(0, 4).map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-2 p-2 border border-border rounded-sm bg-muted/15"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-display text-sm text-foreground truncate">{b.title}</div>
                  <div className="font-mono text-[9px] text-muted-foreground truncate">
                    {b.targetHook || b.targetGameName}
                  </div>
                </div>
                <button
                  onClick={() => onGenerateFromBrief(b)}
                  disabled={generating}
                  className="btn-copper px-2 py-1 font-mono text-[9px] uppercase tracking-widest rounded-sm flex items-center gap-1 shrink-0 disabled:opacity-60"
                >
                  {generating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Forge
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground italic">
            No briefs yet — compose one below.
          </p>
        )}
      </div>

      <div className="mt-auto pt-2">
        <button
          onClick={onComposeBrief}
          className="w-full gold-frame px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-gold-bright hover:bg-gold/10 flex items-center justify-center gap-1.5"
        >
          <Plus className="h-3 w-3" />
          Compose new brief
        </button>
      </div>

      {/* Hidden anchor for visual taxonomy — referenced from forge view */}
      <span className="hidden">
        <Hammer />
      </span>
    </section>
  );
}
