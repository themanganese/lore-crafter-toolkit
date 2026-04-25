import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Loader2, Flame, ArrowRight, Skull } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { searchGames } from "@/lib/server.functions";
import { saveCharacter } from "@/lib/store";
import { useCharacters } from "@/hooks/use-characters";
import type { GameCharacter } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forge — CreatorForge" },
      {
        name: "description",
        content:
          "Search any mobile game and forge a character sheet of its winning ad patterns.",
      },
    ],
  }),
  component: ForgePage,
});

function ForgePage() {
  const navigate = useNavigate();
  const search = useServerFn(searchGames);
  const { characters } = useCharacters();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<
    { externalId: string; platform: "ios" | "android"; name: string; publisher?: string; iconUrl?: string; vertical?: string }[]
  >([]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await search({ data: { query: query.trim() } });
      if (r.error) toast.error(r.error);
      setResults(r.results);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function summon(result: typeof results[number]) {
    const id = crypto.randomUUID();
    const character: GameCharacter = {
      id,
      externalId: result.externalId,
      platform: result.platform,
      name: result.name,
      publisher: result.publisher,
      vertical: result.vertical ?? "",
      iconUrl: result.iconUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "draft",
      ads: [],
      stats: [],
      topHooks: [],
      codex: [],
      briefs: [],
      generations: [],
    };
    await saveCharacter(character);
    navigate({ to: "/character/$gameId", params: { gameId: id } });
  }

  return (
    <div className="px-10 py-12 max-w-6xl mx-auto">
      <header className="text-center mb-12">
        <Flame className="h-10 w-10 text-gold mx-auto mb-4 ember-flicker" />
        <h1 className="font-display text-5xl text-gradient-gold mb-3">The Forge</h1>
        <p className="font-mono text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Name a competitor. We summon its top ads, divine its winning patterns,
          and inscribe a character sheet you can wield.
        </p>
      </header>

      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-10">
        <div className="panel-grim rounded-sm flex items-center gap-2 p-2">
          <Search className="h-5 w-5 text-gold ml-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a mobile game (e.g. Royal Match, Raid: Shadow Legends)…"
            className="flex-1 bg-transparent outline-none px-2 py-2 text-foreground font-body placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="gold-frame px-5 py-2 font-display tracking-wider text-gold-bright hover:bg-gold/10 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>Scry</span>
            )}
          </button>
        </div>
        <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Powered by SensorTower Ad Intelligence
        </p>
      </form>

      {results.length > 0 && (
        <section className="mb-12">
          <h2 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-4">
            Candidates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {results.map((r) => (
              <button
                key={`${r.platform}-${r.externalId}`}
                onClick={() => summon(r)}
                className="panel-grim p-4 flex items-center gap-3 text-left hover:border-gold/60 transition-colors group"
              >
                <div className="h-12 w-12 rounded-sm overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
                  {r.iconUrl ? (
                    <img src={r.iconUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Skull className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base text-foreground truncate">
                    {r.name}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground truncate">
                    {r.publisher ?? "Unknown publisher"} · {r.platform.toUpperCase()}
                    {r.vertical ? ` · ${r.vertical}` : ""}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gold opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </section>
      )}

      {characters.length > 0 && (
        <section>
          <h2 className="font-display text-xs uppercase tracking-[0.3em] text-gold-dim mb-4">
            Your Roster
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.slice(0, 9).map((c) => (
              <button
                key={c.id}
                onClick={() => navigate({ to: "/character/$gameId", params: { gameId: c.id } })}
                className="panel-grim p-4 text-left hover:border-gold/60 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-sm overflow-hidden bg-muted border border-border shrink-0">
                    {c.iconUrl ? (
                      <img src={c.iconUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Skull className="h-5 w-5 m-auto mt-2 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm truncate">{c.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate">
                      {c.vertical || "—"}
                    </div>
                  </div>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim">
                  {c.status === "analyzed"
                    ? `${c.stats.length} stats · ${c.ads.length} ads`
                    : c.status}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
