// [PLACEHOLDER: audio files]
// Drop files into /public/audio and set the paths here. Anything left null is skipped,
// so the game works silently without them. UI sounds are synthesized as a fallback.

import type { BiomeId } from "./biomes";

export const AMBIENT: Partial<Record<BiomeId, string | null>> = {
  swamp: null, // e.g. "/audio/swamp-ambient.mp3"
  reef: null,
  ocean: null,
  deep: null,
};

export const MUSIC: string | null = null; // e.g. "/audio/lofi-loop.mp3"

export const UI_SOUNDS: Record<"plink" | "pop" | "chime" | "tap", string | null> = {
  plink: null,
  pop: null,
  chime: null,
  tap: null,
};
