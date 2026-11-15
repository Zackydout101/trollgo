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

/**
 * Doom-scroll rewards: every reel you scroll to is worth more than the last,
 * so the longer you keep scrolling the faster the points pile up — with no cap.
 */
const BASE_VIDEO = 4;
const STEP = 1;

/** Points earned for having scrolled through `watched` reels this session. */
export function scrollScore(watched: number) {
  const n = Math.max(0, Math.floor(watched));
  // sum of BASE, BASE+STEP, BASE+2*STEP, ... for the n reels already watched
  const points = n * BASE_VIDEO + (STEP * n * (n - 1)) / 2;
  // what the very next scroll will be worth
  const nextVideoWorth = BASE_VIDEO + STEP * n;
  return { watched: n, points, nextVideoWorth };
}
