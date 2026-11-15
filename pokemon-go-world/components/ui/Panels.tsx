"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { CaughtMon, Inventory } from "@/lib/types";
import { typeColor } from "@/lib/game";
import { spriteUrl } from "@/lib/models";
import { useGame, SPIN_RADIUS } from "@/lib/store";
import { isWatchman, speciesOrWatchman } from "@/lib/watchman";
import { distanceMeters } from "@/lib/game";
import { capturePointer } from "@/lib/pointer";
import PokemonModel from "../three/PokemonModel";
import WoodenWatchman, { WatchmanPlaceholder } from "../three/WoodenWatchman";

export function MainMenu() {
  const setScreen = useGame((s) => s.setScreen);
  const useIncense = useGame((s) => s.useIncense);
  const incense = useGame((s) => s.save.inventory.incense);
  return (
    <div className="menu-overlay" onClick={() => setScreen("map")}>
      <div className="menu-grid" onClick={(e) => e.stopPropagation()}>
        <button className="menu-item" onClick={() => setScreen("bag")}>
          <span className="mi-ico mi-pokemon" />
          Pokémon
        </button>
        <button className="menu-item" onClick={() => useGame.getState().openTraining(null)}>
          <span className="mi-ico mi-training" />
          Train
        </button>
        <button
          className="menu-item"
          onClick={() => {
            useIncense();
            setScreen("map");
          }}
          disabled={incense <= 0}
        >
          <span className="mi-ico mi-incense" />
          Incense ×{incense}
        </button>
        <button
          className="menu-item"
          onClick={() => {
            if (confirm("Reset your save? This deletes every Pokémon you caught.")) {
              localStorage.removeItem("pogo-world-save-v3");
              localStorage.removeItem("pogo-world-save-v2");
              location.reload();
            }
          }}
        >
          <span className="mi-ico mi-settings" />
          Reset
        </button>
      </div>
      <button className="close-x" onClick={() => setScreen("map")} aria-label="Close">
        ✕
      </button>
    </div>
  );
}

export function Bag() {
  const save = useGame((s) => s.save);
  const setScreen = useGame((s) => s.setScreen);
  const [tab, setTab] = useState<"mons" | "items">("mons");
  const [sort, setSort] = useState<"recent" | "cp" | "dex">("recent");
  const [detail, setDetail] = useState<string | null>(null);
  const { trainer, inventory, caught } = save;
  const uniqueDex = new Set(caught.map((c) => c.dex)).size;

  const sorted = useMemo(() => {
    const arr = [...caught];
    if (sort === "cp") arr.sort((a, b) => b.cp - a.cp);
    else if (sort === "dex") arr.sort((a, b) => a.dex - b.dex || b.cp - a.cp);
    return arr;
  }, [caught, sort]);

  const detailMon = caught.find((c) => c.id === detail);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Trainer · Level {trainer.level}</h2>
          <div className="panel-stats">
            {caught.length} Pokémon · {uniqueDex} species · {trainer.totalSpins} spins ·{" "}
            {(trainer.distanceWalked / 1000).toFixed(2)} km walked · {trainer.stardust.toLocaleString()} Stardust
          </div>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === "mons" ? "on" : ""} onClick={() => setTab("mons")}>
          Pokémon {caught.length}
        </button>
        <button className={tab === "items" ? "on" : ""} onClick={() => setTab("items")}>
          Items
        </button>
      </div>

      {tab === "items" ? (
        <ItemList inventory={inventory} stardust={trainer.stardust} />
      ) : caught.length === 0 ? (
        <p className="panel-empty">
          No Pokémon yet. Walk toward the Pokémon on the map. When you get close, the catch screen opens on its own.
        </p>
      ) : (
        <>
          <div className="sort-row">
            {(["recent", "cp", "dex"] as const).map((k) => (
              <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>
                {k === "recent" ? "Recent" : k === "cp" ? "CP" : "Number"}
              </button>
            ))}
          </div>
          <div className="mon-grid">
            {sorted.map((c) => (
              <button className="mon-cell" key={c.id} onClick={() => setDetail(c.id)}>
                <div className="mon-cp">
                  <small>CP</small>
                  {c.cp}
                </div>
                <img src={spriteUrl(c.sprite)} alt={c.name} draggable={false} />
                <div className="mon-name">{c.name}</div>
              </button>
            ))}
          </div>
        </>
      )}

      <button className="close-round" onClick={() => setScreen("map")} aria-label="Close">
        ✕
      </button>
      {detailMon && <MonDetail mon={detailMon} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ItemList({ inventory, stardust }: { inventory: Inventory; stardust: number }) {
  const rows: { key: string; name: string; n: number; desc: string }[] = [
    { key: "pokeball", name: "Poké Ball", n: inventory.pokeball, desc: "A device for catching wild Pokémon." },
    { key: "greatball", name: "Great Ball", n: inventory.greatball, desc: "Higher catch rate than a Poké Ball." },
    { key: "ultraball", name: "Ultra Ball", n: inventory.ultraball, desc: "Even higher catch rate than a Great Ball." },
    { key: "razz", name: "Razz Berry", n: inventory.razz, desc: "Feed it to a wild Pokémon to make it easier to catch." },
    { key: "incense", name: "Incense", n: inventory.incense, desc: "Lures more wild Pokémon to you for 5 minutes." },
  ];
  return (
    <div className="items">
      {rows.map((r) => (
        <div key={r.key} className="item-row">
          <span className="item-ico mini-ball" data-ball={r.key} />
          <div className="item-text">
            <b>{r.name}</b>
            <span>{r.desc}</span>
          </div>
          <span className="item-n">×{r.n}</span>
        </div>
      ))}
      <div className="item-row">
        <span className="item-ico stardust-ico" />
        <div className="item-text">
          <b>Stardust</b>
          <span>Used to power up Pokémon.</span>
        </div>
        <span className="item-n">{stardust.toLocaleString()}</span>
      </div>
    </div>
  );
}

function MonDetail({ mon, onClose }: { mon: CaughtMon; onClose: () => void }) {
  const pokedex = useGame((s) => s.pokedex);
  const candy = useGame((s) => s.save.trainer.candy[mon.dex] || 0);
  const stardust = useGame((s) => s.save.trainer.stardust);
  const powerUp = useGame((s) => s.powerUp);
  const transfer = useGame((s) => s.transfer);
  const base = speciesOrWatchman(pokedex, mon.dex);
  if (!base) return null;
  const cost = 200 + mon.level * 25;
  const t2 = base.type2 && base.type2 !== "none" ? base.type2 : null;
  return (
    <div className="mon-detail" style={{ ["--c" as string]: typeColor(base.type1) }}>
      <div className="md-stage">
        <Canvas shadows="percentage" camera={{ position: [0, 1.4, 4.6], fov: 40 }} dpr={[1, 2]}>
          <hemisphereLight args={["#ffffff", "#8fc9a8", 1.4]} />
          <directionalLight position={[3, 6, 4]} intensity={2.2} castShadow />
          <Suspense fallback={isWatchman(base) ? <WatchmanPlaceholder height={1.7} /> : null}>
            {isWatchman(base) ? (
              <WoodenWatchman height={1.7} castShadow />
            ) : (
              <PokemonModel pokemon={base} height={1.7} />
            )}
          </Suspense>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <circleGeometry args={[1.4, 64]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
          </mesh>
          <ContactShadows position={[0, 0.001, 0]} scale={5} blur={2.2} opacity={0.5} far={3} />
          <OrbitControls target={[0, 0.85, 0]} enablePan={false} minDistance={2.5} maxDistance={8} autoRotate autoRotateSpeed={1.2} />
        </Canvas>
        <div className="md-cp">
          <small>CP</small>
          {mon.cp}
        </div>
      </div>
      <div className="md-body">
        <h2>{mon.name}</h2>
        <div className="md-dex">
          {isWatchman(base) ? "Wood" : `#${String(mon.dex).padStart(3, "0")}`} · Level {mon.level}
        </div>
        <div className="enc-types">
          <span style={{ background: typeColor(base.type1) }}>{base.type1}</span>
          {t2 && <span style={{ background: typeColor(t2) }}>{t2}</span>}
        </div>
        <div className="md-stats">
          <Stat label="Attack" v={base.atk} />
          <Stat label="Defense" v={base.def} />
          <Stat label="Stamina" v={base.stm} />
        </div>
        <div className="md-res">
          <div>
            <b>{stardust.toLocaleString()}</b>
            <span>Stardust</span>
          </div>
          <div>
            <b>{candy}</b>
            <span>{mon.name} Candy</span>
          </div>
        </div>
        <div className="md-actions">
          <button className="pill-btn" onClick={() => useGame.getState().openTraining(mon.id)}>
            Train
          </button>
          <button className="pill-btn green" disabled={mon.level >= 40 || stardust < cost || candy < 2} onClick={() => powerUp(mon.id)}>
            Power up · {cost} Stardust · 2 Candy
          </button>
          <button
            className="pill-btn ghost"
            onClick={() => {
              transfer(mon.id);
              onClose();
            }}
          >
            Transfer
          </button>
        </div>
      </div>
      <button className="close-round" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <div className="stat-bar">
        <i style={{ width: `${Math.min(100, (v / 300) * 100)}%` }} />
      </div>
    </div>
  );
}

/** PokéStop / Gym spin screen: drag the photo disc sideways to spin it. */
export function SpinStop() {
  const id = useGame((s) => s.spinStopId);
  const stop = useGame((s) => s.stops.find((x) => x.id === s.spinStopId));
  const close = useGame((s) => s.closeStop);
  const spin = useGame((s) => s.spinStop);
  const [angle, setAngle] = useState(0);
  const [loot, setLoot] = useState<{ items: Partial<Inventory>; stardust: number; xp: number } | null>(null);
  const drag = useRef<{ x: number; total: number } | null>(null);
  const vel = useRef(0);

  useEffect(() => {
    setLoot(null);
    setAngle(0);
  }, [id]);

  // auto-close when walking away
  useEffect(() => {
    const t = setInterval(() => {
      const g = useGame.getState();
      if (stop && distanceMeters(stop.pos, g.pos) > SPIN_RADIUS + 10) close();
    }, 1000);
    return () => clearInterval(t);
  }, [stop, close]);

  // inertia after release
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (!drag.current && Math.abs(vel.current) > 0.1) {
        vel.current *= 0.95;
        setAngle((a) => a + vel.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!stop) return null;
  const cooling = stop.cooldownUntil > Date.now();
  const isGym = stop.kind === "gym";

  const doSpin = () => {
    if (loot || cooling) return;
    const r = spin(stop.id);
    if (r) setLoot(r);
  };

  return (
    <div className="spin-overlay">
      <div className={`spin-name ${isGym ? "gym" : ""}`}>{stop.name}</div>
      <div className="spin-kind">{isGym ? "Gym" : "PokéStop"}</div>
      <div
        className={`spin-disc ${cooling || loot ? "used" : ""} ${isGym ? "gym" : ""}`}
        style={{ transform: `perspective(700px) rotateY(${angle}deg)` }}
        onPointerDown={(e) => {
          capturePointer(e);
          drag.current = { x: e.clientX, total: 0 };
          vel.current = 0;
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          drag.current.x = e.clientX;
          drag.current.total += Math.abs(dx);
          vel.current = dx * 0.9;
          setAngle((a) => a + dx * 0.9);
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (d && d.total > 80) doSpin();
        }}
      >
        <div className="disc-face">
          <div className="disc-photo">
            <span>{isGym ? "🏛" : "📍"}</span>
          </div>
        </div>
      </div>
      <div className="spin-hint">
        {cooling && !loot ? "You already spun this one. Come back in a few minutes." : loot ? "Items collected!" : "Swipe the disc sideways to spin it"}
      </div>
      {loot && (
        <div className="loot">
          {Object.entries(loot.items).map(([k, n]) => (
            <div key={k} className="loot-item">
              <span className="mini-ball" data-ball={k} />
              <b>×{n}</b>
            </div>
          ))}
          <div className="loot-item">
            <span className="stardust-ico" />
            <b>{loot.stardust}</b>
          </div>
          <div className="loot-item xp">
            <b>+{loot.xp} XP</b>
          </div>
        </div>
      )}
      <button className="close-round" onClick={close} aria-label="Close">
        ✕
      </button>
    </div>
  );
}

export function Toast() {
  const toast = useGame((s) => s.toast);
  const [shown, setShown] = useState<typeof toast>(null);
  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    const t = setTimeout(() => setShown((cur) => (cur?.id === toast.id ? null : cur)), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  if (!shown) return null;
  return (
    <div key={shown.id} className="toast">
      {shown.text}
    </div>
  );
}
