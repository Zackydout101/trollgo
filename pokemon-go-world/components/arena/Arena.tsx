"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { Pokemon } from "@/lib/types";
import { useGame } from "@/lib/store";
import { BOSSES, type Boss } from "@/lib/bosses";
import { isCritter, speciesOf } from "@/lib/critters";
import { isWatchman, WOODEN_WATCHMAN } from "@/lib/watchman";
import { isSmurf } from "@/lib/smurf";
import WoodenWatchman, { WatchmanPlaceholder } from "../three/WoodenWatchman";
import Smurf, { SmurfPlaceholder } from "../three/Smurf";
import CritterModel from "../three/CritterModel";
import SubwayRunner from "./SubwayRunner";
import BattleMusic from "../audio/BattleMusic";

type Phase = "select" | "fight" | "won" | "lost";

/** Which animated character fights on your side, and the sprite that runs in the subway. */
type FighterKind = "watchman" | "smurf" | "critter";
interface Fighter {
  kind: FighterKind;
  base: Pokemon;
}

export default function Arena() {
  const leaveArena = useGame((s) => s.leaveArena);
  const arenaBoss = useGame((s) => s.arenaBoss);
  const caught = useGame((s) => s.save.caught);
  const pokedex = useGame((s) => s.pokedex);
  const trainerLevel = useGame((s) => s.save.trainer.level);
  const grantSpoils = useGame((s) => s.grantSpoils);

  const [bossIndex, setBossIndex] = useState(arenaBoss ?? 0);
  const [phase, setPhase] = useState<Phase>(arenaBoss != null ? "fight" : "select");
  const [bossHp, setBossHp] = useState(BOSSES[arenaBoss ?? 0].hp);
  const [playerHp, setPlayerHp] = useState(100);
  const [float, setFloat] = useState<{ id: number; text: string; crit: boolean } | null>(null);
  const [shake, setShake] = useState(0);
  const [hurting, setHurting] = useState(false);
  const [hud, setHud] = useState({ coins: 0, meters: 0 });

  // Play the hurt shake without remounting the arena subtree (which would reload the runner engine).
  useEffect(() => {
    if (!shake) return;
    setHurting(true);
    const t = setTimeout(() => setHurting(false), 320);
    return () => clearTimeout(t);
  }, [shake]);

  const boss = BOSSES[bossIndex];
  const claimed = useRef(false);

  // Your strongest caught Pokémon fights the boss up top while you run the subway below.
  const fighter = useMemo((): Fighter => {
    const best = caught.filter((c) => isCritter(c)).sort((a, b) => b.cp - a.cp)[0];
    if (!best) return { kind: "watchman", base: WOODEN_WATCHMAN };
    const base = speciesOf(pokedex, best.dex) ?? WOODEN_WATCHMAN;
    const kind: FighterKind = isWatchman(best) ? "watchman" : isSmurf(best) ? "smurf" : "critter";
    return { kind, base };
  }, [caught, pokedex]);

  const { bestCp, playerMaxHp, playerAtk } = useMemo(() => {
    const bestCp = caught.filter((c) => isCritter(c)).reduce((m, c) => Math.max(m, c.cp), 0);
    const playerMaxHp = Math.round(120 + trainerLevel * 12 + bestCp * 0.45);
    const playerAtk = Math.round(14 + trainerLevel * 1.6 + bestCp * 0.07);
    return { bestCp, playerMaxHp, playerAtk };
  }, [caught, trainerLevel]);

  // 3D feedback refs read inside the render loop (no React re-render on every hit)
  const bossHitAt = useRef(0);
  const bossLungeAt = useRef(0);
  const playerLungeAt = useRef(0);

  const startFight = useCallback(
    (i: number) => {
      setBossIndex(i);
      setBossHp(BOSSES[i].hp);
      setPlayerHp(playerMaxHp);
      setHud({ coins: 0, meters: 0 });
      claimed.current = false;
      setPhase("fight");
    },
    [playerMaxHp]
  );

  // If we arrived from a map arena spot, drop straight into that boss fight.
  useEffect(() => {
    if (arenaBoss != null) startFight(arenaBoss);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaBoss]);

  // Boss retaliates on a timer while the fight is live.
  // Swings are a slice of your max HP so a clean ~20s run wins and a sloppy one doesn't.
  useEffect(() => {
    if (phase !== "fight") return;
    const chip = [0.05, 0.058, 0.062, 0.056][bossIndex] ?? 0.06;
    const id = setInterval(() => {
      bossLungeAt.current = performance.now();
      setPlayerHp((hp) => {
        const dmg = Math.max(1, Math.round(playerMaxHp * chip * (0.85 + Math.random() * 0.3)));
        const next = Math.max(0, hp - dmg);
        setShake(Date.now());
        if (next <= 0) setPhase("lost");
        return next;
      });
    }, boss.interval);
    return () => clearInterval(id);
  }, [phase, boss, bossIndex, playerMaxHp]);

  // Pay out once on victory.
  useEffect(() => {
    if (phase !== "won" || claimed.current) return;
    claimed.current = true;
    grantSpoils(boss.reward);
  }, [phase, boss, grantSpoils]);

  // ---- runner callbacks: running the subway drives your Pokémon's attacks ----
  // Coins are a slice of the boss's max HP. About one grab a second, so a clean run
  // drops the boss in ~20s instead of a handful of coins ending it immediately.
  const hitBoss = useCallback((amount: number, crit: boolean) => {
    playerLungeAt.current = performance.now();
    bossHitAt.current = performance.now();
    const dmg = Math.max(1, Math.round(amount));
    setFloat({ id: performance.now(), text: `-${dmg}`, crit });
    setBossHp((hp) => {
      const next = Math.max(0, hp - dmg);
      if (next <= 0) setPhase("won");
      return next;
    });
  }, []);

  const onCoin = useCallback(
    (streak: number) => hitBoss(boss.hp * (0.026 + Math.min(streak, 6) * 0.0008), true),
    [hitBoss, boss.hp]
  );
  const onDodge = useCallback(() => hitBoss(boss.hp * 0.008, false), [hitBoss, boss.hp]);
  const onCrash = useCallback(() => {
    setPlayerHp(0);
    setShake(Date.now());
    setPhase("lost");
  }, []);
  const onProgress = useCallback((coins: number, meters: number) => setHud({ coins, meters }), []);

  const bossPct = Math.max(0, bossHp / boss.hp);
  const playerPct = playerMaxHp > 0 ? Math.max(0, playerHp / playerMaxHp) : 0;
  const fighting = phase === "fight";

  return (
    <div className={`arena ${hurting && fighting ? "hurt" : ""}`}>
      <BattleMusic active={fighting} />
      {phase === "select" ? (
        <SelectScreen
          bossIndex={bossIndex}
          setBossIndex={setBossIndex}
          startFight={startFight}
          bestCp={bestCp}
          playerAtk={playerAtk}
          playerMaxHp={playerMaxHp}
        />
      ) : (
        <div className="arena-split">
          {/* ----------------------------------------- TOP: battle scene */}
          <div className="arena-top">
            <Canvas
              shadows="percentage"
              dpr={[1, 2]}
              camera={{ fov: 46, near: 0.1, far: 200, position: [0, 2.4, 9.2] }}
              gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
              style={{ position: "absolute", inset: 0 }}
            >
              <Suspense fallback={null}>
                <BattleStage
                  boss={boss}
                  fighter={fighter}
                  bossHitAt={bossHitAt}
                  bossLungeAt={bossLungeAt}
                  playerLungeAt={playerLungeAt}
                />
              </Suspense>
            </Canvas>

            <div className="arena-bars">
              <div className="hp boss">
                <div className="hp-name">
                  {boss.name} <small>{boss.title}</small>
                </div>
                <div className="hp-track">
                  <i style={{ width: `${bossPct * 100}%` }} />
                </div>
                <div className="hp-num">{bossHp}</div>
              </div>
            </div>

            {float && (
              <div key={float.id} className={`arena-float ${float.crit ? "crit" : ""}`}>
                {float.crit && <b>HIT!</b>}
                {float.text}
              </div>
            )}

            <div className="arena-mini-hp">
              <div className="hp me">
                <div className="hp-name">
                  {fighter.base.name} <small>you</small>
                </div>
                <div className="hp-track">
                  <i style={{ width: `${playerPct * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* -------------------------------------- BOTTOM: subway runner */}
          <div className="arena-bottom">
            <SubwayRunner
              active={fighting}
              onCoin={onCoin}
              onDodge={onDodge}
              onCrash={onCrash}
              onProgress={onProgress}
            />
            <div className="runner-tip">
              {hud.meters} m · {hud.coins} coins · ◀ ▶ lanes · ⤒ jump · ⤓ roll. One crash and you're down.
            </div>
          </div>

          {/* ---------------------------------------------- win / lose */}
          {(phase === "won" || phase === "lost") && (
            <div className="arena-result">
              <div className={`result-card ${phase}`}>
                <div className="result-title">{phase === "won" ? "Victory!" : "Defeated"}</div>
                <div className="result-sub">
                  {phase === "won"
                    ? `${boss.name} was toppled! You ran ${hud.meters} m and grabbed ${hud.coins} coins.`
                    : `${boss.name} knocked you out after ${hud.meters} m. Dodge the trains and try again.`}
                </div>
                {phase === "won" && (
                  <div className="result-rewards">
                    <div>
                      <b>{boss.reward.xp}</b>
                      <span>XP</span>
                    </div>
                    <div>
                      <b>{boss.reward.stardust}</b>
                      <span>Stardust</span>
                    </div>
                    {Object.entries(boss.reward.items).map(([k, n]) => (
                      <div key={k}>
                        <b>×{n}</b>
                        <span>{k}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="result-actions">
                  <button className="pill-btn" onClick={() => startFight(bossIndex)}>
                    {phase === "won" ? "Fight Again" : "Try Again"}
                  </button>
                  <button className="pill-btn ghost" onClick={leaveArena}>
                    Leave Arena
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <button className="close-round" onClick={leaveArena} aria-label="Leave arena">
        ✕
      </button>
    </div>
  );
}

/** Boss picker, shown only when the arena is opened from the menu (no map spot). */
function SelectScreen({
  bossIndex,
  setBossIndex,
  startFight,
  bestCp,
  playerAtk,
  playerMaxHp,
}: {
  bossIndex: number;
  setBossIndex: (i: number) => void;
  startFight: (i: number) => void;
  bestCp: number;
  playerAtk: number;
  playerMaxHp: number;
}) {
  const boss = BOSSES[bossIndex];
  return (
    <div className="arena-select">
      <div className="arena-head">
        <h2>Battle Arena</h2>
        <p>Pick a boss. Your strongest Pokémon fights while you run the subway below — coins are attacks, crashing is death.</p>
      </div>
      <div className="boss-cards">
        {BOSSES.map((b, i) => (
          <button
            key={b.id}
            className={`boss-card ${i === bossIndex ? "sel" : ""}`}
            style={{ ["--bc" as string]: b.tint }}
            onClick={() => setBossIndex(i)}
            onDoubleClick={() => startFight(i)}
          >
            <div className="bc-tier">Tier {i + 1}</div>
            <div className="bc-name">{b.name}</div>
            <div className="bc-title">{b.title}</div>
            <div className="bc-stat">
              <span>HP {b.hp}</span>
              <span>ATK {b.atk}</span>
            </div>
            <div className="bc-reward">
              +{b.reward.xp} XP · {b.reward.stardust} Stardust
            </div>
          </button>
        ))}
      </div>
      <button className="pill-btn arena-go" onClick={() => startFight(bossIndex)}>
        Challenge {boss.name}
      </button>
      <div className="arena-power">
        Your power · best CP {bestCp || 0} · {playerAtk} ATK · {playerMaxHp} HP
      </div>
    </div>
  );
}

/** The arena floor with your fighter and the boss squared off, both swinging. */
function BattleStage({
  boss,
  fighter,
  bossHitAt,
  bossLungeAt,
  playerLungeAt,
}: {
  boss: Boss;
  fighter: Fighter;
  bossHitAt: React.MutableRefObject<number>;
  bossLungeAt: React.MutableRefObject<number>;
  playerLungeAt: React.MutableRefObject<number>;
}) {
  const tint = useRef<THREE.Mesh>(null);
  const bossHeight = boss.size;
  const playerHeight = 2.0;

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    camera.position.x = Math.sin(t * 0.3) * 0.25;
    camera.lookAt(0, 1.25, 0);

    if (tint.current) {
      const since = (performance.now() - bossHitAt.current) / 1000;
      const flash = since < 0.22 ? 1 - since / 0.22 : 0;
      const mat = tint.current.material as THREE.MeshBasicMaterial;
      mat.opacity = flash * 0.6;
      tint.current.visible = flash > 0.01;
      tint.current.position.set(2.6, bossHeight * 0.5, 0);
      tint.current.scale.setScalar(bossHeight * 0.7);
    }
  });

  return (
    <>
      <color attach="background" args={["#160d20"]} />
      <fog attach="fog" args={["#160d20", 14, 44]} />
      <hemisphereLight args={["#8a7bd6", "#1a1030", 0.85]} />
      <spotLight position={[0, 14, 6]} angle={0.75} penumbra={0.6} intensity={130} color="#fff2d6" castShadow distance={60} />
      <pointLight position={[-7, 3, 2]} intensity={38} color="#6ad1ff" distance={28} />
      <pointLight position={[7, 3, 2]} intensity={38} color={boss.tint} distance={28} />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[9, 64]} />
        <meshStandardMaterial color="#2a1c3a" roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[6.3, 6.7, 64]} />
        <meshBasicMaterial color={boss.tint} transparent opacity={0.6} />
      </mesh>

      {/* your fighter (left, facing right) */}
      <Fighter side="left" lungeAt={playerLungeAt}>
        <PlayerFighter fighter={fighter} height={playerHeight} />
      </Fighter>

      {/* the boss (right, facing left) */}
      <Fighter side="right" lungeAt={bossLungeAt}>
        {boss.species === "smurf" ? (
          <Suspense fallback={<SmurfPlaceholder height={bossHeight} />}>
            <Smurf height={bossHeight} clip="attacking" castShadow />
          </Suspense>
        ) : (
          <Suspense fallback={<WatchmanPlaceholder height={bossHeight} />}>
            <WoodenWatchman height={bossHeight} clip="attacking" castShadow />
          </Suspense>
        )}
      </Fighter>

      <mesh ref={tint} visible={false}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshBasicMaterial color="#ff2a2a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <ContactShadows position={[0, 0.03, 0]} scale={16} blur={2.6} opacity={0.6} far={6} resolution={512} frames={Infinity} />
    </>
  );
}

/** Your fighter, playing the same attack clip the character uses everywhere else. */
function PlayerFighter({ fighter, height }: { fighter: Fighter; height: number }) {
  return <CritterModel pokemon={fighter.base} height={height} clip="attacking" castShadow />;
}

/** Positions a combatant on its side and lunges it toward the centre when it attacks. */
function Fighter({
  side,
  lungeAt,
  children,
}: {
  side: "left" | "right";
  lungeAt: React.MutableRefObject<number>;
  children: React.ReactNode;
}) {
  const g = useRef<THREE.Group>(null);
  const baseX = side === "left" ? -2.7 : 2.7;
  const dir = side === "left" ? 1 : -1;
  const faceY = side === "left" ? Math.PI * 0.3 : -Math.PI * 0.3;

  useFrame(({ clock }) => {
    if (!g.current) return;
    const since = (performance.now() - lungeAt.current) / 1000;
    const lunge = since < 0.4 ? Math.sin((since / 0.4) * Math.PI) * 1.25 : 0;
    g.current.position.x = baseX + lunge * dir;
    g.current.rotation.y = faceY + Math.sin(clock.elapsedTime * 0.5) * 0.04;
  });

  return (
    <group ref={g} position={[baseX, 0, 0]}>
      {children}
    </group>
  );
}
