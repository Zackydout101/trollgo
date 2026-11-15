import type { Inventory } from "./types";

export interface Boss {
  id: string;
  name: string;
  title: string;
  /** which animated model fights as this boss */
  species: "watchman" | "smurf";
  hp: number;
  /** damage per swing before randomisation */
  atk: number;
  /** ms between the boss's attacks */
  interval: number;
  /** relative model height */
  size: number;
  tint: string;
  reward: { xp: number; stardust: number; items: Partial<Inventory> };
}

/** The roster of arena bosses. Index matches the tier shown on the map beacons. */
export const BOSSES: Boss[] = [
  {
    id: "timberfang",
    name: "Timberfang",
    title: "Rookie Watchman",
    species: "watchman",
    hp: 340,
    atk: 8,
    interval: 2000,
    size: 2.1,
    tint: "#8fd16a",
    reward: { xp: 500, stardust: 300, items: { greatball: 3, razz: 2 } },
  },
  {
    id: "brawler-smurf",
    name: "Brawler Smurf",
    title: "Blue Menace",
    species: "smurf",
    hp: 760,
    atk: 15,
    interval: 1550,
    size: 2.3,
    tint: "#4aa8ec",
    reward: { xp: 1400, stardust: 700, items: { ultraball: 3, razz: 4 } },
  },
  {
    id: "oakenmaw",
    name: "Oakenmaw",
    title: "Elite Watchman",
    species: "watchman",
    hp: 720,
    atk: 14,
    interval: 1650,
    size: 2.5,
    tint: "#ffb347",
    reward: { xp: 1200, stardust: 650, items: { ultraball: 3, razz: 4 } },
  },
  {
    id: "heartwood",
    name: "Heartwood Tyrant",
    title: "Arena Boss",
    species: "watchman",
    hp: 1250,
    atk: 21,
    interval: 1350,
    size: 3.0,
    tint: "#ff5a6a",
    reward: { xp: 2800, stardust: 1300, items: { ultraball: 6, incense: 2 } },
  },
];
