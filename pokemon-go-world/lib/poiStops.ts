import type { Map as MlMap } from "maplibre-gl";
import type { LatLng, PokeStop } from "./types";
import { distanceMeters } from "./game";

const GYM_CLASSES = new Set([
  "attraction",
  "museum",
  "monument",
  "castle",
  "art_gallery",
  "theatre",
  "stadium",
  "zoo",
  "aquarium",
  "town_hall",
  "place_of_worship",
]);
const SKIP_CLASSES = new Set(["parking", "bus", "railway", "toilets", "atm", "fuel", "car", "bicycle_rental"]);
const RADIUS = 650;
const MIN_SPACING = 30;
const MAX_STOPS = 60;

/** Builds PokéStops and Gyms from the named points of interest in the loaded vector tiles. */
export function stopsFromMap(map: MlMap, center: LatLng): PokeStop[] {
  const feats = map.querySourceFeatures("omt", { sourceLayer: "poi" });
  const seen = new Set<string>();
  const out: (PokeStop & { d: number; rank: number })[] = [];
  for (const f of feats) {
    if (f.geometry.type !== "Point") continue;
    const p = f.properties ?? {};
    const name = (p["name:en"] || p.name || p["name:latin"]) as string | undefined;
    const cls = String(p.class ?? "");
    if (!name || SKIP_CLASSES.has(cls)) continue;
    const [lng, lat] = f.geometry.coordinates as [number, number];
    const pos = { lat, lng };
    const d = distanceMeters(center, pos);
    if (d > RADIUS) continue;
    const id = `poi-${f.id ?? `${name}-${lat.toFixed(5)}-${lng.toFixed(5)}`}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      pos,
      kind: GYM_CLASSES.has(cls) ? "gym" : "stop",
      cooldownUntil: 0,
      d,
      rank: Number(p.rank ?? 50),
    });
  }
  out.sort((a, b) => a.rank - b.rank || a.d - b.d);
  const picked: PokeStop[] = [];
  for (const s of out) {
    if (picked.length >= MAX_STOPS) break;
    if (picked.some((o) => distanceMeters(o.pos, s.pos) < MIN_SPACING)) continue;
    picked.push({ id: s.id, name: s.name, pos: s.pos, kind: s.kind, cooldownUntil: 0 });
  }
  // keep Gyms rare, like the real game
  let gyms = 0;
  const maxGyms = Math.max(1, Math.floor(picked.length / 5));
  for (const s of picked) {
    if (s.kind !== "gym") continue;
    if (++gyms > maxGyms) s.kind = "stop";
  }
  if (gyms === 0 && picked.length >= 5) picked[0].kind = "gym";
  return picked;
}
