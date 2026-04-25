import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Skull, Sword, ScrollText, Download } from "lucide-react";
import type { GameCharacter, SnapshotPayload } from "@/lib/types";
import { saveCharacter } from "@/lib/store";
import { StatRow } from "@/components/StatRow";
import { StatRadar } from "@/components/StatRadar";
import { TierBadge } from "@/components/TierBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/share")({
  head: () => ({
    meta: [
      { title: "Shared Character Sheet — CreatorForge" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<SnapshotPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.slice(1);
    if (!hash) {
      setError("No snapshot in URL");
      return;
    }
    try {
      const json = decodeURIComponent(escape(atob(hash)));
      const parsed = JSON.parse(json) as SnapshotPayload;
      if (!parsed?.character?.name) throw new Error("Invalid snapshot");
      setPayload(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read snapshot");
    }
  }, []);

  async function fork() {
    if (!payload) return;
    const c: GameCharacter = {
      ...payload.character,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveCharacter(c);
    toast.success("Forked to your roster");
    navigate({ to: "/character/$gameId", params: { gameId: c.id } });
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <Skull className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-display text-2xl text-foreground mb-2">Snapshot unreadable</h2>
        <p className="font-mono text-sm text-muted-foreground mb-4">{error}</p>
        <Link to="/" className="gold-frame px-4 py-2 font-display text-gold-bright">
          Go to Forge
        </Link>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex items-center justify-center min-h-screen font-mono text-xs text-muted-foreground">
        Decoding…
      </div>
    );
  }

  const c = payload.character;

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim">
          Shared snapshot · read-only · exported {new Date(payload.exportedAt).toLocaleString()}
        </div>
        <button
          onClick={fork}
          className="gold-frame px-4 py-2 font-display tracking-wider text-gold-bright hover:bg-gold/10 flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Fork into roster
        </button>
      </div>

      <header className="flex items-start gap-5 mb-8">
        <div className="h-20 w-20 rounded-sm overflow-hidden bg-muted border border-gold/40 shrink-0 gold-frame">
          {c.iconUrl ? (
            <img src={c.iconUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Skull className="h-10 w-10 m-auto mt-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim">
            {c.publisher ?? "Unknown"} · {c.platform.toUpperCase()} · {c.vertical}
          </div>
          <h1 className="font-display text-4xl text-gradient-gold mt-1">{c.name}</h1>
        </div>
      </header>

      {c.stats.length === 0 ? (
        <p className="font-mono text-sm text-muted-foreground">No analysis in this snapshot.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="panel-grim p-6">
            <h3 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-4">
              Stat Radar
            </h3>
            <StatRadar stats={c.stats} />
          </div>
          <div className="panel-grim p-6">
            <h3 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-4">
              Attributes
            </h3>
            <div className="space-y-1">
              {c.stats.map((s) => (
                <StatRow key={s.key} stat={s} />
              ))}
            </div>
          </div>
          <div className="panel-grim p-6">
            <h3 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-4 flex items-center gap-2">
              <Sword className="h-3.5 w-3.5" />
              Equipped Hooks
            </h3>
            <div className="space-y-3">
              {c.topHooks.map((h, i) => (
                <div key={i} className="border border-border/60 rounded-sm p-3 bg-muted/20">
                  <div className="flex items-start gap-3">
                    <TierBadge tier={h.tier} size="sm" />
                    <div>
                      <p className="font-display text-sm text-foreground">{h.label}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground italic leading-snug">
                        {h.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {c.codex.length > 0 && (
        <div className="panel-grim p-6 mt-6">
          <h3 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-4 flex items-center gap-2">
            <ScrollText className="h-3.5 w-3.5" />
            Codex
          </h3>
          <ul className="space-y-3">
            {c.codex.map((line, i) => (
              <li key={i} className="flex items-start gap-3 font-mono text-sm text-foreground/90 leading-relaxed">
                <span className="text-gold mt-0.5">⌑</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
