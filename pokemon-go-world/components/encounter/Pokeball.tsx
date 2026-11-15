"use client";

import { forwardRef } from "react";
import * as THREE from "three";
import type { BallType } from "@/lib/types";

const TOP: Record<BallType, string> = {
  pokeball: "#e8202a",
  greatball: "#2266e0",
  ultraball: "#202226",
};

interface Props {
  kind: BallType;
  radius?: number;
  /** 0 = closed, 1 = lid fully open */
  open?: number;
  glow?: number;
}

/**
 * A Poké Ball centred on its origin. The lid hinges at the back so it can open.
 */
const Pokeball = forwardRef<THREE.Group, Props & { lidRef?: React.Ref<THREE.Group>; buttonRef?: React.Ref<THREE.MeshStandardMaterial> }>(
  function Pokeball({ kind, radius = 0.11, open = 0, glow = 0, lidRef, buttonRef }, ref) {
    const r = radius;
    return (
      <group ref={ref}>
        {/* bottom half */}
        <mesh castShadow>
          <sphereGeometry args={[r, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color="#f7f7f7" roughness={0.25} metalness={0.05} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r * 0.98, 32]} />
          <meshStandardMaterial color="#111" side={THREE.DoubleSide} />
        </mesh>
        {/* lid hinged at the back */}
        <group position={[0, 0, -r]}>
          <group ref={lidRef} rotation={[-open * 1.9, 0, 0]}>
            <group position={[0, 0, r]}>
              <mesh castShadow>
                <sphereGeometry args={[r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color={TOP[kind]} roughness={0.22} metalness={0.08} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[r * 0.98, 32]} />
                <meshStandardMaterial color="#111" side={THREE.DoubleSide} />
              </mesh>
              {kind === "greatball" &&
                [-1, 1].map((s) => (
                  <mesh key={s} position={[s * r * 0.48, r * 0.62, r * 0.18]} rotation={[0.35, 0, s * 0.75]}>
                    <boxGeometry args={[r * 0.28, r * 0.75, r * 0.5]} />
                    <meshStandardMaterial color="#e8202a" roughness={0.3} />
                  </mesh>
                ))}
              {kind === "ultraball" && (
                <>
                  {[-1, 1].map((s) => (
                    <mesh key={s} position={[s * r * 0.55, r * 0.55, r * 0.3]} rotation={[0.55, 0, s * 0.45]}>
                      <boxGeometry args={[r * 0.26, r * 0.9, r * 0.55]} />
                      <meshStandardMaterial color="#ffd21f" roughness={0.3} />
                    </mesh>
                  ))}
                </>
              )}
            </group>
          </group>
        </group>
        {/* band */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r * 0.995, r * 0.07, 8, 40]} />
          <meshStandardMaterial color="#141414" roughness={0.5} />
        </mesh>
        {/* button */}
        <mesh position={[0, 0, r * 0.98]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * 0.3, r * 0.3, r * 0.1, 24]} />
          <meshStandardMaterial color="#141414" />
        </mesh>
        <mesh position={[0, 0, r * 1.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r * 0.19, r * 0.19, r * 0.08, 24]} />
          <meshStandardMaterial
            ref={buttonRef}
            color="#ffffff"
            emissive="#ff2a2a"
            emissiveIntensity={glow}
            roughness={0.3}
          />
        </mesh>
      </group>
    );
  }
);

export default Pokeball;
