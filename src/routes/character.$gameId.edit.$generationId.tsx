import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Download, Skull, ArrowLeft, Sparkles } from "lucide-react";
import { useCharacter } from "@/hooks/use-characters";
import { saveCharacter } from "@/lib/store";
import { editGeneration, generateCreative } from "@/lib/server.functions";
import type { GeneratedCreative } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/character/$gameId/edit/$generationId")({
  head: () => ({ meta: [{ title: "Edit Variant — Forge by Silki" }] }),
  component: EditPage,
});

function EditPage() {
  const { gameId, generationId } = Route.useParams();
  const { character, loading, refresh } = useCharacter(gameId);
  const editFn = useServerFn(editGeneration);
  const regen = useServerFn(generateCreative);
  const [working, setWorking] = useState(false);

  const gen = character?.generations.find((g) => g.id === generationId);
  const [prompt, setPrompt] = useState(gen?.prompt ?? "");
  const [strength, setStrength] = useState(0.55);

  // useState initializer captures gen.prompt on first render, but `character` is
  // null during the initial IndexedDB read. Sync once when gen first appears.
  useEffect(() => {
    if (gen && !prompt) setPrompt(gen.prompt);
  }, [gen, prompt]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <Loader2 className="h-6 w-6 text-gold-dim animate-spin mb-3" />
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Retrieving variant from the codex…
        </p>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <Skull className="h-12 w-12 text-muted-foreground mb-4" />
        <Link to="/" className="gold-frame px-4 py-2 font-display text-gold-bright">Return to Forge</Link>
      </div>
    );
  }
  if (!gen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <p className="font-mono text-sm text-muted-foreground mb-4">Variant not found.</p>
        <Link to="/character/$gameId" params={{ gameId }} className="gold-frame px-4 py-2 font-display text-gold-bright">
          Back to dashboard
        </Link>
      </div>
    );
  }

  async function runEdit(mode: "edit" | "regen") {
    if (!character || !gen) return;
    if (!prompt.trim()) { toast.error("Prompt is required"); return; }
    setWorking(true);
    try {
      const r = mode === "edit"
        ? await editFn({ data: { prompt, sourceImageUrl: gen.imageUrl, strength } })
        : await regen({ data: { prompt } });
      if (!r.ok) { toast.error(r.error ?? "Failed"); return; }
      const next: GeneratedCreative = {
        id: crypto.randomUUID(),
        briefId: gen.briefId,
        imageUrl: r.imageUrl,
        prompt,
        model: r.model,
        createdAt: new Date().toISOString(),
        parentId: gen.id,
      };
      await saveCharacter({ ...character, generations: [next, ...character.generations] });
      refresh();
      toast.success("New variant forged — view it on the dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link to="/character/$gameId" params={{ gameId }} className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-gold-bright flex items-center gap-1.5">
          <ArrowLeft className="h-3 w-3" /> Back to {character.name}
        </Link>
        <div className="font-display text-xs uppercase tracking-[0.4em] text-gold-dim">Variant Editor</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="gold-frame p-3 bg-card">
          <img src={gen.imageUrl} alt="" className="w-full h-auto rounded-sm" />
          <div className="flex items-center justify-between mt-3 px-1">
            <span className="font-mono text-[10px] text-muted-foreground">
              {new Date(gen.createdAt).toLocaleString()} · {gen.model}
            </span>
            <a href={gen.imageUrl} target="_blank" rel="noreferrer" download className="font-mono text-[10px] uppercase tracking-widest text-gold-bright hover:underline flex items-center gap-1">
              <Download className="h-3 w-3" /> Download
            </a>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel-grim p-4 space-y-3">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-gold-dim">Prompt</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2 text-sm font-body focus:outline-none focus:border-gold/60 resize-y"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-gold-dim">
                Edit strength: {strength.toFixed(2)}
              </span>
              <input
                type="range" min="0.15" max="0.9" step="0.05"
                value={strength}
                onChange={(e) => setStrength(parseFloat(e.target.value))}
                className="mt-1 w-full accent-gold"
              />
              <p className="font-mono text-[9px] text-muted-foreground mt-1">
                Lower = closer to original. Higher = more change.
              </p>
            </label>
            <button
              onClick={() => runEdit("edit")}
              disabled={working}
              className="w-full btn-copper px-4 py-2.5 font-display tracking-wider text-sm rounded-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Edit with Scenario (img2img)
            </button>
            <button
              onClick={() => runEdit("regen")}
              disabled={working}
              className="w-full gold-frame px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-gold-bright hover:bg-gold/10 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate from prompt
            </button>
          </div>
          <div className="panel-grim p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim mb-2">
              How this works
            </div>
            <p className="font-body text-xs text-foreground/85 leading-relaxed">
              New variants are saved to the dashboard's Anvil grid. This tab stays open like a YouTube video — you can keep iterating without losing context.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
