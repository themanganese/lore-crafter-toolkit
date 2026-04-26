import type { GameCharacter, CreativeBrief, ThoughtEvent } from "@/lib/types";
import { GameHeaderStrip } from "./GameHeaderStrip";
import { TargetColumn } from "./TargetColumn";
import { TrendsColumn } from "./TrendsColumn";
import { GalleryColumn } from "./GalleryColumn";
import { ForgeViewPanel } from "./ForgeViewPanel";
import { AIThinkingTrace } from "./Panels";

interface Props {
  character: GameCharacter;
  analyzing: boolean;
  generating: boolean;
  showTrace: boolean;
  liveEvents: ThoughtEvent[];
  onRunAnalysis: () => void;
  onToggleTrace: () => void;
  onShare: () => void;
  onDelete: () => void;
  onGenerateFromBrief: (brief: CreativeBrief) => void;
}

export function CharacterDossier({
  character,
  analyzing,
  generating,
  showTrace,
  liveEvents,
  onRunAnalysis,
  onToggleTrace,
  onShare,
  onDelete,
  onGenerateFromBrief,
}: Props) {
  return (
    <div className="px-6 py-4 flex flex-col gap-5 min-h-screen">
      <GameHeaderStrip
        character={character}
        analyzing={analyzing}
        showTrace={showTrace}
        onRunAnalysis={onRunAnalysis}
        onToggleTrace={onToggleTrace}
        onShare={onShare}
        onDelete={onDelete}
      />

      {character.status === "error" && (
        <div className="panel-grim p-5 border-l-4 border-l-destructive/70">
          <h3 className="font-display text-lg text-destructive mb-2">Analysis failed</h3>
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">
            {character.errorMessage}
          </p>
          <button
            onClick={onRunAnalysis}
            className="mt-3 gold-frame px-4 py-2 font-display text-gold-bright hover:bg-gold/10"
          >
            Try again
          </button>
        </div>
      )}

      {(showTrace || analyzing) && (
        <AIThinkingTrace
          events={analyzing ? liveEvents : character.aiThoughts}
          active={analyzing}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[480px]">
        <TargetColumn
          breakdown={character.scoreBreakdown}
          topHooks={character.topHooks}
          trend={character.trendAnalysis}
        />
        <TrendsColumn
          breakdown={character.scoreBreakdown}
          trend={character.trendAnalysis}
          forecast={character.revenueForecast}
        />
        <GalleryColumn
          character={character}
          gameId={character.id}
          ads={character.ads}
          trend={character.trendAnalysis}
          briefs={character.briefs}
          generations={character.generations}
          gallery={character.gallery}
          generating={generating}
          onGenerateFromBrief={onGenerateFromBrief}
        />
      </div>

      <ForgeViewPanel
        breakdown={character.scoreBreakdown}
        forecast={character.revenueForecast}
        trend={character.trendAnalysis}
      />
    </div>
  );
}
