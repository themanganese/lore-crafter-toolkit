import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, RefreshCw, Share2, Skull, Sword, Coins, TrendingUp, Sparkles,
  Hammer, Image as ImageIcon, ScrollText, Trash2,
} from "lucide-react";
import { useCharacter } from "@/hooks/use-characters";
import { saveCharacter, deleteCharacter } from "@/lib/store";
import { startAnalysisRun, getRunEvents, generateCreative } from "@/lib/server.functions";
import { GameHeader } from "@/components/dashboard/GameHeader";
import { ExpandPanel } from "@/components/dashboard/ExpandPanel";
import {
  ScoreBreakdownPanel, RevenueForecastPanel, TrendAnalysisPanel,
  TopAdsPanel, GalleryPanel, AnvilPanel, AIThinkingTrace,
} from "@/components/dashboard/Panels";
import { BriefBuilderPanel } from "@/components/dashboard/BriefBuilder";
import type { GeneratedCreative, GalleryItem, ThoughtEvent, CreativeBrief } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/character/$gameId")({
  head: () => ({ meta: [{ title: "Character Dossier — Forge by Silki" }] }),
  component: CharacterPage,
});

function CharacterPage() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const { character, refresh } = useCharacter(gameId);
  const startRun = useServerFn(startAnalysisRun);
  const fetchEvents = useServerFn(getRunEvents);
  const generate = useServerFn(generateCreative);

  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeBriefId, setActiveBriefId] = useState<string | undefined>();
  const [liveEvents, setLiveEvents] = useState<ThoughtEvent[]>([]);
  const [showTrace, setShowTrace] = useState(false);
  const startedOnceRef = useRef(false);

  // Auto-run on first visit if draft (only once per mount)
  useEffect(() => {
    if (!character || startedOnceRef.current) return;
    if (character.status === "draft" && character.externalId) {
      startedOnceRef.current = true;
      void runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.id]);

  async function runAnalysis() {
    if (!character || !character.externalId || character.platform === "unknown") {
      toast.error("Missing app id — cannot run analysis"); return;
    }
    setAnalyzing(true);
    setShowTrace(true);
    setLiveEvents([]);
    await saveCharacter({ ...character, status: "scrying", errorMessage: undefined });

    let pollHandle: number | null = null;
    let runId: string | null = null;

    // Poll for events while we await result
    const pollLoop = async () => {
      if (!runId) return;
      const r = await fetchEvents({ data: { runId } }).catch(() => null);
      if (r) setLiveEvents(r.events);
      if (r?.done) { if (pollHandle !== null) window.clearInterval(pollHandle); }
    };

    try {
      // Start orchestrator (await — events polled in parallel via setInterval)
      const promise = startRun({
        data: {
          externalId: character.externalId,
          platform: character.platform,
          gameName: character.name,
          vertical: character.vertical,
        },
      });
      // Poll runId once available — we don't have it before await, so simulate by polling after first paint
      // Workaround: rely on final result; show pulse meanwhile
      const result = await promise;
      runId = result.runId;
      // Snapshot final events
      const ev = await fetchEvents({ data: { runId } });
      setLiveEvents(ev.events);

      if (!result.ok) {
        await saveCharacter({
          ...character, status: "error",
          errorMessage: result.error ?? "Analysis failed",
          aiThoughts: ev.events,
        });
        toast.error(result.error ?? "Analysis failed");
        return;
      }

      await saveCharacter({
        ...character,
        status: "analyzed",
        ads: result.ads,
        stats: result.stats,
        topHooks: result.topHooks,
        codex: result.codex,
        vertical: result.refinedVertical || character.vertical,
        scoreBreakdown: result.scoreBreakdown,
        revenueForecast: result.revenueForecast,
        trendAnalysis: result.trendAnalysis,
        curation: result.curation,
        aiThoughts: ev.events,
        errorMessage: undefined,
      });
      toast.success("Dossier inscribed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      await saveCharacter({ ...character, status: "error", errorMessage: msg });
      toast.error(msg);
    } finally {
      if (pollHandle !== null) window.clearInterval(pollHandle);
      setAnalyzing(false);
      refresh();
    }
  }

  async function handleDelete() {
    if (!character) return;
    if (!confirm(`Remove ${character.name} from the roster?`)) return;
    await deleteCharacter(character.id);
    navigate({ to: "/" });
  }

  async function handleShare() {
    if (!character) return;
    const payload = { version: 1, exportedAt: new Date().toISOString(), character };
    const json = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const url = `${window.location.origin}/share#${b64}`;
    try { await navigator.clipboard.writeText(url); toast.success("Shareable URL copied"); }
    catch { prompt("Copy this URL:", url); }
  }

  async function uploadGalleryImage(file: File) {
    if (!character) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const item: GalleryItem = {
        id: crypto.randomUUID(),
        kind: "uploaded",
        imageUrl: reader.result as string,
        createdAt: new Date().toISOString(),
      };
      await saveCharacter({ ...character, gallery: [item, ...character.gallery] });
      refresh();
    };
    reader.readAsDataURL(file);
  }

  async function deleteGalleryItem(id: string) {
    if (!character) return;
    await saveCharacter({ ...character, gallery: character.gallery.filter((g) => g.id !== id) });
    refresh();
  }

  async function generateFromBrief(brief: CreativeBrief) {
    if (!character) return;
    setGenerating(true);
    try {
      const r = await generate({ data: { prompt: brief.prompt } });
      if (!r.ok) { toast.error(r.error ?? "Generation failed"); return; }
      const gen: GeneratedCreative = {
        id: crypto.randomUUID(), briefId: brief.id, imageUrl: r.imageUrl,
        prompt: brief.prompt, model: r.model, createdAt: new Date().toISOString(),
      };
      const galleryItem: GalleryItem = {
        id: crypto.randomUUID(), kind: "generated", imageUrl: r.imageUrl,
        createdAt: gen.createdAt, generationId: gen.id,
      };
      await saveCharacter({
        ...character,
        generations: [gen, ...character.generations],
        gallery: [galleryItem, ...character.gallery],
      });
      refresh();
      toast.success("Variant forged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (!character) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <Skull className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-display text-2xl text-foreground mb-2">Character lost</h2>
        <Link to="/" className="gold-frame px-4 py-2 font-display text-gold-bright">Return to Forge</Link>
      </div>
    );
  }

  const curation = character.curation;
  const isEmphasized = (s: "score" | "revenue" | "trend" | "ads") =>
    curation ? curation.emphasizedSections.includes(s) : (s === "score" || s === "trend");
  const isCollapsed = (s: "score" | "revenue" | "trend" | "ads") =>
    curation ? curation.collapsedSections.includes(s) : false;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto space-y-5">
      {/* Action toolbar */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="gold-frame px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center gap-1.5"
        >
          {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {analyzing ? "Analyzing…" : "Re-run analysis"}
        </button>
        {character.aiThoughts.length > 0 && !analyzing && (
          <button
            onClick={() => setShowTrace((s) => !s)}
            className="gold-frame px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-gold-bright"
          >
            {showTrace ? "Hide" : "View"} AI reasoning
          </button>
        )}
        <button
          onClick={handleShare}
          disabled={character.status !== "analyzed"}
          className="gold-frame px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center gap-1.5"
        >
          <Share2 className="h-3 w-3" /> Share
        </button>
        <button
          onClick={handleDelete}
          className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive flex items-center gap-1.5"
        >
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      </div>

      {/* Game header — AC-style */}
      <GameHeader character={character} />

      {/* Curation focus line */}
      {curation?.focus && character.status === "analyzed" && (
        <div className="panel-grim px-5 py-3 bg-parchment border-l-4 border-l-gold-bright">
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim mb-1">
            Focus
          </div>
          <p className="font-body text-sm text-foreground/90">{curation.focus}</p>
        </div>
      )}

      {/* Live AI thinking trace */}
      {(showTrace || analyzing) && (
        <AIThinkingTrace
          events={analyzing ? liveEvents : character.aiThoughts}
          active={analyzing}
        />
      )}

      {/* Error */}
      {character.status === "error" && (
        <div className="panel-grim p-5 border-destructive/40">
          <h3 className="font-display text-lg text-destructive mb-2">Analysis failed</h3>
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">{character.errorMessage}</p>
          <button onClick={runAnalysis} className="mt-3 gold-frame px-4 py-2 font-display text-gold-bright hover:bg-gold/10">
            Try again
          </button>
        </div>
      )}

      {/* Analyzed dashboard */}
      {character.status === "analyzed" && (
        <div className="space-y-4">
          {/* Score Breakdown */}
          {character.scoreBreakdown && (
            <ExpandPanel
              title="Score Breakdown"
              subtitle="Win probability · 5 dimensions · improvement levers"
              icon={<Sword className="h-4 w-4" />}
              defaultOpen={!isCollapsed("score")}
              emphasis={isEmphasized("score")}
              badge={
                <span className="font-mono text-[10px] uppercase tracking-widest text-gold-bright">
                  WP {character.scoreBreakdown.winProbability}
                </span>
              }
            >
              <ScoreBreakdownPanel
                breakdown={character.scoreBreakdown}
                loreStats={character.stats}
                topHooks={character.topHooks}
                codex={character.codex}
              />
            </ExpandPanel>
          )}

          {/* Revenue Forecast */}
          {character.revenueForecast && (
            <ExpandPanel
              title="Revenue Forecast"
              subtitle="30 / 60 / 90 day modelled projection"
              icon={<Coins className="h-4 w-4" />}
              defaultOpen={!isCollapsed("revenue") && isEmphasized("revenue")}
            >
              <RevenueForecastPanel forecast={character.revenueForecast} />
            </ExpandPanel>
          )}

          {/* Trend Analysis — its own sub-sections */}
          {character.trendAnalysis && (
            <ExpandPanel
              title="Trend Analysis"
              subtitle="Working · saturating · velocity matrix · differentiation"
              icon={<TrendingUp className="h-4 w-4" />}
              defaultOpen={!isCollapsed("trend")}
              emphasis={isEmphasized("trend")}
            >
              <TrendAnalysisPanel trend={character.trendAnalysis} />
            </ExpandPanel>
          )}

          {/* Top Ads */}
          {character.ads.length > 0 && (
            <ExpandPanel
              title={`Top Ads (Reference) — ${character.ads.length}`}
              subtitle="SensorTower top creatives"
              icon={<ScrollText className="h-4 w-4" />}
              defaultOpen={false}
            >
              <TopAdsPanel ads={character.ads} />
            </ExpandPanel>
          )}

          {/* Gallery */}
          <ExpandPanel
            title={`Gallery (${character.gallery.length})`}
            subtitle="Generated variants + uploaded references"
            icon={<ImageIcon className="h-4 w-4" />}
            defaultOpen={false}
          >
            <GalleryPanel
              items={character.gallery}
              onUpload={uploadGalleryImage}
              onDelete={deleteGalleryItem}
            />
          </ExpandPanel>

          {/* Brief Builder */}
          <ExpandPanel
            title="Brief Builder"
            subtitle="Adapt winning patterns into a creative brief"
            icon={<Sparkles className="h-4 w-4" />}
            defaultOpen={false}
          >
            <BriefBuilderPanel character={character} onCreated={(b) => setActiveBriefId(b.id)} />
          </ExpandPanel>

          {/* Anvil — always open at bottom (per references) */}
          <ExpandPanel
            title="The Anvil"
            subtitle="Generation studio · click any thumbnail to edit in a new tab"
            icon={<Hammer className="h-4 w-4" />}
            defaultOpen={true}
          >
            <AnvilPanel
              briefs={character.briefs}
              generations={character.generations}
              gameId={character.id}
              onGenerate={generateFromBrief}
              generating={generating}
              activeBriefId={activeBriefId}
              setActiveBriefId={setActiveBriefId}
            />
          </ExpandPanel>
        </div>
      )}
    </div>
  );
}
