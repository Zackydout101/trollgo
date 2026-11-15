import type { Pokemon } from "./types";
import { SMURF } from "./smurf";
import { WOODEN_WATCHMAN } from "./watchman";

/** Walk on the map, dance in the catch scene, attack in the arena. */
export type CritterClip = "walking" | "dancing" | "attacking";

export interface ClipPaint {
  /** Bottom of the body. */
  low: string;
  /** Middle. */
  mid: string;
  /** Top. */
  high: string;
}

/** A character that ships as one GLB per clip, same layout as the smurf. */
export interface ClipCritter {
  dex: number;
  urls: Record<CritterClip, string>;
  clips: Record<CritterClip, string>;
  /** Missing when the GLB already has a texture. */
  paint?: ClipPaint;
  /** Placeholder capsule color. */
  color: string;
}

export const SHINOBI_DEX = 10003;
export const MOSSFOOT_DEX = 10004;
export const SHARK_DEX = 10005;
export const PATAPIM_DEX = 10006;
export const JAKE_DEX = 10007;
export const SULLEY_DEX = 10008;

export const COFFEE_SHINOBI: Pokemon = {
  dex: SHINOBI_DEX,
  name: "Coffee Shinobi",
  type1: "fighting",
  type2: "dark",
  atk: 232,
  def: 164,
  stm: 168,
  bst: 564,
  rarity: 3,
  sprite: "coffee-shinobi.svg",
};

export const MOSSFOOT: Pokemon = {
  dex: MOSSFOOT_DEX,
  name: "Mossfoot Wanderer",
  type1: "grass",
  type2: "ground",
  atk: 176,
  def: 198,
  stm: 204,
  bst: 578,
  rarity: 3,
  sprite: "mossfoot.svg",
};

export const PATAPIM: Pokemon = {
  dex: PATAPIM_DEX,
  name: "Brr Brr Patapim",
  type1: "grass",
  type2: "fairy",
  atk: 168,
  def: 142,
  stm: 190,
  bst: 500,
  rarity: 3,
  sprite: "patapim.svg",
};

export const JAKE: Pokemon = {
  dex: JAKE_DEX,
  name: "Jake",
  type1: "normal",
  type2: "flying",
  atk: 186,
  def: 154,
  stm: 176,
  bst: 516,
  rarity: 3,
  sprite: "jake.svg",
};

export const SULLEY: Pokemon = {
  dex: SULLEY_DEX,
  name: "Sulley",
  type1: "normal",
  type2: "fairy",
  atk: 210,
  def: 188,
  stm: 220,
  bst: 618,
  rarity: 4,
  sprite: "sulley.svg",
};

export const SNEAKER_SHARK: Pokemon = {
  dex: SHARK_DEX,
  name: "Sneaker Shark",
  type1: "water",
  type2: "dark",
  atk: 218,
  def: 150,
  stm: 158,
  bst: 526,
  rarity: 4,
  sprite: "sneaker-shark.svg",
};

/** Every wild encounter. No Pokémon — only these animated characters. */
export const CRITTERS: Pokemon[] = [
  WOODEN_WATCHMAN,
  SMURF,
  COFFEE_SHINOBI,
  MOSSFOOT,
  SNEAKER_SHARK,
  PATAPIM,
  JAKE,
  SULLEY,
];

const SHARK_CLIP = "Armature|Unreal Take|baselayer";

export const CLIP_CRITTERS: Record<number, ClipCritter> = {
  [SHINOBI_DEX]: {
    dex: SHINOBI_DEX,
    urls: {
      walking: "/models/shinobi-walk.glb",
      dancing: "/models/shinobi-dance.glb",
      attacking: "/models/shinobi-attack.glb",
    },
    clips: { walking: "Walking", dancing: "Idle_10", attacking: "Triple_Combo_Attack" },
    paint: { low: "#2a1810", mid: "#8a5a32", high: "#e4c39a" },
    color: "#8a5a32",
  },
  [MOSSFOOT_DEX]: {
    dex: MOSSFOOT_DEX,
    urls: {
      walking: "/models/mossfoot-walk.glb",
      dancing: "/models/mossfoot-dance.glb",
      attacking: "/models/mossfoot-attack.glb",
    },
    clips: { walking: "Walking", dancing: "Idle_3", attacking: "Basic_Jump" },
    paint: { low: "#1c3320", mid: "#3f7a46", high: "#d5e2ae" },
    color: "#3f7a46",
  },
  [SHARK_DEX]: {
    dex: SHARK_DEX,
    urls: {
      walking: "/models/shark-walk.glb",
      dancing: "/models/shark-walk.glb",
      attacking: "/models/shark-walk.glb",
    },
    clips: { walking: SHARK_CLIP, dancing: SHARK_CLIP, attacking: SHARK_CLIP },
    paint: { low: "#f4f7fb", mid: "#3e627c", high: "#1a3144" },
    color: "#3e627c",
  },
  [PATAPIM_DEX]: {
    dex: PATAPIM_DEX,
    urls: {
      walking: "/models/patapim-walk.glb",
      dancing: "/models/patapim-walk.glb",
      attacking: "/models/patapim-walk.glb",
    },
    clips: { walking: "mixamo.com", dancing: "mixamo.com", attacking: "mixamo.com" },
    color: "#c45a8a",
  },
  [JAKE_DEX]: {
    dex: JAKE_DEX,
    urls: {
      walking: "/models/jake-walk.glb",
      dancing: "/models/jake-walk.glb",
      attacking: "/models/jake-walk.glb",
    },
    clips: { walking: "mixamo.com", dancing: "mixamo.com", attacking: "mixamo.com" },
    color: "#e6c15a",
  },
  [SULLEY_DEX]: {
    dex: SULLEY_DEX,
    urls: {
      walking: "/models/sulley-walk.glb",
      dancing: "/models/sulley-walk.glb",
      attacking: "/models/sulley-walk.glb",
    },
    clips: { walking: "mixamo.com", dancing: "mixamo.com", attacking: "mixamo.com" },
    color: "#4aa3c8",
  },
};

export function isCritter(p: { dex: number } | null | undefined): boolean {
  return !!p && CRITTERS.some((c) => c.dex === p.dex);
}

export function critterByDex(dex: number): Pokemon | undefined {
  return CRITTERS.find((c) => c.dex === dex);
}

/** Pokédex lookup that resolves the animated cast, which is not in pokemon.json. */
export function speciesOf(pool: Pokemon[], dex: number): Pokemon | undefined {
  return pool.find((p) => p.dex === dex) ?? critterByDex(dex);
}
