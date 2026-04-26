import { HelpCircle } from "lucide-react";
import type { ScoreBreakdown, RevenueForecast, TrendAnalysis } from "@/lib/types";
import { RevenueForecastChart } from "@/components/charts/RevenueForecastChart";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  breakdown?: ScoreBreakdown;
  forecast?: RevenueForecast;
  trend?: TrendAnalysis;
}

const MINI_STAT_DEFS: Record<string, string> = {
  "Top Hook":
    "The primary creative hook type driving highest ad retention in similar games — e.g. Curiosity Gap, Social Proof, Emotional Pull, or Urgency.",
  "Narrative Arc":
    "The story structure used in top-performing ads — e.g. Problem → Solution, Transformation Journey, or Epic Origin.",
  "Emotional Levers":
    "Psychological triggers activated to motivate viewer action — e.g. Fear of Missing Out, Pride, Nostalgia, or Competitive Drive.",
  "Recommended Lead":
    "The highest-signal rising pattern recommended as your first-frame creative hook based on current trend velocity.",
};

function MiniStat({ label, value }: { label: string; value: string }) {
  const def = MINI_STAT_DEFS[label];
  return (
    <div className="flex-1 min-w-0 px-3 first:pl-0 last:pr-0 border-r border-gold/20 last:border-r-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-default w-fit">
            <div className="text-sm uppercase tracking-[0.25em] text-gold-dim">
              {label}
            </div>
            {def && <HelpCircle className="h-2.5 w-2.5 text-gold-dim/60 shrink-0" />}
          </div>
        </TooltipTrigger>
        {def && (
          <TooltipContent
            side="top"
            className="max-w-64 text-sm leading-snug bg-card border border-gold/50 text-foreground shadow-lg"
          >
            {def}
          </TooltipContent>
        )}
      </Tooltip>
      <div className="font-display text-sm text-foreground mt-0.5 truncate">{value}</div>
    </div>
  );
}

const LEVER_DEF =
  "An improvement action with estimated score impact. Hover the title to see the full description and trend signal.";

export function ForgeViewPanel({ breakdown, forecast, trend }: Props) {
  const angle =
    trend?.differentiationAngle ||
    breakdown?.claudeRead ||
    "Strategic synthesis pending — re-run analysis to forge a differentiation angle.";

  const topHook = trend?.hookType || "—";
  const arc = trend?.narrativeArc || "—";
  const levers = trend?.emotionalLevers?.join(" · ") || "—";

  const lead =
    trend?.whatIsWorking?.find((p) => p.tag === "lead")?.pattern ??
    trend?.whatIsWorking?.[0]?.pattern ??
    "—";

  const topLevers = breakdown?.levers?.slice(0, 3) ?? [];

  return (
    <TooltipProvider delayDuration={300}>
      <section className="panel-grim p-6 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        {/* Left: synthesis + revenue */}
        <div className="flex flex-col gap-4 min-w-0">
          <div>
            <div className="font-display text-sm uppercase tracking-[0.4em] text-gold-dim">
              Forge View · Differentiation Angle
            </div>
            <p
              className="mt-2 font-display italic text-foreground/90 leading-relaxed"
              style={{
                fontSize: 23,
                lineHeight: 1.6,
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              "{angle}"
            </p>
          </div>

          {forecast ? (
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-sm uppercase tracking-[0.25em] text-gold-dim mb-1 flex items-center gap-1 cursor-default w-fit">
                    Revenue Forecast · Day 0 → 90
                    <HelpCircle className="h-2.5 w-2.5 text-gold-dim/60" />
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-64 text-sm leading-snug bg-card border border-gold/50 text-foreground shadow-lg"
                >
                  Projected monthly revenue at Day 30, 60, and 90 based on SensorTower actuals
                  and applied assumptions. Hover data points for assumption details and confidence
                  bands.
                </TooltipContent>
              </Tooltip>
              <RevenueForecastChart forecast={forecast} />
            </div>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground italic border border-dashed border-gold/25 rounded-sm">
              Revenue forecast pending.
            </div>
          )}

          <div className="flex items-stretch panel-grim bg-parchment/60 px-4 py-2.5">
            <MiniStat label="Top Hook" value={topHook} />
            <MiniStat label="Narrative Arc" value={arc} />
            <MiniStat label="Emotional Levers" value={levers} />
            <MiniStat label="Recommended Lead" value={lead} />
          </div>
        </div>

        {/* Right: improvement levers */}
        <div className="flex flex-col gap-3 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="font-display text-sm uppercase tracking-[0.4em] text-gold-dim flex items-center gap-1 cursor-default w-fit">
                Improvement Levers
                <HelpCircle className="h-2.5 w-2.5 text-gold-dim/60" />
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-64 text-sm leading-snug bg-card border border-gold/50 text-foreground shadow-lg"
            >
              {LEVER_DEF}
            </TooltipContent>
          </Tooltip>

          {topLevers.length > 0 ? (
            <div className="flex flex-col gap-2">
              {topLevers.map((l) => (
                <Tooltip key={l.id}>
                  <TooltipTrigger asChild>
                    <div className="flex items-start gap-3 p-3 border border-gold/30 rounded-sm bg-muted/15 cursor-default">
                      <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-sm gold-frame">
                        <span className="font-display text-sm text-gold-bright tabular-nums">
                          +{l.estimatedPointDelta}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p className="font-display text-sm text-foreground leading-tight">
                            {l.title}
                          </p>
                          {l.trendVelocity && (
                            <span
                              className={cn(
                                "text-sm uppercase tracking-widest px-1.5 py-0.5 rounded-sm border",
                                l.trendVelocity === "rising" &&
                                  "bg-gold-bright/15 text-gold-bright border-gold-bright/40",
                                l.trendVelocity === "stable" &&
                                  "bg-iron/30 text-foreground/70 border-iron/40",
                                l.trendVelocity === "declining" &&
                                  "bg-destructive/12 text-destructive border-destructive/40",
                              )}
                            >
                              {l.trendVelocity}
                            </span>
                          )}
                        </div>
                        <p
                          className="mt-0.5 text-sm text-muted-foreground leading-snug"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {l.description}
                        </p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    className="max-w-72 text-sm leading-snug bg-card border border-gold/50 text-foreground shadow-lg"
                  >
                    <p className="font-display text-sm font-bold mb-1">{l.title}</p>
                    <p>{l.description}</p>
                    {l.patternAffected && (
                      <p className="mt-1 text-sm text-gold-dim uppercase tracking-widest">
                        Pattern · {l.patternAffected}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No levers surfaced. Re-run analysis to derive improvement paths.
            </p>
          )}
        </div>
      </section>
    </TooltipProvider>
  );
}
