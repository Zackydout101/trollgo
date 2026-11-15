import type { BallType, LatLng, PokeStop, Pokemon, ThrowBonus } from "./types";

export const EARTH_RADIUS = 6378137; // meters

/** Distance in meters between two lat/lng points (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Move a point by meters north (dy) and meters east (dx). */
export function offsetMeters(origin: LatLng, dx: number, dy: number): LatLng {
  const dLat = dy / EARTH_RADIUS;
  const dLng = dx / (EARTH_RADIUS * Math.cos(toRad(origin.lat)));
  return {
    lat: origin.lat + (dLat * 180) / Math.PI,
    lng: origin.lng + (dLng * 180) / Math.PI,
  };
}

/** Random point within [minR, maxR] meters of origin. */
export function randomPointAround(
  origin: LatLng,
  minR: number,
  maxR: number
): LatLng {
  const bearing = Math.random() * 2 * Math.PI;
  const dist = minR + Math.random() * (maxR - minR);
  return offsetMeters(
    origin,
    Math.cos(bearing) * dist,
    Math.sin(bearing) * dist
  );
}

/**
 * Pick a wild Pokemon weighted so common mons appear far more often than
 * rare/legendary ones. Weight falls off sharply with rarity.
 */
export function pickWild(pool: Pokemon[]): Pokemon {
  const weights = pool.map((p) => 1 / Math.pow(6, p.rarity - 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

const CPM = (level: number) => 0.094 + (level - 1) * 0.015;

/** CP for a given Pokemon at a given level (perfect IVs assumed = +15). */
export function cpAtLevel(p: Pokemon, level: number): number {
  const cpm = CPM(level);
  return Math.max(
    10,
    Math.floor(
      ((p.atk + 15) *
        Math.sqrt(p.def + 15) *
        Math.sqrt(p.stm + 15) *
        cpm *
        cpm) /
        10
    )
  );
}

/** Roll a wild encounter level based on trainer level, returns {level, cp}. */
export function rollWild(p: Pokemon, trainerLevel: number): { level: number; cp: number } {
  const max = Math.min(30, 5 + trainerLevel * 1.5);
  const level = Math.max(1, Math.round(1 + Math.random() * (max - 1)));
  return { level, cp: cpAtLevel(p, level) };
}

export const BALL_MULT: Record<BallType, number> = {
  pokeball: 1,
  greatball: 1.5,
  ultraball: 2,
};

export const BONUS_MULT: Record<ThrowBonus, number> = {
  none: 1,
  nice: 1.15,
  great: 1.5,
  excellent: 1.85,
};

export const BONUS_XP: Record<ThrowBonus, number> = {
  none: 0,
  nice: 10,
  great: 50,
  excellent: 100,
};

/** Catch probability given ball type, razz berry and throw quality. */
export function catchChance(
  p: Pokemon,
  cp: number,
  ball: BallType,
  razz: boolean,
  bonus: ThrowBonus = "none"
): number {
  const base = 0.85 - (p.rarity - 1) * 0.13;
  const cpPenalty = Math.min(0.4, cp / 8000);
  const chance =
    (base - cpPenalty) * BALL_MULT[ball] * (razz ? 1.4 : 1) * BONUS_MULT[bonus];
  return clamp(chance, 0.05, 0.98);
}

/** Color of the catch ring: green (easy) → yellow → orange → red (hard). */
export function ringColor(chance: number): string {
  if (chance > 0.66) return "#3cf06a";
  if (chance > 0.45) return "#f5e33b";
  if (chance > 0.25) return "#ff9a2e";
  return "#ff3b3b";
}

// --- trainer leveling -----------------------------------------------------
/** Total cumulative XP needed to be AT the start of a given level. */
export function xpForLevel(level: number): number {
  // smooth quadratic curve: lvl2=1000, lvl3=3000, lvl4=6000, ...
  const n = level - 1;
  return 500 * n * (n + 1);
}

export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (xp >= xpForLevel(lvl + 1) && lvl < 50) lvl++;
  return lvl;
}

export const XP = {
  catch: 100,
  newDex: 500,
  spin: 50,
  curveball: 20,
};

/** Fallback stops for places where the map has no named points of interest. */
export function randomStops(center: LatLng, n = 12): PokeStop[] {
  return Array.from({ length: n }, (_, i) => {
    const isGym = i % 5 === 0;
    return {
      id: "rand-" + i + "-" + Math.random().toString(36).slice(2, 6),
      name: isGym ? "Gym" : "PokéStop",
      pos: randomPointAround(center, 40, 400),
      kind: isGym ? ("gym" as const) : ("stop" as const),
      cooldownUntil: 0,
    };
  });
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export const TYPE_COLORS: Record<string, string> = {
  normal: "#9fa19f",
  fire: "#e62829",
  water: "#2980ef",
  electric: "#fac000",
  grass: "#3fa129",
  ice: "#3dcef3",
  fighting: "#ff8000",
  poison: "#9141cb",
  ground: "#915121",
  flying: "#81b9ef",
  psychic: "#ef4179",
  bug: "#91a119",
  rock: "#afa981",
  ghost: "#704170",
  dragon: "#5060e1",
  dark: "#50413f",
  steel: "#60a1b8",
  fairy: "#ef70ef",
};

export function typeColor(type: string | null | undefined): string {
  if (!type) return "#777";
  return TYPE_COLORS[type.toLowerCase()] ?? "#777";
}
