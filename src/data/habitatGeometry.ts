// Pure habitat geometry (no three.js, so the UI can use it too): diorama size per
// expansion level, terrain height, and the decoration slot layout.
//
// Slot keys are stable forever:
//   "f0".."fN" / "s0".."sN"  the original Lv1 floor grid and surface spots
//   "L3f1", "L4s0", …        slots added by later levels
// Every slot's x/z is fixed once its level exists, so decorations never move
// when a habitat grows.

import { BIOMES, type BiomeId } from "./biomes";
import { NEW_FLOOR_SLOTS, NEW_SURFACE_SLOTS, SIZE_LEVELS, SIZE_SCALE, TERRAIN_FEATURES } from "./expansion";

export interface Dims {
  w: number;
  h: number;
  d: number;
  soil: number;
}

export function clampLevel(level: number) {
  return Math.max(1, Math.min(SIZE_LEVELS, Math.round(level) || 1));
}

/** Size multipliers at a level, softened by the biome's `growth`. */
export function sizeScale(biome: BiomeId, level: number) {
  const s = SIZE_SCALE[clampLevel(level) - 1];
  const g = BIOMES[biome].expansion.growth;
  return { w: 1 + (s.w - 1) * g, d: 1 + (s.d - 1) * g, h: 1 + (s.h - 1) * g };
}

export function habitatDims(biome: BiomeId, level: number): Dims {
  const base = BIOMES[biome].dims;
  const s = sizeScale(biome, level);
  return { w: base.w * s.w, h: base.h * s.h, d: base.d * s.d, soil: base.soil };
}

export function lerpDims(a: Dims, b: Dims, t: number): Dims {
  return { w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t, d: a.d + (b.d - a.d) * t, soil: a.soil + (b.soil - a.soil) * t };
}

const SEEDS: Record<BiomeId, number> = { swamp: 1.7, tidepool: 3.6, reef: 4.2, amazon: 6.3, ocean: 7.1, kelp: 8.4, deep: 2.9, polar: 5.5 };

/** Highest the terrain bumps go (world units), unless a habitat sets its own. */
export const TERRAIN_MAX = 0.32;

function smooth(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Terrain height at (x, z) for a diorama of size `dims`. The bumps depend only on
 * x/z; just the last half unit near the walls slopes down to meet the soil block,
 * so the ground under existing decorations never changes when a habitat grows.
 */
export function terrainHeight(biome: BiomeId, x: number, z: number, dims: Dims = BIOMES[biome].dims) {
  // Open water: no seabed. "Floor" creatures and decorations sit low and fade into the deep.
  if (BIOMES[biome].floorless) return 0.25;
  const s = SEEDS[biome];
  const edge = Math.min(dims.w / 2 - Math.abs(x), dims.d / 2 - Math.abs(z));
  const falloff = smooth(0, 0.5, edge);
  const n = 0.5 + 0.3 * Math.sin(x * 1.3 + s) * Math.cos(z * 1.1 + s * 2) + 0.2 * Math.sin(x * 2.7 - z * 1.9 + s * 3);
  return Math.max(0, n) * (BIOMES[biome].terrainMax ?? TERRAIN_MAX) * falloff + 0.03;
}

/** Decoration size multiplier. Fixed per habitat (Lv1 grid) so decorations never resize. */
export function decoScale(biome: BiomeId) {
  const b = BIOMES[biome];
  return Math.min((b.dims.w * 0.8) / b.decoSlots.cols, (b.dims.d * 0.72) / b.decoSlots.rows) * 0.8;
}

export interface SlotInfo {
  key: string;
  kind: "floor" | "surface";
  x: number;
  z: number;
  /** Size level that unlocks this slot. */
  level: number;
}

/** Candidate spots for new slots, as fractions of the half-width / half-depth (minus a margin). */
const FLOOR_ANCHORS: [number, number][] = [
  [1, 0], [-1, 0], [0, -1], [1, -1], [-1, 1], [1, 1], [-1, -1], [0, 1],
  [0.5, -1], [-0.5, -1], [0.5, 1], [-0.5, 1], [1, 0.5], [-1, -0.5], [1, -0.5], [-1, 0.5],
];
const SURFACE_ANCHORS: [number, number][] = [
  [0.78, -0.55], [-0.78, 0.6], [0.55, 0.7], [-0.55, -0.7],
];

const layoutCache = new Map<string, SlotInfo[]>();

/** All decoration slots available at `level` (earlier levels' slots included, unchanged). */
export function slotLayout(biome: BiomeId, level: number): SlotInfo[] {
  const lv = clampLevel(level);
  const cacheKey = biome + lv;
  const hit = layoutCache.get(cacheKey);
  if (hit) return hit;

  const b = BIOMES[biome];
  const { w, d } = b.dims;
  const { cols, rows, surface } = b.decoSlots;
  const out: SlotInfo[] = [];
  // Lv1: exactly the original grid, so old saves line up perfectly.
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      out.push({ key: `f${i}`, kind: "floor", level: 1, x: -0.4 * w + (0.8 * w * (c + 0.5)) / cols + (r % 2 ? 0.12 : -0.12), z: -0.36 * d + (0.72 * d * (r + 0.5)) / rows });
    }
  for (let i = 0; i < surface; i++)
    out.push({ key: `s${i}`, kind: "surface", level: 1, x: -0.36 * w + (0.72 * w * (i + 0.5)) / surface, z: i % 2 ? 0.22 * d : -0.18 * d });

  const scale = decoScale(biome);
  const margin = scale * 0.62;
  const minGap = scale * 1.05;
  for (let L = 2; L <= lv; L++) {
    const dims = habitatDims(biome, L);
    const hx = dims.w / 2 - margin;
    const hz = dims.d / 2 - margin;
    // Keep clear of this level's terrain feature.
    const feature = TERRAIN_FEATURES[b.expansion.features[L - 2]];
    const blocked = feature?.anchor && feature.placement !== "surface" ? [{ x: feature.anchor[0] * hx, z: feature.anchor[1] * hz }] : [];
    const place = (anchors: [number, number][], kind: "floor" | "surface", count: number) => {
      let n = 0;
      for (const [ax, az] of anchors) {
        if (n >= count) break;
        const x = ax * hx;
        const z = az * hz;
        const clash = [...out.filter((s) => s.kind === kind), ...blocked].some((s) => Math.hypot(s.x - x, s.z - z) < minGap);
        if (clash) continue;
        out.push({ key: `L${L}${kind === "floor" ? "f" : "s"}${n}`, kind, level: L, x, z });
        n++;
      }
    };
    place(FLOOR_ANCHORS, "floor", NEW_FLOOR_SLOTS[L - 2]);
    if (surface > 0) place(SURFACE_ANCHORS, "surface", NEW_SURFACE_SLOTS[L - 2]);
  }
  layoutCache.set(cacheKey, out);
  return out;
}

/** Slots a level adds (for the Expand card). */
export function newSlotsAt(biome: BiomeId, level: number) {
  return slotLayout(biome, level).filter((s) => s.level === clampLevel(level)).length;
}

/** Where a level's terrain feature sits (world x/z), or null for scene-effect features. */
export function featureSpot(biome: BiomeId, level: number): { x: number; z: number } | null {
  if (level < 2) return null;
  const f = TERRAIN_FEATURES[BIOMES[biome].expansion.features[level - 2]];
  if (!f?.anchor) return null;
  const dims = habitatDims(biome, level);
  const margin = decoScale(biome) * 0.62;
  return { x: f.anchor[0] * (dims.w / 2 - margin), z: f.anchor[1] * (dims.d / 2 - margin) };
}
