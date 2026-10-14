// Three.js-side helpers around the pure habitat geometry (data/habitatGeometry.ts):
// swim bounds, decoration slots and the edge-fade box, all for the current size.
import * as THREE from "three";
import { BIOMES, type BiomeId } from "../data/biomes";
import { slotLayout, TERRAIN_MAX, terrainHeight, type Dims } from "../data/habitatGeometry";

export { decoScale, habitatDims, terrainHeight, TERRAIN_MAX, type Dims } from "../data/habitatGeometry";

export interface Bounds {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/** Where a creature of the given length may swim in a diorama of size `dims`. */
export function swimBounds(dims: Dims, length: number): Bounds {
  const { w, h, d } = dims;
  const mx = Math.min(w / 2 - 0.1, length * 0.55 + 0.15);
  const mz = Math.min(d / 2 - 0.1, length * 0.55 + 0.15);
  const my = Math.min(h / 3, length * 0.2 + 0.12);
  return {
    min: new THREE.Vector3(-w / 2 + mx, TERRAIN_MAX + my, -d / 2 + mz),
    max: new THREE.Vector3(w / 2 - mx, h - my, d / 2 - mz),
  };
}

export interface Slot {
  key: string;
  kind: "floor" | "surface";
  level: number;
  pos: THREE.Vector3;
}

/** Decoration slots at a size level, positioned on the terrain / water surface of `dims`. */
export function decoSlots(biome: BiomeId, level: number, dims: Dims): Slot[] {
  return slotLayout(biome, level).map((s) => ({
    key: s.key,
    kind: s.kind,
    level: s.level,
    pos: new THREE.Vector3(s.x, s.kind === "surface" ? dims.h : terrainHeight(biome, s.x, s.z, dims), s.z),
  }));
}

/**
 * The box creatures fade out at (world space). Sides always; the top stays open
 * where it is the sea surface (so dolphins and whales can leap out of it).
 */
export function fadeBox(biome: BiomeId, dims: Dims) {
  const b = BIOMES[biome];
  const { w, h, d, soil } = dims;
  return {
    min: new THREE.Vector3(-w / 2, b.floorless ? 0 : -soil, -d / 2),
    max: new THREE.Vector3(w / 2, b.sunlit ? 1e4 : h, d / 2),
  };
}
