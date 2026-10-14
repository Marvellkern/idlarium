// The free terrain feature each expansion level adds. The one that arrives with an
// expansion pops up with a small bounce near the end of the growth animation.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES, type BiomeId } from "../data/biomes";
import { TERRAIN_FEATURES } from "../data/expansion";
import { decoScale, featureSpot, terrainHeight, type Dims } from "../data/habitatGeometry";
import { getFeatureParts } from "./models/featureModels";
import { expansionCtx, sceneTime } from "./registry";
import { createSwimMaterial, SwimMode } from "./swimShader";

/** Overshooting ease for the pop-up. */
function backOut(t: number) {
  const x = Math.min(1, Math.max(0, t));
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
}

export function TerrainFeatures({ biome, level, dims, growingTo }: { biome: BiomeId; level: number; dims: Dims; growingTo: number | null }) {
  const features = useMemo(() => {
    const out: { level: number; id: string; x: number; z: number; surface: boolean }[] = [];
    for (let L = 2; L <= level; L++) {
      const id = BIOMES[biome].expansion.features[L - 2];
      const spot = featureSpot(biome, L);
      if (!spot) continue;
      out.push({ level: L, id, x: spot.x, z: spot.z, surface: TERRAIN_FEATURES[id]?.placement === "surface" });
    }
    return out;
  }, [biome, level]);
  const scale = decoScale(biome);
  return (
    <group>
      {features.map((f) => (
        <Feature
          key={f.id}
          id={f.id}
          scale={scale}
          dims={dims}
          position={[f.x, f.surface ? dims.h : terrainHeight(biome, f.x, f.z, dims), f.z]}
          popping={growingTo === f.level}
        />
      ))}
    </group>
  );
}

function Feature({ id, scale, dims, position, popping }: { id: string; scale: number; dims: Dims; position: [number, number, number]; popping: boolean }) {
  const parts = useMemo(() => getFeatureParts(id, dims.h / scale), [id, dims.h, scale]);
  const mats = useMemo(
    () => parts.map((p) => createSwimMaterial({ mode: SwimMode.PLANT, amp: p.sway, freq: 1.5, rim: 0.15, side: THREE.DoubleSide })),
    [parts],
  );
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const group = useRef<THREE.Group>(null);
  const spins = useRef<(THREE.Group | null)[]>([]);
  useFrame((_s, dt) => {
    mats.forEach((m, i) => (m.userData.swim.uPhase.value = sceneTime.value + i * 1.3 + position[0]));
    parts.forEach((p, i) => {
      if (p.spin && spins.current[i]) spins.current[i]!.rotation.y += dt * p.spin;
    });
    if (group.current) {
      const k = popping ? backOut((expansionCtx.t - 0.55) / 0.4) : 1;
      group.current.scale.setScalar(scale * Math.max(0.0001, k));
    }
  });
  return (
    <group ref={group} position={position} scale={scale}>
      {parts.map((p, i) => (
        <group
          key={i}
          ref={(g) => {
            spins.current[i] = g;
          }}
          position={[p.x, 0, p.z]}
          rotation={[0, p.rotY, 0]}
          scale={p.scale}
        >
          <mesh geometry={p.geometry} material={mats[i]} receiveShadow />
          {p.light && <pointLight color={p.light.color} intensity={p.light.intensity} distance={7} decay={1.5} position={[0, p.light.y, 0]} />}
        </group>
      ))}
    </group>
  );
}
