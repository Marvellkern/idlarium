// Waiting eggs sit in a little cluster on the floor (or drift, in open water).
// Tap a cluster to hatch it.
import { Sparkles } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES, type BiomeId } from "../data/biomes";
import { SPECIES_BY_ID } from "../data/creatures";
import { hatchEgg } from "../state/eggLogic";
import type { Egg } from "../state/types";
import { terrainHeight } from "./layout";
import { mix, rng } from "./models/geo";

const eggGeo = new THREE.IcosahedronGeometry(1, 1);
const hitGeo = new THREE.SphereGeometry(0.5, 8, 6);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });

/** Where egg cluster `i` rests. Spread along the front of the habitat. */
export function eggSpot(biome: BiomeId, i: number) {
  const b = BIOMES[biome];
  const { w, h, d } = b.dims;
  const x = (-0.3 + i * 0.3) * w;
  const z = 0.28 * d;
  const y = b.floorless ? h * 0.35 : terrainHeight(biome, x, z) + 0.06;
  return new THREE.Vector3(x, y, z);
}

export function Eggs({ biome, eggs }: { biome: BiomeId; eggs: Egg[] }) {
  return (
    <group>
      {eggs.map((e, i) => (
        <EggCluster key={i + e.speciesId + e.laidAt} biome={biome} index={i} egg={e} />
      ))}
    </group>
  );
}

function EggCluster({ biome, index, egg }: { biome: BiomeId; index: number; egg: Egg }) {
  const sp = SPECIES_BY_ID[egg.speciesId];
  const pos = useMemo(() => eggSpot(biome, index), [biome, index]);
  const big = sp?.size === "L" || sp?.size === "M";
  const color = mix(sp?.colors[2] ?? "#ffffff", "#fff8e8", 0.55);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.35, flatShading: true, emissive: color, emissiveIntensity: 0.25, transparent: true, opacity: 0.92 }),
    [color],
  );
  const eggs = useMemo(() => {
    const r = rng(index * 31 + egg.laidAt);
    const n = big ? 3 : 6;
    return Array.from({ length: n }, () => ({
      p: [(r() - 0.5) * 0.22, r() * 0.06, (r() - 0.5) * 0.22] as [number, number, number],
      s: (big ? 0.08 : 0.045) * (0.8 + r() * 0.4),
    }));
  }, [index, egg.laidAt, big]);
  useEffect(() => () => mat.dispose(), [mat]);
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime + index;
    mat.emissiveIntensity = 0.2 + (Math.sin(t * 2) + 1) * 0.15;
    if (ref.current && BIOMES[biome].floorless) ref.current.position.y = pos.y + Math.sin(t * 0.8) * 0.1;
  });
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    hatchEgg(biome, index, { x: pos.x, y: pos.y + 0.2, z: pos.z });
  };
  return (
    <group ref={ref} position={pos}>
      {eggs.map((e, i) => (
        <mesh key={i} geometry={eggGeo} material={mat} position={e.p} scale={e.s} />
      ))}
      <Sparkles count={6} scale={0.5} size={2} speed={0.3} color="#fff6c8" position={[0, 0.15, 0]} />
      <mesh geometry={hitGeo} material={hitMat} scale={0.7} onClick={onClick} />
    </group>
  );
}
