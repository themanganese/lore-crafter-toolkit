import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Sparkles,
  Sword,
  ScrollText,
  Hammer,
  Share2,
  RefreshCw,
  ChevronRight,
  Skull,
} from "lucide-react";
import { useCharacter } from "@/hooks/use-characters";
import { saveCharacter, deleteCharacter } from "@/lib/store";
import { scryAndAnalyze } from "@/lib/server.functions";
import { StatRow } from "@/components/StatRow";
import { StatRadar } from "@/components/StatRadar";
import { TierBadge } from "@/components/TierBadge";
import { AdCard } from "@/components/AdCard";
import { toast } from "sonner";

export const Route = createFileRoute("/character/$gameId")({
  head: () => ({
    meta: [{ title: "Character Sheet — CreatorForge" }],
  }),
  component: CharacterPage,
});

function CharacterPage() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const { character, loading, refresh } = useCharacter(gameId);
  const scry = useServerFn(scryAndAnalyze);
  const [scrying, setScrying] = useState(false);
  const [tab, setTab] = useState<"sheet" | "ads" | "codex">("sheet");

  // Auto-scry on first visit if draft
  useEffect(() => {
    if (character && character.status === "draft" && character.externalId && !scrying) {
      void runScry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.id]);

  async function runScry() {
    if (!character || !character.externalId || character.platform === "unknown") {
      toast.error("Missing app id — cannot summon ads");
      return;
    }
    setScrying(true);
    await saveCharacter({ ...character, status: "scrying", errorMessage: undefined });
    try {
      const r = await scry({
        data: {
          externalId: character.externalId,
          platform: character.platform,
          gameName: character.name,
          vertical: character.vertical,
        },
      });
      if (!r.ok) {
        await saveCharacter({
          ...character,
          status: "error",
          errorMessage: r.error ?? "Unknown error",
        });
        toast.error(r.error ?? "Analysis failed");
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
        errorMessage: undefined,
      });
      toast.success("Character sheet inscribed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      await saveCharacter({ ...character, status: "error", errorMessage: msg });
      toast.error(msg);
    } finally {
      setScrying(false);
      refresh();
    }
  }

  async function handleDelete() {
    if (!character) return;
    if (!confirm(`Banish ${character.name} from the roster?`)) return;
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
      toast.success("Shareable URL copied to clipboard");
    } catch {
      prompt("Copy this URL:", url);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <Skull className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-display text-2xl text-foreground mb-2">Character lost</h2>
        <p className="font-mono text-sm text-muted-foreground mb-4">
          This character does not exist in your roster.
        </p>
        <Link to="/" className="gold-frame px-4 py-2 font-display text-gold-bright">
          Return to Forge
        </Link>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex items-start gap-5 mb-8">
        <div className="h-20 w-20 rounded-sm overflow-hidden bg-muted border border-gold/40 shrink-0 gold-frame">
          {character.iconUrl ? (
            <img src={character.iconUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Skull className="h-10 w-10 m-auto mt-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-gold-dim">
            <span>{character.publisher ?? "Unknown"}</span>
            <span>·</span>
            <span>{character.platform.toUpperCase()}</span>
            {character.vertical && (
              <>
                <span>·</span>
                <span>{character.vertical}</span>
              </>
            )}
          </div>
          <h1 className="font-display text-4xl text-gradient-gold mt-1">{character.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runScry}
            disabled={scrying}
            className="gold-frame px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center gap-2"
          >
            {scrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Re-scry
          </button>
          <button
            onClick={handleShare}
            disabled={character.status !== "analyzed"}
            className="gold-frame px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center gap-2"
          >
            <Share2 className="h-3 w-3" />
            Share
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors"
          >
            Banish
          </button>
        </div>
      </header>

      {/* Pipeline breadcrumb */}
      <PipelineBreadcrumb currentStep="sheet" gameId={character.id} disabled={character.status !== "analyzed"} />

      {/* Status states */}
      {character.status === "scrying" && <ScryingState />}

      {character.status === "error" && (
        <div className="panel-grim p-6 my-6 border-destructive/40">
          <h3 className="font-display text-lg text-destructive mb-2">Scrying failed</h3>
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">
            {character.errorMessage}
          </p>
          <button
            onClick={runScry}
            className="mt-4 gold-frame px-4 py-2 font-display tracking-wider text-gold-bright hover:bg-gold/10"
          >
            Try again
          </button>
        </div>
      )}

      {character.status === "analyzed" && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border mb-6 mt-6">
            {(["sheet", "ads", "codex"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 font-mono text-[11px] uppercase tracking-widest border-b-2 -mb-px transition-colors ${
                  tab === t
                    ? "border-gold text-gold-bright"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "sheet" ? "Character Sheet" : t === "ads" ? `Top Ads (${character.ads.length})` : "Codex"}
              </button>
            ))}
          </div>

          {tab === "sheet" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Radar */}
              <div className="panel-grim p-6 lg:col-span-1">
                <h3 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-4">
                  Stat Radar
                </h3>
                <StatRadar stats={character.stats} />
              </div>

              {/* Stats list */}
              <div className="panel-grim p-6 lg:col-span-1">
                <h3 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-4">
                  Attributes
                </h3>
                <div className="space-y-1">
                  {character.stats.map((s) => (
                    <StatRow key={s.key} stat={s} />
                  ))}
                </div>
              </div>

              {/* Equipped hooks */}
              <div className="panel-grim p-6 lg:col-span-1">
                <h3 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-4 flex items-center gap-2">
                  <Sword className="h-3.5 w-3.5" />
                  Equipped Hooks
                </h3>
                <div className="space-y-3">
                  {character.topHooks.map((h, i) => (
                    <div key={i} className="border border-border/60 rounded-sm p-3 bg-muted/20">
                      <div className="flex items-start gap-3">
                        <TierBadge tier={h.tier} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-sm text-foreground">{h.label}</p>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground italic leading-snug">
                            {h.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  to="/character/$gameId/brief"
                  params={{ gameId: character.id }}
                  className="mt-5 w-full gold-frame px-4 py-2.5 font-display tracking-wider text-gold-bright hover:bg-gold/10 flex items-center justify-center gap-2 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  Forge a brief
                </Link>
              </div>
            </div>
          )}

          {tab === "ads" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {character.ads.map((ad) => (
                <AdCard key={ad.id} ad={ad} />
              ))}
            </div>
          )}

          {tab === "codex" && (
            <div className="panel-grim p-6">
              <h3 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-4 flex items-center gap-2">
                <ScrollText className="h-3.5 w-3.5" />
                Insights from the Tome
              </h3>
              <ul className="space-y-3">
                {character.codex.map((line, i) => (
                  <li key={i} className="flex items-start gap-3 font-mono text-sm text-foreground/90 leading-relaxed">
                    <span className="text-gold mt-0.5">⌑</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Generations preview */}
          {character.generations.length > 0 && (
            <section className="mt-10">
              <h3 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-4 flex items-center gap-2">
                <Hammer className="h-3.5 w-3.5" />
                Armory ({character.generations.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {character.generations.slice(0, 8).map((g) => (
                  <Link
                    key={g.id}
                    to="/character/$gameId/anvil"
                    params={{ gameId: character.id }}
                    className="aspect-square panel-grim overflow-hidden block"
                  >
                    <img src={g.imageUrl} alt="" className="h-full w-full object-cover" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ScryingState() {
  return (
    <div className="panel-grim p-12 my-6 text-center">
      <Loader2 className="h-10 w-10 text-gold animate-spin mx-auto mb-5" />
      <h3 className="font-display text-2xl text-gradient-gold mb-2">Scrying the market…</h3>
      <ul className="font-mono text-xs text-muted-foreground space-y-1.5 max-w-sm mx-auto">
        <li>· Summoning top creatives from SensorTower</li>
        <li>· Inferring stat axes for this vertical</li>
        <li>· Ranking hooks by impact</li>
        <li>· Inscribing the codex</li>
      </ul>
    </div>
  );
}

export function PipelineBreadcrumb({
  currentStep,
  gameId,
  disabled,
}: {
  currentStep: "sheet" | "brief" | "anvil";
  gameId: string;
  disabled: boolean;
}) {
  const steps = [
    { id: "sheet" as const, label: "Character Sheet", to: "/character/$gameId" },
    { id: "brief" as const, label: "Brief Builder", to: "/character/$gameId/brief" },
    { id: "anvil" as const, label: "Anvil", to: "/character/$gameId/anvil" },
  ];
  return (
    <nav className="flex items-center gap-1 mb-2 font-mono text-[10px] uppercase tracking-widest">
      {steps.map((s, i) => (
        <span key={s.id} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
          {s.id === currentStep ? (
            <span className="text-gold-bright">{s.label}</span>
          ) : disabled && s.id !== "sheet" ? (
            <span className="text-muted-foreground/40">{s.label}</span>
          ) : (
            <Link
              to={s.to}
              params={{ gameId }}
              className="text-muted-foreground hover:text-gold-bright transition-colors"
            >
              {s.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
