import { Loader2, RefreshCw, Share2, Trash2, Skull } from "lucide-react";
import { TierBadge } from "@/components/TierBadge";
import type { GameCharacter, Tier } from "@/lib/types";

interface Props {
  character: GameCharacter;
  analyzing: boolean;
  showTrace: boolean;
  onRunAnalysis: () => void;
  onToggleTrace: () => void;
  onShare: () => void;
  onDelete: () => void;
}

function tierFromScore(n: number): Tier {
  if (n >= 80) return "S";
  if (n >= 65) return "A";
  if (n >= 50) return "B";
  if (n >= 35) return "C";
  return "D";
}

function MetaSlot({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 px-4 first:pl-0 last:pr-0 border-r border-border/60 last:border-r-0">
      <div className="text-base uppercase tracking-[0.25em] text-gold-dim">{label}</div>
      <div className="text-base font-normal text-foreground mt-0.5 break-words leading-snug">
        {value}
      </div>
    </div>
  );
}

export function GameHeaderStrip({
  character,
  analyzing,
  showTrace,
  onRunAnalysis,
  onToggleTrace,
  onShare,
  onDelete,
}: Props) {
  const score = character.scoreBreakdown;
  const trend = character.trendAnalysis;

  // GENRE / CORE LOOP / AUDIENCE / KEY MECHANIC.
  // The persisted character model only carries `vertical`; the trend agent
  // surfaces narrative arc / hook type / emotional levers, which are the
  // closest analogues to core loop / mechanic / audience for this dossier.
  const genre = character.vertical || "—";
  const coreLoop = trend?.narrativeArc || "—";
  const audience = trend?.emotionalLevers?.length ? trend.emotionalLevers.join(" · ") : "—";
  const keyMechanic = trend?.hookType || "—";

  const tier: Tier | null = score ? tierFromScore(score.winProbability) : null;

  return (
    <header className="panel-grim px-5 py-3 flex items-start gap-5 sticky top-0 z-30">
      {/* Cover + title + tier */}
      <div className="flex items-center gap-3 shrink-0 min-w-0 max-w-[26%]">
        <div className="h-[120px] w-[120px] rounded-sm overflow-hidden gold-frame shrink-0">
          {character.iconUrl ? (
            <img
              src={character.iconUrl}
              alt={character.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-muted">
              <Skull className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-gradient-gold leading-none truncate">
            {character.name}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 text-base uppercase tracking-widest text-muted-foreground">
            {tier && <TierBadge tier={tier} size="sm" />}
            <span className="truncate">{character.publisher ?? "Unknown publisher"}</span>
            <span className="text-gold-dim">·</span>
            <span>{character.platform.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Metadata strip — non-negotiable: GENRE / CORE LOOP / AUDIENCE / KEY MECHANIC */}
      <div className="flex-1 min-w-0 flex items-stretch panel-grim bg-parchment/60 px-4 py-2">
        <MetaSlot label="Genre" value={genre} />
        <MetaSlot label="Core Loop" value={coreLoop} />
        <MetaSlot label="Audience" value={audience} />
        <MetaSlot label="Key Mechanic" value={keyMechanic} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onRunAnalysis}
          disabled={analyzing}
          className="gold-frame px-2.5 py-1.5 text-base uppercase tracking-widest text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center gap-1.5"
        >
          {analyzing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {analyzing ? "Analyzing…" : "Re-run"}
        </button>
        {(analyzing || character.aiThoughts.length > 0) && (
          <button
            onClick={onToggleTrace}
            className="gold-frame px-2.5 py-1.5 text-base uppercase tracking-widest text-muted-foreground hover:text-gold-bright"
          >
            {showTrace ? "Hide" : "View"} AI
          </button>
        )}
        <button
          onClick={onShare}
          disabled={character.status !== "analyzed"}
          className="gold-frame px-2.5 py-1.5 text-base uppercase tracking-widest text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center gap-1.5"
        >
          <Share2 className="h-3 w-3" /> Share
        </button>
        <button
          onClick={onDelete}
          className="px-2.5 py-1.5 text-base uppercase tracking-widest text-muted-foreground hover:text-destructive flex items-center gap-1.5"
        >
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      </div>
    </header>
  );
}
