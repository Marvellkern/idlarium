// Biome configs: palettes, diorama dimensions, camera, capacity and unlock costs.
// All balancing numbers for habitats live here. Tweak freely.
//
// Pacing target (casual player, ~4 short check-ins a day): Coral Reef on day 1,
// Open Ocean around day 2–3, Deep Sea around day 7. Each habitat physically expands
// through 5 size levels (see `expansion` below and data/expansion.ts); the last
// Deep Sea expansion is a long-term goal.

export type BiomeId = "swamp" | "reef" | "ocean" | "deep" | "polar";

export interface BiomePalette {
  water: string; // main water tint
  deep: string; // darker water / fog
  floor: string; // sediment / sand top
  soil: string; // cross-section soil sides
  plant: string;
  accent: string;
  glow: string;
  bgTop: string; // page backdrop gradient behind the floating diorama
  bgBottom: string;
}

export interface BiomeConfig {
  id: BiomeId;
  name: string;
  /** Short line shown in the biome switcher. */
  tagline: string;
  /** Set false for biomes that are announced but not built yet. */
  playable: boolean;
  /** Pearls to unlock. 0 = unlocked from the start. */
  unlockCost: number;
  palette: BiomePalette;
  /** Diorama size in world units: width (x), water height (y), depth (z). */
  dims: { w: number; h: number; d: number; soil: number };
  /** min = closest zoom (kept small so little fish are easy to see); default and max adapt to the size. */
  camera: { distance: number; min: number; max: number; fov: number };
  fog: { near: number; far: number };
  caustics: boolean;
  /** Open water with no visible seabed (Open Ocean). */
  floorless?: boolean;
  /** Physical expansion, see data/expansion.ts. Levels 1–5. */
  expansion: {
    /** Space points at size levels 1–5. */
    space: [number, number, number, number, number];
    /** Cost of the Lv2 expansion; each later level costs × costGrowth more. */
    baseCost: number;
    costGrowth: number;
    /** How strongly the diorama grows per level (1 = full table; ~0.7 for habitats that start large). */
    growth: number;
    /** Free terrain feature added at Lv2, Lv3, Lv4 and Lv5 (ids in TERRAIN_FEATURES). */
    features: [string, string, string, string];
  };
  /** Starting (Lv1) decoration slots: floor grid (cols × rows) plus fixed surface slots. */
  decoSlots: { cols: number; rows: number; surface: number };
  /** Codex completion rewards at 25 / 50 / 75 / 100 %. */
  codexRewards: [number, number, number, number];
  emptyPrompt: string;
  /** False where sunlight never reaches (Deep Sea): always dark, no day/night. */
  sunlit: boolean;
  /** Said once when night falls (or on opening at night). */
  nightLine: string;
}

export const BIOMES: Record<BiomeId, BiomeConfig> = {
  swamp: {
    id: "swamp",
    name: "Freshwater Swamp",
    tagline: "Murky, cozy, full of roots",
    playable: true,
    unlockCost: 0,
    palette: {
      water: "#4b6b4a",
      deep: "#2e4232",
      floor: "#6b5a3e",
      soil: "#4a3d2a",
      plant: "#7aa35c",
      accent: "#e8f27a",
      glow: "#e8f27a",
      bgTop: "#cfdcc0",
      bgBottom: "#7d9470",
    },
    dims: { w: 6, h: 3.2, d: 4, soil: 0.9 },
    camera: { distance: 9.5, min: 3.5, max: 14, fov: 42 },
    fog: { near: 6, far: 22 },
    caustics: true,
    expansion: {
      space: [10, 18, 28, 42, 60],
      baseCost: 300,
      costGrowth: 20,
      growth: 1,
      features: ["lily-cluster", "mangrove-edge", "fallen-tree", "sandbar"],
    },
    decoSlots: { cols: 4, rows: 2, surface: 3 },
    codexRewards: [100, 300, 900, 2500],
    emptyPrompt: "Your swamp is quiet… buy your first guppy.",
    sunlit: true,
    nightLine: "The swamp is sleepy tonight.",
  },
  reef: {
    id: "reef",
    name: "Coral Reef",
    tagline: "Bright, busy, sunlit",
    playable: true,
    unlockCost: 2000,
    palette: {
      water: "#3fc1c9",
      deep: "#1f7a8c",
      floor: "#f2e2b6",
      soil: "#c9b48a",
      plant: "#5fbf8f",
      accent: "#ffd166",
      glow: "#fff4c2",
      bgTop: "#d8f4f2",
      bgBottom: "#5fb3bd",
    },
    dims: { w: 9, h: 4.5, d: 6, soil: 1.1 },
    camera: { distance: 14, min: 4.5, max: 20, fov: 42 },
    fog: { near: 10, far: 34 },
    caustics: true,
    expansion: {
      space: [20, 32, 48, 68, 90],
      baseCost: 40_000,
      costGrowth: 9,
      growth: 1,
      features: ["coral-shelf", "sand-channel", "rock-arch", "drop-off"],
    },
    decoSlots: { cols: 4, rows: 2, surface: 0 },
    codexRewards: [1500, 4000, 12000, 30000],
    emptyPrompt: "The reef is waiting for its first clownfish.",
    sunlit: true,
    nightLine: "The reef is settling in for the night. Night owls are out.",
  },
  ocean: {
    id: "ocean",
    name: "Open Ocean",
    tagline: "Deep blue, big travelers",
    playable: true,
    unlockCost: 45_000_000,
    palette: {
      water: "#1e6fa8",
      deep: "#0b2f55",
      floor: "#0b2f55",
      soil: "#0b2f55",
      plant: "#2f8f8f",
      accent: "#ffffff",
      glow: "#8fd3ff",
      bgTop: "#bfe3ff",
      bgBottom: "#2a6c9e",
    },
    dims: { w: 14, h: 8, d: 10, soil: 0 },
    camera: { distance: 24, min: 7, max: 34, fov: 42 },
    fog: { near: 16, far: 50 },
    caustics: false,
    floorless: true,
    expansion: {
      space: [60, 90, 130, 180, 240],
      baseCost: 100_000_000,
      costGrowth: 3.2,
      growth: 0.7,
      features: ["more-light", "kelp-edge", "deeper-blue", "far-seamount"],
    },
    decoSlots: { cols: 3, rows: 2, surface: 2 },
    codexRewards: [2_000_000, 5_000_000, 15_000_000, 40_000_000],
    emptyPrompt: "So much open water. Who will swim here first?",
    sunlit: true,
    nightLine: "Moonlight on the open ocean.",
  },
  deep: {
    id: "deep",
    name: "Deep Sea",
    tagline: "Dark, glowing, strange",
    playable: true,
    unlockCost: 3_000_000_000,
    palette: {
      water: "#081426",
      deep: "#02060d",
      floor: "#1a1f2b",
      soil: "#10131a",
      plant: "#3df5d0",
      accent: "#ff6a3d",
      glow: "#3df5d0",
      bgTop: "#1b2a44",
      bgBottom: "#02060d",
    },
    dims: { w: 14, h: 8, d: 10, soil: 1.2 },
    camera: { distance: 24, min: 7, max: 34, fov: 42 },
    fog: { near: 14, far: 44 },
    caustics: false,
    expansion: {
      space: [50, 80, 115, 160, 210],
      baseCost: 3_000_000_000,
      costGrowth: 2.5,
      growth: 0.7,
      features: ["more-floor", "second-vent", "trench-glow", "bacteria-field"],
    },
    decoSlots: { cols: 4, rows: 2, surface: 0 },
    codexRewards: [300_000_000, 800_000_000, 2_000_000_000, 5_000_000_000],
    emptyPrompt: "Nothing glows down here yet.",
    sunlit: false,
    nightLine: "",
  },
  polar: {
    id: "polar",
    name: "Polar Waters",
    tagline: "Icy, pale, quiet",
    playable: false,
    unlockCost: 5000000,
    palette: {
      water: "#9cc9e0",
      deep: "#4f84a3",
      floor: "#dce9f0",
      soil: "#8aa6b5",
      plant: "#6fa0b0",
      accent: "#ffffff",
      glow: "#e6f6ff",
      bgTop: "#eef6fb",
      bgBottom: "#9ab9cc",
    },
    dims: { w: 14, h: 8, d: 10, soil: 1 },
    camera: { distance: 24, min: 16, max: 34, fov: 42 },
    fog: { near: 16, far: 50 },
    caustics: false,
    expansion: {
      space: [60, 90, 130, 180, 240],
      baseCost: 100_000,
      costGrowth: 3,
      growth: 0.7,
      features: ["more-light", "kelp-edge", "deeper-blue", "far-seamount"],
    },
    decoSlots: { cols: 3, rows: 2, surface: 2 },
    codexRewards: [500000, 1000000, 3000000, 8000000],
    emptyPrompt: "The ice creaks softly. No one here yet.",
    sunlit: true,
    nightLine: "The polar night is long and quiet.",
  },
};

/** Order shown in the biome switcher. */
export const BIOME_ORDER: BiomeId[] = ["swamp", "reef", "ocean", "deep"];
