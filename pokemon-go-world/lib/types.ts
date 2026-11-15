export interface Pokemon {
  dex: number;
  name: string;
  type1: string;
  type2: string | null;
  atk: number;
  def: number;
  stm: number;
  bst: number;
  /** 1 (common) .. 5 (legendary-ish) */
  rarity: number;
  /** sprite file name inside /sprites */
  sprite: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Spawn {
  id: string;
  pokemon: Pokemon;
  pos: LatLng;
  /** epoch ms when the spawn disappears */
  expiresAt: number;
  /** combat power rolled for this wild encounter */
  cp: number;
  /** level rolled for this wild encounter */
  level: number;
}

export interface CaughtMon {
  id: string;
  dex: number;
  name: string;
  sprite: string;
  cp: number;
  level: number;
  caughtAt: number;
  /** Points banked in the training grounds. Every 80 points is a level. */
  trainingPoints?: number;
}

export type BallType = "pokeball" | "greatball" | "ultraball";

export interface Inventory {
  pokeball: number;
  greatball: number;
  ultraball: number;
  razz: number;
  incense: number;
}

export interface PokeStop {
  id: string;
  name: string;
  pos: LatLng;
  kind: "stop" | "gym";
  /** epoch ms when it can be spun again (0 = ready) */
  cooldownUntil: number;
}

export interface Trainer {
  level: number;
  xp: number;
  stardust: number;
  distanceWalked: number; // meters
  totalCaught: number;
  totalSpins: number;
  /** candy count per pokedex number */
  candy: Record<number, number>;
}

export interface SaveState {
  trainer: Trainer;
  inventory: Inventory;
  caught: CaughtMon[];
}

/** Throw quality, based on how small the colored ring was when the ball hit. */
export type ThrowBonus = "none" | "nice" | "great" | "excellent";
