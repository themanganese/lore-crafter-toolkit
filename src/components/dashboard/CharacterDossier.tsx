import { useState } from "react";
import { X } from "lucide-react";
import type { GameCharacter, CreativeBrief, ThoughtEvent } from "@/lib/types";
import { GameHeaderStrip } from "./GameHeaderStrip";
import { TargetColumn } from "./TargetColumn";
import { TrendsColumn } from "./TrendsColumn";
import { GalleryColumn } from "./GalleryColumn";
import { ForgeViewPanel } from "./ForgeViewPanel";
import { AIThinkingTrace } from "./Panels";
import { BriefBuilderPanel } from "./BriefBuilder";

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
  const [briefOpen, setBriefOpen] = useState(false);

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
        <TargetColumn breakdown={character.scoreBreakdown} topHooks={character.topHooks} />
        <TrendsColumn breakdown={character.scoreBreakdown} trend={character.trendAnalysis} />
        <GalleryColumn
          gameId={character.id}
          briefs={character.briefs}
          generations={character.generations}
          gallery={character.gallery}
          generating={generating}
          onGenerateFromBrief={onGenerateFromBrief}
          onComposeBrief={() => setBriefOpen(true)}
        />
      </div>

      <ForgeViewPanel
        breakdown={character.scoreBreakdown}
        forecast={character.revenueForecast}
        trend={character.trendAnalysis}
      />

      {briefOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-foreground/40 backdrop-blur-sm"
          onClick={() => setBriefOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto panel-grim bg-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg text-foreground">Compose a brief</h3>
              <button
                onClick={() => setBriefOpen(false)}
                className="h-8 w-8 rounded-sm flex items-center justify-center text-muted-foreground hover:bg-muted/50"
                aria-label="Close brief builder"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <BriefBuilderPanel character={character} onCreated={() => setBriefOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
