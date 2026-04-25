// IndexedDB-backed store for game characters. Local-first, no auth required.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { GameCharacter } from "./types";

interface ForgeDB extends DBSchema {
  characters: {
    key: string;
    value: GameCharacter;
    indexes: { "by-updated": string };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = "creatorforge";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ForgeDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("Store accessed on server — use client only");
  }
  if (!dbPromise) {
    dbPromise = openDB<ForgeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const chars = db.createObjectStore("characters", { keyPath: "id" });
        chars.createIndex("by-updated", "updatedAt");
        db.createObjectStore("settings");
      },
    });
  }
  return dbPromise;
}

export async function listCharacters(): Promise<GameCharacter[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("characters", "by-updated");
  return all.reverse();
}

export async function getCharacter(id: string): Promise<GameCharacter | undefined> {
  const db = await getDB();
  return db.get("characters", id);
}

export async function saveCharacter(c: GameCharacter): Promise<void> {
  const db = await getDB();
  c.updatedAt = new Date().toISOString();
  await db.put("characters", c);
  // Notify listeners
  window.dispatchEvent(new CustomEvent("forge:characters-changed"));
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("characters", id);
  window.dispatchEvent(new CustomEvent("forge:characters-changed"));
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get("settings", key)) as T | undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put("settings", value as unknown, key);
}
