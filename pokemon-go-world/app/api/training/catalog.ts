import { readdirSync } from "node:fs";
import path from "node:path";

/** One brainrot reel played in the training grounds. */
export interface Reel {
  id: string;
  index: number;
  title: string;
  /** css hue for the loading/placeholder background */
  hue: number;
  /** same-origin video stream for this reel */
  videoUrl: string;
}

/** Folder that holds the training videos (mp4) and the link list. */
export const REEL_DIR = path.join(process.cwd(), "brainrotlink");

const HUES = [200, 128, 28, 330, 92, 266, 14, 188];

/** mp4 files in the brainrot folder, sorted so the order is stable. */
export function videoFiles(): string[] {
  try {
    return readdirSync(REEL_DIR)
      .filter((f) => f.toLowerCase().endsWith(".mp4"))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/** Turn a messy filename into a short, readable reel title. */
function titleFromFile(file: string): string {
  let name = file.replace(/\.mp4$/i, "");
  name = name.replace(/#[^\s#]+/g, " "); // drop hashtags
  name = name.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  if (name.length > 46) name = name.slice(0, 45).trimEnd() + "…";
  return name || "Brainrot reel";
}

/** The reels, one per mp4 file. */
export function reels(): Reel[] {
  return videoFiles().map((file, i) => ({
    id: String(i),
    index: i,
    title: titleFromFile(file),
    hue: HUES[i % HUES.length],
    videoUrl: `/api/training/video/${i}`,
  }));
}

/** File for reel i. A missing slot reuses the first video so every reel plays. */
export function videoFileAt(index: number): string | null {
  const files = videoFiles();
  if (!files.length) return null;
  const i = Number.isFinite(index) ? index : 0;
  return files[i] ?? files[0];
}

/** Points speed up every block of time you stay, with no ceiling. */
const BLOCK = 15;
const BASE_RATE = 2;

export function trainingScore(elapsedSec: number) {
  const seconds = Math.max(0, Math.floor(elapsedSec));
  const blocks = Math.floor(seconds / BLOCK);
  const rem = seconds - blocks * BLOCK;
  let points = 0;
  for (let i = 0; i < blocks; i++) points += BLOCK * (BASE_RATE + i);
  points += rem * (BASE_RATE + blocks);
  const pointsPerSec = BASE_RATE + blocks;
  const nextRateIn = BLOCK - rem;
  return { elapsedSec: seconds, points, pointsPerSec, nextRateIn };
}
