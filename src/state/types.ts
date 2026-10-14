import type { BiomeId } from "../data/biomes";

export interface OwnedCreature {
  uid: string;
  speciesId: string;
  variantId?: string;
}

export interface PlacedDecoration {
  /** Stable slot key (see data/habitatGeometry.ts), e.g. "f3" or "L4f1". */
  slot: string;
  decoId: string;
  /** Quarter turns, 0–3. */
  rotation: number;
}

export interface Egg {
  speciesId: string;
  laidAt: number;
}

/** Cosmetic tank style (ids in data/equipment.ts). */
export interface TankStyle {
  lampId: string;
  lampOn: boolean;
  /** Lamp follows the real clock: on by day, off at night. */
  lampAuto: boolean;
  backgroundId: string;
  frameId: string;
}

/** Functional equipment, bought once per habitat. */
export interface TankEquipment {
  filter: boolean;
  airPump: boolean;
  autoFeeder: boolean;
  cleaner: boolean;
}

export interface HabitatSave {
  /** Physical size level, 1–5. */
  sizeLevel: number;
  /** Only for saves migrated with more space than Lv5 gives: keeps that space. */
  legacySpace?: number;
  lastFed: number;
  creatures: OwnedCreature[];
  decorations: PlacedDecoration[];
  eggs: Egg[];
  style: TankStyle;
  equipment: TankEquipment;
  /** Algae is computed from this (and the filter/cleaner), never ticked. */
  algae: { lastCleanedAt: number };
  /** +15% income in this habitat until then (from wiping cloudy glass). */
  sparklingUntil?: number;
  /** Bought style items, as "lamp:sunset", "background:coral", "frame:gold". Free items are always owned. */
  ownedStyle: string[];
}

/** A rare or legendary creature that was released. It may come back as a visitor. */
export interface SanctuaryEntry {
  speciesId: string;
  variantId?: string;
  biome: BiomeId;
  releasedAt: number;
}

/** Codex keys are species ids and variant ids. */
export type CodexState = "spotted" | "owned";

export interface DailyGoal {
  id: string;
  progress: number;
  target: number;
  done: boolean;
  claimed: boolean;
  reward: number;
  /** For "do X in N different places" goals: which keys already counted. */
  keys?: string[];
}

export interface SaveData {
  version: number;
  pearls: number;
  lastSeen: number;
  biomesUnlocked: BiomeId[];
  activeBiome: BiomeId;
  habitats: Partial<Record<BiomeId, HabitatSave>>;
  codex: Record<string, CodexState>;
  /** Codex reward tiers already claimed per biome (indices 0–3 for 25/50/75/100 %). */
  codexRewardsClaimed: Partial<Record<BiomeId, number[]>>;
  dailyGoals: { date: string; goals: DailyGoal[] };
  settings: { sound: boolean; music: boolean; quality: "low" | "high" };
  stats: { totalEarned: number; visitorsBefriended: number; eggsHatched: number };
  /** First-time tips: index of the next step, or -1 when finished or skipped. */
  tutorial: number;
  milestones: { firstFullExpansion: boolean; /** The "wipe the glass" tip was shown. */ algaeTip: boolean };
  /** Released rares and legendaries, oldest first (capped; the oldest drop off). */
  sanctuary: SanctuaryEntry[];
  /** When the next visitor shows up (real clock, keeps running while you're away). 0 = a visitor is here now. */
  visitorDueAt: number;
}
