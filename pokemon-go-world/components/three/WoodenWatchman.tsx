"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ModelInfo } from "./PokemonModel";

export const WATCHMAN_URL = "/models/wooden-watchman.glb";

const DARK = new THREE.Color("#2a160b");
const MID = new THREE.Color("#7a4520");
const LIGHT = new THREE.Color("#c4843c");

let woodPainted = false;

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** The Mixamo export has no texture, so stain the mesh with wood grain once. */
function paintWood(root: THREE.Object3D) {
  if (woodPainted) return;
  const color = new THREE.Color();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry;
    const pos = geo.getAttribute("position");
    const nor = geo.getAttribute("normal");
    if (!pos || geo.getAttribute("color")) return;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ny = nor ? nor.getY(i) : 0;
      const grain = Math.sin(y * 64 + Math.sin(x * 22 + z * 17) * 5.2);
      const band = Math.sin(y * 8.5 + x * 2.4 + z);
      const fleck = hash(Math.round(x * 36) + Math.round(z * 36) * 19 + Math.round(y * 10) * 7);
      let shade = 0.48 + grain * 0.15 + band * 0.09 + (fleck - 0.5) * 0.14 + ny * 0.14;
      shade += (y / 1.7 - 0.42) * 0.12;
      const knots: [number, number, number, number][] = [
        [0.05, 1.22, 0.1, 0.075],
        [-0.07, 0.74, 0.08, 0.055],
        [0.02, 0.36, -0.07, 0.05],
      ];
      for (const [kx, ky, kz, kr] of knots) {
        const d = Math.hypot(x - kx, (y - ky) * 0.7, z - kz);
        if (d < kr * 2.6) {
          const ring = Math.sin((d / kr) * Math.PI * 3.2);
          shade -= (1 - d / (kr * 2.6)) * 0.32 + ring * 0.05;
        }
      }
      shade = THREE.MathUtils.clamp(shade, 0, 1);
      if (shade < 0.42) color.copy(DARK).lerp(MID, shade / 0.42);
      else color.copy(MID).lerp(LIGHT, (shade - 0.42) / 0.58);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    mesh.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.74,
      metalness: 0.02,
      emissive: new THREE.Color("#3d2212"),
      emissiveIntensity: 0.06,
    });
  });
  woodPainted = true;
}

interface Props {
  /** Target height in world units. */
  height: number;
  castShadow?: boolean;
  onReady?: (info: ModelInfo) => void;
}

export function WatchmanPlaceholder({ height }: { height: number }) {
  return (
    <mesh position={[0, height * 0.48, 0]}>
      <capsuleGeometry args={[height * 0.16, height * 0.5, 4, 8]} />
      <meshStandardMaterial color="#8a5428" roughness={0.62} />
    </mesh>
  );
}

/**
 * Wooden Watchman playing its Mixamo attack clip. The source model is untextured,
 * so the mesh is stained with varied brown wood grain.
 */
export default function WoodenWatchman({ height, castShadow = false, onReady }: Props) {
  const gltf = useGLTF(WATCHMAN_URL);
  const root = useRef<THREE.Object3D>(null);

  const { scene, scale, offset, info } = useMemo(() => {
    paintWood(gltf.scene);
    const scene = cloneSkinned(gltf.scene) as THREE.Group;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
    });
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const h = Math.max(size.y, 1e-3);
    const scale = height / h;
    const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);
    const info: ModelInfo = {
      height,
      radius: (Math.max(size.x, size.z) * scale) / 2,
    };
    return { scene, scale, offset, info };
  }, [gltf.scene, height, castShadow]);

  const { actions, names } = useAnimations(gltf.animations, root);

  useEffect(() => {
    onReady?.(info);
  }, [info, onReady]);

  useEffect(() => {
    const name = names.find((n) => n === "Attack") ?? names[0];
    const action = name ? actions[name] : undefined;
    if (!action) return;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.25).play();
    action.time = Math.random() * (action.getClip().duration || 1);
    return () => {
      action.fadeOut(0.15);
    };
  }, [actions, names]);

  return (
    <group scale={scale}>
      <group position={offset}>
        <primitive ref={root} object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(WATCHMAN_URL);
