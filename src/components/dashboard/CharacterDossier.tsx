import { useState } from "react";
import { X, Target, TrendingUp, Hammer, Images } from "lucide-react";
import type { GameCharacter, CreativeBrief, ThoughtEvent } from "@/lib/types";
import { GameHeaderStrip } from "./GameHeaderStrip";
import { TargetColumn } from "./TargetColumn";
import { TrendsColumn } from "./TrendsColumn";
import { GalleryColumn } from "./GalleryColumn";
import { ForgeViewPanel } from "./ForgeViewPanel";
import { InspiredByTopAdsPanel } from "./InspiredByTopAds";
import { AIThinkingTrace } from "./Panels";
import { BriefBuilderPanel } from "./BriefBuilder";
import { AdCard } from "@/components/AdCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

const TIER_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };

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

  const topAds = [...(character.ads ?? [])]
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 4) - (TIER_ORDER[b.tier] ?? 4))
    .slice(0, 5);

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
          <h3 className="font-display text-sm text-destructive mb-2">Analysis failed</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
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

      <Tabs defaultValue="target" className="flex flex-col gap-0">
        <TabsList>
          <TabsTrigger value="target">
            <Target className="h-3.5 w-3.5" />
            Target · Trend Analysis
          </TabsTrigger>
          <TabsTrigger value="forge">
            <Hammer className="h-3.5 w-3.5" />
            Forge View · Ads
          </TabsTrigger>
          <TabsTrigger value="gallery">
            <Images className="h-3.5 w-3.5" />
            Gallery · Top Ads
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Target + Trend Analysis ─────────────────────── */}
        <TabsContent value="target">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TargetColumn
              breakdown={character.scoreBreakdown}
              topHooks={character.topHooks}
            />
            <TrendsColumn
              breakdown={character.scoreBreakdown}
              trend={character.trendAnalysis}
            />
          </div>
        </TabsContent>

        {/* ── Tab 2: Forge View + Inspired Ads ───────────────────── */}
        <TabsContent value="forge">
          <div className="flex flex-col gap-6">
            <ForgeViewPanel
              breakdown={character.scoreBreakdown}
              forecast={character.revenueForecast}
              trend={character.trendAnalysis}
            />
            <InspiredByTopAdsPanel
              character={character}
              onForge={onGenerateFromBrief}
            />
          </div>
        </TabsContent>

        {/* ── Tab 3: Gallery + Top Ads ────────────────────────────── */}
        <TabsContent value="gallery">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-6">
            <GalleryColumn
              gameId={character.id}
              briefs={character.briefs}
              generations={character.generations}
              gallery={character.gallery}
              generating={generating}
              onGenerateFromBrief={onGenerateFromBrief}
              onComposeBrief={() => setBriefOpen(true)}
            />

            <section className="panel-grim p-6 flex flex-col gap-4">
              <div className="font-display text-sm uppercase tracking-[0.4em] text-gold-dim">
                Top Ads · Similar Games
              </div>
              {topAds.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {topAds.map((ad) => (
                    <AdCard key={ad.id} ad={ad} />
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center border border-dashed border-gold/25 rounded-sm py-12">
                  <p className="text-sm text-muted-foreground italic text-center px-4">
                    Run analysis to surface top ads from similar games.
                  </p>
                </div>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>

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
              <h3 className="font-display text-sm text-foreground">Compose a brief</h3>
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
