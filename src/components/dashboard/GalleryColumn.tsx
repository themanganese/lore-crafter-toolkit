import { useMemo, useState } from "react";
import { ChevronDown, Hammer, Image as ImageIcon, Loader2, Plus, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { saveCharacter } from "@/lib/store";
import { draftCreativeBrief } from "@/lib/server.functions";
import type {
  AdCreative,
  CreativeBrief,
  GalleryItem,
  GameCharacter,
  GeneratedCreative,
  TrendAnalysis,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { applySort, rankAds, rankingExplainerChips, type SortKey } from "@/lib/silki/rank-ads";
import { AdCard } from "./AdCard";
import { InspiredByTopAdsPanel } from "./InspiredByTopAds";
import { toast } from "sonner";

interface Props {
  character: GameCharacter;
  gameId: string;
  ads: AdCreative[];
  trend?: TrendAnalysis;
  briefs: CreativeBrief[];
  generations: GeneratedCreative[];
  gallery: GalleryItem[];
  generating: boolean;
  onGenerateFromBrief: (brief: CreativeBrief) => void;
  onBriefCreated?: (brief: CreativeBrief) => void;
}

function variantHref(gameId: string, variantId: string): string {
  return `/character/${gameId}/variant/${variantId}`;
}

export function GalleryColumn({
  character,
  gameId,
  ads,
  trend,
  briefs,
  generations,
  gallery,
  generating,
  onGenerateFromBrief,
  onBriefCreated,
}: Props) {
  const [sort, setSort] = useState<SortKey>("relevance");
  const [showAll, setShowAll] = useState(false);
  const [inspiredOpen, setInspiredOpen] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedBriefId, setSelectedBriefId] = useState<string | undefined>(briefs[0]?.id);

  // Keep the selected brief in sync when briefs are added/removed.
  const selectedBrief = briefs.find((b) => b.id === selectedBriefId) ?? briefs[0];

  const ranked = useMemo(
    () => rankAds({ ads, trend, targetGameName: character.name }),
    [ads, trend, character.name],
  );
  const sorted = useMemo(() => applySort(ranked, sort), [ranked, sort]);
  const visible = showAll ? sorted : sorted.slice(0, 5);
  const explainerChips = useMemo(() => rankingExplainerChips(trend), [trend]);

  const fallbackVariants =
    generations.length === 0 ? gallery.filter((g) => g.kind === "generated").slice(0, 8) : [];

  return (
    <section className="panel-grim p-5 flex flex-col gap-3 min-h-0 overflow-y-auto">
      {/* ───────── Zone A — Top creatives ───────── */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-[11px] uppercase tracking-[0.4em] text-gold-dim">
          Top Creatives ·{" "}
          <span className="text-foreground/85 normal-case tracking-normal font-display italic">
            ranked for {character.name}
          </span>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="bg-input border border-gold/30 rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground/85 focus:outline-none focus:border-gold/60"
          aria-label="Sort creatives"
        >
          <option value="relevance">Relevance</option>
          <option value="days">Days running</option>
          <option value="network">Network</option>
          <option value="format">Format</option>
        </select>
      </div>

      {/* "Why this ranking" chips */}
      {explainerChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-widest text-gold-dim self-center">
            Why this ranking
          </span>
          {explainerChips.map((chip, i) => (
            <span
              key={i}
              className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-gold/8 border border-gold/30 text-foreground/80 italic"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {sorted.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {visible.map((entry) => (
            <AdCard key={entry.ad.id} entry={entry} />
          ))}
          {sorted.length > 5 && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="self-start font-mono text-[10px] uppercase tracking-widest text-gold-dim hover:text-gold-bright"
            >
              {showAll ? `Show top 5` : `Show all (${sorted.length})`}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-4 border border-dashed border-gold/30 rounded-sm">
          <ImageIcon className="h-4 w-4 text-gold-dim" />
          <span className="font-mono text-[11px] text-muted-foreground italic">
            Awaiting Sensor Tower scrape…
          </span>
        </div>
      )}

      <div className="h-px bg-gold/30 my-1" />

      {/* ───────── Zone B — Inspired by top ads ───────── */}
      <CollapsibleSection
        title="Inspired by Top Ads"
        subtitle="briefs from comparable games"
        open={inspiredOpen}
        onToggle={() => setInspiredOpen((o) => !o)}
      >
        <InspiredByTopAdsPanel
          character={character}
          onForge={(brief) => {
            onBriefCreated?.(brief);
          }}
        />
      </CollapsibleSection>

      <div className="h-px bg-gold/30 my-1" />

      {/* ───────── Zone C — Manual brief ───────── */}
      <CollapsibleSection
        title="Manual Brief"
        subtitle="hand-craft from this character sheet"
        open={manualOpen}
        onToggle={() => setManualOpen((o) => !o)}
      >
        <ManualBriefForm character={character} onCreated={onBriefCreated} />
      </CollapsibleSection>

      <div className="h-px bg-gold/30 my-1" />

      {/* ───────── Zone D — Variants strip ───────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="font-display text-[11px] uppercase tracking-[0.4em] text-gold-dim">
          Variants ({generations.length || fallbackVariants.length})
        </div>
        <button
          onClick={() => {
            setInspiredOpen(true);
            // Scroll the gallery section into view-of-itself
            requestAnimationFrame(() => {
              const el = document.getElementById("gallery-zone-b");
              el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
          }}
          className="font-mono text-[10px] uppercase tracking-widest text-gold-dim hover:text-gold-bright flex items-center gap-1"
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
              <span className="font-mono text-[9px] uppercase tracking-widest text-gold-bright">
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
                <span className="font-mono text-[9px] uppercase tracking-widest text-gold-bright">
                  V{(fallbackVariants.length - i).toString().padStart(2, "0")}
                </span>
              </a>
            ))}
        </div>
      ) : (
        <p className="font-mono text-[11px] text-muted-foreground italic">
          No variants forged yet.
        </p>
      )}

      {/* The Anvil — saved briefs list + selected-brief detail card. */}
      {briefs.length > 0 && (
        <div className="border-t border-gold/30 pt-3 -mt-1 space-y-2">
          <div className="font-display text-[11px] uppercase tracking-[0.4em] text-gold-dim">
            The Anvil ·{" "}
            <span className="text-foreground/85 normal-case tracking-normal font-display italic">
              {briefs.length} brief{briefs.length === 1 ? "" : "s"} ready to forge
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {briefs.slice(0, 5).map((b) => {
              const active = selectedBrief?.id === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBriefId(b.id)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 border rounded-sm flex items-center gap-2 transition-colors",
                    active
                      ? "border-gold/60 bg-gold/10"
                      : "border-gold/25 bg-muted/15 hover:border-gold/45 hover:bg-gold/5",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-[9px] uppercase tracking-widest shrink-0",
                      active ? "text-gold-bright" : "text-gold-dim",
                    )}
                  >
                    {active ? "▸" : " "}
                  </span>
                  <span className="font-display text-[13px] text-foreground truncate flex-1">
                    {b.title}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground shrink-0">
                    {b.cta || "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedBrief && (
            <BriefDetailCard
              brief={selectedBrief}
              generating={generating}
              onGenerate={() => onGenerateFromBrief(selectedBrief)}
            />
          )}
        </div>
      )}
    </section>
  );
}

// ───────── Selected brief detail card ─────────
function BriefDetailCard({
  brief,
  generating,
  onGenerate,
}: {
  brief: CreativeBrief;
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="border border-gold/40 rounded-sm bg-card p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-widest text-gold-dim">Brief</div>
          <h4 className="font-display text-base text-foreground leading-tight mt-0.5">
            {brief.title}
          </h4>
          <div className="font-mono text-[10px] text-muted-foreground italic mt-0.5">
            For {brief.targetGameName}
          </div>
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="btn-copper px-3 py-1.5 font-display tracking-wider text-[12px] rounded-sm flex items-center gap-1.5 shrink-0 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Hammer className="h-3.5 w-3.5" />
          )}
          {generating ? "Forging…" : "Generate variant"}
        </button>
      </div>

      <BriefField label="Hook" value={brief.targetHook} />
      <BriefField label="Narrative arc" value={brief.mechanic || brief.notes || "—"} />
      <BriefField label="Visual direction" value={brief.visualCue} />
      <BriefField label="Pacing" value={brief.pacing} />

      <div>
        <div className="font-mono text-[9px] uppercase tracking-widest text-gold-dim mb-1">
          Format target
        </div>
        <div className="flex gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border border-gold/40 text-gold">
            Static · 1080×1080
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm border border-gold/40 text-gold">
            Story · 1080×1920
          </span>
        </div>
      </div>

      <div>
        <div className="font-mono text-[9px] uppercase tracking-widest text-gold-dim mb-1">
          Scenario prompt
        </div>
        <pre className="font-mono text-[11px] text-foreground/85 leading-snug whitespace-pre-wrap bg-muted/30 border border-border rounded-sm p-2 max-h-32 overflow-y-auto">
          {brief.prompt}
        </pre>
      </div>
    </div>
  );
}

function BriefField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-gold-dim">{label}</div>
      <p className="font-body text-[12px] text-foreground/85 leading-snug mt-0.5">{value}</p>
    </div>
  );
}

// ───────── Collapsible section wrapper ─────────
function CollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div id={title === "Inspired by Top Ads" ? "gallery-zone-b" : undefined}>
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-2 group">
        <div className="text-left">
          <span className="font-display text-[11px] uppercase tracking-[0.4em] text-gold-dim group-hover:text-gold-bright">
            {title}
          </span>
          {subtitle && (
            <span className="font-mono text-[10px] text-muted-foreground italic ml-2">
              · {subtitle}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-gold-dim transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ───────── Manual brief mini-form ─────────
function ManualBriefForm({
  character,
  onCreated,
}: {
  character: GameCharacter;
  onCreated?: (brief: CreativeBrief) => void;
}) {
  const draft = useServerFn(draftCreativeBrief);
  const [hook, setHook] = useState("");
  const [visual, setVisual] = useState("");
  const [forging, setForging] = useState(false);

  async function forge() {
    if (!hook.trim() || !visual.trim()) {
      toast.error("Hook and visual direction are required");
      return;
    }
    setForging(true);
    try {
      // Use the existing draft fn to flesh the brief out from manual seeds,
      // then persist via saveCharacter (same path BriefBuilderPanel uses).
      const r = await draft({
        data: {
          character: {
            name: character.name,
            vertical: character.vertical,
            stats: character.stats,
            topHooks: character.topHooks,
            codex: character.codex,
          },
          targetGameName: character.name,
        },
      });

      // Whether or not the draft succeeded, we honour the user's manual seeds —
      // the AI draft is a scaffold; manual hook/visual win.
      const base =
        r.ok && r.brief
          ? r.brief
          : {
              title: hook.slice(0, 60),
              targetHook: hook,
              mechanic: "",
              visualCue: visual,
              pacing: "",
              cta: "",
              notes: "",
              prompt: `${hook}\n\nVisual direction: ${visual}`,
              targetGameName: character.name,
            };

      const brief: CreativeBrief = {
        id: crypto.randomUUID(),
        title: hook.slice(0, 60) || base.title || "Manual brief",
        targetGameName: character.name,
        targetHook: hook,
        mechanic: base.mechanic ?? "",
        visualCue: visual,
        pacing: base.pacing ?? "",
        cta: base.cta ?? "",
        notes: base.notes ?? "",
        prompt: base.prompt
          ? `${hook}\n\nVisual direction: ${visual}\n\n${base.prompt}`
          : `${hook}\n\nVisual direction: ${visual}`,
        createdAt: new Date().toISOString(),
      };
      await saveCharacter({
        ...character,
        briefs: [brief, ...character.briefs],
      });
      onCreated?.(brief);
      setHook("");
      setVisual("");
      toast.success("Brief forged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Forge failed");
    } finally {
      setForging(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="font-mono text-[9px] uppercase tracking-widest text-gold-dim">
          Hook concept
        </span>
        <textarea
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          rows={2}
          placeholder="e.g. 3v3 squad rallies for the comeback win"
          className="mt-1 w-full bg-input border border-border rounded-sm px-2 py-1.5 text-[12px] text-foreground font-body focus:outline-none focus:border-gold/60 resize-none"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[9px] uppercase tracking-widest text-gold-dim">
          Visual direction
        </span>
        <textarea
          value={visual}
          onChange={(e) => setVisual(e.target.value)}
          rows={2}
          placeholder="e.g. cinematic close-ups, gold/teal palette, fast cuts"
          className="mt-1 w-full bg-input border border-border rounded-sm px-2 py-1.5 text-[12px] text-foreground font-body focus:outline-none focus:border-gold/60 resize-none"
        />
      </label>
      <button
        onClick={forge}
        disabled={forging || !hook.trim() || !visual.trim()}
        className="w-full btn-copper px-3 py-1.5 font-display tracking-wider text-[12px] rounded-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {forging ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {forging ? "Forging…" : "Forge brief"}
      </button>
    </div>
  );
}
