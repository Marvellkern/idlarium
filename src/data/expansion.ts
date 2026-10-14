// Habitat expansion: 5 size levels per habitat. Each level makes the diorama
// physically bigger, adds space, a few decoration slots and one free terrain feature.
// Per-biome numbers (space per level, costs, growth) live in biomes.ts → `expansion`.

export const SIZE_LEVELS = 5;

/**
 * Diorama size multipliers per level (index 0 = Lv1). Footprint grows a lot,
 * height only a little so the water column doesn't look stretched. Habitats that
 * already start large (Open Ocean, Deep Sea) apply these at reduced strength (`growth`).
 */
export const SIZE_SCALE: { w: number; d: number; h: number }[] = [
  { w: 1.0, d: 1.0, h: 1.0 },
  { w: 1.25, d: 1.15, h: 1.0 },
  { w: 1.5, d: 1.3, h: 1.05 },
  { w: 1.8, d: 1.45, h: 1.1 },
  { w: 2.2, d: 1.6, h: 1.15 },
];

/** New decoration slots each level adds (index 0 = Lv2). Surface slots only where the habitat has them. */
export const NEW_FLOOR_SLOTS = [2, 3, 3, 4];
export const NEW_SURFACE_SLOTS = [1, 0, 1, 0];

/** Expansion animation length (ms). Tapping skips it. */
export const EXPAND_ANIM_MS = 2000;
/** With reduced motion: a quick fade instead; the size switches once the screen is covered. */
export const REDUCED_FADE_MS = 700;

export interface TerrainFeature {
  id: string;
  name: string;
  /** Where it sits, as a fraction of the half-width / half-depth at its level. null = scene effect only. */
  anchor: [number, number] | null;
  placement?: "floor" | "surface";
}

/** One free terrain feature per level (Lv2–Lv5) per habitat. */
export const TERRAIN_FEATURES: Record<string, TerrainFeature> = {
  // Swamp
  "lily-cluster": { id: "lily-cluster", name: "More lily pads", anchor: [0.86, 0.62], placement: "surface" },
  "mangrove-edge": { id: "mangrove-edge", name: "A mangrove edge", anchor: [-0.88, -0.78] },
  "fallen-tree": { id: "fallen-tree", name: "A fallen tree", anchor: [0.82, 0.8] },
  sandbar: { id: "sandbar", name: "A shallow sandbar", anchor: [-0.8, 0.82] },
  // Reef
  "coral-shelf": { id: "coral-shelf", name: "A new coral shelf", anchor: [-0.86, -0.78] },
  "sand-channel": { id: "sand-channel", name: "A sand channel", anchor: [0.62, 0.0] },
  "rock-arch": { id: "rock-arch", name: "A rock arch", anchor: [0.85, -0.78] },
  "drop-off": { id: "drop-off", name: "A drop-off edge", anchor: [0, -0.9] },
  // Open Ocean
  "more-light": { id: "more-light", name: "More light shafts", anchor: null },
  "kelp-edge": { id: "kelp-edge", name: "A kelp edge", anchor: [-0.82, -0.8] },
  "deeper-blue": { id: "deeper-blue", name: "A deeper blue below", anchor: null },
  "far-seamount": { id: "far-seamount", name: "A distant seamount", anchor: [0.8, -0.8] },
  // Deep Sea
  "more-floor": { id: "more-floor", name: "More of the dark floor", anchor: [-0.82, 0.78] },
  "second-vent": { id: "second-vent", name: "A second vent", anchor: [0.84, -0.78] },
  "trench-glow": { id: "trench-glow", name: "A faintly glowing trench edge", anchor: [0, -0.92] },
  "bacteria-field": { id: "bacteria-field", name: "A field of glowing bacteria", anchor: [-0.82, -0.75] },
};
