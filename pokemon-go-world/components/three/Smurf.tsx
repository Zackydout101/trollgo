"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ModelInfo } from "./PokemonModel";
import type { WatchmanClip } from "./WoodenWatchman";

/**
 * The "We Live We Love We Lie" smurf ships as three single-clip Mixamo exports, so
 * each animation state loads its own file. They are untextured, so the mesh is
 * stained smurf-blue with white hat and shorts.
 */
export const SMURF_URL: Record<WatchmanClip, string> = {
  walking: "/models/smurf-walk.glb",
  dancing: "/models/smurf-dance.glb",
  attacking: "/models/smurf-attack.glb",
};
const SMURF_CLIP: Record<WatchmanClip, string> = {
  walking: "Walking",
  dancing: "Breakdance_1990",
  attacking: "Punch_Combo",
};

const SKIN = new THREE.Color("#4aa8ec");
const SKIN_DARK = new THREE.Color("#2f84c6");
const WHITE = new THREE.Color("#f3f8fd");

const painted = new WeakSet<THREE.Object3D>();

/** Stain the untextured smurf: white shorts at the base, white hat on top, blue in between. */
function paintSmurf(root: THREE.Object3D) {
  if (painted.has(root)) return;
  const color = new THREE.Color();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry;
    const pos = geo.getAttribute("position");
    if (!pos || geo.getAttribute("color")) return;
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const minY = bb.min.y;
    const spanY = Math.max(1e-3, bb.max.y - bb.min.y);
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const h = (pos.getY(i) - minY) / spanY; // 0 bottom .. 1 top
      const noise = Math.sin(pos.getX(i) * 30 + pos.getZ(i) * 22) * 0.04;
      if (h < 0.24) color.copy(WHITE); // shorts / feet
      else if (h > 0.9) color.copy(WHITE); // hat tip
      else color.copy(SKIN_DARK).lerp(SKIN, THREE.MathUtils.clamp(h + noise, 0, 1));
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    mesh.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.7,
      metalness: 0.02,
    });
  });
  painted.add(root);
}

interface Props {
  height: number;
  castShadow?: boolean;
  clip?: WatchmanClip;
  onReady?: (info: ModelInfo) => void;
}

export function SmurfPlaceholder({ height }: { height: number }) {
  return (
    <mesh position={[0, height * 0.5, 0]}>
      <capsuleGeometry args={[height * 0.17, height * 0.5, 4, 8]} />
      <meshStandardMaterial color="#4aa8ec" roughness={0.6} />
    </mesh>
  );
}

export default function Smurf({ height, castShadow = false, clip = "walking", onReady }: Props) {
  const gltf = useGLTF(SMURF_URL[clip]);
  const root = useRef<THREE.Object3D>(null);

  const { scene, scale, offset, info } = useMemo(() => {
    paintSmurf(gltf.scene);
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
    const name = names.find((n) => n === SMURF_CLIP[clip]) ?? names[0];
    const action = name ? actions[name] : undefined;
    if (!action) return;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.25).play();
    action.time = Math.random() * (action.getClip().duration || 1);
    return () => {
      action.fadeOut(0.15);
    };
  }, [actions, names, clip]);

  return (
    <group scale={scale}>
      <group position={offset}>
        <primitive ref={root} object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(SMURF_URL.walking);
useGLTF.preload(SMURF_URL.dancing);
useGLTF.preload(SMURF_URL.attacking);
