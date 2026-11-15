import type { Pokemon } from "./types";

/** Sentinel dex number for the "We Live We Love We Lie" smurf, kept clear of real species. */
export const SMURF_DEX = 10002;

/** Roughly one in six wild spawns is a Smurf. */
export const SMURF_CHANCE = 0.18;

export const SMURF: Pokemon = {
  dex: SMURF_DEX,
  name: "Smurf",
  type1: "water",
  type2: "fairy",
  atk: 188,
  def: 172,
  stm: 210,
  bst: 570,
  rarity: 4,
  sprite: "smurf.svg",
};

export function isSmurf(p: { dex: number } | null | undefined): boolean {
  return p?.dex === SMURF_DEX;
}
