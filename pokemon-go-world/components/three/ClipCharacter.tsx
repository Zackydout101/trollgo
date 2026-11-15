"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CLIP_CRITTERS, type ClipCritter, type CritterClip } from "@/lib/critters";
import type { ModelInfo } from "./PokemonModel";

const painted = new WeakSet<THREE.Object3D>();

/** The Meshy exports have no texture, so stain the mesh the same way the smurf is stained. */
function paintBody(root: THREE.Object3D, paint: NonNullable<ClipCritter["paint"]>) {
  if (painted.has(root)) return;
  const low = new THREE.Color(paint.low);
  const mid = new THREE.Color(paint.mid);
  const high = new THREE.Color(paint.high);
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
      const h = (pos.getY(i) - minY) / spanY;
      const noise = Math.sin(pos.getX(i) * 18 + pos.getZ(i) * 14) * 0.04;
      const t = THREE.MathUtils.clamp(h + noise, 0, 1);
      if (t < 0.5) color.copy(low).lerp(mid, t / 0.5);
      else color.copy(mid).lerp(high, (t - 0.5) / 0.5);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    mesh.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.04,
    });
  });
  painted.add(root);
}

interface Props {
  spec: ClipCritter;
  height: number;
  castShadow?: boolean;
  clip?: CritterClip;
  onReady?: (info: ModelInfo) => void;
}

export function ClipPlaceholder({ height, color }: { height: number; color: string }) {
  return (
    <mesh position={[0, height * 0.5, 0]}>
      <capsuleGeometry args={[height * 0.17, height * 0.5, 4, 8]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

/** One animated character, one GLB per clip. Same contract as the smurf. */
export default function ClipCharacter({ spec, height, castShadow = false, clip = "walking", onReady }: Props) {
  const gltf = useGLTF(spec.urls[clip]);
  const root = useRef<THREE.Object3D>(null);

  const { scene, scale, offset, info } = useMemo(() => {
    if (spec.paint) paintBody(gltf.scene, spec.paint);
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
  }, [gltf.scene, spec.paint, height, castShadow]);

  const { actions, names } = useAnimations(gltf.animations, root);

  useEffect(() => {
    onReady?.(info);
  }, [info, onReady]);

  useEffect(() => {
    const wanted = spec.clips[clip];
    const name = names.find((n) => n === wanted) ?? names[0];
    const action = name ? actions[name] : undefined;
    if (!action) return;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.25).play();
    action.time = Math.random() * (action.getClip().duration || 1);
    return () => {
      action.fadeOut(0.15);
    };
  }, [actions, names, clip, spec]);

  return (
    <group scale={scale}>
      <group position={offset}>
        <primitive ref={root} object={scene} />
      </group>
    </group>
  );
}

const preloaded = new Set<string>();
for (const spec of Object.values(CLIP_CRITTERS)) {
  for (const url of new Set(Object.values(spec.urls))) {
    if (preloaded.has(url)) continue;
    preloaded.add(url);
    useGLTF.preload(url);
  }
}
