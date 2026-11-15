"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export const SKIBIDI_URL = "/models/skibidi-toilet.glb";

export interface SkibidiHandle {
  /** Replay the rig animation from the start. */
  play: () => void;
}

interface Props {
  /** Target height in world units. */
  height?: number;
}

/**
 * Rigged Skibidi Toilet used in place of a Poké Ball. The baked clip loops,
 * and `play()` restarts it for a successful catch.
 */
const SkibidiToilet = forwardRef<SkibidiHandle, Props>(function SkibidiToilet({ height = 0.82 }, ref) {
  const gltf = useGLTF(SKIBIDI_URL);
  const root = useRef<THREE.Object3D>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);

  const { scene, scale, offset } = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as THREE.Group;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
      }
    });
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = height / Math.max(size.y, 1e-3);
    const offset = new THREE.Vector3(-center.x, -center.y, -center.z);
    return { scene, scale, offset };
  }, [gltf.scene, height]);

  const { actions, names } = useAnimations(gltf.animations, root);

  const play = () => {
    const action = actionRef.current;
    if (!action) return;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.12).play();
  };

  useEffect(() => {
    const name = names.find((n) => n === "rootAction") ?? names[0];
    const action = name ? actions[name] : undefined;
    actionRef.current = action ?? null;
    if (action) action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.2).play();
    return () => {
      action?.fadeOut(0.15);
    };
  }, [actions, names]);

  useImperativeHandle(ref, () => ({ play }), []);

  return (
    <group scale={scale}>
      <group position={offset}>
        <primitive ref={root} object={scene} />
      </group>
    </group>
  );
});

export default SkibidiToilet;

useGLTF.preload(SKIBIDI_URL);
