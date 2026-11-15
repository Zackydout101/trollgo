/**
 * 3D Pokémon models come from the community Pokemon-3D-api repository
 * (https://github.com/Sudhanshu-Ambastha/Pokemon-3D-api), proxied and disk-cached
 * by app/api/model/[dex]. They are fan-extracted, Nintendo/Game Freak owned assets:
 * personal, non-commercial use only.
 */

/** Draco decoder used by the optimised models. */
export const DRACO_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

/** Map of dex number -> model file size in bytes (only dex numbers that have a model). */
let manifest: Record<string, number> = {};

export async function loadModelManifest(): Promise<void> {
  try {
    const r = await fetch("/data/models.json");
    manifest = await r.json();
  } catch {
    manifest = {};
  }
}

export function hasModel(dex: number): boolean {
  return manifest[String(dex)] != null;
}

export function modelSize(dex: number): number {
  return manifest[String(dex)] ?? Infinity;
}

export function modelUrl(dex: number): string {
  return `/api/model/${dex}`;
}

export const spriteUrl = (file: string) => `/sprites/${file}`;
