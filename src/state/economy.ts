// Pure economy functions + tuning constants. No React, no store access.
// Tweak the ECONOMY block to rebalance pacing.

import { BIOMES, type BiomeId } from "../data/biomes";
import {
  canBreed,
  COST_GROWTH,
  eggOnlySpecies,
  SIZE_SPACE,
  SPECIES_BY_ID,
  VISITOR_RARITY_WEIGHT,
  speciesForBiome,
  type Rarity,
  type Species,
} from "../data/creatures";
import { GOAL_REWARD_FLOOR, GOALS, GOALS_PER_DAY, type GoalContext } from "../data/goals";
import { SIZE_LEVELS, TERRAIN_FEATURES } from "../data/expansion";
import { clampLevel, newSlotsAt } from "../data/habitatGeometry";
import { DECORATION_BY_ID } from "../data/decorations";
import { DEFAULT_STYLE, TANK } from "../data/equipment";
import { isHighTide, TIDES } from "../data/signatures";
import type { DailyGoal, Egg, HabitatSave, SaveData } from "./types";

export const ECONOMY = {
  startingPearls: 25,
  /** Offline income runs at this fraction of live income. */
  offlineRate: 0.5,
  offlineCapHours: 8,
  /** Being hidden/away longer than this triggers the "While you were away" logic. */
  awayThresholdSec: 60,
  happiness: {
    min: 0.5,
    max: 1.5,
    base: 1.0,
    /** Max total bonus from decorations. */
    decoMax: 0.4,
    /** Small bonus right after feeding. */
    fedBonus: 0.1,
    fedBonusHours: 2,
    /** Happiness only starts drifting down after this many hours without feeding… */
    neglectAfterHours: 12,
    /** …and then drops by this much per hour (never below min). */
    neglectPerHour: 0.03,
  },
  visitor: {
    minIntervalSec: 180,
    maxIntervalSec: 480,
    tapWindowSec: 25,
    /** Weight multiplier for species you already own (favors discovery). */
    ownedWeight: 0.6,
    /** Away for at least this long → small chance a visitor "passed by". */
    awayPassByMinMinutes: 30,
    awayPassByChance: 0.6,
  },
  eggs: {
    /** Chance per real hour that a species with 2+ members in a habitat lays an egg. */
    chancePerHour: { common: 0.25, uncommon: 0.15, rare: 0.1, legendary: 0.05 } as Record<Rarity, number>,
    /** Eggs waiting to hatch, per habitat. */
    maxWaiting: 3,
    /** Chance a hatchling is a color variant (if the species has any). */
    variantChance: 0.1,
    /** Chance an egg laid in a habitat with egg-only species is one of those instead. */
    surpriseChance: 0.2,
  },
  expansion: {
    /** One-time reward the first time any habitat reaches max size: minutes of income, with a floor. */
    firstFullRewardMinutes: 15,
    firstFullRewardFloor: 25_000,
  },
  release: {
    /** Species with a shop price refund this share of their unscaled baseCost (always less than you paid). */
    shopRefundRate: 0.25,
    /** Species without a price, by rarity. Common: this share of the biome's cheapest shop creature. */
    commonRefundRate: 0.25,
    /** Uncommon / rare / legendary: minutes of the income of the habitat it lived in. */
    incomeMinutes: { common: 0, uncommon: 2, rare: 5, legendary: 10 } as Record<Rarity, number>,
    /** One-tap releases can be undone for this long. */
    undoSeconds: 5,
    /** Releasing this many or more at once always asks first. */
    confirmBulkAt: 5,
    /** Rarities that always ask first (and go to the Sanctuary). */
    confirmRarities: ["rare", "legendary"] as Rarity[],
    /** Release animation length. */
    animMs: 1500,
    /** Bulk releases animate this many creatures; the rest just fade. */
    animateMax: 4,
  },
  sanctuary: {
    maxEntries: 30,
    /** When a visitor arrives in a habitat with old friends in the Sanctuary, chance it's one of them. */
    returnChance: 0.12,
  },
};

const HOUR = 3600_000;

export function newHabitat(now: number): HabitatSave {
  return {
    sizeLevel: 1,
    lastFed: now,
    creatures: [],
    decorations: [],
    eggs: [],
    style: { ...DEFAULT_STYLE, lampOn: true, lampAuto: false },
    equipment: { filter: false, airPump: false, autoFeeder: false, cleaner: false },
    algae: { lastCleanedAt: now },
    ownedStyle: [],
  };
}

// ───────────── Tank: algae, equipment, Sparkling ─────────────

/**
 * Algae on the glass, 0–1, from the time since the last clean. A filter slows it,
 * a scraper/snail slows it more and caps it. Purely visual: it never lowers income.
 */
export function algaeLevel(h: Pick<HabitatSave, "algae" | "equipment">, now: number) {
  const e = h.equipment;
  const hours = e.filter ? TANK.algaeHoursWithFilter : TANK.algaeHours;
  const level = (Math.max(0, now - h.algae.lastCleanedAt) / (hours * HOUR)) * (e.cleaner ? TANK.cleanerRate : 1);
  return Math.min(e.cleaner ? TANK.cleanerCap : 1, level);
}

export function isSparkling(h: Pick<HabitatSave, "sparklingUntil">, now: number) {
  return (h.sparklingUntil ?? 0) > now;
}

/** Income bonus from the tank (cleaner +5%, Sparkling +15%), added together. Never below 1. */
export function tankIncomeMultiplier(h: HabitatSave, now: number, sparkle = true) {
  return 1 + (h.equipment.cleaner ? TANK.cleanerIncome : 0) + (sparkle && isSparkling(h, now) ? TANK.sparkleIncome : 0);
}

export function ownedCount(h: HabitatSave | undefined, speciesId: string) {
  return h ? h.creatures.filter((c) => c.speciesId === speciesId).length : 0;
}

export function creatureCost(species: Species, owned: number) {
  return Math.ceil((species.baseCost ?? 0) * Math.pow(COST_GROWTH, owned));
}

/** Space a habitat has at a size level (1–5). */
export function spaceAt(biome: BiomeId, level: number) {
  return BIOMES[biome].expansion.space[clampLevel(level) - 1];
}

/** A habitat's space: its size level, or more if an old save had more. */
export function capacityOf(biome: BiomeId, h: Pick<HabitatSave, "sizeLevel" | "legacySpace">) {
  return Math.max(spaceAt(biome, h.sizeLevel), h.legacySpace ?? 0);
}

/** Cost to expand to `toLevel` (2–5): baseCost × growth^(toLevel − 2). */
export function expansionCost(biome: BiomeId, toLevel: number) {
  const e = BIOMES[biome].expansion;
  return Math.round(e.baseCost * Math.pow(e.costGrowth, toLevel - 2));
}

export interface ExpansionOffer {
  from: number;
  to: number;
  cost: number;
  spaceBefore: number;
  spaceAfter: number;
  newSlots: number;
  feature: string;
}

/** What the next expansion would give, or null at max size. */
export function nextExpansion(biome: BiomeId, h: HabitatSave | undefined): ExpansionOffer | null {
  if (!h || h.sizeLevel >= SIZE_LEVELS) return null;
  const to = h.sizeLevel + 1;
  const featureId = BIOMES[biome].expansion.features[to - 2];
  return {
    from: h.sizeLevel,
    to,
    cost: expansionCost(biome, to),
    spaceBefore: capacityOf(biome, h),
    spaceAfter: Math.max(spaceAt(biome, to), h.legacySpace ?? 0),
    newSlots: newSlotsAt(biome, to),
    feature: TERRAIN_FEATURES[featureId]?.name ?? "",
  };
}

export function spaceUsed(h: HabitatSave | undefined) {
  if (!h) return 0;
  let s = 0;
  for (const c of h.creatures) {
    const sp = SPECIES_BY_ID[c.speciesId];
    if (sp) s += SIZE_SPACE[sp.size];
  }
  return s;
}

export function decoHappiness(h: HabitatSave) {
  const seen = new Set<string>();
  let bonus = 0;
  for (const d of h.decorations) {
    if (seen.has(d.decoId)) continue;
    seen.add(d.decoId);
    bonus += DECORATION_BY_ID[d.decoId]?.happiness ?? 0;
  }
  return Math.min(bonus, ECONOMY.happiness.decoMax);
}

export interface HappinessBreakdown {
  value: number;
  deco: number;
  fed: number;
  neglect: number;
  /** From the air pump. */
  gear: number;
  /** An auto feeder means it never gets hungry. */
  autoFed: boolean;
}

export function happiness(h: HabitatSave, now: number): HappinessBreakdown {
  const cfg = ECONOMY.happiness;
  const hoursSinceFed = Math.max(0, (now - h.lastFed) / HOUR);
  const deco = decoHappiness(h);
  const fed = hoursSinceFed < cfg.fedBonusHours ? cfg.fedBonus : 0;
  const autoFed = h.equipment.autoFeeder;
  // The auto feeder feeds whenever it's needed (offline too), so hunger never sets in.
  const neglect = autoFed ? 0 : Math.max(0, hoursSinceFed - cfg.neglectAfterHours) * cfg.neglectPerHour;
  const gear = h.equipment.airPump ? TANK.airPumpHappiness : 0;
  const value = Math.min(cfg.max, Math.max(cfg.min, cfg.base + deco + fed + gear - neglect));
  return { value, deco, fed, neglect, gear, autoFed };
}

export function habitatBaseIncome(h: HabitatSave | undefined) {
  if (!h) return 0;
  let sum = 0;
  for (const c of h.creatures) sum += SPECIES_BY_ID[c.speciesId]?.pearlsPerSec ?? 0;
  return sum;
}

export function habitatIncome(h: HabitatSave | undefined, now: number, sparkle = true) {
  if (!h) return 0;
  return habitatBaseIncome(h) * happiness(h, now).value * tankIncomeMultiplier(h, now, sparkle);
}

export function totalIncome(save: Pick<SaveData, "habitats">, now: number) {
  let sum = 0;
  for (const h of Object.values(save.habitats)) sum += habitatIncome(h, now);
  return sum;
}

/** Clamp an away duration to [0, cap] so clock changes can't break anything. */
export function clampAwaySeconds(from: number, to: number) {
  const raw = (to - from) / 1000;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, ECONOMY.offlineCapHours * 3600);
}

export interface OfflineResult {
  seconds: number;
  total: number;
  perBiome: Partial<Record<BiomeId, number>>;
}

/**
 * Offline earnings: income/sec × secondsAway × offlineRate, capped.
 * Happiness can drift while away, so each habitat is sampled at the midpoint.
 */
export function offlineEarnings(save: Pick<SaveData, "habitats">, from: number, to: number): OfflineResult {
  const seconds = clampAwaySeconds(from, to);
  const mid = from + (seconds * 1000) / 2;
  const perBiome: Partial<Record<BiomeId, number>> = {};
  let total = 0;
  const end = from + seconds * 1000;
  for (const [id, h] of Object.entries(save.habitats) as [BiomeId, HabitatSave][]) {
    // Sparkling only counts for the part of the time away it actually lasted.
    const sparkleSeconds = Math.max(0, Math.min(end, h.sparklingUntil ?? 0) - from) / 1000;
    const base = habitatIncome(h, mid, false);
    const sparkle = habitatBaseIncome(h) * happiness(h, mid).value * TANK.sparkleIncome * sparkleSeconds;
    const earned = (base * seconds + sparkle) * ECONOMY.offlineRate;
    if (earned > 0) {
      perBiome[id] = earned;
      total += earned;
    }
  }
  return { seconds, total, perBiome };
}

/** Codex entries for a biome: every species plus every color variant. */
export function codexEntries(biome: BiomeId) {
  return speciesForBiome(biome).flatMap((s) => [s.id, ...(s.variants ?? []).map((v) => v.id)]);
}

export function codexProgress(biome: BiomeId, codex: SaveData["codex"]) {
  const ids = codexEntries(biome);
  const owned = ids.filter((id) => codex[id] === "owned").length;
  const spotted = ids.filter((id) => codex[id] === "spotted").length;
  return { owned, spotted, total: ids.length, pct: ids.length ? owned / ids.length : 0 };
}

export const CODEX_TIERS = [0.25, 0.5, 0.75, 1];

/** Visitor pool for a biome with decoration-boosted weights. */
export function visitorWeights(biome: BiomeId, h: HabitatSave | undefined, codex: SaveData["codex"]) {
  const boosts: Record<string, number> = {};
  const seen = new Set<string>();
  for (const d of h?.decorations ?? []) {
    if (seen.has(d.decoId)) continue;
    seen.add(d.decoId);
    for (const [sid, mult] of Object.entries(DECORATION_BY_ID[d.decoId]?.visitorBoost ?? {})) {
      boosts[sid] = (boosts[sid] ?? 1) * mult;
    }
  }
  return speciesForBiome(biome)
    .filter((s) => s.obtain === "visitor" || s.visitorWeight !== undefined)
    .map((s) => {
      let w = (s.visitorWeight ?? VISITOR_RARITY_WEIGHT[s.rarity]) * (boosts[s.id] ?? 1);
      if (codex[s.id] === "owned") w *= ECONOMY.visitor.ownedWeight;
      // Tidepool: some visitors mostly wander in at high tide.
      if (s.highTide && BIOMES[biome].signature === "tides") w *= isHighTide() ? TIDES.highTideVisitorBoost : 1 / TIDES.highTideVisitorBoost;
      return { species: s, weight: w };
    })
    .filter((x) => x.weight > 0);
}

export function pickWeighted<T extends { weight: number }>(items: T[], rand = Math.random): T | undefined {
  const total = items.reduce((a, b) => a + b.weight, 0);
  if (total <= 0) return undefined;
  let r = rand() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

/** Is this species currently purchasable in the shop? */
export function inShop(s: Species, codex: SaveData["codex"]) {
  if (s.baseCost === undefined) return false;
  if (s.obtain === "shop") return true;
  return s.obtain === "visitor" && codex[s.id] === "owned";
}

// ───────────── Release ─────────────

const RARITY_RANK: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

/** The cheapest creature in a biome's shop (unscaled). */
export function cheapestShopCost(biome: BiomeId) {
  const costs = speciesForBiome(biome)
    .filter((s) => s.obtain === "shop" && s.baseCost !== undefined)
    .map((s) => s.baseCost!);
  return costs.length ? Math.min(...costs) : 0;
}

/**
 * Pearls back for releasing one creature. Priced species refund a share of their
 * unscaled baseCost, so buying then releasing always loses pearls. Unpriced ones
 * (visitor-only) refund by rarity. `homeIncome` is its habitat's income per second.
 */
export function releaseRefund(sp: Species, homeIncome: number) {
  const r = ECONOMY.release;
  if (sp.baseCost !== undefined) return Math.floor(sp.baseCost * r.shopRefundRate);
  const floor = Math.floor(cheapestShopCost(sp.biome) * r.commonRefundRate);
  if (sp.rarity === "common") return floor;
  return Math.max(floor, Math.round(homeIncome * r.incomeMinutes[sp.rarity] * 60));
}

/** Rare and legendary releases always ask first; so do big batches. */
export function releaseNeedsConfirm(sp: Species, count: number) {
  return ECONOMY.release.confirmRarities.includes(sp.rarity) || count >= ECONOMY.release.confirmBulkAt;
}

/** Make Room order: lowest rarity first, then lowest income. */
export function releaseOrder(a: Species, b: Species) {
  return RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] || a.pearlsPerSec - b.pearlsPerSec;
}

export function freeSpace(biome: BiomeId, h: HabitatSave | undefined) {
  return h ? capacityOf(biome, h) - spaceUsed(h) : 0;
}

/** Space still missing before this species fits (0 = it fits). */
export function spaceShort(biome: BiomeId, h: HabitatSave | undefined, speciesId: string) {
  const sp = SPECIES_BY_ID[speciesId];
  if (!sp) return 0;
  return Math.max(0, SIZE_SPACE[sp.size] - freeSpace(biome, h));
}

// ───────────── Eggs ─────────────

/** Species in a habitat that can lay eggs (2+ of them, not giants). */
export function breedingSpecies(h: HabitatSave | undefined) {
  if (!h) return [];
  const counts = new Map<string, number>();
  for (const c of h.creatures) counts.set(c.speciesId, (counts.get(c.speciesId) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([id, n]) => n >= 2 && SPECIES_BY_ID[id] && canBreed(SPECIES_BY_ID[id]))
    .map(([id]) => SPECIES_BY_ID[id]);
}

/**
 * Roll for new eggs over `hours` of real time. Works for a 0.25 s live tick and
 * for an 8 h offline gap alike. Never exceeds the waiting cap. `boost` multiplies
 * the chance (Amazon rain). Some eggs turn out to be the habitat's egg-only species.
 */
export function rollEggs(h: HabitatSave, hours: number, now: number, rand = Math.random, boost = 1): Egg[] {
  const room = ECONOMY.eggs.maxWaiting - h.eggs.length;
  if (room <= 0 || hours <= 0) return [];
  const laid: Egg[] = [];
  for (const sp of breedingSpecies(h)) {
    const rate = ECONOMY.eggs.chancePerHour[sp.rarity] * boost;
    // Expected eggs = rate × hours; whole part guaranteed, fraction by chance.
    const expected = rate * hours;
    let n = Math.floor(expected) + (rand() < expected % 1 ? 1 : 0);
    const surprises = eggOnlySpecies(sp.biome).filter((s) => s.id !== sp.id);
    while (n-- > 0 && laid.length < room) {
      const surprise = surprises.length && rand() < ECONOMY.eggs.surpriseChance ? surprises[Math.floor(rand() * surprises.length)] : null;
      laid.push({ speciesId: (surprise ?? sp).id, laidAt: now });
    }
  }
  return laid;
}

/** Variant a hatchling turns out to be, if any. */
export function rollVariant(speciesId: string, rand = Math.random): string | undefined {
  const vs = SPECIES_BY_ID[speciesId]?.variants;
  if (!vs?.length || rand() >= ECONOMY.eggs.variantChance) return undefined;
  return vs[Math.floor(rand() * vs.length)].id;
}

// ───────────── Daily goals ─────────────

export function goalContext(save: Pick<SaveData, "habitats" | "biomesUnlocked"> & { pearls?: number }): GoalContext {
  return {
    habitats: save.biomesUnlocked.length,
    canBreed: Object.values(save.habitats).some((h) => breedingSpecies(h).length > 0),
    // Only offer "Expand a habitat" when one is affordable right now.
    canExpand: save.biomesUnlocked.some((b) => {
      const next = nextExpansion(b, save.habitats[b]);
      return !!next && (save.pearls ?? 0) >= next.cost;
    }),
  };
}

/** Pick today's goals. Rewards are a few minutes of current income (with a floor). */
export function makeDailyGoals(save: Pick<SaveData, "habitats" | "biomesUnlocked"> & { pearls?: number }, income: number, rand = Math.random): DailyGoal[] {
  const ctx = goalContext(save);
  const pool = GOALS.filter((g) => !g.requires || g.requires(ctx));
  const picked: DailyGoal[] = [];
  while (picked.length < GOALS_PER_DAY && pool.length) {
    const g = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const reward = Math.max(GOAL_REWARD_FLOOR, Math.round((income * g.rewardMinutes * 60) / 10) * 10);
    picked.push({ id: g.id, progress: 0, target: g.target, done: false, claimed: false, reward, ...(g.distinct ? { keys: [] } : {}) });
  }
  return picked;
}
