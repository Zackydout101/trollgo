"use client";

import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Billboard, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Pokemon } from "@/lib/types";
import { DRACO_PATH, hasModel, modelUrl, spriteUrl } from "@/lib/models";

export interface ModelInfo {
  /** model height in world units after normalisation */
  height: number;
  /** approximate radius in world units */
  radius: number;
}

interface Props {
  pokemon: Pokemon;
  /** target height in world units */
  height: number;
  /** add breathing / bobbing motion on top of any baked animation */
  idle?: boolean;
  /** prefer a sprite even when a model exists (e.g. very large files on the map) */
  forceSprite?: boolean;
  castShadow?: boolean;
  onReady?: (info: ModelInfo) => void;
  /** spinner/placeholder while the model downloads */
  fallback?: ReactNode;
}

export default function PokemonModel(props: Props) {
  const { pokemon, forceSprite } = props;
  const sprite = <SpriteBillboard {...props} />;
  if (forceSprite || !hasModel(pokemon.dex)) return sprite;
  return (
    <ModelBoundary fallback={sprite}>
      <Suspense fallback={props.fallback ?? sprite}>
        <GltfPokemon {...props} />
      </Suspense>
    </ModelBoundary>
  );
}

function GltfPokemon({ pokemon, height, idle = true, castShadow = true, onReady }: Props) {
  const gltf = useGLTF(modelUrl(pokemon.dex), DRACO_PATH);
  const root = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  const { scene, scale, offset, info } = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as THREE.Group;
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = castShadow;
        m.receiveShadow = false;
        m.frustumCulled = false;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          const sm = mat as THREE.MeshStandardMaterial;
          if (sm.map) sm.map.anisotropy = 4;
          if ("metalness" in sm) sm.metalness = Math.min(sm.metalness, 0.2);
          if (sm.transparent && sm.opacity > 0.95) {
            sm.transparent = false;
            sm.alphaTest = 0.5;
          }
        });
      }
    });
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const h = Math.max(size.y, 1e-3);
    // very flat or very long models: limit by their largest dimension too
    const scale = Math.min(height / h, (height * 1.6) / Math.max(size.x, size.z, 1e-3));
    const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);
    const info: ModelInfo = {
      height: h * scale,
      radius: (Math.max(size.x, size.z) * scale) / 2,
    };
    return { scene, scale, offset, info };
  }, [gltf, height, castShadow]);

  const { actions, names } = useAnimations(gltf.animations, root);

  useEffect(() => {
    const idleName =
      names.find((n) => /idle|wait|stand|loop/i.test(n)) ??
      (names.length === 1 && /armature|action|take|anim/i.test(names[0]) ? names[0] : undefined);
    if (!idleName) return;
    const a = actions[idleName];
    a?.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.3).play();
    return () => {
      a?.fadeOut(0.2);
    };
  }, [actions, names]);

  useEffect(() => {
    onReady?.(info);
  }, [info, onReady]);

  useFrame(({ clock }) => {
    if (!idle || !bob.current) return;
    const t = clock.elapsedTime * 2.2 + phase;
    const breathe = Math.sin(t);
    bob.current.scale.set(1 - breathe * 0.012, 1 + breathe * 0.025, 1 - breathe * 0.012);
    bob.current.position.y = Math.max(0, Math.sin(t * 0.5)) * height * 0.015;
  });

  return (
    <group ref={bob}>
      <group scale={scale}>
        <group position={offset}>
          <primitive ref={root} object={scene} />
        </group>
      </group>
    </group>
  );
}

function SpriteBillboard({ pokemon, height, idle = true, onReady }: Props) {
  const tex = useLoader(THREE.TextureLoader, spriteUrl(pokemon.sprite));
  const ref = useRef<THREE.Group>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  useMemo(() => {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
  }, [tex]);
  const img = tex.image as { width: number; height: number } | undefined;
  const aspect = img ? img.width / img.height : 1;
  useEffect(() => {
    onReady?.({ height, radius: (height * aspect) / 2 });
  }, [height, aspect, onReady]);
  useFrame(({ clock }) => {
    if (!idle || !ref.current) return;
    ref.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 2 + phase)) * height * 0.05;
  });
  return (
    <group ref={ref}>
      <Billboard position={[0, height / 2, 0]} lockX lockZ>
        <mesh>
          <planeGeometry args={[height * aspect, height]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.4} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </group>
  );
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("Pokémon model failed to load, using sprite", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function preloadPokemon(dex: number) {
  if (hasModel(dex)) useGLTF.preload(modelUrl(dex), DRACO_PATH);
}
