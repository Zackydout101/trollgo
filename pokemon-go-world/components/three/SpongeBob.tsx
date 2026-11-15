"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * SpongeBob is the player's main character. The Mixamo export is textured and ships
 * with a single walk clip (named "mixamo.com"), so we just loop it and drive its
 * playback speed from the walk blend — the pose freezes into a standing idle while
 * the trainer is still.
 */
export const SPONGEBOB_URL = "/models/spongebob-walk.glb";

interface Props {
  /** Target height in world units (before the avatar group scale). */
  height?: number;
  castShadow?: boolean;
  /** 0 = standing still, 1 = walking. Controls the walk clip's playback speed. */
  walkRef?: React.MutableRefObject<number>;
}

export default function SpongeBob({ height = 1.8, castShadow = true, walkRef }: Props) {
  const gltf = useGLTF(SPONGEBOB_URL);
  const root = useRef<THREE.Object3D>(null);

  const { scene, scale, offset } = useMemo(() => {
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
    return { scene, scale, offset };
  }, [gltf.scene, height, castShadow]);

  const { actions, names } = useAnimations(gltf.animations, root);
  const action = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    const name = names[0];
    const a = name ? actions[name] : undefined;
    if (!a) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    action.current = a;
    return () => {
      a.stop();
      action.current = null;
    };
  }, [actions, names]);

  // Freeze the walk pose when standing. A full walk plays the clip at 2x.
  useFrame(() => {
    if (!action.current) return;
    const w = walkRef ? walkRef.current : 1;
    action.current.timeScale = 0.1 + w * 1.9;
  });

  return (
    <group scale={scale}>
      <group position={offset}>
        <primitive ref={root} object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(SPONGEBOB_URL);
