// Non-React lookups shared inside the scene: where each creature is right now,
// the sway clock, and the live context for the active habitat.
import * as THREE from "three";
import type { Splash } from "./movement";

type PosGetter = (out: THREE.Vector3) => THREE.Vector3;

export const creaturePositions = new Map<string, PosGetter>();

/** Shared clock uniform for anything that sways (plants, water). */
export const sceneTime = { value: 0 };

/** Live context for the active habitat, read by movement every frame. */
export const habitatCtx: {
  feed: THREE.Vector3 | null;
  pads: THREE.Vector3[];
  hideouts: THREE.Vector3[];
  /** 0 = night, 1 = day (always 0 where sunlight never reaches). */
  daylight: number;
  splashes: Splash[];
} = {
  feed: null,
  pads: [],
  hideouts: [],
  daylight: 1,
  splashes: [],
};

/** Habitat growth animation progress, 0 → 1 (1 when nothing is growing). Set by HabitatScene. */
export const expansionCtx = { t: 1 };

/** Each creature's length, so the camera can frame small fish up close. */
export const creatureLengths = new Map<string, number>();
