"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type Biome = "meadow" | "forest" | "lake" | "desert" | "snow" | "dusk" | "flowers" | "volcano" | "sky";

export interface BiomeStyle {
  skyTop: string;
  skyBottom: string;
  fog: string;
  ground: string;
  groundAlt: string;
  grassBase: string;
  grassTip: string;
  grassDensity: number;
  foliage: string[];
  trunk: string;
  flower: string[];
  sun: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  trees: "round" | "pine" | "cactus" | "dead" | "none";
  rocks: string;
  water: boolean;
  clouds: string;
}

const BIOMES: Record<Biome, BiomeStyle> = {
  meadow: {
    skyTop: "#3d9ef0", skyBottom: "#d4f1ff", fog: "#cdebf7",
    ground: "#63b84a", groundAlt: "#86cf5a", grassBase: "#3f8f2e", grassTip: "#a6e05c", grassDensity: 1,
    foliage: ["#4caf3e", "#3e9a35", "#62c24a"], trunk: "#7a5232", flower: ["#ffffff", "#ffe066", "#ff8fb8"],
    sun: "#fff3d6", sunIntensity: 2.6, hemiSky: "#dff3ff", hemiGround: "#5c8f3a", trees: "round", rocks: "#9aa0a6", water: false, clouds: "#ffffff",
  },
  forest: {
    skyTop: "#5aa9d6", skyBottom: "#d9f0d9", fog: "#bcd9b8",
    ground: "#3f7d34", groundAlt: "#5b9a3c", grassBase: "#2b6a25", grassTip: "#7fc04a", grassDensity: 1.3,
    foliage: ["#2f7d32", "#256b2b", "#3d8f3a", "#4a9c3c"], trunk: "#5b3b22", flower: ["#fff6a8", "#c9f07a"],
    sun: "#ffefc4", sunIntensity: 2.0, hemiSky: "#cfe9c4", hemiGround: "#2c4f22", trees: "pine", rocks: "#7d8a80", water: false, clouds: "#f2fff2",
  },
  lake: {
    skyTop: "#2f8ff0", skyBottom: "#c9f0ff", fog: "#c7ecff",
    ground: "#6cbf55", groundAlt: "#a9d97a", grassBase: "#3f8f3a", grassTip: "#b6e66a", grassDensity: 0.8,
    foliage: ["#4caf50", "#57b85a"], trunk: "#7a5232", flower: ["#ffffff", "#9fd8ff"],
    sun: "#fff8e6", sunIntensity: 2.6, hemiSky: "#e0f5ff", hemiGround: "#4f8f5a", trees: "round", rocks: "#a0a8ad", water: true, clouds: "#ffffff",
  },
  desert: {
    skyTop: "#3b8fe0", skyBottom: "#ffe9c2", fog: "#f5dfb5",
    ground: "#e2b86c", groundAlt: "#f0cf8a", grassBase: "#b39445", grassTip: "#e9d58c", grassDensity: 0.25,
    foliage: ["#5f9e47", "#6fae50"], trunk: "#8a6a3a", flower: ["#ff6b6b", "#ffd166"],
    sun: "#fff0cc", sunIntensity: 3.0, hemiSky: "#fff0d6", hemiGround: "#b8894a", trees: "cactus", rocks: "#c48a56", water: false, clouds: "#fff8ee",
  },
  snow: {
    skyTop: "#6fa8dc", skyBottom: "#eef6ff", fog: "#e8f2fb",
    ground: "#eef4fa", groundAlt: "#dfe9f3", grassBase: "#cfdde8", grassTip: "#ffffff", grassDensity: 0.3,
    foliage: ["#2f6b4f", "#3a7a5b"], trunk: "#5b4632", flower: ["#bfe3ff", "#ffffff"],
    sun: "#ffffff", sunIntensity: 2.2, hemiSky: "#ffffff", hemiGround: "#b9c9d8", trees: "pine", rocks: "#8f9aa5", water: false, clouds: "#ffffff",
  },
  dusk: {
    skyTop: "#241a4d", skyBottom: "#c46a9b", fog: "#5a3b72",
    ground: "#3c4a3a", groundAlt: "#4e5c45", grassBase: "#24331f", grassTip: "#6b7d4f", grassDensity: 0.9,
    foliage: ["#3a2f55", "#4a3a6b", "#2d4a3f"], trunk: "#2e2433", flower: ["#c58cff", "#7af0ff"],
    sun: "#ffb3d9", sunIntensity: 1.3, hemiSky: "#a78bd6", hemiGround: "#2a2238", trees: "dead", rocks: "#5d5a6e", water: false, clouds: "#e0b8e8",
  },
  flowers: {
    skyTop: "#5ab0ff", skyBottom: "#ffe6f4", fog: "#fbe3f0",
    ground: "#7cc760", groundAlt: "#a3dc78", grassBase: "#4a9c3a", grassTip: "#c4ef7d", grassDensity: 1,
    foliage: ["#f7a6c9", "#f48fb1", "#ffc1dd"], trunk: "#8a5a3c", flower: ["#ff7eb6", "#ffd1e8", "#ffffff", "#c49bff"],
    sun: "#fff3ea", sunIntensity: 2.4, hemiSky: "#ffeef7", hemiGround: "#6aa04c", trees: "round", rocks: "#b0a3ad", water: false, clouds: "#ffffff",
  },
  volcano: {
    skyTop: "#5b3a3a", skyBottom: "#ffb27a", fog: "#c98a66",
    ground: "#5a4436", groundAlt: "#735443", grassBase: "#4b3a2a", grassTip: "#9a6b3e", grassDensity: 0.3,
    foliage: ["#6b4a2f", "#7d5634"], trunk: "#3a2a20", flower: ["#ff5a1f", "#ffb01f"],
    sun: "#ffc59a", sunIntensity: 2.2, hemiSky: "#ffcfae", hemiGround: "#4a2e22", trees: "dead", rocks: "#4a3c38", water: false, clouds: "#e8c4b0",
  },
  sky: {
    skyTop: "#1f7fe6", skyBottom: "#e6f7ff", fog: "#dbf2ff",
    ground: "#7fcf6a", groundAlt: "#a8e08a", grassBase: "#4c9e40", grassTip: "#c7f08a", grassDensity: 0.7,
    foliage: ["#5cb85c", "#6cc46a"], trunk: "#7a5232", flower: ["#ffffff", "#bde3ff"],
    sun: "#ffffff", sunIntensity: 2.8, hemiSky: "#e8f8ff", hemiGround: "#6fae5a", trees: "round", rocks: "#b8c0c6", water: false, clouds: "#ffffff",
  },
};

export function biomeFor(type1: string, type2: string | null, night: boolean): { biome: Biome; style: BiomeStyle } {
  const t = [type1, type2 ?? ""].map((x) => x.toLowerCase());
  const has = (...k: string[]) => t.some((x) => k.includes(x));
  let biome: Biome = "meadow";
  if (has("ghost", "dark")) biome = "dusk";
  else if (has("water")) biome = "lake";
  else if (has("ice")) biome = "snow";
  else if (has("fire")) biome = "volcano";
  else if (has("ground", "rock", "steel")) biome = "desert";
  else if (has("fairy", "psychic")) biome = "flowers";
  else if (has("bug", "poison") || t[0] === "grass") biome = "forest";
  else if (has("flying", "dragon")) biome = "sky";
  let style = BIOMES[biome];
  if (night && biome !== "dusk") {
    style = {
      ...style,
      skyTop: "#0b1440",
      skyBottom: "#3a4f9a",
      fog: "#26386e",
      sun: "#a9bfff",
      sunIntensity: style.sunIntensity * 0.45,
      hemiSky: "#6f86d6",
      hemiGround: "#1d2a40",
      clouds: "#8899cc",
    };
  }
  return { biome, style };
}

// --------------------------------------------------------------------------

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function Scenery({ style, biome, seed }: { style: BiomeStyle; biome: Biome; seed: number }) {
  return (
    <>
      <color attach="background" args={[style.skyBottom]} />
      <fog attach="fog" args={[style.fog, 18, 75]} />
      <SkyDome top={style.skyTop} bottom={style.skyBottom} />
      <hemisphereLight args={[style.hemiSky, style.hemiGround, 1.1]} />
      <directionalLight
        castShadow
        position={[6, 12, 6]}
        intensity={style.sunIntensity}
        color={style.sun}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      <ambientLight intensity={0.25} />
      <Ground style={style} />
      <Grass style={style} seed={seed} />
      <Flowers style={style} seed={seed + 7} />
      <Rocks color={style.rocks} seed={seed + 3} count={biome === "desert" || biome === "volcano" ? 26 : 12} />
      {style.trees !== "none" && <Trees style={style} seed={seed + 11} />}
      {style.water && <Water />}
      <Clouds color={style.clouds} seed={seed + 5} />
      {biome === "snow" && <Snowfall />}
      {(biome === "dusk" || biome === "volcano") && <Embers color={biome === "dusk" ? "#c9a6ff" : "#ff9a3c"} />}
    </>
  );
}

function SkyDome({ top, bottom }: { top: string; bottom: string }) {
  const uniforms = useMemo(
    () => ({ top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } }),
    [top, bottom]
  );
  return (
    <mesh scale={[200, 200, 200]} renderOrder={-1}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={`varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `}
        fragmentShader={`uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
          void main(){ float h = clamp(vP.y*1.6+0.05,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.7)),1.0);
          #include <colorspace_fragment>
          }`}
      />
    </mesh>
  );
}

function Ground({ style }: { style: BiomeStyle }) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: style.ground, roughness: 0.95 });
    const alt = new THREE.Color(style.groundAlt);
    m.onBeforeCompile = (shader) => {
      shader.uniforms.altColor = { value: alt };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;")
        .replace(
          "#include <worldpos_vertex>",
          "#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed,1.0)).xyz;"
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform vec3 altColor; varying vec3 vWorldPos;
          float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
          float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float n = vnoise(vWorldPos.xz*0.35)*0.6 + vnoise(vWorldPos.xz*1.7)*0.3 + vnoise(vWorldPos.xz*6.0)*0.1;
          diffuseColor.rgb = mix(diffuseColor.rgb, altColor, smoothstep(0.35, 0.75, n));`
        );
    };
    return m;
  }, [style.ground, style.groundAlt]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={mat}>
      <circleGeometry args={[120, 64]} />
    </mesh>
  );
}

const GRASS_VS = `
  uniform float uTime;
  attribute vec3 offset;
  attribute float scale;
  attribute float yaw;
  varying float vH;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_vertex>
  void main(){
    vec3 p = position;
    float c = cos(yaw), s = sin(yaw);
    p = vec3(p.x*c - p.z*s, p.y, p.x*s + p.z*c);
    p.y *= scale;
    float h = position.y;
    vH = h;
    vec3 wp = p + offset;
    float wind = sin(uTime*1.7 + offset.x*0.35 + offset.z*0.25) * 0.5 + sin(uTime*3.1 + offset.x*1.3)*0.18;
    wp.x += wind * h * h * 0.22;
    wp.z += wind * h * h * 0.08;
    vWorld = wp;
    vec4 mvPosition = viewMatrix * vec4(wp,1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const GRASS_FS = `
  uniform vec3 uBase; uniform vec3 uTip;
  varying float vH;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_fragment>
  void main(){
    vec3 col = mix(uBase, uTip, smoothstep(0.0, 1.0, vH));
    col *= 0.85 + 0.15*sin(vWorld.x*0.7+vWorld.z*0.4);
    gl_FragColor = vec4(col,1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function Grass({ style, seed }: { style: BiomeStyle; seed: number }) {
  const count = Math.round(14000 * style.grassDensity);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const blade = new THREE.BufferGeometry();
    // tapered blade, height 1 (scaled per instance)
    const w = 0.045;
    const verts = new Float32Array([
      -w, 0, 0, w, 0, 0, -w * 0.7, 0.4, 0, w * 0.7, 0.4, 0, -w * 0.35, 0.75, 0.02, w * 0.35, 0.75, 0.02, 0, 1, 0.05,
    ]);
    blade.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
    const g = new THREE.InstancedBufferGeometry();
    g.index = blade.index;
    g.attributes.position = blade.attributes.position;
    const r = rng(seed);
    const offsets = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const yaws = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // denser near the Pokémon, sparser far away
      const rad = 0.9 + Math.pow(r(), 1.6) * 28;
      const a = r() * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      offsets[i * 3] = x;
      offsets[i * 3 + 1] = 0;
      offsets[i * 3 + 2] = z;
      // short grass in front of the camera so it never hides the ball or the Pokémon's feet
      const nearCam = z > 1.5 && Math.abs(x) < 4 ? 0.45 : 1;
      scales[i] = (0.1 + r() * 0.2) * nearCam;
      yaws[i] = r() * Math.PI;
    }
    g.setAttribute("offset", new THREE.InstancedBufferAttribute(offsets, 3));
    g.setAttribute("scale", new THREE.InstancedBufferAttribute(scales, 1));
    g.setAttribute("yaw", new THREE.InstancedBufferAttribute(yaws, 1));
    g.instanceCount = count;
    return g;
  }, [count, seed]);
  const uniforms = useMemo(
    () =>
      THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uBase: { value: new THREE.Color(style.grassBase) },
          uTip: { value: new THREE.Color(style.grassTip) },
        },
      ]),
    [style.grassBase, style.grassTip]
  );
  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={GRASS_VS}
        fragmentShader={GRASS_FS}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        fog
      />
    </mesh>
  );
}

function useInstances(count: number, place: (i: number, m: THREE.Object3D) => void, deps: unknown[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      o.position.set(0, 0, 0);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      place(i, o);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

function Flowers({ style, seed }: { style: BiomeStyle; seed: number }) {
  const per = 140;
  return (
    <>
      {style.flower.map((c, k) => (
        <FlowerSet key={c + k} color={c} count={per} seed={seed + k * 13} />
      ))}
    </>
  );
}

function FlowerSet({ color, count, seed }: { color: string; count: number; seed: number }) {
  const ref = useInstances(
    count,
    (i, o) => {
      const r = rng(seed + i * 7919);
      const rad = 1.2 + r() * 18;
      const a = r() * Math.PI * 2;
      o.position.set(Math.cos(a) * rad, 0.1 + r() * 0.06, Math.sin(a) * rad);
      o.scale.set(1, 0.6, 1).multiplyScalar(0.35 + r() * 0.4);
    },
    [count, seed]
  );
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <icosahedronGeometry args={[0.05, 0]} />
      <meshStandardMaterial color={color} roughness={0.6} emissive={color} emissiveIntensity={0.08} />
    </instancedMesh>
  );
}

function Rocks({ color, seed, count }: { color: string; seed: number; count: number }) {
  const ref = useInstances(
    count,
    (i, o) => {
      const r = rng(seed + i * 104729);
      const rad = 3.5 + r() * 22;
      const a = Math.PI * (0.95 + r() * 1.1);
      o.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      const s = 0.25 + r() * 0.9;
      o.scale.set(s * (1 + r() * 0.6), s * (0.5 + r() * 0.6), s);
      o.rotation.set(r(), r() * 6, r());
    },
    [count, seed]
  );
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
      <dodecahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial color={color} roughness={0.9} flatShading />
    </instancedMesh>
  );
}

function Trees({ style, seed }: { style: BiomeStyle; seed: number }) {
  const count = 46;
  const spots = useMemo(() => {
    const r = rng(seed);
    const out: { x: number; z: number; s: number; c: number }[] = [];
    for (let i = 0; i < count; i++) {
      // behind and to the sides of the Pokémon, never between it and the camera
      const a = Math.PI * (1.02 + r() * 0.96);
      const rad = 8 + r() * 26;
      out.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad - 2, s: 0.8 + r() * 0.9, c: Math.floor(r() * 10) });
    }
    return out;
  }, [seed]);

  const trunks = useInstances(
    count,
    (i, o) => {
      const t = spots[i];
      const h = style.trees === "cactus" ? 0 : 1.4 * t.s;
      o.position.set(t.x, h / 2, t.z);
      o.scale.set(t.s, Math.max(h, 0.001), t.s);
    },
    [spots, style.trees]
  );

  const crowns = style.foliage.map((col, k) => {
    const mine = spots.filter((t) => t.c % style.foliage.length === k);
    return { col, mine };
  });

  return (
    <>
      {style.trees !== "cactus" && (
        <instancedMesh ref={trunks} args={[undefined, undefined, count]} castShadow>
          <cylinderGeometry args={[0.12, 0.18, 1, 7]} />
          <meshStandardMaterial color={style.trunk} roughness={0.9} />
        </instancedMesh>
      )}
      {crowns.map(({ col, mine }) => (
        <Crowns key={col} color={col} spots={mine} kind={style.trees} snow={style.ground === "#eef4fa"} />
      ))}
    </>
  );
}

function Crowns({
  color,
  spots,
  kind,
  snow,
}: {
  color: string;
  spots: { x: number; z: number; s: number }[];
  kind: BiomeStyle["trees"];
  snow: boolean;
}) {
  const n = spots.length * (kind === "pine" ? 3 : kind === "round" ? 3 : 1);
  const ref = useInstances(
    n,
    (i, o) => {
      if (kind === "pine") {
        const t = spots[Math.floor(i / 3)];
        const k = i % 3;
        o.position.set(t.x, (1.5 + k * 0.9) * t.s, t.z);
        o.scale.set((1.4 - k * 0.35) * t.s, 1.3 * t.s, (1.4 - k * 0.35) * t.s);
      } else if (kind === "round") {
        const t = spots[Math.floor(i / 3)];
        const k = i % 3;
        const off = [
          [0, 0, 0],
          [0.55, -0.3, 0.2],
          [-0.5, -0.25, -0.15],
        ][k];
        o.position.set(t.x + off[0] * t.s, (2.1 + off[1]) * t.s, t.z + off[2] * t.s);
        o.scale.setScalar((k === 0 ? 1.1 : 0.8) * t.s);
      } else if (kind === "cactus") {
        const t = spots[i];
        o.position.set(t.x, 1.0 * t.s, t.z);
        o.scale.set(0.35 * t.s, 2 * t.s, 0.35 * t.s);
      } else {
        const t = spots[i];
        o.position.set(t.x, 1.9 * t.s, t.z);
        o.rotation.set(0.3, t.x, 0.4);
        o.scale.set(0.12 * t.s, 1.3 * t.s, 0.12 * t.s);
      }
    },
    [spots, kind]
  );
  const crownColor = snow ? "#e8f2f8" : color;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, n)]} castShadow>
      {kind === "pine" ? (
        <coneGeometry args={[1, 1.4, 8]} />
      ) : kind === "round" ? (
        <icosahedronGeometry args={[1, 1]} />
      ) : kind === "cactus" ? (
        <capsuleGeometry args={[0.5, 1, 4, 10]} />
      ) : (
        <cylinderGeometry args={[0.5, 1, 1, 5]} />
      )}
      <meshStandardMaterial color={crownColor} roughness={0.8} flatShading={kind !== "cactus"} />
    </instancedMesh>
  );
}

function Water() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () =>
      THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uDeep: { value: new THREE.Color("#1f8fd6") }, uShallow: { value: new THREE.Color("#6fe0ff") } },
      ]),
    []
  );
  useFrame(({ clock }) => {
    if (mat.current) mat.current.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -16]}>
      <circleGeometry args={[14, 64]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        fog
        transparent
        vertexShader={`varying vec2 vUv; varying vec3 vW;
          #include <common>
          #include <fog_pars_vertex>
          void main(){ vUv=uv; vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
          }`}
        fragmentShader={`uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; varying vec2 vUv; varying vec3 vW;
          #include <common>
          #include <fog_pars_fragment>
          void main(){
            float d = length(vUv-0.5)*2.0;
            float rip = sin(vW.x*3.0+uTime*1.6)*0.5+sin(vW.z*4.0-uTime*1.2+vW.x)*0.5;
            vec3 col = mix(uDeep, uShallow, smoothstep(0.55,1.0,d) + rip*0.06);
            float spec = pow(max(0.0, rip), 8.0)*0.35;
            col += spec;
            float edge = smoothstep(1.0, 0.94, d);
            gl_FragColor = vec4(col, edge*0.95);
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`}
      />
    </mesh>
  );
}

function Clouds({ color, seed }: { color: string; seed: number }) {
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: 9 }, () => ({
      x: -90 + r() * 180,
      y: 34 + r() * 22,
      z: -110 - r() * 50,
      s: 3 + r() * 4,
      puffs: Array.from({ length: 5 }, () => [r() * 3 - 1.5, r() * 0.8, r() * 1.5 - 0.75, 0.7 + r() * 0.7] as const),
    }));
  }, [seed]);
  useFrame((_, dt) => {
    if (group.current) group.current.position.x = ((group.current.position.x + dt * 0.6 + 80) % 160) - 80;
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {c.puffs.map((p, k) => (
            <mesh key={k} position={[p[0], p[1], p[2]]} scale={p[3]}>
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color={color} roughness={1} emissive={color} emissiveIntensity={0.35} fog={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Particles({ count, color, size, speed, spread, rise }: { count: number; color: string; size: number; speed: number; spread: number; rise: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * spread;
      p[i * 3 + 1] = Math.random() * 10;
      p[i * 3 + 2] = (Math.random() - 0.5) * spread - 4;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [count, spread]);
  useFrame(({ clock }, dt) => {
    const a = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = a.getY(i) + (rise ? speed : -speed) * dt;
      if (y < 0) y = 10;
      if (y > 10) y = 0;
      a.setY(i, y);
      a.setX(i, a.getX(i) + Math.sin(clock.elapsedTime + i) * dt * 0.2);
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color={color} size={size} transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

function Snowfall() {
  return <Particles count={700} color="#ffffff" size={0.06} speed={0.9} spread={30} rise={false} />;
}

function Embers({ color }: { color: string }) {
  return <Particles count={160} color={color} size={0.05} speed={0.35} spread={20} rise />;
}
