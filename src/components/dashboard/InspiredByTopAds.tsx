import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Lightbulb,
  Sparkles,
  Plus,
  X,
  RefreshCw,
  ChevronDown,
  Hammer,
} from "lucide-react";
import {
  suggestComparableGames,
  generateInspiredBriefsFn,
  searchGames,
  type ComparableGame,
  type InspiredBrief,
} from "@/lib/server.functions";
import { saveCharacter } from "@/lib/store";
import type { GameCharacter, CreativeBrief } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function InspiredByTopAdsPanel({
  character,
  onForge,
}: {
  character: GameCharacter;
  onForge: (brief: CreativeBrief) => void;
}) {
  const suggest = useServerFn(suggestComparableGames);
  const generate = useServerFn(generateInspiredBriefsFn);
  const search = useServerFn(searchGames);

  const [comparables, setComparables] = useState<ComparableGame[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [briefs, setBriefs] = useState<InspiredBrief[]>([]);
  const [comparablesUsed, setComparablesUsed] = useState<{ name: string; adsCount: number }[]>([]);
  const [failures, setFailures] = useState<{ name: string; error: string }[]>([]);

  // Manual override
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<ComparableGame[]>([]);
  const [searching, setSearching] = useState(false);

  // First-load: auto-suggest from vertical
  useEffect(() => {
    if (!character.externalId || comparables.length > 0) return;
    void runSuggest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);

  async function runSuggest() {
    if (!character.externalId) return;
    setLoadingSuggest(true);
    try {
      const r = await suggest({
        data: {
          targetExternalId: character.externalId,
          targetName: character.name,
          vertical: character.vertical,
          limit: 3,
        },
      });
      if (!r.ok) {
        toast.error(r.error ?? "Could not suggest comparables");
        return;
      }
      setComparables(r.comparables);
      if (r.comparables.length === 0) {
        toast.info("No comparables found — search & pin one manually.");
      }
    } finally {
      setLoadingSuggest(false);
    }
  }

  async function runSearch() {
    const q = searchQ.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const r = await search({ data: { query: q } });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      // Map search results → ComparableGame shape
      const mapped: ComparableGame[] = r.results.map((g) => ({
        externalId: g.externalId,
        platform: g.platform,
        name: g.name,
        publisher: g.publisher,
        iconUrl: g.iconUrl,
        vertical: g.vertical,
      }));
      setSearchResults(mapped);
    } finally {
      setSearching(false);
    }
  }

  function pinComparable(g: ComparableGame) {
    if (comparables.find((c) => c.externalId === g.externalId)) return;
    if (g.externalId === character.externalId) {
      toast.info("That's the target game.");
      return;
    }
    if (comparables.length >= 5) {
      toast.info("Max 5 comparables.");
      return;
    }
    setComparables([...comparables, g]);
    setSearchOpen(false);
    setSearchQ("");
    setSearchResults([]);
  }

  function removeComparable(externalId: string) {
    setComparables(comparables.filter((c) => c.externalId !== externalId));
  }

  async function runGenerate() {
    if (comparables.length === 0) {
      toast.error("Pin at least one comparable first.");
      return;
    }
    setGenerating(true);
    setBriefs([]);
    setFailures([]);
    try {
      const r = await generate({
        data: {
          targetGameName: character.name,
          vertical: character.vertical,
          comparables,
          briefsCount: 4,
        },
      });
      if (!r.ok) {
        toast.error(r.error ?? "Inspired brief generation failed");
        return;
      }
      setBriefs(r.briefs);
      setComparablesUsed(r.comparablesUsed);
      setFailures(r.failures);
      if (r.briefs.length === 0) {
        toast.error("No briefs returned — try different comparables.");
      } else {
        toast.success(`${r.briefs.length} inspired briefs ready`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function saveAndForge(b: InspiredBrief) {
    const brief: CreativeBrief = {
      id: b.id,
      title: b.title,
      targetGameName: character.name,
      targetHook: b.targetHook,
      mechanic: b.mechanic,
      visualCue: b.visualCue,
      pacing: b.pacing,
      cta: b.cta,
      notes: `Inspired by ${b.sourceGame} — "${b.sourceHook}"\n\n${b.notes}`,
      prompt: b.prompt,
      createdAt: new Date().toISOString(),
    };
    await saveCharacter({ ...character, briefs: [brief, ...character.briefs] });
    onForge(brief);
    toast.success(`Saved · sent to Anvil`);
  }

  return (
    <div className="space-y-5">
      {/* Header / explainer */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-mono text-xs text-muted-foreground max-w-xl leading-relaxed">
            Pull top-performing ads from comparable games in <span className="text-gold">{character.vertical || "this vertical"}</span> and let Claude derive ready-to-ship briefs. Your target game's existing brief is intentionally ignored — the competitor ads ARE the brief.
          </p>
        </div>
        <button
          onClick={runSuggest}
          disabled={loadingSuggest}
          className="gold-frame px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center gap-1.5 shrink-0"
        >
          {loadingSuggest ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Re-suggest
        </button>
      </div>

      {/* Comparables list */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim mb-2">
          Comparable games ({comparables.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {comparables.map((c) => (
            <ComparableChip key={c.externalId} game={c} onRemove={() => removeComparable(c.externalId)} />
          ))}
          <button
            onClick={() => setSearchOpen((o) => !o)}
            className="border border-dashed border-gold/40 rounded-sm px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-gold-dim hover:text-gold-bright hover:border-gold/80 flex items-center gap-1.5"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
      </div>

      {/* Manual search */}
      {searchOpen && (
        <div className="border border-border rounded-sm p-3 bg-muted/15 space-y-2">
          <div className="flex gap-2">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search SensorTower for a comparable game…"
              className="flex-1 bg-input border border-border rounded-sm px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-gold/60"
            />
            <button
              onClick={runSearch}
              disabled={searching || searchQ.trim().length < 2}
              className="gold-frame px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-gold-bright hover:bg-gold/10 disabled:opacity-40"
            >
              {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Search"}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
              {searchResults.map((r) => (
                <button
                  key={r.externalId}
                  onClick={() => pinComparable(r)}
                  className="text-left p-2 border border-border/60 rounded-sm hover:bg-gold/5 hover:border-gold/40 flex items-center gap-2"
                >
                  {r.iconUrl ? (
                    <img src={r.iconUrl} alt="" className="h-7 w-7 rounded-sm border border-border" />
                  ) : (
                    <div className="h-7 w-7 rounded-sm bg-muted/50" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-xs text-foreground truncate">{r.name}</div>
                    <div className="font-mono text-[9px] text-muted-foreground truncate">
                      {r.publisher ?? r.platform}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generate CTA */}
      <button
        onClick={runGenerate}
        disabled={generating || comparables.length === 0}
        className="w-full btn-copper px-4 py-3 font-display tracking-wider rounded-sm disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
        {generating ? "Reading competitor ads…" : `Generate inspired briefs from ${comparables.length} comparable${comparables.length === 1 ? "" : "s"}`}
      </button>

      {/* Status — used / failed */}
      {(comparablesUsed.length > 0 || failures.length > 0) && (
        <div className="flex flex-wrap gap-2 text-[10px] font-mono">
          {comparablesUsed.map((c) => (
            <span key={c.name} className="px-2 py-0.5 bg-gold/10 text-gold border border-gold/30 rounded-sm">
              {c.name} · {c.adsCount} ads
            </span>
          ))}
          {failures.map((f, i) => (
            <span key={i} className="px-2 py-0.5 bg-destructive/10 text-destructive border border-destructive/30 rounded-sm">
              {f.name}: {f.error.slice(0, 40)}
            </span>
          ))}
        </div>
      )}

      {/* Brief cards */}
      {briefs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {briefs.map((b) => (
            <InspiredBriefCard key={b.id} brief={b} onForge={() => saveAndForge(b)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComparableChip({ game, onRemove }: { game: ComparableGame; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 pl-1 pr-1.5 py-1 border border-gold/40 rounded-sm bg-muted/20">
      {game.iconUrl ? (
        <img src={game.iconUrl} alt="" className="h-6 w-6 rounded-sm border border-border" />
      ) : (
        <div className="h-6 w-6 rounded-sm bg-muted/50" />
      )}
      <span className="font-display text-xs text-foreground max-w-[140px] truncate">{game.name}</span>
      <button
        onClick={onRemove}
        className="h-4 w-4 rounded-sm flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/15"
        aria-label={`Remove ${game.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function InspiredBriefCard({ brief, onForge }: { brief: InspiredBrief; onForge: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-sm bg-muted/15 overflow-hidden">
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] uppercase tracking-widest text-copper">
              Inspired by {brief.sourceGame}
            </div>
            <h4 className="font-display text-base text-foreground mt-0.5 leading-tight">
              {brief.title}
            </h4>
          </div>
          <Sparkles className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />
        </div>

        <p className="font-body text-sm text-foreground/90 leading-snug">{brief.targetHook}</p>

        <div className="border-l-2 border-copper/50 pl-2 mt-2">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Source hook
          </div>
          <p className="font-mono text-[11px] text-foreground/70 italic line-clamp-2 mt-0.5">
            "{brief.sourceHook}"
          </p>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="font-mono text-[10px] uppercase tracking-widest text-gold-dim hover:text-gold-bright flex items-center gap-1 mt-1"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
          {open ? "Hide" : "Show"} details
        </button>

        {open && (
          <div className="pt-2 space-y-2 text-[11px] font-mono text-foreground/80 border-t border-border/60 mt-2">
            <KV k="Mechanic" v={brief.mechanic} />
            <KV k="Visual cue" v={brief.visualCue} />
            <KV k="Pacing" v={brief.pacing} />
            <KV k="CTA" v={brief.cta} />
            <KV k="Scenario prompt" v={brief.prompt} mono />
          </div>
        )}
      </div>
      <button
        onClick={onForge}
        className="w-full btn-copper px-3 py-2 font-display tracking-wider text-sm rounded-none flex items-center justify-center gap-2"
      >
        <Hammer className="h-3.5 w-3.5" />
        Save & send to Anvil
      </button>
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-gold-dim">{k}</div>
      <div className={cn("text-foreground/80 leading-snug", mono ? "font-mono text-[10px]" : "font-body text-xs")}>
        {v}
      </div>
    </div>
  );
}
