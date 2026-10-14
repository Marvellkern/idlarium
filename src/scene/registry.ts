// Non-React lookups shared inside the scene: where each creature is right now,
// the sway clock, and the live context for the active habitat.
import * as THREE from "three";
import type { Agent, Splash } from "./movement";

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
  /** Water height as a fraction of the full height (Tidepool tides; 1 elsewhere). */
  waterLevel: number;
  /** 0–1: how hard it's raining in the active habitat (Amazon). */
  rain: number;
  /** 0–1: how bright the aurora is (Polar Waters at night). */
  aurora: number;
} = {
  feed: null,
  pads: [],
  hideouts: [],
  daylight: 1,
  splashes: [],
  waterLevel: 1,
  rain: 0,
  aurora: 0,
};

/** Habitat growth animation progress, 0 → 1 (1 when nothing is growing). Set by HabitatScene. */
export const expansionCtx = { t: 1 };

/** Each creature's length, so the camera can frame small fish up close. */
export const creatureLengths = new Map<string, number>();

/** Live movement state per creature (sea otters read their partner's). */
export const agents = new Map<string, Agent>();

/** Species that pair up (sea otters): uids in the order they arrived, paired 1–2, 3–4, … */
export const pairBook = new Map<string, string[]>();

/**
 * The tank as currently drawn (it animates while a habitat grows), written by the
 * diorama every frame, plus the lamp state that lighting and creatures react to.
 */
export const tankCtx = {
  w: 1,
  h: 1,
  d: 1,
  soil: 0,
  lampOn: true,
  lampColor: new THREE.Color("#ffffff"),
  lampTint: 0,
};
