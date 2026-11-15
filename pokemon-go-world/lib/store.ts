"use client";

import { create } from "zustand";
import type {
  BallType,
  CaughtMon,
  Inventory,
  LatLng,
  PokeStop,
  Pokemon,
  SaveState,
  Spawn,
  ThrowBonus,
} from "./types";
import {
  BONUS_XP,
  cpAtLevel,
  distanceMeters,
  levelFromXp,
  pickWild,
  randomPointAround,
  rollWild,
  XP,
} from "./game";
import { isWatchman, speciesOrWatchman, WOODEN_WATCHMAN, WATCHMAN_CHANCE } from "./watchman";

// --- tuning ---------------------------------------------------------------
export const MAX_SPAWNS = 12;
export const SPAWN_MIN_R = 35;
export const SPAWN_MAX_R = 160;
export const SPAWN_LIFETIME_MS = 120_000;
export const DESPAWN_DISTANCE = 280;
/** Walking into this radius of a wild Pokémon starts the encounter automatically. */
export const AUTO_ENCOUNTER_RADIUS = 25;
/** Tapping a Pokémon on the map works inside this radius. */
export const TAP_RADIUS = 45;
export const SPIN_RADIUS = 45;
export const SPIN_COOLDOWN_MS = 5 * 60_000;
export const WALK_SPEED = 7;
export const DEFAULT_POS: LatLng = { lat: 40.7829, lng: -73.9654 };

/** Joystick / keyboard input, x = right, y = forward (relative to the camera). Mutated every frame. */
export const input = { x: 0, y: 0 };
/** Current map bearing in degrees, mirrored from MapLibre so walking follows the camera. */
export const view = { bearing: 0 };

export type Screen = "map" | "bag" | "menu" | "training";

/** Training-ground points required for one level. */
export const TRAINING_PER_LEVEL = 80;

export interface CatchReward {
  xp: number;
  stardust: number;
  candy: number;
  isNew: boolean;
  bonus: ThrowBonus;
}

interface GameState {
  pokedex: Pokemon[];
  pos: LatLng;
  /** degrees clockwise from north the avatar faces */
  heading: number;
  moving: boolean;
  geoStatus: "locating" | "gps" | "manual";
  spawns: Spawn[];
  stops: PokeStop[];
  save: SaveState;
  incenseUntil: number;
  encounter: Spawn | null;
  /** spawn ids the player ran from; they won't auto-trigger again */
  dismissed: Record<string, true>;
  screen: Screen;
  /** Pokémon to open straight into training, when launched from its menu page. */
  trainMonId: string | null;
  spinStopId: string | null;
  toast: { id: number; text: string } | null;

  setPokedex: (p: Pokemon[]) => void;
  setPos: (p: LatLng, opts?: { heading?: number; moving?: boolean }) => void;
  setGeoStatus: (s: GameState["geoStatus"]) => void;
  setStops: (s: PokeStop[]) => void;
  setScreen: (s: Screen) => void;
  /** Open the training grounds, optionally straight onto one caught Pokémon. */
  openTraining: (monId?: string | null) => void;
  flash: (text: string) => void;
  addXp: (amount: number) => void;

  spawnTick: () => void;
  cleanupTick: () => void;
  seedSpawns: (n: number) => void;

  startEncounter: (s: Spawn) => void;
  runAway: () => void;
  consumeThrow: (ball: BallType, razz: boolean) => void;
  resolveCatch: (bonus: ThrowBonus) => CatchReward | null;
  flee: () => void;
  finishEncounter: (id?: string) => void;

  openStop: (id: string) => void;
  closeStop: () => void;
  spinStop: (id: string) => { items: Partial<Inventory>; stardust: number; xp: number } | null;

  useIncense: () => void;
  powerUp: (monId: string) => void;
  transfer: (monId: string) => void;
  /** Bank points from a training session onto one caught Pokémon. */
  grantTraining: (monId: string, points: number) => { levels: number; points: number };
}

const DEFAULT_SAVE: SaveState = {
  trainer: {
    level: 1,
    xp: 0,
    stardust: 400,
    distanceWalked: 0,
    totalCaught: 0,
    totalSpins: 0,
    candy: {},
  },
  inventory: { pokeball: 30, greatball: 5, ultraball: 0, razz: 5, incense: 1 },
  caught: [],
};

const STORAGE_KEY = "pogo-world-save-v3";

function loadSave(): SaveState {
  if (typeof window === "undefined") return DEFAULT_SAVE;
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("pogo-world-save-v2");
    if (!raw) return DEFAULT_SAVE;
    const parsed = JSON.parse(raw) as SaveState;
    return {
      trainer: { ...DEFAULT_SAVE.trainer, ...parsed.trainer },
      inventory: { ...DEFAULT_SAVE.inventory, ...parsed.inventory },
      caught: parsed.caught ?? [],
    };
  } catch {
    return DEFAULT_SAVE;
  }
}

function makeSpawn(pool: Pokemon[], pos: LatLng, trainerLevel: number): Spawn {
  const mon = Math.random() < WATCHMAN_CHANCE ? WOODEN_WATCHMAN : pickWild(pool);
  const { level, cp } = rollWild(mon, trainerLevel);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pokemon: mon,
    pos: randomPointAround(pos, SPAWN_MIN_R, SPAWN_MAX_R),
    expiresAt: Date.now() + SPAWN_LIFETIME_MS * (0.7 + Math.random() * 0.6),
    cp,
    level,
  };
}

let toastId = 0;

export const useGame = create<GameState>((set, get) => ({
  pokedex: [],
  pos: DEFAULT_POS,
  heading: 0,
  moving: false,
  geoStatus: "locating",
  spawns: [],
  stops: [],
  save: loadSave(),
  incenseUntil: 0,
  encounter: null,
  dismissed: {},
  screen: "map",
  trainMonId: null,
  spinStopId: null,
  toast: null,

  setPokedex: (pokedex) => set({ pokedex }),

  setPos: (p, opts) => {
    const { pos, save } = get();
    const d = distanceMeters(pos, p);
    const next: Partial<GameState> = { pos: p };
    if (opts?.heading != null) next.heading = opts.heading;
    if (opts?.moving != null) next.moving = opts.moving;
    if (d > 0.05 && d < 100) {
      next.save = {
        ...save,
        trainer: { ...save.trainer, distanceWalked: save.trainer.distanceWalked + d },
      };
    }
    set(next);
  },

  setGeoStatus: (geoStatus) => set({ geoStatus }),
  setStops: (stops) => {
    const prev = new Map(get().stops.map((s) => [s.id, s.cooldownUntil]));
    set({ stops: stops.map((s) => ({ ...s, cooldownUntil: prev.get(s.id) ?? s.cooldownUntil })) });
  },
  setScreen: (screen) => set({ screen, trainMonId: screen === "training" ? get().trainMonId : null }),
  openTraining: (monId) => set({ screen: "training", trainMonId: monId ?? null }),

  flash: (text) => set({ toast: { id: ++toastId, text } }),

  addXp: (amount) => {
    const s = get().save;
    const xp = s.trainer.xp + amount;
    const level = levelFromXp(xp);
    let inventory = s.inventory;
    if (level > s.trainer.level) {
      inventory = {
        ...inventory,
        pokeball: inventory.pokeball + 10 + level * 2,
        greatball: inventory.greatball + (level >= 5 ? 4 : 1),
        ultraball: inventory.ultraball + (level >= 10 ? 3 : 0),
        razz: inventory.razz + 3,
        incense: inventory.incense + (level % 5 === 0 ? 1 : 0),
      };
      setTimeout(() => get().flash(`Level up! You reached level ${level}. Rewards added to your bag.`), 600);
    }
    set({ save: { ...s, inventory, trainer: { ...s.trainer, xp, level } } });
  },

  seedSpawns: (n) => {
    const { pokedex, pos, save } = get();
    if (!pokedex.length) return;
    const spawns = Array.from({ length: n }, () => makeSpawn(pokedex, pos, save.trainer.level));
    // Always drop a couple of watchmen in the opening set so they show up on the map.
    let watchers = spawns.filter((s) => isWatchman(s.pokemon)).length;
    for (let i = 0; watchers < 2 && i < spawns.length; i++) {
      if (isWatchman(spawns[i].pokemon)) continue;
      const rolled = rollWild(WOODEN_WATCHMAN, save.trainer.level);
      spawns[i] = { ...spawns[i], pokemon: WOODEN_WATCHMAN, level: rolled.level, cp: rolled.cp };
      watchers++;
    }
    set({ spawns });
  },

  spawnTick: () => {
    const { pokedex, pos, spawns, save, incenseUntil } = get();
    if (!pokedex.length) return;
    const cap = incenseUntil > Date.now() ? MAX_SPAWNS + 8 : MAX_SPAWNS;
    if (spawns.length >= cap) return;
    set({ spawns: [...spawns, makeSpawn(pokedex, pos, save.trainer.level)] });
  },

  cleanupTick: () => {
    const { spawns, pos, encounter } = get();
    const now = Date.now();
    const kept = spawns.filter(
      (s) =>
        s.id === encounter?.id ||
        (s.expiresAt > now && distanceMeters(s.pos, pos) < DESPAWN_DISTANCE)
    );
    if (kept.length !== spawns.length) set({ spawns: kept });
  },

  startEncounter: (s) => {
    if (get().encounter) return;
    set({ encounter: s, screen: "map", spinStopId: null });
  },

  runAway: () => {
    const e = get().encounter;
    if (!e) return;
    set((st) => ({ encounter: null, dismissed: { ...st.dismissed, [e.id]: true } }));
  },

  consumeThrow: (ball, razz) => {
    const s = get().save;
    set({
      save: {
        ...s,
        inventory: {
          ...s.inventory,
          [ball]: Math.max(0, s.inventory[ball] - 1),
          razz: razz ? Math.max(0, s.inventory.razz - 1) : s.inventory.razz,
        },
      },
    });
  },

  resolveCatch: (bonus) => {
    const { encounter: target, save } = get();
    if (!target) return null;
    const isNew = !save.caught.some((c) => c.dex === target.pokemon.dex);
    const mon: CaughtMon = {
      id: target.id,
      dex: target.pokemon.dex,
      name: target.pokemon.name,
      sprite: target.pokemon.sprite,
      cp: target.cp,
      level: target.level,
      caughtAt: Date.now(),
      trainingPoints: 0,
    };
    const candy = isNew ? 10 : 3;
    const stardust = 100;
    set((st) => ({
      spawns: st.spawns.filter((x) => x.id !== target.id),
      save: {
        ...st.save,
        caught: [mon, ...st.save.caught],
        trainer: {
          ...st.save.trainer,
          totalCaught: st.save.trainer.totalCaught + 1,
          stardust: st.save.trainer.stardust + stardust,
          candy: {
            ...st.save.trainer.candy,
            [mon.dex]: (st.save.trainer.candy[mon.dex] || 0) + candy,
          },
        },
      },
    }));
    const xp = XP.catch + (isNew ? XP.newDex : 0) + BONUS_XP[bonus];
    get().addXp(xp);
    return { xp, stardust, candy, isNew, bonus };
  },

  flee: () => {
    const e = get().encounter;
    if (!e) return;
    set((st) => ({ spawns: st.spawns.filter((x) => x.id !== e.id) }));
  },

  finishEncounter: (id) => {
    if (id && get().encounter?.id !== id) return;
    set({ encounter: null });
  },

  openStop: (id) => {
    const stop = get().stops.find((s) => s.id === id);
    if (!stop) return;
    const d = distanceMeters(stop.pos, get().pos);
    if (d > SPIN_RADIUS) {
      get().flash(`${Math.round(d)} m away. Walk closer to the ${stop.kind === "gym" ? "Gym" : "PokéStop"}.`);
      return;
    }
    set({ spinStopId: id });
  },

  closeStop: () => set({ spinStopId: null }),

  spinStop: (id) => {
    const stop = get().stops.find((s) => s.id === id);
    if (!stop || stop.cooldownUntil > Date.now()) return null;
    const loot = rollLoot(stop.kind === "gym");
    const xp = stop.kind === "gym" ? XP.spin * 2 : XP.spin;
    set((st) => ({
      stops: st.stops.map((s) =>
        s.id === id ? { ...s, cooldownUntil: Date.now() + SPIN_COOLDOWN_MS } : s
      ),
      save: {
        ...st.save,
        inventory: mergeInv(st.save.inventory, loot.items),
        trainer: {
          ...st.save.trainer,
          totalSpins: st.save.trainer.totalSpins + 1,
          stardust: st.save.trainer.stardust + loot.stardust,
        },
      },
    }));
    get().addXp(xp);
    return { ...loot, xp };
  },

  useIncense: () => {
    const s = get().save;
    if (s.inventory.incense <= 0) {
      get().flash("You don't have any Incense.");
      return;
    }
    set({
      save: { ...s, inventory: { ...s.inventory, incense: s.inventory.incense - 1 } },
      incenseUntil: Date.now() + 5 * 60_000,
    });
    get().flash("Incense active: more Pokémon will appear for 5 minutes.");
  },

  powerUp: (monId) => {
    const { save, pokedex } = get();
    const mon = save.caught.find((c) => c.id === monId);
    const base = mon ? speciesOrWatchman(pokedex, mon.dex) : undefined;
    if (!mon || !base || mon.level >= 40) return;
    const cost = 200 + mon.level * 25;
    const candyHave = save.trainer.candy[mon.dex] || 0;
    if (save.trainer.stardust < cost || candyHave < 2) {
      get().flash("You need more Stardust or Candy.");
      return;
    }
    const level = mon.level + 1;
    const cp = cpAtLevel(base, level);
    set({
      save: {
        ...save,
        trainer: {
          ...save.trainer,
          stardust: save.trainer.stardust - cost,
          candy: { ...save.trainer.candy, [mon.dex]: candyHave - 2 },
        },
        caught: save.caught.map((c) => (c.id === monId ? { ...c, level, cp } : c)),
      },
    });
    get().flash(`${mon.name} powered up to CP ${cp}!`);
  },

  transfer: (monId) => {
    const { save } = get();
    const mon = save.caught.find((c) => c.id === monId);
    if (!mon) return;
    set({
      save: {
        ...save,
        caught: save.caught.filter((c) => c.id !== monId),
        trainer: {
          ...save.trainer,
          candy: { ...save.trainer.candy, [mon.dex]: (save.trainer.candy[mon.dex] || 0) + 1 },
        },
      },
    });
    get().flash(`${mon.name} was transferred. +1 Candy`);
  },

  grantTraining: (monId, points) => {
    const gained = Math.floor(points);
    if (gained <= 0) return { levels: 0, points: 0 };
    const { save, pokedex } = get();
    const mon = save.caught.find((c) => c.id === monId);
    const base = mon ? speciesOrWatchman(pokedex, mon.dex) : undefined;
    if (!mon) return { levels: 0, points: 0 };
    const prev = mon.trainingPoints ?? 0;
    const total = prev + gained;
    const steps = Math.floor(total / TRAINING_PER_LEVEL) - Math.floor(prev / TRAINING_PER_LEVEL);
    const level = Math.min(40, mon.level + Math.max(0, steps));
    const levels = level - mon.level;
    const cp = base ? cpAtLevel(base, level) : mon.cp;
    set({
      save: {
        ...save,
        caught: save.caught.map((c) => (c.id === monId ? { ...c, trainingPoints: total, level, cp } : c)),
      },
    });
    if (levels > 0) get().flash(`${mon.name} reached level ${level}. CP ${cp}.`);
    else get().flash(`${mon.name} gained ${gained} training points.`);
    return { levels, points: gained };
  },
}));

// persist the save, debounced
if (typeof window !== "undefined") {  let t: number | undefined;
  useGame.subscribe((s, prev) => {
    if (s.save === prev.save) return;
    window.clearTimeout(t);
    t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...s.save, caught: s.save.caught.slice(0, 800) })
        );
      } catch {
        /* storage full or blocked */
      }
    }, 500);
  });
}

function rollLoot(premium: boolean): { items: Partial<Inventory>; stardust: number } {
  const items: Partial<Inventory> = {};
  const n = 3 + Math.floor(Math.random() * 3);
  const add = (k: keyof Inventory, c: number) => {
    items[k] = (items[k] || 0) + c;
  };
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (r < 0.5) add("pokeball", 2);
    else if (r < 0.72) add("greatball", 1);
    else if (r < 0.82 && premium) add("ultraball", 1);
    else if (r < 0.96) add("razz", 1);
    else add("incense", 1);
  }
  return { items, stardust: premium ? 100 : 50 };
}

function mergeInv(inv: Inventory, add: Partial<Inventory>): Inventory {
  const out = { ...inv };
  (Object.keys(add) as (keyof Inventory)[]).forEach((k) => {
    out[k] = (out[k] || 0) + (add[k] || 0);
  });
  return out;
}
