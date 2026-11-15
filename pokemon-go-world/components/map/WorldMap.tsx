"use client";

import { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Map, { type MapRef } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import { Canvas, coordsToVector3 } from "react-three-map/maplibre";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { LatLng, Spawn } from "@/lib/types";
import { distanceMeters } from "@/lib/game";
import { isNight, pogoStyle } from "@/lib/mapStyle";
import { stopsFromMap } from "@/lib/poiStops";
import { ARENA_RADIUS, SPIN_RADIUS, TAP_RADIUS, useGame, view } from "@/lib/store";
import { isWatchman } from "@/lib/watchman";
import CritterModel from "../three/CritterModel";
import PokeStop3D from "./PokeStop3D";
import ArenaSpot3D from "./ArenaSpot3D";
import { PlayerRings, useWalkBlend } from "./Avatar";
import SpongeBob from "../three/SpongeBob";

/** Map objects are drawn larger than life so they read well from the GO camera, like the real game. */
const AVATAR_SCALE = 5.5;
const STOP_SCALE = 4.8;
const MON_HEIGHT = 9;
const REANCHOR_DISTANCE = 1500;

const toCoords = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

if (typeof window !== "undefined") setWorkerUrl(`${location.origin}/vendor/maplibre-gl-worker.mjs`);

export default function WorldMap() {
  const mapRef = useRef<MapRef>(null);
  const start = useRef(useGame.getState().pos).current;
  const [anchor, setAnchor] = useState<LatLng>(start);
  const [night] = useState(() => isNight());
  const style = useMemo(() => pogoStyle(night), [night]);
  const [loaded, setLoaded] = useState(false);

  // keep the camera locked on the trainer
  useEffect(() => {
    return useGame.subscribe((s, prev) => {
      if (s.pos === prev.pos) return;
      const map = mapRef.current?.getMap();
      map?.jumpTo({ center: [s.pos.lng, s.pos.lat] });
      setAnchor((a) => (distanceMeters(a, s.pos) > REANCHOR_DISTANCE ? s.pos : a));
    });
  }, []);

  // turn named map POIs around the trainer into PokéStops and Gyms
  useEffect(() => {
    const map = loaded ? mapRef.current?.getMap() : undefined;
    if (!map) return;
    let lastCenter: LatLng | null = null;
    const harvest = () => {
      const { pos, stops } = useGame.getState();
      const stale =
        !lastCenter ||
        distanceMeters(lastCenter, pos) > 150 ||
        stops.length === 0 ||
        stops.every((s) => s.id.startsWith("rand-"));
      if (!stale) return;
      const found = stopsFromMap(map, pos);
      if (found.length < 3) return;
      lastCenter = pos;
      useGame.getState().setStops(found);
    };
    map.on("idle", harvest);
    const id = setInterval(harvest, 2500);
    return () => {
      map.off("idle", harvest);
      clearInterval(id);
    };
  }, [loaded]);

  useEffect(() => {
    const north = () => mapRef.current?.getMap().easeTo({ bearing: 0, pitch: 62, duration: 600 });
    window.addEventListener("pogo:north", north);
    return () => window.removeEventListener("pogo:north", north);
  }, []);

  // one-finger / left-mouse drag rotates the camera around the trainer (Pokémon GO style)
  useEffect(() => {
    const map = loaded ? mapRef.current?.getMap() : undefined;
    const el = map?.getCanvasContainer();
    if (!map || !el) return;
    const p = useGame.getState().pos;
    map.jumpTo({ center: [p.lng, p.lat] });
    let dragging: { x: number; y: number; id: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const move = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== dragging.id) return;
      const dx = e.clientX - dragging.x;
      const dy = e.clientY - dragging.y;
      dragging.x = e.clientX;
      dragging.y = e.clientY;
      const flip = e.clientY > window.innerHeight * 0.55 ? -1 : 1;
      map.setBearing(map.getBearing() - dx * 0.35 * flip);
      map.setPitch(Math.max(40, Math.min(72, map.getPitch() - dy * 0.15)));
    };
    const up = (e: PointerEvent) => {
      if (dragging && e.pointerId === dragging.id) dragging = null;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [loaded]);

  return (
    <div className={`world ${night ? "night" : "day"}`}>
      <Map
        ref={mapRef}
        mapStyle={style}
        initialViewState={{ latitude: start.lat, longitude: start.lng, zoom: 18.6, pitch: 62, bearing: 0 }}
        minZoom={16.5}
        maxZoom={20.5}
        maxPitch={75}
        dragPan={false}
        dragRotate={false}
        keyboard={false}
        doubleClickZoom={false}
        scrollZoom={{ around: "center" }}
        touchZoomRotate={{ around: "center" }}
        touchPitch={false}
        attributionControl={{ compact: true }}
        canvasContextAttributes={{ antialias: true }}
        onMove={(e) => (view.bearing = e.viewState.bearing)}
        onLoad={() => setLoaded(true)}
        style={{ position: "absolute", inset: 0 }}
      >
        <Canvas latitude={anchor.lat} longitude={anchor.lng} frameloop="always">
          <hemisphereLight args={[night ? "#9fb6ff" : "#ffffff", night ? "#1b3a4a" : "#7bc77e", night ? 1.1 : 1.6]} />
          <directionalLight position={[60, 120, 40]} intensity={night ? 1.2 : 2.4} color={night ? "#c6d2ff" : "#fff6e0"} />
          <ambientLight intensity={night ? 0.5 : 0.6} />
          <Player anchor={anchor} />
          <Spawns anchor={anchor} />
          <Stops anchor={anchor} />
          <Arenas anchor={anchor} />
        </Canvas>
      </Map>
    </div>
  );
}

function Player({ anchor }: { anchor: LatLng }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const walk = useWalkBlend();
  const yaw = useRef(0);
  useFrame((_, dt) => {
    const { pos, heading } = useGame.getState();
    const [x, y, z] = coordsToVector3(toCoords(pos), toCoords(anchor));
    group.current?.position.set(x, y, z);
    const target = Math.PI - (heading * Math.PI) / 180;
    let diff = target - yaw.current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    yaw.current += diff * Math.min(1, dt * 10);
    if (body.current) body.current.rotation.y = yaw.current;
  });
  return (
    <group ref={group}>
      <PlayerRings radius={TAP_RADIUS} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <circleGeometry args={[1.8, 32]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <group ref={body} scale={AVATAR_SCALE}>
        <Suspense fallback={null}>
          <SpongeBob walkRef={walk} />
        </Suspense>
      </group>
    </group>
  );
}

function Spawns({ anchor }: { anchor: LatLng }) {
  const spawns = useGame((s) => s.spawns);
  const encounterId = useGame((s) => s.encounter?.id);
  return (
    <>
      {spawns.map((s) =>
        s.id === encounterId ? null : <MapPokemon key={s.id} spawn={s} anchor={anchor} />
      )}
    </>
  );
}

const MapPokemon = memo(function MapPokemon({ spawn, anchor }: { spawn: Spawn; anchor: LatLng }) {
  const ref = useRef<THREE.Group>(null);
  const born = useRef(performance.now());
  const pos = useMemo(() => coordsToVector3(toCoords(spawn.pos), toCoords(anchor)), [spawn.pos, anchor]);
  const height = isWatchman(spawn.pokemon)
    ? MON_HEIGHT * 1.45
    : MON_HEIGHT * (0.8 + Math.min(1, spawn.pokemon.bst / 700) * 0.55);

  useFrame(() => {
    if (!ref.current) return;
    const k = Math.min(1, (performance.now() - born.current) / 600);
    const pop = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 8) : 1;
    ref.current.scale.setScalar(Math.max(0.001, pop));
    ref.current.rotation.y = (-view.bearing * Math.PI) / 180;
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return;
    e.stopPropagation();
    const g = useGame.getState();
    const d = distanceMeters(g.pos, spawn.pos);
    if (d <= TAP_RADIUS) g.startEncounter(spawn);
    else g.flash(`${spawn.pokemon.name} is ${Math.round(d)} m away. Walk closer!`);
  };

  return (
    <group position={pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <circleGeometry args={[height * 0.32, 32]} />
        <meshBasicMaterial color="#000" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <group ref={ref} onClick={click}>
        <CritterModel pokemon={spawn.pokemon} height={height} clip="walking" />
      </group>
    </group>
  );
});

function Stops({ anchor }: { anchor: LatLng }) {
  const stops = useGame((s) => s.stops);
  const [, force] = useState(0);
  const nearIds = useRef<Set<string>>(new Set());

  // re-render when the trainer walks in/out of a stop's range or cooldowns expire
  useEffect(() => {
    const id = setInterval(() => {
      const { pos, stops } = useGame.getState();
      const next = new Set(stops.filter((s) => distanceMeters(s.pos, pos) <= SPIN_RADIUS).map((s) => s.id));
      const changed = next.size !== nearIds.current.size || [...next].some((i) => !nearIds.current.has(i));
      nearIds.current = next;
      if (changed || stops.some((s) => s.cooldownUntil && s.cooldownUntil < Date.now() + 600)) force((n) => n + 1);
    }, 500);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {stops.map((s) => (
        <group key={s.id} position={coordsToVector3(toCoords(s.pos), toCoords(anchor))}>
          <PokeStop3D
            stop={s}
            near={nearIds.current.has(s.id)}
            scale={STOP_SCALE}
            onSelect={() => useGame.getState().openStop(s.id)}
          />
        </group>
      ))}
    </>
  );
}

function Arenas({ anchor }: { anchor: LatLng }) {
  const arenaSpots = useGame((s) => s.arenaSpots);
  const [, force] = useState(0);
  const nearIds = useRef<Set<string>>(new Set());

  // re-render when the trainer walks in/out of an arena's range
  useEffect(() => {
    const id = setInterval(() => {
      const { pos, arenaSpots } = useGame.getState();
      const next = new Set(
        arenaSpots.filter((a) => distanceMeters(a.pos, pos) <= ARENA_RADIUS).map((a) => a.id)
      );
      const changed = next.size !== nearIds.current.size || [...next].some((i) => !nearIds.current.has(i));
      nearIds.current = next;
      if (changed) force((n) => n + 1);
    }, 500);
    return () => clearInterval(id);
  }, []);

  const select = (id: string, bossIndex: number) => {
    const g = useGame.getState();
    const spot = g.arenaSpots.find((a) => a.id === id);
    if (!spot) return;
    const d = distanceMeters(spot.pos, g.pos);
    if (d <= ARENA_RADIUS) g.enterArena(bossIndex);
    else g.flash(`Boss arena is ${Math.round(d)} m away. Walk closer to challenge it!`);
  };

  return (
    <>
      {arenaSpots.map((a) => (
        <group key={a.id} position={coordsToVector3(toCoords(a.pos), toCoords(anchor))}>
          <ArenaSpot3D
            bossIndex={a.bossIndex}
            near={nearIds.current.has(a.id)}
            scale={STOP_SCALE}
            onSelect={() => select(a.id, a.bossIndex)}
          />
        </group>
      ))}
    </>
  );
}
