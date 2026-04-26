import { useState } from "react";
import { Hammer, Loader2, Plus } from "lucide-react";
import type { CreativeBrief, GalleryItem, GeneratedCreative } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  briefs: CreativeBrief[];
  generations: GeneratedCreative[];
  gallery: GalleryItem[];
  generating: boolean;
  onGenerateFromBrief: (brief: CreativeBrief) => void;
  onComposeBrief: () => void;
}

export function GalleryColumn({
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

  const [reviewBrief, setReviewBrief] = useState<CreativeBrief | null>(null);

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
              href={g.imageUrl}
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
                href={g.imageUrl}
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

      {/* ───────── Saved briefs — open to review & forge ───────── */}
      {briefs.length > 0 && (
        <div className="border-t border-gold/15 pt-2 -mt-1">
          <div className="text-sm uppercase tracking-widest text-gold-dim mb-1">
            Saved briefs ({briefs.length}) — open to review
          </div>
          <div className="flex flex-wrap gap-1.5">
            {briefs.slice(0, 5).map((b) => (
              <button
                key={b.id}
                onClick={() => setReviewBrief(b)}
                className="px-2 py-1 border border-gold/30 rounded-sm bg-muted/15 hover:bg-gold/10 hover:border-gold/60 flex items-center gap-1.5 max-w-[180px]"
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

      <BriefReviewDialog
        brief={reviewBrief}
        generating={generating}
        onClose={() => setReviewBrief(null)}
        onForge={(b) => {
          onGenerateFromBrief(b);
          setReviewBrief(null);
        }}
      />
    </section>
  );
}

function BriefReviewDialog({
  brief,
  generating,
  onClose,
  onForge,
}: {
  brief: CreativeBrief | null;
  generating: boolean;
  onClose: () => void;
  onForge: (b: CreativeBrief) => void;
}) {
  return (
    <Dialog open={!!brief} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {brief && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">{brief.title}</DialogTitle>
              <DialogDescription>
                For {brief.targetGameName} · saved {new Date(brief.createdAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <Field label="Target hook" value={brief.targetHook} />
              <Field label="Mechanic" value={brief.mechanic} />
              <Field label="Visual cue" value={brief.visualCue} />
              <Field label="Pacing" value={brief.pacing} />
              <Field label="CTA" value={brief.cta} />
              {brief.notes && <Field label="Notes" value={brief.notes} multiline />}
              <Field label="Scenario prompt" value={brief.prompt} multiline mono />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border/50 mt-3">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-base uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
              <button
                onClick={() => onForge(brief)}
                disabled={generating}
                className="btn-copper px-4 py-1.5 text-base tracking-wider rounded-sm disabled:opacity-50 flex items-center gap-2"
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Hammer className="h-3.5 w-3.5" />
                )}
                Forge variant
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  multiline,
  mono,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <div className="text-base uppercase tracking-widest text-gold-dim mb-0.5">{label}</div>
      <div
        className={
          mono
            ? "font-mono text-sm text-foreground/90 leading-snug whitespace-pre-wrap"
            : multiline
              ? "text-base text-foreground/90 leading-snug whitespace-pre-wrap"
              : "text-base text-foreground/90 leading-snug"
        }
      >
        {value}
      </div>
    </div>
  );
}
