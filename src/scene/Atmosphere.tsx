// Lights, fog and the real-clock day/night cycle for the active habitat,
// plus night fireflies and splashes when something breaks the surface.
import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES, type BiomeId } from "../data/biomes";
import { daylight } from "../utils/time";
import type { Dims } from "../data/habitatGeometry";
import { mix } from "./models/geo";
import { habitatCtx, sceneTime, tankCtx } from "./registry";
import { AURORA, RAIN } from "../data/signatures";

interface LightSet {
  sun: string;
  sunI: number;
  sky: string;
  ground: string;
  hemiI: number;
  ambient: number;
}

/** Daytime lighting per biome. Night (where sunlight reaches) blends toward moonlight. */
function dayLights(biome: BiomeId): LightSet {
  const p = BIOMES[biome].palette;
  switch (biome) {
    case "swamp":
      return { sun: "#fff2d0", sunI: 1.5, sky: mix(p.water, "#ffffff", 0.6), ground: p.soil, hemiI: 1.1, ambient: 0.25 };
    case "ocean":
      return { sun: "#ffffff", sunI: 2.2, sky: mix(p.glow, "#ffffff", 0.3), ground: p.deep, hemiI: 1.0, ambient: 0.3 };
    case "deep":
      // No sunlight at all: a faint blue key so shapes still read, glow does the rest.
      return { sun: "#7fa8ff", sunI: 0.75, sky: "#2a4a78", ground: "#05070c", hemiI: 0.95, ambient: 0.22 };
    default: {
      const o = BIOMES[biome].lighting ?? {};
      return { sun: o.sun ?? "#ffffff", sunI: o.sunI ?? 2.0, sky: mix(p.water, "#ffffff", 0.6), ground: p.soil, hemiI: o.hemiI ?? 1.1, ambient: o.ambient ?? 0.25 };
    }
  }
}

const NIGHT: LightSet = { sun: "#a8b8ff", sunI: 0.35, sky: "#24324e", ground: "#05080f", hemiI: 0.55, ambient: 0.18 };
const NIGHT_FOG = "#0a1120";

/** `dims` is the current habitat size: lights, shadows and fog adapt to it. */
export function Atmosphere({ biome, shadows, dims }: { biome: BiomeId; shadows: boolean; dims: Dims }) {
  const b = BIOMES[biome];
  const { w, h, d } = dims;
  // Bigger habitats push the fog back so the far wall still reads clearly.
  const fogScale = Math.max(w / b.dims.w, d / b.dims.d);
  const day = useMemo(() => dayLights(biome), [biome]);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const fireflies = useRef<THREE.Group>(null);
  const center = useMemo(() => new THREE.Vector3(0, h * 0.4, 0), [h]);
  const c = useMemo(
    () => ({
      daySun: new THREE.Color(day.sun),
      nightSun: new THREE.Color(NIGHT.sun),
      daySky: new THREE.Color(day.sky),
      nightSky: new THREE.Color(NIGHT.sky),
      dayGround: new THREE.Color(day.ground),
      nightGround: new THREE.Color(NIGHT.ground),
      aurora: new THREE.Color(AURORA.colors[0]),
      dayFog: new THREE.Color(mix(b.palette.deep, b.palette.bgBottom, 0.5)),
      nightFog: new THREE.Color(mix(b.palette.deep, NIGHT_FOG, 0.75)),
    }),
    [day, b.palette],
  );
  // Start at the right brightness instead of fading in from noon.
  const lit = useRef(b.sunlit ? daylight() : 0);
  const lampK = useRef(1);
  useEffect(() => {
    lit.current = b.sunlit ? daylight() : 0;
    habitatCtx.daylight = lit.current;
  }, [b.sunlit]);

  useFrame((state, dt) => {
    sceneTime.value = state.clock.elapsedTime;
    const target = b.sunlit ? daylight() : 0;
    lit.current += (target - lit.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 1.5));
    const k = lit.current;
    habitatCtx.daylight = k;
    // In the deep, "day" lighting is the only lighting.
    const t = b.sunlit ? k : 1;
    // Amazon showers soften the light a little.
    const rainDim = 1 - (1 - RAIN.lightDim) * habitatCtx.rain;
    // The tank lamp: its color tints the light a little; switched off, the tank gets moody.
    lampK.current += ((tankCtx.lampOn ? 1 : 0) - lampK.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 4));
    const lampDim = THREE.MathUtils.lerp(0.38, 1, lampK.current);
    if (sun.current) {
      sun.current.color.lerpColors(c.nightSun, c.daySun, t);
      if (tankCtx.lampTint > 0) sun.current.color.lerp(tankCtx.lampColor, tankCtx.lampTint);
      sun.current.intensity = THREE.MathUtils.lerp(NIGHT.sunI, day.sunI, t) * rainDim * lampDim;
    }
    if (hemi.current) {
      hemi.current.color.lerpColors(c.nightSky, c.daySky, t);
      hemi.current.groundColor.lerpColors(c.nightGround, c.dayGround, t);
      hemi.current.intensity = THREE.MathUtils.lerp(NIGHT.hemiI, day.hemiI, t) * THREE.MathUtils.lerp(0.62, 1, lampK.current);
      // The aurora's light tints the water faintly.
      if (habitatCtx.aurora > 0) hemi.current.color.lerp(c.aurora, AURORA.tint * habitatCtx.aurora);
    }
    if (amb.current) amb.current.intensity = THREE.MathUtils.lerp(NIGHT.ambient, day.ambient, t);
    const f = fogRef.current;
    if (f) {
      // Fog is tuned for the default camera distance; keep the look when the camera
      // sits further back (tall phones) or zooms in.
      const dist = state.camera.position.distanceTo(center);
      f.near = Math.max(0.1, dist + (b.fog.near - b.camera.distance) * fogScale);
      f.far = dist + (b.fog.far - b.camera.distance) * fogScale;
      f.color.lerpColors(c.nightFog, c.dayFog, t);
    }
    if (fireflies.current) fireflies.current.visible = k < 0.45;
  });

  return (
    <>
      <fog ref={fogRef} attach="fog" args={[c.dayFog, b.fog.near, b.fog.far]} />
      <hemisphereLight ref={hemi} args={[day.sky, day.ground, day.hemiI]} />
      <ambientLight ref={amb} intensity={day.ambient} />
      <directionalLight
        ref={sun}
        position={[w * 0.35, h + 8, d * 0.6]}
        intensity={day.sunI}
        color={day.sun}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0008}
        shadow-camera-left={-w * 0.75}
        shadow-camera-right={w * 0.75}
        shadow-camera-top={d * 0.9}
        shadow-camera-bottom={-d * 0.9}
        shadow-camera-near={1}
        shadow-camera-far={h + 20}
      />
      {biome === "swamp" && (
        <group ref={fireflies} visible={false}>
          <Sparkles count={28} scale={[w * 1.1, 1.6, d * 1.1]} position={[0, h + 0.9, 0]} size={5} speed={0.35} opacity={1} color="#f3ff8a" noise={1.5} />
        </group>
      )}
      <Splashes />
    </>
  );
}

// ───────────── Splashes ─────────────

const POOL = 6;
const DROPS = 10;
const LIFE = 1.3;

function Splashes() {
  const ringGeo = useMemo(() => {
    const g = new THREE.RingGeometry(0.8, 1, 24);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const rings = useMemo(
    () => Array.from({ length: POOL }, () => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false })),
    [],
  );
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const drops = useRef<THREE.InstancedMesh>(null);
  const dropGeo = useMemo(() => new THREE.IcosahedronGeometry(0.06, 0), []);
  const dropMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#e8f8ff" }), []);
  const dirs = useMemo(
    () => Array.from({ length: POOL * DROPS }, (_, i) => ({ a: (i % DROPS) * ((Math.PI * 2) / DROPS) + Math.random() * 0.4, up: 2 + Math.random() * 2.5, out: 0.6 + Math.random() * 0.8 })),
    [],
  );
  useEffect(
    () => () => {
      ringGeo.dispose();
      dropGeo.dispose();
      dropMat.dispose();
      rings.forEach((m) => m.dispose());
    },
    [ringGeo, dropGeo, dropMat, rings],
  );
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const now = sceneTime.value;
    const list = habitatCtx.splashes;
    while (list.length && now - list[0].at > LIFE) list.shift();
    while (list.length > POOL) list.shift();
    for (let i = 0; i < POOL; i++) {
      const sp = list[i];
      const ring = ringRefs.current[i];
      const t = sp ? (now - sp.at) / LIFE : 1;
      if (ring) {
        ring.visible = !!sp;
        if (sp) {
          ring.position.copy(sp.pos).setY(sp.pos.y + 0.03);
          ring.scale.setScalar(0.2 + t * sp.size * 1.6);
          rings[i].opacity = (1 - t) * 0.7;
        }
      }
      for (let j = 0; j < DROPS; j++) {
        const k = i * DROPS + j;
        if (!sp || !drops.current) {
          s.setScalar(0);
          m4.compose(v.set(0, -100, 0), q, s);
        } else {
          const tt = t * LIFE;
          const dd = dirs[k];
          const size = Math.max(0.6, sp.size);
          v.set(
            sp.pos.x + Math.cos(dd.a) * dd.out * size * tt,
            sp.pos.y + dd.up * size * 0.6 * tt - 4.5 * tt * tt,
            sp.pos.z + Math.sin(dd.a) * dd.out * size * tt,
          );
          s.setScalar(v.y > sp.pos.y - 0.05 ? size * 0.9 : 0);
          m4.compose(v, q, s);
        }
        drops.current?.setMatrixAt(k, m4);
      }
    }
    if (drops.current) drops.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {rings.map((m, i) => (
        <mesh
          key={i}
          ref={(r) => {
            ringRefs.current[i] = r;
          }}
          geometry={ringGeo}
          material={m}
          visible={false}
          renderOrder={5}
        />
      ))}
      <instancedMesh ref={drops} args={[dropGeo, dropMat, POOL * DROPS]} frustumCulled={false} />
    </group>
  );
}
