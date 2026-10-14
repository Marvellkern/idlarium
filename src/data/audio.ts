// [PLACEHOLDER: audio files]
// Drop files into /public/audio and set the paths here. Anything left null is skipped,
// so the game works silently without them. UI sounds are synthesized as a fallback.

import type { BiomeId } from "./biomes";

export const AMBIENT: Partial<Record<BiomeId, string | null>> = {
  swamp: null, // e.g. "/audio/swamp-ambient.mp3"
  tidepool: null,
  reef: null,
  amazon: null,
  ocean: null,
  kelp: null,
  deep: null,
  polar: null,
};

/** Optional rain loop for Amazon showers (synthesized if null). */
export const RAIN_LOOP: string | null = null;

/** Little sounds the synthesized ambience can sprinkle in. */
export type AmbientEvent = "bubble" | "whale" | "ping" | "gull" | "trickle" | "bird" | "insect" | "bark" | "creak";

/**
 * Synthesized ambience, used while a habitat has no audio file above:
 * a low-passed noise bed (optionally swelling like waves), optional low drones,
 * and small events picked every tickMs with the given chances.
 */
export interface AmbientRecipe {
  bed: { cutoff: number; gain: number; /** Seconds per wave swell (0 = steady). */ swell?: number };
  hum?: number[];
  tickMs: number;
  events: { kind: AmbientEvent; chance: number }[];
}

export const AMBIENT_SYNTH: Record<BiomeId, AmbientRecipe> = {
  swamp: { bed: { cutoff: 600, gain: 0.035 }, tickMs: 900, events: [{ kind: "bubble", chance: 1 }] },
  // Gentle waves, water trickling between rocks, a gull far away.
  tidepool: { bed: { cutoff: 1100, gain: 0.04, swell: 7 }, tickMs: 1100, events: [{ kind: "trickle", chance: 0.45 }, { kind: "gull", chance: 0.04 }] },
  reef: { bed: { cutoff: 900, gain: 0.035 }, tickMs: 900, events: [{ kind: "bubble", chance: 1 }] },
  // River flow, soft rainforest birds and insects (rain is layered on top when it rains).
  amazon: { bed: { cutoff: 520, gain: 0.032 }, tickMs: 1400, events: [{ kind: "bird", chance: 0.1 }, { kind: "insect", chance: 0.14 }, { kind: "bubble", chance: 0.2 }] },
  ocean: { bed: { cutoff: 380, gain: 0.035 }, tickMs: 2500, events: [{ kind: "whale", chance: 0.18 }] },
  // Muffled ocean with a slow swell, a sea lion barking far away now and then.
  kelp: { bed: { cutoff: 320, gain: 0.045, swell: 9 }, tickMs: 2500, events: [{ kind: "bark", chance: 0.05 }, { kind: "bubble", chance: 0.12 }] },
  deep: { bed: { cutoff: 220, gain: 0.05 }, hum: [55, 55.7, 82.4], tickMs: 2500, events: [{ kind: "ping", chance: 0.12 }] },
  // Low wind, creaking ice, distant whale song.
  polar: { bed: { cutoff: 260, gain: 0.042, swell: 11 }, tickMs: 2500, events: [{ kind: "creak", chance: 0.1 }, { kind: "whale", chance: 0.09 }] },
};

export const MUSIC: string | null = null; // e.g. "/audio/lofi-loop.mp3"

export const UI_SOUNDS: Record<"plink" | "pop" | "chime" | "tap", string | null> = {
  plink: null,
  pop: null,
  chime: null,
  tap: null,
};
