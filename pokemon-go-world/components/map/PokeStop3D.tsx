"use client";

import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { PokeStop } from "@/lib/types";

const TEAM_COLORS = ["#3d7dff", "#ff3b3b", "#ffd21f"];

interface Props {
  stop: PokeStop;
  near: boolean;
  scale: number;
  onSelect: () => void;
}

export default function PokeStop3D({ stop, near, scale, onSelect }: Props) {
  const cooling = stop.cooldownUntil > Date.now();
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return;
    e.stopPropagation();
    onSelect();
  };
  return (
    <group scale={scale} onClick={click}>
      {stop.kind === "gym" ? <Gym id={stop.id} near={near} /> : <Stop near={near} cooling={cooling} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.9, 32]} />
        <meshBasicMaterial color="#000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Stop({ near, cooling }: { near: boolean; cooling: boolean }) {
  const top = useRef<THREE.Group>(null);
  const disc = useRef<THREE.Group>(null);
  const color = cooling ? "#b46cff" : "#22b4ff";
  const glow = cooling ? "#d9a8ff" : "#7fe0ff";
  useFrame(({ clock }, dt) => {
    if (top.current) {
      top.current.rotation.y += dt * 1.2;
      top.current.position.y = 3.3 + Math.sin(clock.elapsedTime * 2) * 0.08;
    }
    if (disc.current) {
      const s = THREE.MathUtils.lerp(disc.current.scale.x, near ? 1 : 0.001, Math.min(1, dt * 6));
      disc.current.scale.setScalar(s);
      disc.current.rotation.y += dt * 0.8;
    }
  });
  return (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.55, 0.65, 0.12, 24]} />
        <meshStandardMaterial color="#e9f7ff" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 3, 10]} />
        <meshStandardMaterial color="#a8e6ff" roughness={0.3} metalness={0.2} />
      </mesh>
      <group ref={top} position={[0, 3.3, 0]}>
        {!near && (
          <mesh rotation={[Math.PI / 4, 0, Math.PI / 4]}>
            <boxGeometry args={[0.75, 0.75, 0.75]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.25} metalness={0.1} />
          </mesh>
        )}
      </group>
      <group ref={disc} position={[0, 3.4, 0]} scale={0.001}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.0, 0.12, 12, 48]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.3} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.9, 0.9, 0.08, 40]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.25} roughness={0.4} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * 1.25, 0, Math.sin((i * Math.PI) / 2) * 1.25]}>
            <boxGeometry args={[0.22, 0.22, 0.22]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Gym({ id, near }: { id: string; near: boolean }) {
  const crystal = useRef<THREE.Mesh>(null);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const team = TEAM_COLORS[h % 3];
  useFrame(({ clock }, dt) => {
    if (!crystal.current) return;
    crystal.current.rotation.y += dt * (near ? 2.5 : 1);
    crystal.current.position.y = 5.6 + Math.sin(clock.elapsedTime * 1.6) * 0.15;
  });
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[1.5, 1.7, 0.4, 6]} />
        <meshStandardMaterial color="#eef3f8" roughness={0.5} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.05, 2.4, Math.sin(a) * 1.05]} rotation={[0, -a, 0.08]}>
            <boxGeometry args={[0.22, 4.2, 0.22]} />
            <meshStandardMaterial color="#d6dde6" roughness={0.4} metalness={0.3} />
          </mesh>
        );
      })}
      <mesh position={[0, 2.2, 0]}>
        <cylinderGeometry args={[0.55, 0.85, 3.6, 6]} />
        <meshStandardMaterial color={team} emissive={team} emissiveIntensity={0.25} roughness={0.35} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 4.5, 0]}>
        <cylinderGeometry args={[1.4, 1.1, 0.35, 6]} />
        <meshStandardMaterial color="#f5f8fb" roughness={0.4} />
      </mesh>
      <mesh ref={crystal} position={[0, 5.6, 0]}>
        <octahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={team} emissive={team} emissiveIntensity={0.6} roughness={0.15} metalness={0.2} />
      </mesh>
    </group>
  );
}
