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
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-[0.2em] text-gold-dim leading-none">{label}</div>
      <div className="text-base font-normal text-foreground mt-1 leading-snug break-words">
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
    <header className="panel-grim px-5 py-3 flex items-start gap-4 sticky top-0 z-30">
      {/* Icon + title + publisher/platform */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="h-[120px] w-[120px] rounded-xl overflow-hidden gold-frame shrink-0">
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
          <h1 className="font-display text-xl text-gradient-gold leading-none truncate">
            {character.name}
          </h1>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs uppercase tracking-widest text-muted-foreground">
            {tier && <TierBadge tier={tier} size="sm" />}
            <span className="truncate">{character.publisher ?? "Unknown publisher"}</span>
            <span className="text-gold-dim">·</span>
            <span>{character.platform.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="self-stretch w-px bg-border/60 shrink-0" />

      {/* Metadata strip */}
      <div className="flex-1 min-w-0 flex flex-col gap-2.5 py-1">
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
          className="gold-frame px-2.5 py-1.5 text-sm uppercase tracking-widest text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center gap-1.5"
        >
          {analyzing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {analyzing ? "Analyzing…" : "Re-run"}
        </button>
        {character.aiThoughts.length > 0 && !analyzing && (
          <button
            onClick={onToggleTrace}
            className="gold-frame px-2.5 py-1.5 text-sm uppercase tracking-widest text-muted-foreground hover:text-gold-bright"
          >
            {showTrace ? "Hide" : "View"} AI
          </button>
        )}
        <button
          onClick={onShare}
          disabled={character.status !== "analyzed"}
          className="gold-frame px-2.5 py-1.5 text-sm uppercase tracking-widest text-gold-bright hover:bg-gold/10 disabled:opacity-40 flex items-center gap-1.5"
        >
          <Share2 className="h-3 w-3" /> Share
        </button>
        <button
          onClick={onDelete}
          className="px-2.5 py-1.5 text-sm uppercase tracking-widest text-muted-foreground hover:text-destructive flex items-center gap-1.5"
        >
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      </div>
    </header>
  );
}
