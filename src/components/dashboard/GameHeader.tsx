import type { ReactNode } from "react";
import { Skull, Sword, Shield, Crown, Sparkles, Target, Coins, TrendingUp } from "lucide-react";
import type { GameCharacter, Tier } from "@/lib/types";
import { TierBadge } from "@/components/TierBadge";

interface GameHeaderProps {
  character: GameCharacter;
}

// Assassin's Creed-style hero header: game icon dead-center under spotlight,
// flanking equipment slots show key stats like a character's gear.
export function GameHeader({ character }: GameHeaderProps) {
  const score = character.scoreBreakdown;
  const trend = character.trendAnalysis;
  const revenue = character.revenueForecast;

  // Left equipment slots — what makes them strong
  const left: SlotData[] = [
    {
      label: "Top Hook",
      value: character.topHooks[0]?.label ?? "—",
      icon: <Sword className="h-5 w-5" />,
      tier: character.topHooks[0]?.tier,
    },
    {
      label: "Hook Strength",
      value: score?.dimensions.find((d) => d.key === "hook_strength")?.value ?? "—",
      icon: <Target className="h-5 w-5" />,
    },
    {
      label: "Visual Novelty",
      value: score?.dimensions.find((d) => d.key === "visual_novelty")?.value ?? "—",
      icon: <Sparkles className="h-5 w-5" />,
    },
  ];

  // Right equipment slots — outcomes / advantage
  const right: SlotData[] = [
    {
      label: "Win Probability",
      value: score ? `${score.winProbability}` : "—",
      icon: <Crown className="h-5 w-5" />,
      suffix: score ? "/100" : "",
    },
    {
      label: "Differentiation",
      value: score?.dimensions.find((d) => d.key === "differentiation")?.value ?? "—",
      icon: <Shield className="h-5 w-5" />,
    },
    {
      label: revenue ? "Monthly USD" : "Confidence",
      value: revenue
        ? `$${Math.round(revenue.baselineMonthlyUsd / 1000)}k`
        : (score?.confidence ?? "—").toString(),
      icon: revenue ? <Coins className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />,
    },
  ];

  return (
    <div className="relative panel-grim hero-spotlight overflow-hidden">
      {/* Top banner */}
      <div className="px-6 pt-5 pb-3 border-b border-border/60">
        <div className="flex items-center justify-center gap-4 font-display text-xs uppercase tracking-[0.4em] text-gold-dim">
          <span className="opacity-60">Forge</span>
          <span className="text-gold-bright">Character</span>
          <span className="opacity-60">Dossier</span>
        </div>
        <div className="ornate-rule mt-3" />
      </div>

      {/* Hero row: left slots — icon — right slots */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-8 px-6 py-8 items-center">
        {/* Left equipment column */}
        <div className="grid grid-cols-3 md:grid-cols-1 gap-3 md:gap-4 order-2 md:order-1">
          {left.map((s, i) => (
            <EquipmentSlot key={`l${i}`} {...s} align="right" />
          ))}
        </div>

        {/* Center character */}
        <div className="flex flex-col items-center order-1 md:order-2 min-w-0">
          <div className="relative h-32 w-32 md:h-40 md:w-40 rounded-md overflow-hidden gold-frame-strong shrink-0">
            {character.iconUrl ? (
              <img
                src={character.iconUrl}
                alt={character.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-muted">
                <Skull className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            {score && (
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                <TierBadge
                  tier={
                    score.winProbability >= 80
                      ? "S"
                      : score.winProbability >= 65
                      ? "A"
                      : score.winProbability >= 50
                      ? "B"
                      : score.winProbability >= 35
                      ? "C"
                      : "D"
                  }
                  size="md"
                />
              </div>
            )}
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-gradient-gold mt-6 text-center px-2 truncate max-w-full">
            {character.name}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex-wrap justify-center">
            <span>{character.publisher ?? "Unknown publisher"}</span>
            <span>·</span>
            <span>{character.platform.toUpperCase()}</span>
            {character.vertical && (
              <>
                <span>·</span>
                <span className="text-gold-dim">{character.vertical}</span>
              </>
            )}
          </div>
          {trend?.differentiationAngle && (
            <p className="font-mono text-[11px] text-foreground/70 italic max-w-md text-center mt-3 leading-relaxed">
              "{trend.differentiationAngle}"
            </p>
          )}
        </div>

        {/* Right equipment column */}
        <div className="grid grid-cols-3 md:grid-cols-1 gap-3 md:gap-4 order-3">
          {right.map((s, i) => (
            <EquipmentSlot key={`r${i}`} {...s} align="left" />
          ))}
        </div>
      </div>

      {/* Bottom stats strip — like AC's HEALTH / DAMAGE / ARMOR row */}
      {score && (
        <>
          <div className="ornate-rule" />
          <div className="grid grid-cols-3 md:grid-cols-5 gap-px bg-gold/15">
            {score.dimensions.map((d) => (
              <div
                key={d.key}
                className="bg-card px-3 py-3 text-center"
              >
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  {d.label}
                </div>
                <div className="font-display text-xl text-foreground tabular-nums mt-0.5">
                  {d.value}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface SlotData {
  label: string;
  value: string | number;
  icon: ReactNode;
  tier?: import("@/lib/types").Tier;
  suffix?: string;
}

import type { ReactNode } from "react";

function EquipmentSlot({
  label,
  value,
  icon,
  tier,
  suffix,
  align,
}: SlotData & { align: "left" | "right" }) {
  return (
    <div
      className={`equip-slot p-3 flex items-center gap-3 ${
        align === "right" ? "md:flex-row-reverse md:text-right" : ""
      }`}
    >
      <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-sm bg-gold/10 text-gold-bright">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground truncate">
          {label}
        </div>
        <div className="font-display text-sm text-foreground truncate">
          {value}
          {suffix && <span className="text-muted-foreground text-xs ml-0.5">{suffix}</span>}
        </div>
      </div>
      {tier && <TierBadge tier={tier} size="sm" />}
    </div>
  );
}
