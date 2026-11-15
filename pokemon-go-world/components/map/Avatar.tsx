"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "@/lib/store";

const SKIN = "#f6c9a4";
const HAIR = "#3b2414";
const CAP = "#e8323c";
const JACKET = "#2a8ae8";
const SHIRT = "#f4f4f4";
const PANTS = "#24324f";
const SHOE = "#f2f2f2";
const PACK = "#ffb433";

/**
 * Procedural chibi trainer. Faces +Z when rotation is 0, 1 unit ≈ 1 m before scaling.
 */
export function TrainerModel({ walkRef }: { walkRef: React.MutableRefObject<number> }) {
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);

  useFrame(({ clock }, dt) => {
    const w = walkRef.current;
    const t = clock.elapsedTime;
    const swing = Math.sin(t * 9) * 0.75 * w;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.9;
    if (armR.current) armR.current.rotation.x = swing * 0.9;
    if (body.current) {
      body.current.position.y = Math.abs(Math.sin(t * 9)) * 0.06 * w + Math.sin(t * 2) * 0.012 * (1 - w);
    }
    if (head.current) head.current.rotation.y = Math.sin(t * 0.7) * 0.25 * (1 - w);
    void dt;
  });

  return (
    <group ref={body}>
      {/* legs */}
      <group ref={legL} position={[-0.13, 0.62, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.38, 6, 12]} />
          <meshStandardMaterial color={PANTS} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.58, 0.05]} castShadow>
          <boxGeometry args={[0.2, 0.12, 0.3]} />
          <meshStandardMaterial color={SHOE} roughness={0.5} />
        </mesh>
      </group>
      <group ref={legR} position={[0.13, 0.62, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.38, 6, 12]} />
          <meshStandardMaterial color={PANTS} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.58, 0.05]} castShadow>
          <boxGeometry args={[0.2, 0.12, 0.3]} />
          <meshStandardMaterial color={SHOE} roughness={0.5} />
        </mesh>
      </group>

      {/* torso */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.24, 0.32, 8, 16]} />
        <meshStandardMaterial color={JACKET} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.98, 0.17]}>
        <boxGeometry args={[0.16, 0.42, 0.12]} />
        <meshStandardMaterial color={SHIRT} roughness={0.6} />
      </mesh>
      {/* backpack */}
      <mesh position={[0, 1.0, -0.25]} castShadow>
        <boxGeometry args={[0.36, 0.42, 0.18]} />
        <meshStandardMaterial color={PACK} roughness={0.6} />
      </mesh>

      {/* arms */}
      <group ref={armL} position={[-0.32, 1.18, 0]}>
        <mesh position={[0, -0.24, 0]} rotation={[0, 0, -0.12]} castShadow>
          <capsuleGeometry args={[0.075, 0.34, 6, 12]} />
          <meshStandardMaterial color={JACKET} roughness={0.55} />
        </mesh>
        <mesh position={[0.03, -0.48, 0]}>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      </group>
      <group ref={armR} position={[0.32, 1.18, 0]}>
        <mesh position={[0, -0.24, 0]} rotation={[0, 0, 0.12]} castShadow>
          <capsuleGeometry args={[0.075, 0.34, 6, 12]} />
          <meshStandardMaterial color={JACKET} roughness={0.55} />
        </mesh>
        <mesh position={[-0.03, -0.48, 0]}>
          <sphereGeometry args={[0.075, 12, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      </group>

      {/* head */}
      <group ref={head} position={[0, 1.55, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.3, 24, 24]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.02, -0.04]} scale={[1.04, 1, 1.04]}>
          <sphereGeometry args={[0.3, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={HAIR} roughness={0.9} />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.1, 0.0, 0.27]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color="#1b1b2a" />
        </mesh>
        <mesh position={[0.1, 0.0, 0.27]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color="#1b1b2a" />
        </mesh>
        {/* cap */}
        <mesh position={[0, 0.1, 0]} scale={[1.08, 0.9, 1.08]} castShadow>
          <sphereGeometry args={[0.3, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
          <meshStandardMaterial color={CAP} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.2, 0.26]} rotation={[0.25, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.025, 24, 1, false, -Math.PI / 2, Math.PI]} />
          <meshStandardMaterial color={CAP} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.28, 0.2]} rotation={[-0.5, 0, 0]}>
          <circleGeometry args={[0.07, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
    </group>
  );
}

/** Rings drawn on the ground around the player, like Pokémon GO's interaction radius. */
export function PlayerRings({ radius }: { radius: number }) {
  const pulse = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const k = (clock.elapsedTime * 0.5) % 1;
    pulse.current.scale.setScalar(0.15 + k * 0.85);
    (pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
  });
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
      <mesh>
        <ringGeometry args={[radius - 0.6, radius, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[radius, 96]} />
        <meshBasicMaterial color="#63d6ff" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh ref={pulse}>
        <ringGeometry args={[radius * 0.9, radius, 96]} />
        <meshBasicMaterial color="#9ae8ff" transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <ringGeometry args={[2.2, 3.2, 48]} />
        <meshBasicMaterial color="#4fc3ff" transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function useWalkBlend() {
  const walk = useRef(0);
  useFrame((_, dt) => {
    const target = useGame.getState().moving ? 1 : 0;
    walk.current += (target - walk.current) * Math.min(1, dt * 8);
  });
  return walk;
}
