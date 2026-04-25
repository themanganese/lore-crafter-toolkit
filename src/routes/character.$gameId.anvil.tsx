import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Hammer, Download, RefreshCw, Skull } from "lucide-react";
import { useCharacter } from "@/hooks/use-characters";
import { saveCharacter } from "@/lib/store";
import { generateCreative } from "@/lib/server.functions";
import { PipelineBreadcrumb } from "./character.$gameId";
import { z } from "zod";
import type { GeneratedCreative } from "@/lib/types";
import { toast } from "sonner";

const searchSchema = z.object({
  briefId: z.string().optional(),
});

export const Route = createFileRoute("/character/$gameId/anvil")({
  head: () => ({ meta: [{ title: "Anvil — CreatorForge" }] }),
  validateSearch: searchSchema,
  component: AnvilPage,
});

function AnvilPage() {
  const { gameId } = Route.useParams();
  const { briefId } = useSearch({ from: "/character/$gameId/anvil" });
  const { character, refresh } = useCharacter(gameId);
  const generate = useServerFn(generateCreative);
  const [generating, setGenerating] = useState(false);
  const [activeBriefId, setActiveBriefId] = useState<string | undefined>(briefId);

  if (!character) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <Skull className="h-12 w-12 text-muted-foreground mb-4" />
        <Link to="/" className="gold-frame px-4 py-2 font-display text-gold-bright">
          Return to Forge
        </Link>
      </div>
    );
  }

  const activeBrief =
    character.briefs.find((b) => b.id === activeBriefId) ?? character.briefs[0];

  async function forge() {
    if (!character || !activeBrief) {
      toast.error("Pick a brief first");
      return;
    }
    setGenerating(true);
    try {
      const r = await generate({ data: { prompt: activeBrief.prompt } });
      if (!r.ok) {
        toast.error(r.error ?? "Generation failed");
        return;
      }
      const gen: GeneratedCreative = {
        id: crypto.randomUUID(),
        briefId: activeBrief.id,
        imageUrl: r.imageUrl,
        prompt: activeBrief.prompt,
        model: r.model,
        createdAt: new Date().toISOString(),
      };
      await saveCharacter({
        ...character,
        generations: [gen, ...character.generations],
      });
      refresh();
      toast.success("Creative forged");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (character.briefs.length === 0) {
    return (
      <div className="px-8 py-8 max-w-5xl mx-auto">
        <PipelineBreadcrumb currentStep="anvil" gameId={character.id} disabled={false} />
        <div className="panel-grim p-12 text-center mt-6">
          <Hammer className="h-10 w-10 text-gold mx-auto mb-4 opacity-60" />
          <h2 className="font-display text-2xl text-foreground mb-2">No briefs forged</h2>
          <p className="font-mono text-xs text-muted-foreground mb-4">
            Create a creative brief first to feed the anvil.
          </p>
          <Link
            to="/character/$gameId/brief"
            params={{ gameId: character.id }}
            className="gold-frame inline-block px-4 py-2 font-display text-gold-bright"
          >
            Open Brief Builder
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <PipelineBreadcrumb currentStep="anvil" gameId={character.id} disabled={false} />
      <h1 className="font-display text-3xl text-gradient-gold mt-1 mb-1">The Anvil</h1>
      <p className="font-mono text-xs text-muted-foreground mb-8">
        Forge tailored creatives from your briefs via Scenario.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Brief picker */}
        <aside className="space-y-2">
          <h3 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-3">
            Briefs
          </h3>
          {character.briefs.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBriefId(b.id)}
              className={`w-full text-left panel-grim p-3 transition-colors ${
                activeBrief?.id === b.id ? "border-gold/60 bg-gold/5" : ""
              }`}
            >
              <div className="font-display text-sm text-foreground">{b.title}</div>
              <div className="font-mono text-[10px] text-muted-foreground mt-1 truncate">
                For {b.targetGameName}
              </div>
            </button>
          ))}
        </aside>

        {/* Active brief + forge */}
        <div className="space-y-6">
          {activeBrief && (
            <div className="panel-grim p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg text-foreground">{activeBrief.title}</h3>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    For {activeBrief.targetGameName}
                  </p>
                </div>
                <button
                  onClick={forge}
                  disabled={generating}
                  className="gold-frame px-4 py-2 font-display tracking-wider text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center gap-2"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Hammer className="h-4 w-4" />
                  )}
                  {generating ? "Forging…" : "Forge"}
                </button>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground bg-muted/30 border border-border rounded-sm p-3 max-h-32 overflow-y-auto leading-relaxed">
                {activeBrief.prompt}
              </div>
            </div>
          )}

          {/* Armory */}
          <div>
            <h3 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-3">
              Armory ({character.generations.length})
            </h3>
            {character.generations.length === 0 && (
              <div className="panel-grim p-10 text-center">
                <p className="font-mono text-xs text-muted-foreground">
                  Strike the anvil to forge your first creative.
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {character.generations.map((g) => (
                <div key={g.id} className="panel-grim overflow-hidden group">
                  <div className="aspect-square bg-muted relative">
                    <img src={g.imageUrl} alt="" className="h-full w-full object-cover" />
                    <a
                      href={g.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="absolute bottom-2 right-2 p-2 bg-background/80 backdrop-blur border border-gold/40 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Download className="h-3.5 w-3.5 text-gold-bright" />
                    </a>
                  </div>
                  <div className="p-2">
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {new Date(g.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
