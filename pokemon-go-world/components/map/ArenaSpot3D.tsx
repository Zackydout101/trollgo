"use client";

import { useMemo, useRef } from "react";
import { Billboard } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { BOSSES } from "@/lib/bosses";

interface Props {
  bossIndex: number;
  near: boolean;
  scale: number;
  onSelect: () => void;
}

/** A glowing colosseum beacon marking a boss battle arena on the world map. */
export default function ArenaSpot3D({ bossIndex, near, scale, onSelect }: Props) {
  const boss = BOSSES[bossIndex] ?? BOSSES[0];
  const tint = boss.tint;
  const ring = useRef<THREE.Mesh>(null);
  const emblem = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);

  const pillars = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (emblem.current) {
      emblem.current.position.y = 3.4 + Math.sin(t * 1.8) * 0.12;
      emblem.current.rotation.y += dt * (near ? 1.8 : 0.6);
    }
    if (ring.current) {
      const s = 1 + Math.sin(t * 2) * 0.05;
      ring.current.scale.setScalar(s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = near ? 0.85 : 0.5;
    }
    if (beam.current) {
      (beam.current.material as THREE.MeshBasicMaterial).opacity = (near ? 0.26 : 0.12) + Math.sin(t * 3) * 0.04;
    }
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return;
    e.stopPropagation();
    onSelect();
  };

  return (
    <group scale={scale} onClick={click}>
      {/* ground tier ring */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.5, 1.9, 48]} />
        <meshBasicMaterial color={tint} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1.9, 48]} />
        <meshBasicMaterial color={tint} transparent opacity={0.12} depthWrite={false} />
      </mesh>

      {/* colosseum pillars */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[1.95, 2.15, 0.36, 24]} />
        <meshStandardMaterial color="#e7ddcf" roughness={0.7} />
      </mesh>
      {pillars.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 1.75, 1.3, Math.sin(a) * 1.75]} castShadow>
          <cylinderGeometry args={[0.16, 0.18, 2.4, 10]} />
          <meshStandardMaterial color="#f1e8da" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 2.6, 0]}>
        <cylinderGeometry args={[2.0, 2.0, 0.3, 24, 1, true]} />
        <meshStandardMaterial color="#d9cdba" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* light beam */}
      <mesh ref={beam} position={[0, 4, 0]}>
        <cylinderGeometry args={[0.5, 1.4, 6, 20, 1, true]} />
        <meshBasicMaterial color={tint} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* crossed-swords emblem */}
      <group ref={emblem} position={[0, 3.4, 0]}>
        <mesh>
          <icosahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color={tint} emissive={tint} emissiveIntensity={0.7} roughness={0.2} metalness={0.3} />
        </mesh>
        <Billboard>
          <mesh position={[0, 0, 0.72]}>
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial color="#1a0f24" transparent opacity={0.85} />
          </mesh>
          {[-1, 1].map((d) => (
            <mesh key={d} position={[0, 0, 0.74]} rotation={[0, 0, (d * Math.PI) / 4]}>
              <boxGeometry args={[0.1, 0.8, 0.02]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          ))}
        </Billboard>
      </group>
    </group>
  );
}
