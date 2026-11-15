"use client";

import { useEffect, useRef } from "react";
import type { LatLng, Pokemon } from "./types";
import { distanceMeters, offsetMeters, randomStops } from "./game";
import { emptyGpsGate, gateGpsFix, type GpsGate } from "./gps";
import { loadModelManifest } from "./models";
import {
  AUTO_ENCOUNTER_RADIUS,
  input,
  useGame,
  view,
  WALK_SPEED,
} from "./store";

const REFETCH_DISTANCE = 500;
const SPAWN_INTERVAL_MS = 3000;
/** after GPS is overridden by the joystick, ignore GPS until the player asks for it again */
export const gpsMode = { follow: true };

let gpsGate: GpsGate = emptyGpsGate();

/**
 * Apply one GPS reading. Wild single jumps are ignored so the map does not
 * teleport. Pass force when the player taps the recenter button.
 */
export function applyGpsFix(
  coords: { latitude: number; longitude: number; accuracy?: number },
  opts?: { force?: boolean }
): boolean {
  if (!opts?.force && !gpsMode.follow) return false;
  const decision = gateGpsFix(
    gpsGate,
    {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy ?? 0,
      at: Date.now(),
    },
    useGame.getState().pos,
    opts
  );
  gpsGate = decision.gate;
  if (!decision.accept) {
    if (opts?.force) {
      useGame.getState().flash("That GPS fix is too fuzzy to move you. Try again in a moment.");
    }
    return false;
  }
  const d = distanceMeters(useGame.getState().pos, decision.pos);
  useGame.getState().setGeoStatus("gps");
  if (d > 3) {
    useGame.getState().setPos(decision.pos, { moving: false });
    if (d > 250) useGame.getState().seedSpawns(7);
  }
  return true;
}

export function useGameLoop() {
  const ready = useRef(false);

  // data
  useEffect(() => {
    Promise.all([
      fetch("/data/pokemon.json").then((r) => r.json() as Promise<Pokemon[]>),
      loadModelManifest(),
    ])
      .then(([dex]) => {
        useGame.getState().setPokedex(dex);
        useGame.getState().seedSpawns(7);
        ready.current = true;
      })
      .catch(() => useGame.getState().flash("Couldn't load Pokémon data."));
  }, []);

  // geolocation
  useEffect(() => {
    const g = useGame.getState;
    if (!("geolocation" in navigator)) {
      g().setGeoStatus("manual");
      return;
    }
    const onOk = (p: GeolocationPosition) => {
      applyGpsFix(p.coords);
    };
    const onErr = () => {
      if (g().geoStatus !== "gps") g().setGeoStatus("manual");
    };
    const gpsOptions: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 8000,
    };
    navigator.geolocation.getCurrentPosition(onOk, onErr, gpsOptions);
    const id = navigator.geolocation.watchPosition(onOk, onErr, gpsOptions);
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // keyboard
  useEffect(() => {
    const keys = new Set<string>();
    const dirs = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"];
    const recompute = () => {
      let x = 0;
      let y = 0;
      if (keys.has("w") || keys.has("arrowup")) y += 1;
      if (keys.has("s") || keys.has("arrowdown")) y -= 1;
      if (keys.has("a") || keys.has("arrowleft")) x -= 1;
      if (keys.has("d") || keys.has("arrowright")) x += 1;
      const len = Math.hypot(x, y) || 1;
      input.x = x / len;
      input.y = y / len;
    };
    const down = (e: KeyboardEvent) => {
      if (useGame.getState().encounter) return;
      const k = e.key.toLowerCase();
      if (dirs.includes(k)) {
        keys.add(k);
        recompute();
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      recompute();
    };
    const blur = () => {
      keys.clear();
      recompute();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // walking
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let wasMoving = false;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const g = useGame.getState();
      const active =
        (input.x !== 0 || input.y !== 0) && !g.encounter && !g.spinStopId && g.screen === "map";
      if (active) {
        gpsMode.follow = false;
        if (g.geoStatus !== "manual") g.setGeoStatus("manual");
        const b = (view.bearing * Math.PI) / 180;
        const east = input.x * Math.cos(b) + input.y * Math.sin(b);
        const north = -input.x * Math.sin(b) + input.y * Math.cos(b);
        const speed = WALK_SPEED * Math.min(1, Math.hypot(input.x, input.y));
        const heading = (Math.atan2(east, north) * 180) / Math.PI;
        g.setPos(offsetMeters(g.pos, east * speed * dt, north * speed * dt), {
          heading,
          moving: true,
        });
        wasMoving = true;
      } else if (wasMoving) {
        wasMoving = false;
        useGame.setState({ moving: false });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // spawns + proximity encounters
  useEffect(() => {
    const spawn = setInterval(() => useGame.getState().spawnTick(), SPAWN_INTERVAL_MS);
    const cleanup = setInterval(() => useGame.getState().cleanupTick(), 1500);
    const proximity = setInterval(() => {
      const g = useGame.getState();
      if (g.encounter || g.spinStopId || g.screen !== "map") return;
      let best: (typeof g.spawns)[number] | null = null;
      let bestD = AUTO_ENCOUNTER_RADIUS;
      for (const s of g.spawns) {
        if (g.dismissed[s.id]) continue;
        const d = distanceMeters(s.pos, g.pos);
        if (d <= bestD) {
          best = s;
          bestD = d;
        }
      }
      if (best) g.startEncounter(best);
    }, 300);
    return () => {
      clearInterval(spawn);
      clearInterval(cleanup);
      clearInterval(proximity);
    };
  }, []);

  // Real PokéStops come from map POIs (see WorldMap). Where the map has none, scatter some.
  useEffect(() => {
    let emptySince = 0;
    let center: LatLng | null = null;
    const id = setInterval(() => {
      const { pos, stops, pokedex } = useGame.getState();
      if (!pokedex.length) return;
      const nearby = stops.some((s) => distanceMeters(s.pos, pos) < REFETCH_DISTANCE);
      if (nearby) {
        emptySince = 0;
        return;
      }
      if (!emptySince) emptySince = Date.now();
      if (Date.now() - emptySince > 8000 && (!center || distanceMeters(center, pos) > REFETCH_DISTANCE)) {
        center = pos;
        useGame.getState().setStops(randomStops(pos, 14));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);
}
