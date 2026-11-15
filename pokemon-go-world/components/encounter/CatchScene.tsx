"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { Spawn, ThrowBonus } from "@/lib/types";
import type { CritterClip } from "@/lib/critters";
import { type ModelInfo } from "../three/PokemonModel";
import CritterModel from "../three/CritterModel";
import SkibidiToilet, { type SkibidiHandle } from "./SkibidiToilet";
import { Scenery, type Biome, type BiomeStyle } from "./Scenery";

export interface ThrowInput {
  dragging: boolean;
  /** pointer position in normalised device coords */
  ndc: THREE.Vector2;
  /** release velocity in screen-heights per second (x right, y up) */
  release: { vx: number; vy: number } | null;
}

export interface CatchCallbacks {
  onIntroDone: () => void;
  /** return false to cancel the throw (e.g. out of balls) */
  onThrow: () => boolean;
  onHit: (bonus: ThrowBonus) => { success: boolean; shakes: number };
  onShake: (i: number) => void;
  onCaught: () => void;
  /** returns true if the Pokémon flees after breaking out */
  onBreakOut: () => boolean;
  onFled: () => void;
  onMiss: () => void;
}

type Mode = "intro" | "ready" | "fly" | "absorb" | "drop" | "shake" | "caught" | "burst" | "flee";

const TOILET_H = 0.46;
/** Half the toilet height, so it sits on the ground and fills the catch ring. */
const BALL_R = TOILET_H / 2;
const GRAVITY = 9.8;
const CAM_BASE = new THREE.Vector3(0, 1.45, 7);

interface Props extends CatchCallbacks {
  spawn: Spawn;
  ringColor: string;
  input: React.MutableRefObject<ThrowInput>;
  biome: Biome;
  style: BiomeStyle;
  razz: boolean;
}

export default function CatchScene(props: Props) {
  const { spawn, ringColor, input, biome, style, razz } = props;
  const cb = useRef<CatchCallbacks>(props);
  cb.current = props;

  const { camera } = useThree();
  const height = useMemo(() => 1.1 + Math.min(1, spawn.pokemon.bst / 680) * 1.3, [spawn.pokemon.bst]);
  const dims = useRef<ModelInfo>({ height, radius: height * 0.4 });
  const onReady = useCallback((i: ModelInfo) => (dims.current = i), []);

  const monGroup = useRef<THREE.Group>(null);
  const monInner = useRef<THREE.Group>(null);
  const ballGroup = useRef<THREE.Group>(null);
  const toilet = useRef<SkibidiHandle>(null);
  const ringOuter = useRef<THREE.Group>(null);
  const ringInner = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const stars = useRef<THREE.Group>(null);
  const smoke = useRef<THREE.Group>(null);
  const tint = useRef<THREE.Mesh>(null);

  const sim = useRef({
    mode: "intro" as Mode,
    t: 0,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    spin: new THREE.Euler(),
    open: 0,
    monScale: 0,
    monPos: new THREE.Vector3(),
    hover: new THREE.Vector3(),
    ringK: 1,
    ringT: 0,
    jumpT: -1,
    nextJump: 3 + Math.random() * 3,
    success: false,
    shakes: 0,
    shakeIdx: 0,
    bounced: 0,
    fleeChecked: false,
    brokeOut: false,
  });

  // Waiting is the dance. A throw switches to the attack. Breaking out keeps a third clip up.
  const [clip, setClip] = useState<CritterClip>("dancing");

  const setMode = (m: Mode) => {
    const s = sim.current;
    if (m === "burst" || m === "flee") s.brokeOut = true;
    if (m === "fly") s.brokeOut = false;
    s.mode = m;
    s.t = 0;
    const next: CritterClip =
      m === "fly" || m === "absorb" || m === "drop" || m === "shake"
        ? "attacking"
        : s.brokeOut
          ? "walking"
          : "dancing";
    setClip((cur) => (cur === next ? cur : next));
  };
  const tmp = useMemo(
    () => ({
      v: new THREE.Vector3(),
      v2: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      ray: new THREE.Raycaster(),
    }),
    []
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const s = sim.current;
    s.t += dt;
    const h = dims.current.height;
    const r = Math.max(0.3, dims.current.radius);
    const time = state.clock.elapsedTime;

    // --- camera: dolly-in intro, then a slight handheld sway -------------
    const introK = s.mode === "intro" ? easeOutCubic(Math.min(1, s.t / 1.1)) : 1;
    const camZ = THREE.MathUtils.lerp(11.5, CAM_BASE.z + Math.max(0, h - 2) * 1.2, introK);
    camera.position.set(
      Math.sin(time * 0.6) * 0.04,
      CAM_BASE.y + Math.max(0, h - 1.8) * 0.35 + Math.sin(time * 0.8) * 0.03,
      camZ
    );
    camera.lookAt(0, 0.85 + h * 0.18, 0);
    camera.updateMatrixWorld();

    // --- pokémon idle hops ----------------------------------------------
    let jumpY = 0;
    if (s.mode === "ready" || s.mode === "fly") {
      s.nextJump -= dt;
      if (s.nextJump <= 0 && s.jumpT < 0) {
        s.jumpT = 0;
        s.nextJump = 2.5 + Math.random() * 4;
      }
    }
    if (s.jumpT >= 0) {
      s.jumpT += dt;
      const k = s.jumpT / 0.55;
      if (k >= 1) s.jumpT = -1;
      else jumpY = Math.sin(k * Math.PI) * 0.55;
    }

    // rest position for the ball, fixed relative to the camera
    const rest = tmp.v.set(0, -0.52, -1.6).applyMatrix4(camera.matrixWorld);

    switch (s.mode) {
      case "intro": {
        s.monScale = easeOutBack(Math.min(1, s.t / 0.7));
        s.pos.copy(rest).y -= 0.6 * (1 - introK);
        if (s.t > 1.1) {
          setMode("ready");
          cb.current.onIntroDone();
        }
        break;
      }
      case "ready": {
        s.monScale = 1;
        s.open = 0;
        const inp = input.current;
        if (inp.release) {
          const rel = inp.release;
          inp.release = null;
          const up = rel.vy;
          if (up > 0.6 && cb.current.onThrow()) {
            const k = THREE.MathUtils.clamp(up / 4, 0.05, 1.35);
            camera.getWorldDirection(tmp.fwd);
            tmp.fwd.y = 0;
            tmp.fwd.normalize();
            s.vel.set(rel.vx * 2.1, 0.8 + 4.2 * k, 0).addScaledVector(tmp.fwd, 5 + 7 * k);
            s.bounced = 0;
            setMode("fly");
            break;
          }
        }
        if (inp.dragging) {
          tmp.ray.setFromCamera(inp.ndc, camera);
          camera.getWorldDirection(tmp.fwd);
          const d = 1.6 / Math.max(0.2, tmp.ray.ray.direction.dot(tmp.fwd));
          tmp.v2.copy(tmp.ray.ray.origin).addScaledVector(tmp.ray.ray.direction, d);
          s.pos.lerp(tmp.v2, Math.min(1, dt * 25));
          s.spin.x += dt * 2;
        } else {
          s.pos.lerp(rest, Math.min(1, dt * 12));
          s.pos.y += Math.sin(time * 2.4) * 0.0015;
          s.spin.x = THREE.MathUtils.lerp(s.spin.x % (Math.PI * 2), 0, Math.min(1, dt * 6));
        }
        s.spin.y = Math.sin(time * 1.3) * 0.15;
        break;
      }
      case "fly": {
        const prevZ = s.pos.z;
        s.vel.y -= GRAVITY * dt;
        s.pos.addScaledVector(s.vel, dt);
        s.spin.x -= dt * 22;
        const hitZ = r * 0.55;
        if (!s.bounced && prevZ > hitZ && s.pos.z <= hitZ) {
          const f = (prevZ - hitZ) / Math.max(1e-4, prevZ - s.pos.z);
          const hx = s.pos.x + s.vel.x * dt * (f - 1);
          const hy = s.pos.y + s.vel.y * dt * (f - 1);
          const halfW = Math.max(0.4, r * 1.05);
          if (Math.abs(hx) <= halfW && hy >= jumpY - 0.15 && hy <= jumpY + Math.max(h, 1.1) + 0.3) {
            const ringR = ringRadius(h, r);
            const dist = Math.hypot(hx, hy - (jumpY + h * 0.5));
            let bonus: ThrowBonus = "none";
            if (dist <= ringR * s.ringK + BALL_R) {
              bonus = s.ringK < 0.4 ? "excellent" : s.ringK < 0.7 ? "great" : "nice";
            }
            const res = cb.current.onHit(bonus);
            s.success = res.success;
            s.shakes = res.success ? 3 : res.shakes;
            s.shakeIdx = 0;
            s.pos.set(hx, hy, hitZ + 0.05);
            s.hover.set(hx * 0.3, Math.min(jumpY + h * 0.6 + 0.6, 2.6), r + 1.0);
            s.monPos.set(0, jumpY, 0);
            setMode("absorb");
            break;
          }
        }
        if (s.pos.y <= BALL_R && s.vel.y < 0) {
          s.pos.y = BALL_R;
          s.vel.y *= -0.35;
          s.vel.x *= 0.7;
          s.vel.z *= 0.7;
          s.bounced++;
        }
        if (s.t > 1.8 || s.pos.z < -12) {
          cb.current.onMiss();
          s.pos.copy(rest).y -= 0.5;
          s.brokeOut = true;
          setMode("ready");
        }
        break;
      }
      case "absorb": {
        const t = s.t;
        const go = easeOutCubic(Math.min(1, t / 0.32));
        s.pos.lerp(s.hover, go * 0.35);
        s.spin.x = THREE.MathUtils.lerp(s.spin.x % (Math.PI * 2), -0.35, Math.min(1, dt * 10));
        s.spin.z = 0;
        s.open = t < 0.3 ? 0 : t < 0.5 ? easeOutCubic((t - 0.3) / 0.2) : t < 1.05 ? 1 : 1 - Math.min(1, (t - 1.05) / 0.15);
        const suck = THREE.MathUtils.clamp((t - 0.4) / 0.55, 0, 1);
        s.monScale = 1 - easeInCubic(suck);
        s.monPos.set(0, jumpY * (1 - suck), 0).lerp(tmp.v2.copy(s.pos).setY(s.pos.y - h * 0.3), easeInCubic(suck));
        if (t > 1.25) {
          s.vel.set(0, 0.5, 0);
          s.monScale = 0;
          setMode("drop");
        }
        break;
      }
      case "drop": {
        s.vel.y -= GRAVITY * dt;
        s.pos.addScaledVector(s.vel, dt);
        if (s.pos.y <= BALL_R) {
          s.pos.y = BALL_R;
          if (Math.abs(s.vel.y) > 0.8) s.vel.y *= -0.32;
          else s.vel.y = 0;
        }
        s.spin.x = THREE.MathUtils.lerp(s.spin.x, -0.15, Math.min(1, dt * 6));
        if (s.t > 0.9) setMode("shake");
        break;
      }
      case "shake": {
        const per = 1.0;
        const local = s.t - s.shakeIdx * per;
        if (s.shakeIdx >= s.shakes) {
          if (s.success) {
            setMode("caught");
            toilet.current?.play();
            cb.current.onCaught();
          } else {
            setMode("burst");
          }
          break;
        }
        if (local > 0.3) {
          const k = (local - 0.3) / 0.6;
          s.spin.z = Math.sin(k * Math.PI * 3) * 0.5 * (1 - k);
        }
        if (local >= per) {
          cb.current.onShake(s.shakeIdx);
          s.shakeIdx++;
          s.spin.z = 0;
        }
        break;
      }
      case "caught": {
        s.spin.z = 0;
        break;
      }
      case "burst": {
        const t = s.t;
        s.open = Math.min(1, t / 0.12);
        s.monPos.set(0, 0, 0);
        s.monScale = easeOutBack(Math.min(1, t / 0.45));
        if (t > 0.7 && !s.fleeChecked) {
          s.fleeChecked = true;
          const fled = cb.current.onBreakOut();
          if (fled) setMode("flee");
          else {
            s.fleeChecked = false;
            s.open = 0;
            s.spin.set(0, 0, 0);
            s.pos.copy(rest).y -= 0.5;
            setMode("ready");
          }
        }
        break;
      }
      case "flee": {
        const k = Math.min(1, s.t / 0.9);
        s.monScale = 1 - easeInCubic(k);
        s.monPos.y = k * 0.6;
        if (s.t > 1.4 && !s.fleeChecked) {
          s.fleeChecked = true;
          cb.current.onFled();
        }
        break;
      }
    }

    // --- apply to scene graph ------------------------------------------
    const showBall = !(s.mode === "burst" && s.t > 0.12) && s.mode !== "flee";
    if (ballGroup.current) {
      ballGroup.current.visible = showBall;
      ballGroup.current.position.copy(s.pos);
      ballGroup.current.rotation.copy(s.spin);
      if (s.mode === "caught") ballGroup.current.scale.setScalar(1 + Math.max(0, 0.12 - s.t * 0.4));
      else ballGroup.current.scale.setScalar(1);
    }

    if (monGroup.current) {
      const inAbsorb = s.mode === "absorb" || s.mode === "burst";
      if (inAbsorb || s.mode === "flee") monGroup.current.position.copy(s.monPos);
      else monGroup.current.position.set(0, jumpY, 0);
      monGroup.current.scale.setScalar(Math.max(0.0001, s.monScale));
      monGroup.current.visible = s.monScale > 0.001;
      monGroup.current.rotation.y = s.mode === "flee" ? s.t * 8 : 0;
    }
    if (tint.current) {
      const red =
        s.mode === "absorb" ? THREE.MathUtils.clamp((s.t - 0.3) / 0.3, 0, 1) : s.mode === "burst" ? Math.max(0, 1 - s.t * 2) : 0;
      const mat = tint.current.material as THREE.MeshBasicMaterial;
      mat.opacity = red * 0.55;
      tint.current.visible = red > 0.01 && s.monScale > 0.01;
      tint.current.scale.set(Math.max(0.4, r * 1.3), h * 0.6, Math.max(0.4, r * 1.3));
      tint.current.position.set(0, h * 0.5, 0);
    }

    // beam between ball and pokémon while absorbing
    if (beam.current) {
      const on = s.mode === "absorb" && s.t > 0.32 && s.t < 1.05;
      beam.current.visible = on;
      if (on) {
        const from = tmp.v2.copy(s.monPos).setY(s.monPos.y + h * 0.5 * Math.max(0.2, s.monScale));
        const to = s.pos;
        const mid = from.clone().add(to).multiplyScalar(0.5);
        const len = from.distanceTo(to);
        beam.current.position.copy(mid);
        beam.current.lookAt(to);
        beam.current.rotateX(Math.PI / 2);
        beam.current.scale.set(1 + Math.sin(time * 40) * 0.2, Math.max(0.01, len), 1);
      }
    }

    // flash on break-out
    if (flash.current) {
      const on = s.mode === "burst" && s.t < 0.5;
      flash.current.visible = on;
      if (on) {
        flash.current.position.copy(s.pos);
        flash.current.scale.setScalar(0.2 + s.t * 5);
        (flash.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - s.t / 0.5);
      }
    }

    // stars on capture
    if (stars.current) {
      const on = s.mode === "caught" && s.t < 1.6;
      stars.current.visible = on;
      if (on) {
        stars.current.position.copy(s.pos);
        stars.current.children.forEach((c, i) => {
          const a = (i / stars.current!.children.length) * Math.PI * 2;
          const k = easeOutCubic(Math.min(1, s.t / 0.9));
          c.position.set(Math.cos(a) * k * 0.55, 0.15 + Math.sin(a) * k * 0.4 + k * 0.3, 0);
          c.rotation.z = s.t * 4 + i;
          c.scale.setScalar(Math.max(0.001, 1 - Math.max(0, s.t - 0.9) / 0.7));
        });
      }
    }

    // smoke when fleeing
    if (smoke.current) {
      const on = s.mode === "flee" && s.t < 1.3;
      smoke.current.visible = on;
      if (on) {
        smoke.current.children.forEach((c, i) => {
          const a = (i / smoke.current!.children.length) * Math.PI * 2;
          const k = s.t / 1.3;
          c.position.set(Math.cos(a) * (0.3 + k * 1.2), h * 0.3 + k * 1.2 + (i % 3) * 0.2, Math.sin(a) * (0.3 + k));
          c.scale.setScalar(0.25 + k * 0.6);
          ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.8 * (1 - k);
        });
      }
    }

    // catch ring
    const ringVisible = s.mode === "ready" || s.mode === "fly";
    if (ringOuter.current) {
      ringOuter.current.visible = ringVisible;
      if (ringVisible) {
        s.ringT += dt;
        s.ringK = 0.12 + 0.88 * (1 - ((s.ringT * 0.42) % 1));
        const R = ringRadius(h, r);
        ringOuter.current.position.set(0, jumpY + h * 0.5, r * 0.55 + 0.05);
        ringOuter.current.quaternion.copy(camera.quaternion);
        ringOuter.current.scale.setScalar(R);
        ringInner.current?.scale.setScalar(s.ringK);
      }
    }
  });

  const starShape = useMemo(() => {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? 0.07 : 0.03;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0) sh.moveTo(x, y);
      else sh.lineTo(x, y);
    }
    return sh;
  }, []);

  return (
    <>
      <Scenery style={style} biome={biome} seed={spawn.pokemon.dex * 97} />

      <group ref={monGroup} scale={0.0001}>
        <group ref={monInner}>
          <CritterModel pokemon={spawn.pokemon} height={height} castShadow clip={clip} onReady={onReady} />
        </group>
        {razz && <RazzHearts height={height} />}
      </group>
      <mesh ref={tint} visible={false}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#ff2a2a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <ContactShadows position={[0, 0.01, 0]} scale={8} blur={2.4} opacity={0.55} far={4} resolution={512} frames={Infinity} />

      <group ref={ringOuter} visible={false}>
        <mesh>
          <ringGeometry args={[0.965, 1, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={ringInner}>
          <ringGeometry args={[0.88, 1, 64]} />
          <meshBasicMaterial color={ringColor} transparent opacity={0.95} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <group ref={ballGroup}>
        <SkibidiToilet ref={toilet} height={TOILET_H} />
      </group>

      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.03, 0.09, 1, 12, 1, true]} />
        <meshBasicMaterial color="#ff3030" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={flash} visible={false}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <group ref={stars} visible={false}>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i}>
            <shapeGeometry args={[starShape]} />
            <meshBasicMaterial color="#ffe14d" side={THREE.DoubleSide} depthTest={false} />
          </mesh>
        ))}
      </group>
      <group ref={smoke} visible={false}>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#eef0f2" transparent opacity={0.8} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function RazzHearts({ height }: { height: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.6 + i / 3) % 1;
      c.position.set(Math.sin(i * 2.1 + t * 3) * 0.4, height * 0.9 + t * 0.8, 0.2);
      c.scale.setScalar(0.6 + Math.sin(t * Math.PI) * 0.6);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(t * Math.PI);
    });
  });
  return (
    <group ref={g}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.06, 10, 10]} />
          <meshBasicMaterial color="#ff4f9a" transparent />
        </mesh>
      ))}
    </group>
  );
}

function ringRadius(h: number, r: number) {
  return THREE.MathUtils.clamp(Math.max(h * 0.36, r * 0.9), 0.4, 1.25);
}
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x: number) => x * x * x;
const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
