import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BIOMES, type BiomeId } from "../data/biomes";
import { SPECIES_BY_ID, SIZE_SPACE, VARIANT_BY_ID } from "../data/creatures";
import { DECORATION_BY_ID } from "../data/decorations";
import { GOAL_BY_ID, type GoalEvent } from "../data/goals";
import { SIZE_LEVELS } from "../data/expansion";
import { RAIN } from "../data/signatures";
import { DEFAULT_STYLE, equipmentPrice, styleItem, stylePrice, TANK, type EquipmentSlot, type StyleKind } from "../data/equipment";
import { clampLevel, slotLayout } from "../data/habitatGeometry";
import { localDateKey } from "../utils/time";
import { uid } from "../utils/id";
import {
  CODEX_TIERS,
  ECONOMY,
  capacityOf,
  clampAwaySeconds,
  nextExpansion,
  spaceAt,
  codexProgress,
  algaeLevel,
  creatureCost,
  habitatIncome,
  inShop,
  releaseRefund,
  makeDailyGoals,
  newHabitat,
  offlineEarnings,
  ownedCount,
  pickWeighted,
  rollEggs,
  rollVariant,
  spaceUsed,
  totalIncome,
  visitorWeights,
} from "./economy";
import { flushSave, throttledStorage } from "./saveStorage";
import { isRaining } from "./weather";
import type { DailyGoal, HabitatSave, OwnedCreature, SanctuaryEntry, SaveData } from "./types";

export const SAVE_KEY = "idlarium-save";
export const SAVE_VERSION = 6;

export type ActionResult =
  | { ok: true; uid?: string; variantId?: string; from?: number; to?: number; milestoneReward?: number }
  | { ok: false; reason: string };

export interface ReleaseResult {
  ok: boolean;
  refund: number;
  released: OwnedCreature[];
  /** How many went to the Sanctuary. */
  toSanctuary: number;
}

export interface AwaySummary {
  seconds: number;
  total: number;
  perBiome: Partial<Record<BiomeId, number>>;
  /** speciesId of a visitor that swam past while you were gone. */
  passedBy?: string;
  eggsLaid: number;
}

/** Listeners for "a daily goal was just completed" (the UI shows a toast). */
const goalListeners = new Set<(goalId: string) => void>();
export function onGoalDone(fn: (goalId: string) => void) {
  goalListeners.add(fn);
  return () => {
    goalListeners.delete(fn);
  };
}

export function defaultSave(now = Date.now()): SaveData {
  return {
    version: SAVE_VERSION,
    pearls: ECONOMY.startingPearls,
    lastSeen: now,
    biomesUnlocked: ["swamp"],
    activeBiome: "swamp",
    habitats: { swamp: newHabitat(now) },
    codex: {},
    codexRewardsClaimed: {},
    dailyGoals: { date: "", goals: [] },
    settings: { sound: false, music: false, quality: "high" },
    stats: { totalEarned: 0, visitorsBefriended: 0, eggsHatched: 0 },
    tutorial: 0,
    milestones: { firstFullExpansion: false, algaeTip: false },
    sanctuary: [],
    visitorDueAt: 0,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/**
 * Turns anything (current saves, migrated saves, imported JSON) into a valid SaveData.
 * Unknown species, variants and decorations are dropped instead of crashing.
 */
export function normalizeSave(raw: unknown, now = Date.now()): SaveData {
  const d = defaultSave(now);
  if (!isObj(raw)) return d;
  const biomeIds = Object.keys(BIOMES) as BiomeId[];

  const unlocked = Array.isArray(raw.biomesUnlocked)
    ? (raw.biomesUnlocked.filter((b) => biomeIds.includes(b as BiomeId) && BIOMES[b as BiomeId].playable) as BiomeId[])
    : d.biomesUnlocked;
  if (!unlocked.includes("swamp")) unlocked.unshift("swamp");

  const habitats: SaveData["habitats"] = {};
  const rawHabitats = isObj(raw.habitats) ? raw.habitats : {};
  for (const b of unlocked) {
    const h = rawHabitats[b];
    const base = newHabitat(now);
    if (isObj(h)) {
      base.sizeLevel = clampLevel(num(h.sizeLevel, 1));
      if (typeof h.legacySpace === "number" && h.legacySpace > spaceAt(b, SIZE_LEVELS)) base.legacySpace = h.legacySpace;
      base.lastFed = Math.min(now, num(h.lastFed, now));
      if (Array.isArray(h.creatures))
        base.creatures = h.creatures
          .filter((c): c is Record<string, unknown> => isObj(c) && typeof c.speciesId === "string" && !!SPECIES_BY_ID[c.speciesId])
          .map((c) => {
            const variant = typeof c.variantId === "string" && VARIANT_BY_ID[c.variantId]?.speciesId === c.speciesId ? c.variantId : undefined;
            return {
              uid: typeof c.uid === "string" ? c.uid : uid(),
              speciesId: c.speciesId as string,
              ...(variant ? { variantId: variant } : {}),
            };
          });
      if (Array.isArray(h.decorations)) {
        // Keep decorations on known slots (any level, so nothing is ever dropped), one per slot.
        const keys = new Set(slotLayout(b, SIZE_LEVELS).map((sl) => sl.key));
        const used = new Set<string>();
        base.decorations = h.decorations
          .filter((x): x is Record<string, unknown> => isObj(x) && typeof x.decoId === "string" && !!DECORATION_BY_ID[x.decoId] && typeof x.slot === "string" && keys.has(x.slot))
          .filter((x) => !used.has(x.slot as string) && !!used.add(x.slot as string))
          .map((x) => ({ slot: x.slot as string, decoId: x.decoId as string, rotation: Math.floor(num(x.rotation, 0)) % 4 }));
      }
      // Tank: style, equipment, algae. Unknown ids fall back to the defaults.
      const st = isObj(h.style) ? h.style : {};
      const owned = Array.isArray(h.ownedStyle)
        ? [
            ...new Set(
              h.ownedStyle.filter((x): x is string => typeof x === "string" && /^(lamp|background|frame):/.test(x) && !!styleItem(x.split(":")[0] as StyleKind, x.split(":")[1])),
            ),
          ]
        : [];
      const pick = (kind: StyleKind, v: unknown, def: string) => {
        const id = typeof v === "string" && styleItem(kind, v) ? v : def;
        return styleItem(kind, id)!.tier === "free" || owned.includes(kind + ":" + id) ? id : def;
      };
      base.ownedStyle = owned;
      base.style = {
        lampId: pick("lamp", st.lampId, DEFAULT_STYLE.lampId),
        lampOn: st.lampOn !== false,
        lampAuto: st.lampAuto === true,
        backgroundId: pick("background", st.backgroundId, DEFAULT_STYLE.backgroundId),
        frameId: pick("frame", st.frameId, DEFAULT_STYLE.frameId),
      };
      const eq = isObj(h.equipment) ? h.equipment : {};
      base.equipment = { filter: eq.filter === true, airPump: eq.airPump === true, autoFeeder: eq.autoFeeder === true, cleaner: eq.cleaner === true };
      base.algae = { lastCleanedAt: Math.min(now, num(isObj(h.algae) ? h.algae.lastCleanedAt : undefined, now)) };
      if (typeof h.sparklingUntil === "number" && h.sparklingUntil > now) base.sparklingUntil = Math.min(h.sparklingUntil, now + TANK.sparkleMinutes * 60_000);
      if (Array.isArray(h.eggs))
        base.eggs = h.eggs
          .filter((e): e is Record<string, unknown> => isObj(e) && typeof e.speciesId === "string" && !!SPECIES_BY_ID[e.speciesId])
          .slice(0, ECONOMY.eggs.maxWaiting)
          .map((e) => ({ speciesId: e.speciesId as string, laidAt: num(e.laidAt, now) }));
    }
    habitats[b] = base;
  }

  const codex: SaveData["codex"] = {};
  if (isObj(raw.codex))
    for (const [k, v] of Object.entries(raw.codex)) if (v === "spotted" || v === "owned") codex[k] = v;
  // Anything you own is "owned" in the codex, whatever the save says.
  for (const h of Object.values(habitats))
    for (const c of h!.creatures) {
      codex[c.speciesId] = "owned";
      if (c.variantId) codex[c.variantId] = "owned";
    }

  const claimed: SaveData["codexRewardsClaimed"] = {};
  if (isObj(raw.codexRewardsClaimed))
    for (const [k, v] of Object.entries(raw.codexRewardsClaimed))
      if (biomeIds.includes(k as BiomeId) && Array.isArray(v)) claimed[k as BiomeId] = v.filter((x) => typeof x === "number");

  const s = isObj(raw.settings) ? raw.settings : {};
  const stats = isObj(raw.stats) ? raw.stats : {};
  const goals = isObj(raw.dailyGoals) ? raw.dailyGoals : {};
  const active = unlocked.includes(raw.activeBiome as BiomeId) ? (raw.activeBiome as BiomeId) : "swamp";

  const parsedGoals: DailyGoal[] = Array.isArray(goals.goals)
    ? goals.goals
        .filter((g): g is Record<string, unknown> => isObj(g) && typeof g.id === "string" && !!GOAL_BY_ID[g.id])
        .map((g) => ({
          id: g.id as string,
          progress: Math.max(0, num(g.progress, 0)),
          target: Math.max(1, num(g.target, GOAL_BY_ID[g.id as string].target)),
          done: g.done === true,
          claimed: g.claimed === true,
          reward: Math.max(0, num(g.reward, 0)),
          ...(Array.isArray(g.keys) ? { keys: g.keys.filter((k): k is string => typeof k === "string") } : {}),
        }))
    : [];

  return {
    version: SAVE_VERSION,
    pearls: Math.max(0, num(raw.pearls, d.pearls)),
    lastSeen: Math.min(now, num(raw.lastSeen, now)),
    biomesUnlocked: unlocked,
    activeBiome: active,
    habitats,
    codex,
    codexRewardsClaimed: claimed,
    dailyGoals: { date: typeof goals.date === "string" ? goals.date : "", goals: parsedGoals },
    settings: {
      sound: s.sound === true,
      music: s.music === true,
      quality: s.quality === "low" ? "low" : "high",
    },
    stats: {
      totalEarned: num(stats.totalEarned, 0),
      visitorsBefriended: num(stats.visitorsBefriended, 0),
      eggsHatched: num(stats.eggsHatched, 0),
    },
    tutorial: Math.floor(num(raw.tutorial, d.tutorial)),
    milestones: {
      firstFullExpansion: isObj(raw.milestones) && raw.milestones.firstFullExpansion === true,
      algaeTip: isObj(raw.milestones) && raw.milestones.algaeTip === true,
    },
    sanctuary: Array.isArray(raw.sanctuary)
      ? raw.sanctuary
          .filter((e): e is Record<string, unknown> => isObj(e) && typeof e.speciesId === "string" && !!SPECIES_BY_ID[e.speciesId])
          .map((e) => {
            const sp = SPECIES_BY_ID[e.speciesId as string];
            const variant = typeof e.variantId === "string" && VARIANT_BY_ID[e.variantId]?.speciesId === sp.id ? e.variantId : undefined;
            return { speciesId: sp.id, ...(variant ? { variantId: variant } : {}), biome: sp.biome, releasedAt: Math.min(now, num(e.releasedAt, now)) };
          })
          .slice(-ECONOMY.sanctuary.maxEntries)
      : [],
    // A due time far in the future (clock changes) is pulled back to a normal wait.
    visitorDueAt: Math.min(Math.max(0, num(raw.visitorDueAt, 0)), now + ECONOMY.visitor.maxIntervalSec * 1000),
  };
}

/**
 * Save migrations, one step per version. normalizeSave runs afterwards and
 * fills any remaining gaps, so steps only need to handle real shape changes.
 */
export function migrate(persisted: unknown, version: number): unknown {
  let data = isObj(persisted) ? { ...persisted } : persisted;
  if (!isObj(data)) return data;
  if (version < 2) {
    // v1 → v2: daily goals gained progress/rewards (old ones are simply regenerated),
    // onboarding tips were added (skipped for players who already have creatures),
    // and stats count hatched eggs.
    data.dailyGoals = { date: "", goals: [] };
    const habitats = isObj(data.habitats) ? data.habitats : {};
    const hasCreatures = Object.values(habitats).some((h) => isObj(h) && Array.isArray(h.creatures) && h.creatures.length > 0);
    data.tutorial = hasCreatures ? -1 : 0;
    data.stats = { ...(isObj(data.stats) ? data.stats : {}), eggsHatched: 0 };
    data.version = 2;
  }
  if (version < 3) data = migrateToV3(data);
  // v3 → v4: releasing creatures. Only the Sanctuary list is new.
  if (version < 4) data = { ...(data as Record<string, unknown>), sanctuary: [], version: 4 };
  // v4 → v5: four new habitats (Tidepool, Amazon River, Kelp Forest, Polar Waters).
  // They start locked, which is simply "not in biomesUnlocked", so nothing else changes:
  // every unlocked habitat, creature, decoration and egg carries over as it was.
  if (version < 5) data = { ...(data as Record<string, unknown>), version: 5 };
  // v5 → v6: aquarium equipment, styles and glass algae. Every tank starts with the
  // default lamp, no background, a black frame, no equipment and clean glass.
  if (version < 6) data = migrateToV6(data as Record<string, unknown>);
  return data;
}

/** Old (v2) capacity rule per habitat: base + perLevel × capacityLevel. */
const V2_CAPACITY: Partial<Record<BiomeId, [number, number]>> = { swamp: [10, 5], reef: [14, 6], ocean: [30, 15], deep: [30, 15] };

/**
 * v2 → v3: physical expansion.
 *  - capacityLevel (0–8) becomes sizeLevel (1–5): the smallest level whose space is at
 *    least the old capacity. If the old capacity beats Lv5, keep it as legacySpace.
 *  - Decorations move from grid indices to stable slot keys. The Lv1 grid is the old
 *    grid, so every decoration keeps its exact position.
 */
function migrateToV3(data: Record<string, unknown>) {
  const habitats = isObj(data.habitats) ? { ...data.habitats } : {};
  for (const [b, raw] of Object.entries(habitats)) {
    if (!isObj(raw) || !(b in BIOMES) || !V2_CAPACITY[b as BiomeId]) continue;
    const biome = b as BiomeId;
    const [base, per] = V2_CAPACITY[biome]!;
    const oldCap = base + per * Math.max(0, Math.floor(num(raw.capacityLevel, 0)));
    const space = BIOMES[biome].expansion.space;
    let level = space.findIndex((sp) => sp >= oldCap) + 1;
    let legacySpace: number | undefined;
    if (level === 0) {
      level = SIZE_LEVELS;
      legacySpace = oldCap;
    }
    const { cols, rows } = BIOMES[biome].decoSlots;
    const decorations = Array.isArray(raw.decorations)
      ? raw.decorations.filter(isObj).map((x) => {
          const i = Math.floor(num(x.slot, -1));
          const slot = typeof x.slot === "string" ? x.slot : i < cols * rows ? `f${i}` : `s${i - cols * rows}`;
          return { ...x, slot };
        })
      : [];
    const next: Record<string, unknown> = { ...raw, sizeLevel: level, decorations };
    delete next.capacityLevel;
    if (legacySpace !== undefined) next.legacySpace = legacySpace;
    habitats[biome] = next;
  }
  return { ...data, habitats, milestones: { firstFullExpansion: false }, version: 3 };
}

function migrateToV6(data: Record<string, unknown>) {
  const now = Date.now();
  const habitats = isObj(data.habitats) ? { ...data.habitats } : {};
  for (const [b, raw] of Object.entries(habitats)) {
    if (!isObj(raw)) continue;
    habitats[b] = {
      ...raw,
      style: { ...DEFAULT_STYLE, lampOn: true, lampAuto: false },
      equipment: { filter: false, airPump: false, autoFeeder: false, cleaner: false },
      algae: { lastCleanedAt: now },
      ownedStyle: [],
    };
  }
  const milestones = isObj(data.milestones) ? data.milestones : {};
  return { ...data, habitats, milestones: { ...milestones, algaeTip: false }, version: 6 };
}

/** Pull just the SaveData fields out of the store state. */
function pickSave(s: SaveData): SaveData {
  return {
    version: s.version,
    pearls: s.pearls,
    lastSeen: s.lastSeen,
    biomesUnlocked: s.biomesUnlocked,
    activeBiome: s.activeBiome,
    habitats: s.habitats,
    codex: s.codex,
    codexRewardsClaimed: s.codexRewardsClaimed,
    dailyGoals: s.dailyGoals,
    settings: s.settings,
    stats: s.stats,
    tutorial: s.tutorial,
    milestones: s.milestones,
    sanctuary: s.sanctuary,
    visitorDueAt: s.visitorDueAt,
  };
}

interface Actions {
  /** Live tick. Returns "away" when the gap is long enough for the away summary. */
  liveTick(now: number): "ok" | "away";
  applyAway(now: number): AwaySummary;
  buyCreature(speciesId: string): ActionResult;
  /** Welcome a visitor. `returning` = an old friend from the Sanctuary (it leaves the list). */
  befriend(speciesId: string, biome: BiomeId, opts?: { variantId?: string; returning?: number }): ActionResult;
  /** Let creatures go. The codex keeps them as owned; rares and legendaries go to the Sanctuary. */
  releaseCreatures(biome: BiomeId, uids: string[]): ReleaseResult;
  /** Undo a release: the creatures come back and the refund is taken back. */
  restoreCreatures(biome: BiomeId, creatures: OwnedCreature[], refund: number): ActionResult;
  hatchEgg(biome: BiomeId, index: number): ActionResult;
  /** Grow a habitat one size level. */
  expandHabitat(biome: BiomeId): ActionResult;
  unlockBiome(biome: BiomeId): ActionResult;
  setActiveBiome(biome: BiomeId): void;
  feed(biome: BiomeId): void;
  placeDecoration(biome: BiomeId, slot: string, decoId: string): ActionResult;
  rotateDecoration(biome: BiomeId, slot: string): void;
  removeDecoration(biome: BiomeId, slot: string): void;
  markSpotted(speciesId: string): void;
  claimCodexReward(biome: BiomeId, tier: number): ActionResult;
  /** Make sure today's goals exist (they reset at local midnight). */
  ensureDailyGoals(now?: number): void;
  trackGoal(event: GoalEvent, key?: string): void;
  claimGoal(index: number): ActionResult;
  setTutorial(step: number): void;
  /** Buy a style item (lamp, background, frame) and put it on the tank. */
  buyStyle(biome: BiomeId, kind: StyleKind, id: string): ActionResult;
  /** Put an owned (or free) style item on the tank. */
  equipStyle(biome: BiomeId, kind: StyleKind, id: string): void;
  setLamp(biome: BiomeId, opts: { on?: boolean; auto?: boolean }): void;
  buyEquipment(biome: BiomeId, slot: EquipmentSlot): ActionResult;
  /** The glass is wiped clean. Cloudy enough (≥ 50%) makes the tank Sparkling. */
  cleanGlass(biome: BiomeId): { ok: boolean; sparkled: boolean; level: number };
  setMilestone(key: "algaeTip", on: boolean): void;
  debugSetAlgae(biome: BiomeId, level: number): void;
  setVisitorDue(at: number): void;
  setSetting<K extends keyof SaveData["settings"]>(key: K, value: SaveData["settings"][K]): void;
  exportSave(): string;
  importSave(json: string): ActionResult;
  resetSave(): void;
  debugAddPearls(n: number): void;
  debugShiftTime(ms: number): void;
  debugShiftFed(ms: number): void;
  debugLayEgg(speciesId: string): void;
  debugSetSize(biome: BiomeId, level: number): void;
}

export type GameState = SaveData & Actions;

function mutHabitat(s: SaveData, biome: BiomeId, fn: (h: HabitatSave) => HabitatSave): SaveData["habitats"] {
  const h = s.habitats[biome];
  if (!h) return s.habitats;
  return { ...s.habitats, [biome]: fn(h) };
}

/** New eggs for every habitat over `hours`; returns null if nothing was laid. `live`: rain can boost them. */
function layEggs(habitats: SaveData["habitats"], hours: number, now: number, live = false) {
  let laid = 0;
  let next: SaveData["habitats"] | null = null;
  for (const [b, h] of Object.entries(habitats) as [BiomeId, HabitatSave][]) {
    // Amazon showers (only while the game is open) make eggs a little more likely there.
    const boost = live && BIOMES[b].signature === "rain" && isRaining(now) ? RAIN.eggBoost : 1;
    const eggs = rollEggs(h, hours, now, Math.random, boost);
    if (!eggs.length) continue;
    next ??= { ...habitats };
    next[b] = { ...h, eggs: [...h.eggs, ...eggs] };
    laid += eggs.length;
  }
  return next ? { habitats: next, laid } : null;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...defaultSave(),

      liveTick(now) {
        const s = get();
        const dt = (now - s.lastSeen) / 1000;
        if (dt > ECONOMY.awayThresholdSec) return "away";
        if (dt <= 0) {
          // Clock went backwards: just re-anchor.
          set({ lastSeen: now });
          return "ok";
        }
        const earned = totalIncome(s, now) * dt;
        const eggs = layEggs(s.habitats, dt / 3600, now, true);
        set({
          pearls: s.pearls + earned,
          lastSeen: now,
          stats: { ...s.stats, totalEarned: s.stats.totalEarned + earned },
          ...(eggs ? { habitats: eggs.habitats } : {}),
        });
        if (s.dailyGoals.date !== localDateKey(new Date(now))) get().ensureDailyGoals(now);
        return "ok";
      },

      applyAway(now) {
        const s = get();
        const res = offlineEarnings(s, s.lastSeen, now);
        let passedBy: string | undefined;
        const codex = { ...s.codex };
        if (res.seconds >= ECONOMY.visitor.awayPassByMinMinutes * 60 && Math.random() < ECONOMY.visitor.awayPassByChance) {
          const pool = s.biomesUnlocked.flatMap((b) => visitorWeights(b, s.habitats[b], s.codex));
          const pick = pickWeighted(pool);
          if (pick) {
            passedBy = pick.species.id;
            if (!codex[passedBy]) codex[passedBy] = "spotted";
          }
        }
        // Eggs keep coming while you're away (same cap as pearls, and max 3 waiting).
        const eggs = layEggs(s.habitats, clampAwaySeconds(s.lastSeen, now) / 3600, now);
        set({
          pearls: s.pearls + res.total,
          lastSeen: now,
          codex,
          stats: { ...s.stats, totalEarned: s.stats.totalEarned + res.total },
          ...(eggs ? { habitats: eggs.habitats } : {}),
        });
        get().ensureDailyGoals(now);
        return { ...res, passedBy, eggsLaid: eggs?.laid ?? 0 };
      },

      buyCreature(speciesId) {
        const s = get();
        const sp = SPECIES_BY_ID[speciesId];
        if (!sp) return { ok: false, reason: "Unknown species." };
        const h = s.habitats[sp.biome];
        if (!h) return { ok: false, reason: "That habitat is still locked." };
        if (!inShop(sp, s.codex)) return { ok: false, reason: "Not in the shop yet." };
        const cost = creatureCost(sp, ownedCount(h, sp.id));
        if (s.pearls < cost) return { ok: false, reason: "Not enough pearls yet." };
        if (spaceUsed(h) + SIZE_SPACE[sp.size] > capacityOf(sp.biome, h))
          return { ok: false, reason: "No room. Expand the habitat first." };
        const newUid = uid();
        set({
          pearls: s.pearls - cost,
          habitats: mutHabitat(s, sp.biome, (h) => ({ ...h, creatures: [...h.creatures, { uid: newUid, speciesId }] })),
          codex: { ...s.codex, [speciesId]: "owned" },
        });
        get().trackGoal("buy");
        return { ok: true, uid: newUid };
      },

      befriend(speciesId, biome, opts = {}) {
        const s = get();
        const sp = SPECIES_BY_ID[speciesId];
        const h = s.habitats[biome];
        if (!sp || !h) return { ok: false, reason: "Can't befriend that here." };
        if (spaceUsed(h) + SIZE_SPACE[sp.size] > capacityOf(biome, h)) return { ok: false, reason: "No room." };
        const newUid = uid();
        const variantId = opts.variantId && VARIANT_BY_ID[opts.variantId]?.speciesId === speciesId ? opts.variantId : undefined;
        // An old friend coming home leaves the Sanctuary list.
        const back = opts.returning === undefined ? -1 : s.sanctuary.findIndex((e) => e.speciesId === speciesId && e.releasedAt === opts.returning);
        set({
          habitats: mutHabitat(s, biome, (h) => ({ ...h, creatures: [...h.creatures, { uid: newUid, speciesId, ...(variantId ? { variantId } : {}) }] })),
          codex: { ...s.codex, [speciesId]: "owned", ...(variantId ? { [variantId]: "owned" as const } : {}) },
          stats: { ...s.stats, visitorsBefriended: s.stats.visitorsBefriended + 1 },
          ...(back >= 0 ? { sanctuary: s.sanctuary.filter((_, i) => i !== back) } : {}),
        });
        get().trackGoal("befriend");
        return { ok: true, uid: newUid };
      },

      releaseCreatures(biome, uids) {
        const s = get();
        const h = s.habitats[biome];
        const none: ReleaseResult = { ok: false, refund: 0, released: [], toSanctuary: 0 };
        if (!h) return none;
        const wanted = new Set(uids);
        const released = h.creatures.filter((c) => wanted.has(c.uid));
        if (!released.length) return none;
        // Refunds use the habitat's income from before the release.
        const now = Date.now();
        const homeIncome = habitatIncome(h, now);
        let refund = 0;
        const freed: SanctuaryEntry[] = [];
        for (const c of released) {
          const sp = SPECIES_BY_ID[c.speciesId];
          if (!sp) continue;
          refund += releaseRefund(sp, homeIncome);
          if (ECONOMY.release.confirmRarities.includes(sp.rarity))
            freed.push({ speciesId: sp.id, ...(c.variantId ? { variantId: c.variantId } : {}), biome, releasedAt: now });
        }
        // The codex is left alone on purpose: what you've owned stays owned.
        set({
          pearls: s.pearls + refund,
          habitats: mutHabitat(s, biome, (h) => ({ ...h, creatures: h.creatures.filter((c) => !wanted.has(c.uid)) })),
          ...(freed.length ? { sanctuary: [...s.sanctuary, ...freed].slice(-ECONOMY.sanctuary.maxEntries) } : {}),
        });
        return { ok: true, refund, released, toSanctuary: freed.length };
      },

      restoreCreatures(biome, creatures, refund) {
        const s = get();
        const h = s.habitats[biome];
        if (!h || !creatures.length) return { ok: false, reason: "Nothing to bring back." };
        if (s.pearls < refund) return { ok: false, reason: "Those pearls were already spent, so this can't be undone." };
        const back = creatures.filter((c) => SPECIES_BY_ID[c.speciesId] && !h.creatures.some((x) => x.uid === c.uid));
        const need = back.reduce((a, c) => a + SIZE_SPACE[SPECIES_BY_ID[c.speciesId].size], 0);
        if (spaceUsed(h) + need > capacityOf(biome, h)) return { ok: false, reason: "That space is taken now, so this can't be undone." };
        set({
          pearls: s.pearls - refund,
          habitats: mutHabitat(s, biome, (h) => ({ ...h, creatures: [...h.creatures, ...back] })),
        });
        return { ok: true };
      },

      hatchEgg(biome, index) {
        const s = get();
        const h = s.habitats[biome];
        const egg = h?.eggs[index];
        const sp = egg && SPECIES_BY_ID[egg.speciesId];
        if (!h || !egg || !sp) return { ok: false, reason: "No egg there." };
        if (spaceUsed(h) + SIZE_SPACE[sp.size] > capacityOf(biome, h))
          return { ok: false, reason: "No room for a hatchling yet. Expand the habitat and the egg will wait." };
        const variantId = rollVariant(sp.id);
        const newUid = uid();
        set({
          habitats: mutHabitat(s, biome, (h) => ({
            ...h,
            eggs: h.eggs.filter((_, i) => i !== index),
            creatures: [...h.creatures, { uid: newUid, speciesId: sp.id, ...(variantId ? { variantId } : {}) }],
          })),
          codex: { ...s.codex, [sp.id]: "owned", ...(variantId ? { [variantId]: "owned" as const } : {}) },
          stats: { ...s.stats, eggsHatched: s.stats.eggsHatched + 1 },
        });
        get().trackGoal("hatch");
        return { ok: true, uid: newUid, variantId };
      },

      expandHabitat(biome) {
        const s = get();
        const h = s.habitats[biome];
        if (!h) return { ok: false, reason: "Locked habitat." };
        const next = nextExpansion(biome, h);
        if (!next) return { ok: false, reason: "Already fully expanded." };
        if (s.pearls < next.cost) return { ok: false, reason: "Not enough pearls yet." };
        // First habitat ever to reach max size: a one-time thank-you.
        let milestoneReward = 0;
        if (next.to === SIZE_LEVELS && !s.milestones.firstFullExpansion) {
          const e = ECONOMY.expansion;
          milestoneReward = Math.max(e.firstFullRewardFloor, Math.round((totalIncome(s, Date.now()) * e.firstFullRewardMinutes * 60) / 100) * 100);
        }
        set({
          pearls: s.pearls - next.cost + milestoneReward,
          habitats: mutHabitat(s, biome, (h) => ({ ...h, sizeLevel: next.to })),
          ...(milestoneReward ? { milestones: { ...s.milestones, firstFullExpansion: true } } : {}),
        });
        get().trackGoal("expand");
        return { ok: true, from: next.from, to: next.to, milestoneReward };
      },

      unlockBiome(biome) {
        const s = get();
        const b = BIOMES[biome];
        if (!b.playable) return { ok: false, reason: "Coming soon." };
        if (s.biomesUnlocked.includes(biome)) return { ok: false, reason: "Already open." };
        if (s.pearls < b.unlockCost) return { ok: false, reason: "Not enough pearls yet." };
        const now = Date.now();
        set({
          pearls: s.pearls - b.unlockCost,
          biomesUnlocked: [...s.biomesUnlocked, biome],
          habitats: { ...s.habitats, [biome]: newHabitat(now) },
          activeBiome: biome,
        });
        get().trackGoal("visit", biome);
        return { ok: true };
      },

      setActiveBiome(biome) {
        if (!get().biomesUnlocked.includes(biome)) return;
        set({ activeBiome: biome });
        get().trackGoal("visit", biome);
      },

      feed(biome) {
        const s = get();
        set({ habitats: mutHabitat(s, biome, (h) => ({ ...h, lastFed: Date.now() })) });
        get().trackGoal("feed", biome);
      },

      placeDecoration(biome, slot, decoId) {
        const s = get();
        const deco = DECORATION_BY_ID[decoId];
        const h = s.habitats[biome];
        if (!deco || !h || deco.biome !== biome) return { ok: false, reason: "That doesn't fit here." };
        const spot = slotLayout(biome, h.sizeLevel).find((x) => x.key === slot);
        if (!spot || spot.kind !== deco.placement) return { ok: false, reason: "That doesn't fit in this spot." };
        const existing = h.decorations.find((d) => d.slot === slot);
        const refund = existing ? (DECORATION_BY_ID[existing.decoId]?.cost ?? 0) : 0;
        if (s.pearls + refund < deco.cost) return { ok: false, reason: "Not enough pearls yet." };
        set({
          pearls: s.pearls + refund - deco.cost,
          habitats: mutHabitat(s, biome, (h) => ({
            ...h,
            decorations: [...h.decorations.filter((d) => d.slot !== slot), { slot, decoId, rotation: existing?.rotation ?? 0 }],
          })),
        });
        get().trackGoal("place-deco");
        return { ok: true };
      },

      rotateDecoration(biome, slot) {
        const s = get();
        set({
          habitats: mutHabitat(s, biome, (h) => ({
            ...h,
            decorations: h.decorations.map((d) => (d.slot === slot ? { ...d, rotation: (d.rotation + 1) % 4 } : d)),
          })),
        });
      },

      removeDecoration(biome, slot) {
        // Removing refunds the full price, so rearranging is never a loss.
        const s = get();
        const existing = s.habitats[biome]?.decorations.find((d) => d.slot === slot);
        if (!existing) return;
        set({
          pearls: s.pearls + (DECORATION_BY_ID[existing.decoId]?.cost ?? 0),
          habitats: mutHabitat(s, biome, (h) => ({ ...h, decorations: h.decorations.filter((d) => d.slot !== slot) })),
        });
      },

      markSpotted(speciesId) {
        const s = get();
        if (!s.codex[speciesId]) set({ codex: { ...s.codex, [speciesId]: "spotted" } });
      },

      claimCodexReward(biome, tier) {
        const s = get();
        const claimed = s.codexRewardsClaimed[biome] ?? [];
        if (claimed.includes(tier)) return { ok: false, reason: "Already claimed." };
        if (codexProgress(biome, s.codex).pct + 1e-9 < CODEX_TIERS[tier]) return { ok: false, reason: "Not there yet." };
        set({
          pearls: s.pearls + BIOMES[biome].codexRewards[tier],
          codexRewardsClaimed: { ...s.codexRewardsClaimed, [biome]: [...claimed, tier] },
        });
        return { ok: true };
      },

      ensureDailyGoals(now = Date.now()) {
        const s = get();
        const today = localDateKey(new Date(now));
        if (s.dailyGoals.date === today && s.dailyGoals.goals.length) return;
        set({ dailyGoals: { date: today, goals: makeDailyGoals(s, totalIncome(s, now)) } });
      },

      trackGoal(event, key) {
        const s = get();
        if (!s.dailyGoals.goals.length) return;
        const finished: string[] = [];
        const goals = s.dailyGoals.goals.map((g) => {
          if (g.done || GOAL_BY_ID[g.id]?.event !== event) return g;
          let next: DailyGoal;
          if (g.keys) {
            if (!key || g.keys.includes(key)) return g;
            const keys = [...g.keys, key];
            next = { ...g, keys, progress: keys.length };
          } else next = { ...g, progress: g.progress + 1 };
          if (next.progress >= next.target) {
            next.done = true;
            finished.push(g.id);
          }
          return next;
        });
        set({ dailyGoals: { ...s.dailyGoals, goals } });
        finished.forEach((id) => goalListeners.forEach((fn) => fn(id)));
      },

      claimGoal(index) {
        const s = get();
        const g = s.dailyGoals.goals[index];
        if (!g || !g.done) return { ok: false, reason: "Not done yet." };
        if (g.claimed) return { ok: false, reason: "Already claimed." };
        const goals = s.dailyGoals.goals.map((x, i) => (i === index ? { ...x, claimed: true } : x));
        set({ pearls: s.pearls + g.reward, dailyGoals: { ...s.dailyGoals, goals } });
        return { ok: true };
      },

      setTutorial(step) {
        set({ tutorial: step });
      },

      buyStyle(biome, kind, id) {
        const s = get();
        const h = s.habitats[biome];
        const item = styleItem(kind, id);
        if (!h || !item) return { ok: false, reason: "That isn't available here." };
        const key = kind + ":" + id;
        if (item.tier === "free" || h.ownedStyle.includes(key)) {
          get().equipStyle(biome, kind, id);
          return { ok: true };
        }
        const cost = stylePrice(biome, kind, id);
        if (s.pearls < cost) return { ok: false, reason: "Not enough pearls yet." };
        const field = kind === "lamp" ? "lampId" : kind === "background" ? "backgroundId" : "frameId";
        set({
          pearls: s.pearls - cost,
          habitats: mutHabitat(s, biome, (h) => ({
            ...h,
            ownedStyle: [...h.ownedStyle, key],
            style: { ...h.style, [field]: id, ...(kind === "lamp" ? { lampOn: true } : {}) },
          })),
        });
        return { ok: true };
      },

      equipStyle(biome, kind, id) {
        const s = get();
        const h = s.habitats[biome];
        const item = styleItem(kind, id);
        if (!h || !item || (item.tier !== "free" && !h.ownedStyle.includes(kind + ":" + id))) return;
        const field = kind === "lamp" ? "lampId" : kind === "background" ? "backgroundId" : "frameId";
        set({ habitats: mutHabitat(s, biome, (h) => ({ ...h, style: { ...h.style, [field]: id, ...(kind === "lamp" ? { lampOn: true } : {}) } })) });
      },

      setLamp(biome, { on, auto }) {
        const s = get();
        set({
          habitats: mutHabitat(s, biome, (h) => ({
            ...h,
            style: { ...h.style, ...(on !== undefined ? { lampOn: on } : {}), ...(auto !== undefined ? { lampAuto: auto } : {}) },
          })),
        });
      },

      buyEquipment(biome, slot) {
        const s = get();
        const h = s.habitats[biome];
        if (!h) return { ok: false, reason: "Locked habitat." };
        if (h.equipment[slot]) return { ok: false, reason: "Already installed." };
        const cost = equipmentPrice(biome, slot);
        if (s.pearls < cost) return { ok: false, reason: "Not enough pearls yet." };
        const now = Date.now();
        set({
          pearls: s.pearls - cost,
          habitats: mutHabitat(s, biome, (h) => {
            // Keep the glass looking the same when the build-up rate changes.
            const level = algaeLevel(h, now);
            const equipment = { ...h.equipment, [slot]: true };
            const hours = equipment.filter ? TANK.algaeHoursWithFilter : TANK.algaeHours;
            const rate = equipment.cleaner ? TANK.cleanerRate : 1;
            const kept = Math.min(level, equipment.cleaner ? TANK.cleanerCap : 1);
            return { ...h, equipment, algae: { lastCleanedAt: now - (kept / rate) * hours * 3600_000 } };
          }),
        });
        return { ok: true };
      },

      cleanGlass(biome) {
        const s = get();
        const h = s.habitats[biome];
        if (!h) return { ok: false, sparkled: false, level: 0 };
        const now = Date.now();
        const level = algaeLevel(h, now);
        const sparkled = level >= TANK.sparkleFrom;
        set({
          habitats: mutHabitat(s, biome, (h) => ({
            ...h,
            algae: { lastCleanedAt: now },
            // Doesn't stack: a qualifying clean just restarts the timer.
            ...(sparkled ? { sparklingUntil: now + TANK.sparkleMinutes * 60_000 } : {}),
          })),
        });
        get().trackGoal("wipe");
        return { ok: true, sparkled, level };
      },

      setMilestone(key, on) {
        set({ milestones: { ...get().milestones, [key]: on } });
      },

      debugSetAlgae(biome, level) {
        const s = get();
        set({
          habitats: mutHabitat(s, biome, (h) => {
            const hours = h.equipment.filter ? TANK.algaeHoursWithFilter : TANK.algaeHours;
            const rate = h.equipment.cleaner ? TANK.cleanerRate : 1;
            return { ...h, algae: { lastCleanedAt: Date.now() - (level / rate) * hours * 3600_000 } };
          }),
        });
      },

      setVisitorDue(at) {
        set({ visitorDueAt: at });
      },

      setSetting(key, value) {
        set({ settings: { ...get().settings, [key]: value } });
      },

      exportSave() {
        return JSON.stringify(pickSave(get()));
      },

      importSave(json) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(json.trim());
        } catch {
          return { ok: false, reason: "That doesn't look like a save. Copy the whole text and try again." };
        }
        if (!isObj(parsed) || typeof parsed.version !== "number" || !isObj(parsed.habitats))
          return { ok: false, reason: "That doesn't look like an Idlarium save." };
        if (parsed.version > SAVE_VERSION) return { ok: false, reason: "That save is from a newer version of Idlarium." };
        const next = normalizeSave(migrate(parsed, parsed.version));
        // Imported progress shouldn't trigger a huge away payout from the old timestamp.
        next.lastSeen = Date.now();
        set(next);
        get().ensureDailyGoals();
        flushSave();
        return { ok: true };
      },

      resetSave() {
        set(defaultSave());
        get().ensureDailyGoals();
        flushSave();
      },

      debugAddPearls(n) {
        set({ pearls: get().pearls + n });
      },

      debugShiftTime(ms) {
        const s = get();
        const habitats = { ...s.habitats };
        for (const k of Object.keys(habitats) as BiomeId[]) habitats[k] = { ...habitats[k]!, lastFed: habitats[k]!.lastFed - ms };
        set({ lastSeen: s.lastSeen - ms, habitats });
      },

      debugShiftFed(ms) {
        const s = get();
        const habitats = { ...s.habitats };
        for (const k of Object.keys(habitats) as BiomeId[]) habitats[k] = { ...habitats[k]!, lastFed: habitats[k]!.lastFed - ms };
        set({ habitats });
      },

      debugSetSize(biome, level) {
        const s = get();
        set({ habitats: mutHabitat(s, biome, (h) => ({ ...h, sizeLevel: clampLevel(level) })) });
      },

      debugLayEgg(speciesId) {
        const s = get();
        const sp = SPECIES_BY_ID[speciesId];
        if (!sp || !s.habitats[sp.biome]) return;
        set({ habitats: mutHabitat(s, sp.biome, (h) => ({ ...h, eggs: [...h.eggs, { speciesId, laidAt: Date.now() }].slice(-ECONOMY.eggs.maxWaiting) })) });
      },
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => throttledStorage),
      partialize: (s) => pickSave(s),
      migrate: (persisted, version) => migrate(persisted, version) as GameState,
      merge: (persisted, current) => ({ ...current, ...normalizeSave(persisted) }),
    },
  ),
);
