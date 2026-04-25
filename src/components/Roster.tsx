import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Flame, Plus, Skull } from "lucide-react";
import { useCharacters } from "@/hooks/use-characters";
import { cn } from "@/lib/utils";
import { TIER_TEXT } from "@/lib/tier";

export function Roster() {
  const { characters, loading } = useCharacters();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col h-screen sticky top-0">
      <button
        onClick={() => navigate({ to: "/" })}
        className="px-5 py-5 border-b border-border text-left group"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-gold ember-flicker" />
          <span className="font-display text-lg tracking-wider text-gradient-gold">
            CreatorForge
          </span>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
          Ad Intel × Anvil
        </p>
      </button>

      <Link
        to="/"
        className="mx-3 mt-3 px-3 py-2 flex items-center gap-2 gold-frame text-gold-bright text-sm font-display tracking-wide hover:bg-gold/10 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Forge new character
      </Link>

      <div className="px-4 mt-5 mb-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Roster
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {loading && (
          <div className="px-3 py-2 text-xs text-muted-foreground font-mono">Awakening…</div>
        )}
        {!loading && characters.length === 0 && (
          <div className="px-3 py-6 text-center">
            <Skull className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-xs text-muted-foreground font-mono leading-relaxed">
              No souls have been<br />analyzed yet.
            </p>
          </div>
        )}
        {characters.map((c) => {
          const active = location.pathname.startsWith(`/character/${c.id}`);
          const topTier = c.stats[0]?.tier ?? "C";
          return (
            <Link
              key={c.id}
              to="/character/$gameId"
              params={{ gameId: c.id }}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-sm border border-transparent transition-all group",
                active
                  ? "border-gold/50 bg-gold/10"
                  : "hover:border-border hover:bg-muted/40"
              )}
            >
              <div className="h-9 w-9 rounded-sm overflow-hidden bg-muted shrink-0 border border-border flex items-center justify-center">
                {c.iconUrl ? (
                  <img src={c.iconUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Skull className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm truncate text-foreground">{c.name}</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground truncate">
                    {c.vertical || "—"}
                  </span>
                  {c.status === "analyzed" && c.stats.length > 0 && (
                    <span className={cn("font-display text-xs", TIER_TEXT[topTier])}>
                      {topTier}
                    </span>
                  )}
                  {c.status === "scrying" && (
                    <span className="font-mono text-[10px] text-ember ember-flicker">
                      scrying…
                    </span>
                  )}
                  {c.status === "error" && (
                    <span className="font-mono text-[10px] text-destructive">err</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <Link
        to="/settings"
        className="px-5 py-3 border-t border-border font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        Settings
      </Link>
    </aside>
  );
}
