import { useEffect, useState, useCallback } from "react";
import { listCharacters, getCharacter } from "@/lib/store";
import type { GameCharacter } from "@/lib/types";

export function useCharacters() {
  const [characters, setCharacters] = useState<GameCharacter[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await listCharacters();
    setCharacters(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("forge:characters-changed", handler);
    return () => window.removeEventListener("forge:characters-changed", handler);
  }, [refresh]);

  return { characters, loading, refresh };
}

export function useCharacter(id: string | undefined) {
  const [character, setCharacter] = useState<GameCharacter | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) {
      setCharacter(null);
      setLoading(false);
      return;
    }
    const c = await getCharacter(id);
    setCharacter(c ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("forge:characters-changed", handler);
    return () => window.removeEventListener("forge:characters-changed", handler);
  }, [refresh]);

  return { character, loading, refresh };
}
