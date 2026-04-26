import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Skull } from "lucide-react";
import { useCharacter } from "@/hooks/use-characters";
import { saveCharacter, deleteCharacter } from "@/lib/store";
import {
  startAnalysisRun,
  getRunEvents,
  getRunResult,
  generateCreative,
} from "@/lib/server.functions";
import { CharacterDossier } from "@/components/dashboard/CharacterDossier";
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
  const fetchResult = useServerFn(getRunResult);
  const generate = useServerFn(generateCreative);

  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
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
      toast.error("Missing app id — cannot run analysis");
      return;
    }
    setAnalyzing(true);
    setShowTrace(true);
    setLiveEvents([]);
    await saveCharacter({ ...character, status: "scrying", errorMessage: undefined });

    let pollHandle: ReturnType<typeof setInterval> | null = null;
    try {
      const { runId } = await startRun({
        data: {
          externalId: character.externalId,
          platform: character.platform,
          gameName: character.name,
          vertical: character.vertical,
        },
      });

      // Poll the in-memory run store for live events and completion. The
      // trace panel updates in real time so the user can watch agents work
      // instead of staring at a spinner.
      await new Promise<void>((resolve, reject) => {
        pollHandle = setInterval(async () => {
          try {
            const ev = await fetchEvents({ data: { runId } });
            setLiveEvents(ev.events);
            if (ev.done) {
              if (pollHandle) clearInterval(pollHandle);
              pollHandle = null;
              resolve();
            }
          } catch (err) {
            if (pollHandle) clearInterval(pollHandle);
            pollHandle = null;
            reject(err);
          }
        }, 1500);
      });

      const { result: r } = await fetchResult({ data: { runId } });
      const ev = await fetchEvents({ data: { runId } });

      if (!r || r.ok !== true) {
        const msg = r?.error ?? "Analysis failed";
        await saveCharacter({
          ...character,
          status: "error",
          errorMessage: msg,
          aiThoughts: ev.events,
        });
        toast.error(msg);
        return;
      }

      await saveCharacter({
        ...character,
        status: "analyzed",
        ads: r.ads,
        stats: r.stats,
        topHooks: r.topHooks,
        codex: r.codex,
        vertical: r.refinedVertical || character.vertical,
        scoreBreakdown: r.scoreBreakdown,
        revenueForecast: r.revenueForecast,
        trendAnalysis: r.trendAnalysis,
        curation: r.curation,
        aiThoughts: ev.events,
        errorMessage: undefined,
      });
      toast.success("Dossier inscribed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      await saveCharacter({ ...character, status: "error", errorMessage: msg });
      toast.error(msg);
    } finally {
      if (pollHandle) clearInterval(pollHandle);
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
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Shareable URL copied");
    } catch {
      prompt("Copy this URL:", url);
    }
  }

  async function generateFromBrief(brief: CreativeBrief) {
    if (!character) return;
    setGenerating(true);
    try {
      const r = await generate({ data: { prompt: brief.prompt } });
      if (!r.ok) {
        toast.error(r.error ?? "Generation failed");
        return;
      }
      const gen: GeneratedCreative = {
        id: crypto.randomUUID(),
        briefId: brief.id,
        imageUrl: r.imageUrl,
        prompt: brief.prompt,
        model: r.model,
        createdAt: new Date().toISOString(),
      };
      const galleryItem: GalleryItem = {
        id: crypto.randomUUID(),
        kind: "generated",
        imageUrl: r.imageUrl,
        createdAt: gen.createdAt,
        generationId: gen.id,
      };
      await saveCharacter({
        ...character,
        generations: [gen, ...character.generations],
        gallery: [galleryItem, ...character.gallery],
      });
      refresh();
      toast.success("Variant forged — click Open to view", {
        duration: 20000,
        action: {
          label: "Open",
          onClick: () => window.open(r.imageUrl, "_blank", "noreferrer"),
        },
      });
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
        <Link to="/" className="gold-frame px-4 py-2 font-display text-gold-bright">
          Return to Forge
        </Link>
      </div>
    );
  }

  return (
    <CharacterDossier
      character={character}
      analyzing={analyzing}
      generating={generating}
      showTrace={showTrace}
      liveEvents={liveEvents}
      onRunAnalysis={runAnalysis}
      onToggleTrace={() => setShowTrace((s) => !s)}
      onShare={handleShare}
      onDelete={handleDelete}
      onGenerateFromBrief={generateFromBrief}
    />
  );
}
