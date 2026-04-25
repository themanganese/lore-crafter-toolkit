import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Hammer, Skull } from "lucide-react";
import { useCharacter } from "@/hooks/use-characters";
import { saveCharacter } from "@/lib/store";
import { draftCreativeBrief } from "@/lib/server.functions";
import { PipelineBreadcrumb } from "./character.$gameId";
import type { CreativeBrief } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/character/$gameId/brief")({
  head: () => ({ meta: [{ title: "Brief Builder — CreatorForge" }] }),
  component: BriefPage,
});

const EMPTY: Omit<CreativeBrief, "id" | "createdAt"> = {
  title: "",
  targetGameName: "",
  targetHook: "",
  mechanic: "",
  visualCue: "",
  pacing: "",
  cta: "",
  notes: "",
  prompt: "",
};

function BriefPage() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const { character, refresh } = useCharacter(gameId);
  const draft = useServerFn(draftCreativeBrief);
  const [drafting, setDrafting] = useState(false);
  const [form, setForm] = useState(EMPTY);

  if (!character || character.status !== "analyzed") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <Skull className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-display text-2xl text-foreground mb-2">Character not ready</h2>
        <p className="font-mono text-sm text-muted-foreground mb-4">
          Inscribe a character sheet first.
        </p>
        <Link to="/" className="gold-frame px-4 py-2 font-display text-gold-bright">
          Return to Forge
        </Link>
      </div>
    );
  }

  async function autoDraft() {
    if (!character) return;
    if (!form.targetGameName.trim()) {
      toast.error("Name your target game first");
      return;
    }
    setDrafting(true);
    try {
      const r = await draft({
        data: {
          character: {
            name: character.name,
            vertical: character.vertical,
            stats: character.stats,
            topHooks: character.topHooks,
            codex: character.codex,
          },
          targetGameName: form.targetGameName,
        },
      });
      if (!r.ok || !r.brief) {
        toast.error(r.error ?? "Drafting failed");
        return;
      }
      setForm({ ...form, ...r.brief });
      toast.success("Brief drafted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Drafting failed");
    } finally {
      setDrafting(false);
    }
  }

  async function saveAndForge() {
    if (!character) return;
    if (!form.title.trim() || !form.prompt.trim()) {
      toast.error("Title and prompt are required");
      return;
    }
    const brief: CreativeBrief = {
      id: crypto.randomUUID(),
      ...form,
      createdAt: new Date().toISOString(),
    };
    await saveCharacter({ ...character, briefs: [brief, ...character.briefs] });
    refresh();
    navigate({
      to: "/character/$gameId/anvil",
      params: { gameId: character.id },
      search: { briefId: brief.id },
    });
  }

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <PipelineBreadcrumb currentStep="brief" gameId={character.id} disabled={false} />
      <h1 className="font-display text-3xl text-gradient-gold mt-1 mb-1">Brief Builder</h1>
      <p className="font-mono text-xs text-muted-foreground mb-8">
        Adapt {character.name}'s winning patterns for your own game.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="panel-grim p-6 space-y-5">
          <Field
            label="Target game (yours)"
            value={form.targetGameName}
            onChange={(v) => setForm({ ...form, targetGameName: v })}
            placeholder="e.g. Shadow Reaver"
          />

          <button
            onClick={autoDraft}
            disabled={drafting || !form.targetGameName.trim()}
            className="w-full gold-frame px-4 py-2.5 font-display tracking-wider text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {drafting ? "Drafting…" : "Auto-draft from character"}
          </button>

          <div className="border-t border-border pt-5 space-y-5">
            <Field label="Brief title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <Field label="Target hook" value={form.targetHook} onChange={(v) => setForm({ ...form, targetHook: v })} multiline />
            <Field label="Mechanic" value={form.mechanic} onChange={(v) => setForm({ ...form, mechanic: v })} multiline />
            <Field label="Visual cue" value={form.visualCue} onChange={(v) => setForm({ ...form, visualCue: v })} multiline />
            <Field label="Pacing" value={form.pacing} onChange={(v) => setForm({ ...form, pacing: v })} multiline />
            <Field label="Call to action" value={form.cta} onChange={(v) => setForm({ ...form, cta: v })} />
            <Field label="Notes" value={form.notes ?? ""} onChange={(v) => setForm({ ...form, notes: v })} multiline />
            <Field
              label="Scenario prompt (sent to image model)"
              value={form.prompt}
              onChange={(v) => setForm({ ...form, prompt: v })}
              multiline
              rows={5}
            />
          </div>

          <button
            onClick={saveAndForge}
            disabled={!form.title.trim() || !form.prompt.trim()}
            className="w-full gold-frame px-4 py-3 font-display tracking-wider text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Hammer className="h-4 w-4" />
            Save & forge creative
          </button>
        </div>

        <aside className="space-y-4">
          <div className="panel-grim p-4">
            <h4 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-3">
              Source character
            </h4>
            <div className="font-display text-base text-foreground">{character.name}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{character.vertical}</div>
            <div className="mt-4 space-y-1">
              {character.stats.slice(0, 5).map((s) => (
                <div key={s.key} className="flex justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="text-gold tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel-grim p-4">
            <h4 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-3">
              Top hooks
            </h4>
            <ul className="space-y-2">
              {character.topHooks.map((h, i) => (
                <li key={i} className="font-mono text-[11px] text-foreground/80 leading-relaxed">
                  <span className="text-gold">▸</span> {h.label}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-widest text-gold-dim">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-gold/60 resize-y"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-gold/60"
        />
      )}
    </label>
  );
}
