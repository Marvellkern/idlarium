// Each newer habitat's special touch: Tidepool tides, Amazon rain, Polar aurora and
// drifting ice. (The Kelp Forest's swaying kelp is scenery, its otters live in
// Creature.tsx.) Tuning lives in data/signatures.ts.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES, type BiomeId } from "../data/biomes";
import { AURORA, tideLevel } from "../data/signatures";
import { isRaining } from "../state/weather";
import type { Dims } from "./layout";
import { box, ico, jitter, paint, rng, tf } from "./models/geo";
import { habitatCtx } from "./registry";

export function Signature({ biome, dims, high }: { biome: BiomeId; dims: Dims; high: boolean }) {
  const sig = BIOMES[biome].signature;
  // Shared with movement, lighting and the diorama: only the Tidepool moves the water,
  // only the Amazon gets rain (it fades in and out over a few seconds).
  useFrame((_s, dt) => {
    habitatCtx.waterLevel = sig === "tides" ? tideLevel() : 1;
    const target = sig === "rain" && isRaining() ? 1 : 0;
    habitatCtx.rain += (target - habitatCtx.rain) * (1 - Math.exp(-Math.min(dt, 0.1) * 0.6));
    if (target === 0 && habitatCtx.rain < 0.002) habitatCtx.rain = 0;
  });
  useEffect(
    () => () => {
      habitatCtx.waterLevel = 1;
      habitatCtx.rain = 0;
    },
    [],
  );
  return (
    <>
      {sig === "rain" && <Rain dims={dims} high={high} />}
      {sig === "aurora" && (
        <>
          <Aurora dims={dims} />
          <IceFloes dims={dims} />
        </>
      )}
    </>
  );
}

// ───────────── Amazon rain ─────────────

const RIPPLES = 18;

function Rain({ dims, high }: { dims: Dims; high: boolean }) {
  const { w, h, d } = dims;
  const count = high ? 160 : 70;
  const streakGeo = useMemo(() => new THREE.BoxGeometry(0.012, 0.42, 0.012), []);
  const streakMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#e4ecf2", transparent: true, opacity: 0, depthWrite: false }), []);
  const ringGeo = useMemo(() => {
    const g = new THREE.RingGeometry(0.8, 1, 18);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#f4f8ff", transparent: true, opacity: 0, depthWrite: false }), []);
  useEffect(() => () => (streakGeo.dispose(), streakMat.dispose(), ringGeo.dispose(), ringMat.dispose()), [streakGeo, streakMat, ringGeo, ringMat]);

  const drops = useMemo(
    () => Array.from({ length: count }, () => ({ x: (Math.random() - 0.5) * w, z: (Math.random() - 0.5) * d, y: h + Math.random() * 4, v: 5 + Math.random() * 2 })),
    [count, w, h, d],
  );
  const ripples = useMemo(() => Array.from({ length: RIPPLES }, () => ({ x: 0, z: 0, t: 1 + Math.random() })), []);
  const streaks = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const group = useRef<THREE.Group>(null);

  useFrame((_st, dtRaw) => {
    const k = habitatCtx.rain;
    if (group.current) group.current.visible = k > 0.01;
    if (k <= 0.01) return;
    const dt = Math.min(dtRaw, 0.1);
    streakMat.opacity = 0.45 * k;
    ringMat.opacity = 0.4 * k;
    const top = h * habitatCtx.waterLevel;
    const im = streaks.current;
    if (im) {
      drops.forEach((dr, i) => {
        dr.y -= dr.v * dt;
        if (dr.y < top) {
          dr.y = top + 3 + Math.random() * 1.5;
          dr.x = (Math.random() - 0.5) * w;
          dr.z = (Math.random() - 0.5) * d;
        }
        m4.compose(p.set(dr.x, dr.y, dr.z), q, s.set(1, 1, 1));
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
    }
    const rm = rings.current;
    if (rm) {
      ripples.forEach((r, i) => {
        r.t += dt / 0.9;
        if (r.t >= 1 && Math.random() < k * 0.5) {
          r.t = 0;
          r.x = (Math.random() - 0.5) * w * 0.95;
          r.z = (Math.random() - 0.5) * d * 0.95;
        }
        const alive = r.t < 1;
        m4.compose(p.set(r.x, top + 0.02, r.z), q, s.setScalar(alive ? 0.04 + r.t * 0.3 : 0));
        rm.setMatrixAt(i, m4);
      });
      rm.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={group} visible={false}>
      <instancedMesh ref={streaks} args={[streakGeo, streakMat, count]} frustumCulled={false} renderOrder={6} />
      <instancedMesh ref={rings} args={[ringGeo, ringMat, RIPPLES]} frustumCulled={false} renderOrder={6} />
    </group>
  );
}

// ───────────── Polar aurora and drifting ice ─────────────

const auroraVert = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(p.x * 0.55 + uTime * 0.25) * 0.7;
    p.y += sin(p.x * 0.9 + uTime * 0.45) * 0.25 * uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const auroraFrag = /* glsl */ `
  uniform float uTime;
  uniform float uAmount;
  uniform vec3 uA;
  uniform vec3 uB;
  varying vec2 vUv;
  void main() {
    // A soft curtain: bright at the lower edge, fading up into violet, with faint folds.
    float band = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
    float folds = 0.78 + 0.22 * sin(vUv.x * 16.0 + uTime * 0.5 + sin(vUv.x * 4.0 + uTime * 0.15) * 2.5);
    float edge = smoothstep(0.0, 0.2, vUv.x) * (1.0 - smoothstep(0.8, 1.0, vUv.x));
    vec3 col = mix(uA, uB, smoothstep(0.2, 0.9, vUv.y));
    gl_FragColor = vec4(col, band * folds * edge * uAmount * 0.6);
  }`;

function Aurora({ dims }: { dims: Dims }) {
  const { w, h, d } = dims;
  const geo = useMemo(() => new THREE.PlaneGeometry(w * 1.7, 4.5, 64, 4), [w]);
  const mats = useMemo(
    () =>
      [0, 1].map(
        (i) =>
          new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            uniforms: {
              uTime: { value: i * 7 },
              uAmount: { value: 0 },
              uA: { value: new THREE.Color(AURORA.colors[0]) },
              uB: { value: new THREE.Color(AURORA.colors[1]) },
            },
            vertexShader: auroraVert,
            fragmentShader: auroraFrag,
          }),
      ),
    [],
  );
  useEffect(() => () => (geo.dispose(), mats.forEach((m) => m.dispose())), [geo, mats]);
  const group = useRef<THREE.Group>(null);
  useFrame((_s, dt) => {
    // Night only, on the real local clock: full below fullBelow daylight, gone above goneAbove.
    const k = THREE.MathUtils.smoothstep(AURORA.goneAbove - habitatCtx.daylight, 0, AURORA.goneAbove - AURORA.fullBelow);
    habitatCtx.aurora = k;
    if (group.current) group.current.visible = k > 0.01;
    mats.forEach((m) => {
      m.uniforms.uTime.value += Math.min(dt, 0.1);
      m.uniforms.uAmount.value = k;
    });
  });
  useEffect(
    () => () => {
      habitatCtx.aurora = 0;
    },
    [],
  );
  return (
    <group ref={group} visible={false}>
      <mesh geometry={geo} material={mats[0]} position={[0, h + 4, -d * 0.7]} rotation={[0.25, 0, 0]} renderOrder={1} />
      <mesh geometry={geo} material={mats[1]} position={[w * 0.12, h + 5.2, -d * 0.95]} rotation={[0.2, 0.15, 0]} scale={[0.8, 0.8, 1]} renderOrder={1} />
    </group>
  );
}

const ICE_COLOR = (p: THREE.Vector3, f: number) => (((f * 2654435761) >>> 0) % 100 < 20 ? "#cfe6f4" : p.y < 0 ? "#a8d0e8" : "#eef7ff");

function IceFloes({ dims }: { dims: Dims }) {
  const { w, h, d } = dims;
  const floes = useMemo(() => {
    const r = rng(161);
    return Array.from({ length: AURORA.iceChunks }, (_, i) => {
      const size = 0.35 + r() * 0.45;
      const R = 0.6 + r() * 1.4;
      return {
        geo: paint(jitter(tf(ico(size, 1), { s: [1.4, 0.35, 1.1] }), size * 0.12, 170 + i), ICE_COLOR),
        cx: (r() - 0.5) * Math.max(0, w - 2 * (R + size + 0.4)),
        cz: (r() - 0.5) * Math.max(0, d - 2 * (R + size + 0.4)),
        R,
        a: r() * Math.PI * 2,
        speed: (0.04 + r() * 0.05) * (r() < 0.5 ? 1 : -1),
        spin: (r() - 0.5) * 0.1,
      };
    });
  }, [w, d]);
  // A shelf of ice along the back edge, with light coming through its cracks.
  const shelf = useMemo(() => paint(jitter(tf(box(w * 0.45, 0.4, 1.2), {}), 0.08, 180), ICE_COLOR), [w]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.35 }), []);
  useEffect(() => () => (mat.dispose(), shelf.dispose(), floes.forEach((f) => f.geo.dispose())), [mat, shelf, floes]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_s, dtRaw) => {
    // Drift by day, rest at night.
    const dt = Math.min(dtRaw, 0.1) * habitatCtx.daylight;
    floes.forEach((f, i) => {
      f.a += f.speed * dt;
      const m = refs.current[i];
      if (!m) return;
      m.position.set(f.cx + Math.cos(f.a) * f.R, h * habitatCtx.waterLevel - 0.05, f.cz + Math.sin(f.a) * f.R * 0.7);
      m.rotation.y += f.spin * dt;
    });
  });
  return (
    <group>
      {floes.map((f, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          geometry={f.geo}
          material={mat}
        />
      ))}
      <mesh geometry={shelf} material={mat} position={[-w * 0.22, h - 0.05, -d / 2 + 0.65]} />
    </group>
  );
}
