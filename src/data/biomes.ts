// Biome configs: palettes, diorama dimensions, camera, capacity and unlock costs.
// All balancing numbers for habitats live here. Tweak freely.
//
// Unlock order (BIOME_ORDER at the bottom) runs swamp → tidepool → reef → amazon →
// ocean → kelp → deep → polar. Each new habitat sits about halfway (on a log scale)
// between its neighbors' unlock costs. Each habitat physically expands through 5
// size levels (see `expansion` below and data/expansion.ts). Signature touches
// (tides, rain, kelp, aurora) are tuned in data/signatures.ts.

export type BiomeId = "swamp" | "tidepool" | "reef" | "amazon" | "ocean" | "kelp" | "deep" | "polar";

/** Kind of water, shown as a small label in the habitat switcher. */
export type BiomeGroup = "Freshwater" | "Coast" | "Open sea" | "Polar";

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
  /** Optional rock color: the higher terrain bumps are painted with it (tide pools, kelp reefs, ice). */
  rock?: string;
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
  group: BiomeGroup;
  /** Sun shafts through the water (high quality only). 0 = none. */
  lightShafts: number;
  /** Daytime light overrides (defaults suit a clear, sunlit habitat). */
  lighting?: { sun?: string; sunI?: number; hemiI?: number; ambient?: number };
  /** Height of the terrain bumps (default 0.32). */
  terrainMax?: number;
  /** The habitat's special touch, tuned in data/signatures.ts. */
  signature?: "tides" | "rain" | "kelp" | "aurora";
  /** Fixed scenery that's always there (not decorations): deco model id, spot as a fraction of the Lv1 half-size. */
  scenery?: { decoId: string; x: number; z: number; scale: number; rotY?: number }[];
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
    group: "Freshwater",
    lightShafts: 0,
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
    group: "Coast",
    lightShafts: 5,
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
    group: "Open sea",
    lightShafts: 5,
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
    group: "Open sea",
    lightShafts: 0,
  },
  tidepool: {
    id: "tidepool",
    name: "Tidepool",
    tagline: "Tiny rock pools, real tides",
    playable: true,
    // About 0.3 × the Coral Reef: cheap early variety.
    unlockCost: 600,
    palette: {
      water: "#7fd1c7",
      deep: "#3a8f8a",
      floor: "#e8d9b0",
      soil: "#a8987a",
      plant: "#6fae6a",
      accent: "#ff9f68",
      glow: "#fff6d8",
      bgTop: "#e6f6f2",
      bgBottom: "#78bdb4",
      rock: "#6e6a6a",
    },
    dims: { w: 5.2, h: 2.2, d: 3.8, soil: 0.8 },
    camera: { distance: 8.5, min: 3, max: 13, fov: 42 },
    fog: { near: 6, far: 21 },
    caustics: true,
    expansion: {
      space: [8, 14, 22, 32, 45],
      // Same base-to-unlock ratio as the Coral Reef (×20).
      baseCost: 12_000,
      costGrowth: 12,
      growth: 1,
      features: ["barnacle-ridge", "sea-stack", "mussel-bed", "anemone-garden"],
    },
    decoSlots: { cols: 4, rows: 2, surface: 0 },
    codexRewards: [500, 1500, 4500, 12000],
    emptyPrompt: "The rock pool is still. Buy your first hermit crab.",
    sunlit: true,
    nightLine: "The tide pool glitters under the moon.",
    group: "Coast",
    lightShafts: 0,
    terrainMax: 0.5,
    signature: "tides",
  },
  amazon: {
    id: "amazon",
    name: "Amazon River",
    tagline: "Tea-brown water, flooded forest",
    playable: true,
    // √(Coral Reef × Open Ocean): halfway on a log scale.
    unlockCost: 300_000,
    palette: {
      water: "#8a6a3c",
      deep: "#4a3820",
      floor: "#6b5434",
      soil: "#4a3a26",
      plant: "#5f9e4a",
      accent: "#ff5a4f",
      glow: "#e8d27a",
      bgTop: "#ddd5ad",
      bgBottom: "#6e5c38",
      rock: "#5b4630",
    },
    dims: { w: 10, h: 5, d: 6.5, soil: 1.1 },
    camera: { distance: 15, min: 4.5, max: 22, fov: 42 },
    fog: { near: 9, far: 30 },
    caustics: true,
    expansion: {
      space: [25, 40, 60, 85, 115],
      // Base-to-unlock ratio halfway (log) between the Reef's and the Open Ocean's.
      baseCost: 2_000_000,
      costGrowth: 5.4,
      growth: 1,
      features: ["root-curtain", "sandy-bank", "flooded-grove", "lily-lagoon"],
    },
    decoSlots: { cols: 4, rows: 2, surface: 3 },
    codexRewards: [100_000, 300_000, 900_000, 2_500_000],
    emptyPrompt: "The river flows quietly. Who'll swim in first?",
    sunlit: true,
    nightLine: "Frogs and insects sing over the dark river.",
    group: "Freshwater",
    lightShafts: 6,
    lighting: { sun: "#ffe7b0", sunI: 1.6, hemiI: 1.0, ambient: 0.24 },
    signature: "rain",
  },
  kelp: {
    id: "kelp",
    name: "Kelp Forest",
    tagline: "Tall, swaying, full of sunbeams",
    playable: true,
    // Halfway (log) between the Open Ocean and the Deep Sea.
    unlockCost: 350_000_000,
    palette: {
      water: "#2f8a8a",
      deep: "#164e57",
      floor: "#c8b88a",
      soil: "#7a6c52",
      plant: "#8a7a2f",
      accent: "#ff7a29",
      glow: "#e8f4d0",
      bgTop: "#d2ece8",
      bgBottom: "#2c7479",
      rock: "#5a6470",
    },
    dims: { w: 11, h: 8, d: 7.5, soil: 1 },
    camera: { distance: 20, min: 6, max: 30, fov: 42 },
    fog: { near: 13, far: 42 },
    caustics: true,
    expansion: {
      space: [30, 48, 70, 100, 135],
      // Base-to-unlock ratio halfway (log) between the Open Ocean's and the Deep Sea's.
      baseCost: 520_000_000,
      costGrowth: 2.8,
      growth: 0.85,
      features: ["kelp-thicket", "boulder-field", "sand-channel", "more-light"],
    },
    decoSlots: { cols: 4, rows: 2, surface: 0 },
    codexRewards: [20_000_000, 50_000_000, 150_000_000, 400_000_000],
    emptyPrompt: "Sunbeams fall through empty kelp. Who'll live here?",
    sunlit: true,
    nightLine: "The kelp sways in the dark. Otters are asleep at the top.",
    group: "Coast",
    lightShafts: 8,
    signature: "kelp",
    // A few giant kelp columns are always there, rooted along the back.
    scenery: [
      { decoId: "giant-kelp", x: -0.78, z: -0.7, scale: 1.1 },
      { decoId: "giant-kelp", x: -0.25, z: -0.86, scale: 0.95, rotY: 1.2 },
      { decoId: "giant-kelp", x: 0.38, z: -0.78, scale: 1.05, rotY: 2.4 },
      { decoId: "giant-kelp", x: 0.86, z: -0.5, scale: 0.9, rotY: 0.6 },
    ],
  },
  polar: {
    id: "polar",
    name: "Polar Waters",
    tagline: "Pale, quiet and huge",
    playable: true,
    // Lowered from ~100B in the balance pass: about a week after the Deep Sea.
    unlockCost: 30_000_000_000,
    palette: {
      water: "#9cc9e0",
      deep: "#2e5a7a",
      floor: "#e4eef5",
      soil: "#6f8fa8",
      plant: "#7fa8b8",
      accent: "#ffd36b",
      glow: "#eef7ff",
      bgTop: "#eef6fb",
      bgBottom: "#7fa4bf",
      rock: "#8fa9bd",
    },
    dims: { w: 14, h: 8, d: 10, soil: 1 },
    camera: { distance: 24, min: 7, max: 34, fov: 42 },
    fog: { near: 16, far: 50 },
    caustics: false,
    expansion: {
      space: [60, 90, 130, 180, 240],
      // Same base-to-unlock ratio as the Deep Sea (×1).
      baseCost: 30_000_000_000,
      // Steeper than the Deep Sea's so full size stays a long-term goal (~10 days after unlocking).
      costGrowth: 4.5,
      growth: 0.7,
      features: ["ice-floes", "ice-cave-edge", "iceberg-keel", "aurora-crystals"],
    },
    decoSlots: { cols: 3, rows: 2, surface: 2 },
    codexRewards: [3_000_000_000, 8_000_000_000, 20_000_000_000, 50_000_000_000],
    emptyPrompt: "The ice creaks softly. No one here yet.",
    sunlit: true,
    nightLine: "The aurora is out over the ice.",
    group: "Polar",
    lightShafts: 0,
    lighting: { sun: "#f4fbff", sunI: 1.9, hemiI: 1.15, ambient: 0.3 },
    terrainMax: 0.38,
    signature: "aurora",
  },
};

/** Unlock order, also the order shown in the habitat switcher and codex. */
export const BIOME_ORDER: BiomeId[] = ["swamp", "tidepool", "reef", "amazon", "ocean", "kelp", "deep", "polar"];
