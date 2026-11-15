import type { Pokemon } from "./types";

/** Sentinel dex number so the watchman can be caught without colliding with real species. */
export const WATCHMAN_DEX = 10001;

/** Roughly one in three wild spawns is a Wooden Watchman. */
export const WATCHMAN_CHANCE = 0.34;

export const WOODEN_WATCHMAN: Pokemon = {
  dex: WATCHMAN_DEX,
  name: "Wooden Watchman",
  type1: "ground",
  type2: "grass",
  atk: 210,
  def: 196,
  stm: 180,
  bst: 586,
  rarity: 4,
  sprite: "wooden-watchman.svg",
};

export function isWatchman(p: { dex: number } | null | undefined): boolean {
  return p?.dex === WATCHMAN_DEX;
}

/** Pokédex lookup that also resolves the Wooden Watchman, which is not in pokemon.json. */
export function speciesOrWatchman(pool: Pokemon[], dex: number): Pokemon | undefined {
  return pool.find((p) => p.dex === dex) ?? (dex === WATCHMAN_DEX ? WOODEN_WATCHMAN : undefined);
}
