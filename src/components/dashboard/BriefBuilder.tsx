import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Plus } from "lucide-react";
import { draftCreativeBrief } from "@/lib/server.functions";
import { saveCharacter } from "@/lib/store";
import type { GameCharacter, CreativeBrief } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

export function BriefBuilderPanel({
  character,
  onCreated,
}: {
  character: GameCharacter;
  onCreated?: (brief: CreativeBrief) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [drafting, setDrafting] = useState(false);
  const draft = useServerFn(draftCreativeBrief);

  async function autoDraft() {
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

  async function save() {
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
    setForm(EMPTY);
    setOpen(false);
    onCreated?.(brief);
    toast.success("Brief saved");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-base text-muted-foreground">
          {character.briefs.length} brief{character.briefs.length === 1 ? "" : "s"} saved.
          {" "}Adapt {character.name}'s winning patterns into your own ad concepts.
        </p>
        <button
          onClick={() => setOpen((o) => !o)}
          className="gold-frame px-3 py-1.5 text-base uppercase tracking-widest text-gold-bright hover:bg-gold/10 flex items-center gap-1.5"
        >
          <Plus className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-45")} />
          {open ? "Close" : "New brief"}
        </button>
      </div>

      {/* Saved briefs list */}
      {character.briefs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {character.briefs.slice(0, 6).map((b) => (
            <div key={b.id} className="border border-border rounded-sm p-3 bg-muted/15">
              <div className="font-display text-2xl text-foreground">{b.title}</div>
              <div className="text-base text-muted-foreground mt-0.5">
                For {b.targetGameName}
              </div>
              <p className="text-base text-foreground/70 mt-2 line-clamp-2">
                {b.prompt}
              </p>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="border border-border rounded-sm p-4 space-y-4 bg-muted/10">
          <Field
            label="Target game (yours)"
            value={form.targetGameName}
            onChange={(v) => setForm({ ...form, targetGameName: v })}
            placeholder="e.g. Shadow Reaver"
          />
          <button
            onClick={autoDraft}
            disabled={drafting || !form.targetGameName.trim()}
            className="w-full gold-frame px-4 py-2 font-display tracking-wider text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {drafting ? "Drafting…" : "Auto-draft from character"}
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border pt-4">
            <Field label="Brief title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <Field label="Call to action" value={form.cta} onChange={(v) => setForm({ ...form, cta: v })} />
            <Field label="Target hook" value={form.targetHook} onChange={(v) => setForm({ ...form, targetHook: v })} multiline />
            <Field label="Mechanic" value={form.mechanic} onChange={(v) => setForm({ ...form, mechanic: v })} multiline />
            <Field label="Visual cue" value={form.visualCue} onChange={(v) => setForm({ ...form, visualCue: v })} multiline />
            <Field label="Pacing" value={form.pacing} onChange={(v) => setForm({ ...form, pacing: v })} multiline />
          </div>
          <Field
            label="Scenario prompt (sent to image model)"
            value={form.prompt}
            onChange={(v) => setForm({ ...form, prompt: v })}
            multiline
            rows={5}
          />
          <button
            onClick={save}
            disabled={!form.title.trim() || !form.prompt.trim()}
            className="w-full btn-copper px-4 py-2.5 tracking-wider text-base rounded-sm disabled:opacity-50"
          >
            Save brief
          </button>
        </div>
      )}
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
      <span className="text-base uppercase tracking-widest text-gold-dim">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2 text-base text-foreground focus:outline-none focus:border-gold/60 resize-y"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2 text-base text-foreground focus:outline-none focus:border-gold/60"
        />
      )}
    </label>
  );
}
