"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { BallType, Spawn, ThrowBonus } from "@/lib/types";
import { catchChance, ringColor, typeColor } from "@/lib/game";
import { isNight } from "@/lib/mapStyle";
import { useGame, type CatchReward } from "@/lib/store";
import { capturePointer } from "@/lib/pointer";
import CatchScene, { type ThrowInput } from "./CatchScene";
import { biomeFor } from "./Scenery";

const BALLS: BallType[] = ["pokeball", "greatball", "ultraball"];
const BALL_NAME: Record<BallType, string> = {
  pokeball: "Poké Ball",
  greatball: "Great Ball",
  ultraball: "Ultra Ball",
};
const BONUS_TEXT: Record<ThrowBonus, string> = { none: "", nice: "Nice!", great: "Great!", excellent: "Excellent!" };

type Ui = "intro" | "aim" | "busy" | "caught" | "fled";

export default function Encounter({ spawn }: { spawn: Spawn }) {
  const inventory = useGame((s) => s.save.inventory);
  const [ball, setBall] = useState<BallType>(() => BALLS.find((b) => inventory[b] > 0) ?? "pokeball");
  const [razz, setRazz] = useState(false);
  const [ui, setUi] = useState<Ui>("intro");
  const [banner, setBanner] = useState<string | null>(null);
  const [bonusText, setBonusText] = useState<{ id: number; text: string } | null>(null);
  const [reward, setReward] = useState<CatchReward | null>(null);
  const [ballMenu, setBallMenu] = useState(false);
  const pendingBonus = useRef<ThrowBonus>("none");
  const usedRazz = useRef(false);

  const night = useMemo(() => isNight(), []);
  const { biome, style } = useMemo(
    () => biomeFor(spawn.pokemon.type1, spawn.pokemon.type2 === "none" ? null : spawn.pokemon.type2, night),
    [spawn.pokemon, night]
  );
  const chance = catchChance(spawn.pokemon, spawn.cp, ball, razz);

  const input = useRef<ThrowInput>({ dragging: false, ndc: new THREE.Vector2(), release: null });

  useEffect(() => {
    setBanner(`A wild ${spawn.pokemon.name} appeared!`);
    const t = setTimeout(() => setBanner(null), 2200);
    return () => clearTimeout(t);
  }, [spawn.pokemon.name]);

  // if the currently selected ball runs out, pick another
  useEffect(() => {
    if (inventory[ball] > 0) return;
    const other = BALLS.find((b) => inventory[b] > 0);
    if (other) setBall(other);
  }, [inventory, ball]);

  const showBonus = (b: ThrowBonus) => {
    if (b === "none") return;
    setBonusText({ id: Date.now(), text: BONUS_TEXT[b] });
    setTimeout(() => setBonusText(null), 1300);
  };

  const callbacks = {
    onIntroDone: useCallback(() => setUi("aim"), []),
    onThrow: () => {
      const inv = useGame.getState().save.inventory;
      if (inv[ball] <= 0) {
        useGame.getState().flash(`You're out of ${BALL_NAME[ball]}s! Spin PokéStops to get more.`);
        return false;
      }
      usedRazz.current = razz && inv.razz > 0;
      useGame.getState().consumeThrow(ball, usedRazz.current);
      setRazz(false);
      setBallMenu(false);
      setUi("busy");
      return true;
    },
    onHit: (bonus: ThrowBonus) => {
      pendingBonus.current = bonus;
      showBonus(bonus);
      const p = catchChance(spawn.pokemon, spawn.cp, ball, usedRazz.current, bonus);
      const success = Math.random() < p;
      // more shakes when it was close
      const shakes = success ? 3 : Math.random() < p ? 2 : Math.random() < 0.5 ? 1 : 0;
      return { success, shakes };
    },
    onShake: () => {},
    onCaught: () => {
      const r = useGame.getState().resolveCatch(pendingBonus.current);
      setReward(r);
      setUi("caught");
    },
    onBreakOut: () => {
      const fled = Math.random() < 0.08 + spawn.pokemon.rarity * 0.04;
      if (!fled) {
        setUi("aim");
        setBanner(Math.random() < 0.5 ? "Argh! Almost had it!" : "Aww! It appeared to be caught!");
        setTimeout(() => setBanner(null), 1500);
      }
      return fled;
    },
    onFled: () => {
      useGame.getState().flee();
      setUi("fled");
      setTimeout(() => useGame.getState().finishEncounter(spawn.id), 1800);
    },
    onMiss: () => setUi("aim"),
  };

  // --- swipe to throw --------------------------------------------------
  const samples = useRef<{ t: number; x: number; y: number }[]>([]);
  const onPointerDown = (e: React.PointerEvent) => {
    if (ui !== "aim") return;
    if (e.clientY < window.innerHeight * 0.45) return;
    capturePointer(e);
    input.current.dragging = true;
    samples.current = [{ t: performance.now(), x: e.clientX, y: e.clientY }];
    updateNdc(e);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!input.current.dragging) return;
    updateNdc(e);
    const now = performance.now();
    samples.current.push({ t: now, x: e.clientX, y: e.clientY });
    while (samples.current.length > 2 && now - samples.current[0].t > 90) samples.current.shift();
  };
  const onPointerUp = () => {
    if (!input.current.dragging) return;
    input.current.dragging = false;
    const s = samples.current;
    if (s.length >= 2) {
      const a = s[0];
      const b = s[s.length - 1];
      const dt = Math.max(0.016, (b.t - a.t) / 1000);
      const H = window.innerHeight;
      input.current.release = { vx: (b.x - a.x) / dt / H, vy: -(b.y - a.y) / dt / H };
    }
  };
  const updateNdc = (e: React.PointerEvent) => {
    input.current.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  };

  const run = () => {
    if (ui === "busy") return;
    useGame.getState().runAway();
  };

  const finish = () => useGame.getState().finishEncounter();

  const t1 = spawn.pokemon.type1;
  const t2 = spawn.pokemon.type2 && spawn.pokemon.type2 !== "none" ? spawn.pokemon.type2 : null;

  return (
    <div className="encounter" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ fov: 50, near: 0.05, far: 400, position: [0, 1.45, 11] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
        style={{ position: "absolute", inset: 0, touchAction: "none" }}
      >
        <Suspense fallback={null}>
          <CatchScene
            spawn={spawn}
            ringColor={ringColor(chance)}
            input={input}
            biome={biome}
            style={style}
            razz={razz}
            {...callbacks}
          />
        </Suspense>
      </Canvas>

      <div className="enc-flash" />

      {/* top bar */}
      {ui !== "caught" && ui !== "fled" && (
        <button className="enc-run" onClick={run} onPointerDown={(e) => e.stopPropagation()} aria-label="Run away">
          <RunIcon />
        </button>
      )}
      <div className="enc-title">
        <div className="enc-cp">
          <small>CP</small>
          {spawn.cp}
        </div>
        <div className="enc-name">{spawn.pokemon.name}</div>
        <div className="enc-types">
          <span style={{ background: typeColor(t1) }}>{t1}</span>
          {t2 && <span style={{ background: typeColor(t2) }}>{t2}</span>}
        </div>
      </div>

      {banner && <div className="enc-banner">{banner}</div>}
      {bonusText && (
        <div key={bonusText.id} className={`enc-bonus b-${bonusText.text.replace("!", "").toLowerCase()}`}>
          {bonusText.text}
        </div>
      )}

      {(ui === "aim" || ui === "intro") && (
        <>
          <div className="enc-hint">Swipe the Skibidi Toilet up to throw. Try to land it inside the colored ring!</div>
          <div className="enc-bottom" onPointerDown={(e) => e.stopPropagation()}>
            <button
              className={`enc-item razz ${razz ? "on" : ""}`}
              disabled={inventory.razz <= 0 || razz}
              onClick={() => setRazz(true)}
              title="Razz Berry: makes it easier to catch"
            >
              <span className="razz-ico" />
              <b>{inventory.razz}</b>
            </button>
            <div className="enc-count">
              Skibidi Toilet ×{inventory[ball]}
            </div>
            <button className="enc-item" onClick={() => setBallMenu((v) => !v)} title="Switch ball">
              <span className="mini-ball" data-ball={ball} />
              <b>⇄</b>
            </button>
          </div>
          {ballMenu && (
            <div className="ball-menu" onPointerDown={(e) => e.stopPropagation()}>
              {BALLS.map((b) => (
                <button
                  key={b}
                  className={b === ball ? "sel" : ""}
                  disabled={inventory[b] <= 0}
                  onClick={() => {
                    setBall(b);
                    setBallMenu(false);
                  }}
                >
                  <span className="mini-ball" data-ball={b} />
                  {BALL_NAME[b]}
                  <b>×{inventory[b]}</b>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {ui === "fled" && <div className="enc-banner big">Oh no! The Pokémon fled.</div>}

      {ui === "caught" && reward && (
        <div className="gotcha" onPointerDown={(e) => e.stopPropagation()}>
          <div className="gotcha-title">Gotcha!</div>
          <div className="gotcha-card">
            <div className="gotcha-sub">
              {spawn.pokemon.name} was caught!
              {reward.isNew && <span className="new-tag">New Pokédex entry</span>}
            </div>
            <div className="gotcha-rewards">
              <div>
                <b>{reward.xp}</b>
                <span>XP</span>
              </div>
              <div>
                <b>{reward.stardust}</b>
                <span>Stardust</span>
              </div>
              <div>
                <b>{reward.candy}</b>
                <span>Candy</span>
              </div>
            </div>
            {reward.bonus !== "none" && <div className="gotcha-bonus">{BONUS_TEXT[reward.bonus]} Throw bonus</div>}
            <button className="pill-btn" onClick={finish}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
      <circle cx="14.5" cy="4" r="2.2" />
      <path d="M10.6 8.3 7 10.2v3.6h2v-2.4l1.7-.9-1.5 7.3-3.6-.7-.4 2 5.6 1.1 1-4.7 2.2 2.1V23h2v-6.2l-2.3-2.2.7-3.3c1.1 1.3 2.7 2.2 4.6 2.2v-2c-1.6 0-2.9-.9-3.6-2.1l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5 0-.8.1Z" />
    </svg>
  );
}
