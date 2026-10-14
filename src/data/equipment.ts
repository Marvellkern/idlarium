// Aquarium equipment, tank styles and glass algae. All tuning lives here.
//
// Prices are a share of the habitat's "equipment base" (its unlock cost), so they
// scale with the economy. Each habitat buys its own equipment and style items.

import { BIOMES, BIOME_ORDER, type BiomeId } from "./biomes";

export type StyleKind = "lamp" | "background" | "frame";
export type StyleTier = "free" | "common" | "fancy";
export type EquipmentSlot = "filter" | "airPump" | "autoFeeder" | "cleaner";

/** Share of the equipment base each style tier costs. */
export const STYLE_PRICE: Record<StyleTier, number> = { free: 0, common: 0.03, fancy: 0.1 };

/**
 * What prices are a share of. The Swamp has no unlock cost; the brief's "next habitat
 * × 0.3" would be only 180 pearls now that the cheap Tidepool comes next, so it uses
 * a fixed 1,500 instead. The Tidepool also gets that floor.
 */
export const SWAMP_EQUIPMENT_BASE = 1500;

export function equipmentBase(biome: BiomeId) {
  const unlock = BIOMES[biome].unlockCost;
  if (unlock > 0) return Math.max(unlock, SWAMP_EQUIPMENT_BASE);
  const next = BIOME_ORDER[BIOME_ORDER.indexOf(biome) + 1];
  return Math.max(SWAMP_EQUIPMENT_BASE, next ? BIOMES[next].unlockCost * 0.3 : SWAMP_EQUIPMENT_BASE);
}

/** Round prices to friendly numbers (two significant digits). */
function friendly(v: number) {
  if (v < 100) return Math.max(1, Math.round(v));
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / mag) * mag;
}

// ───────────── Lamps ─────────────

export type LampLook = "clip" | "bar" | "hood" | "pendant" | "party" | "brass";

export interface LampDef {
  id: string;
  name: string;
  tier: StyleTier;
  look: LampLook;
  /** Light color, strength (spotlight) and how much it tints the whole tank. */
  color: string;
  intensity: number;
  tint: number;
  /** Strength of the soft light beam in the water. */
  beam: number;
  /** Shimmery caustic boost under the lamp (reef LEDs). */
  shimmer?: number;
  /** Slowly cycles hues (party lamp). */
  cycle?: boolean;
  blurb: string;
}

export const LAMPS: LampDef[] = [
  { id: "clip-basic", name: "Basic Clip Lamp", tier: "free", look: "clip", color: "#fff8ec", intensity: 2.2, tint: 0, beam: 0.08, blurb: "A small black clip-on lamp. Plain, neutral light." },
  { id: "daylight-bar", name: "Daylight LED Bar", tier: "common", look: "bar", color: "#eef6ff", intensity: 3.2, tint: 0.08, beam: 0.1, blurb: "A slim bar across the top. Bright, crisp and a little cool." },
  { id: "sunset", name: "Warm Sunset Lamp", tier: "common", look: "hood", color: "#ffb38a", intensity: 2.6, tint: 0.22, beam: 0.12, blurb: "A round hood that bathes the tank in warm orange-pink." },
  { id: "moonlight", name: "Moonlight Lamp", tier: "common", look: "clip", color: "#9cbcff", intensity: 1.3, tint: 0.25, beam: 0.07, blurb: "Soft, dim blue light, like a moonlit night." },
  { id: "reef-spectrum", name: "Reef Spectrum LED", tier: "fancy", look: "pendant", color: "#cfe4ff", intensity: 4, tint: 0.12, beam: 0.16, shimmer: 0.35, blurb: "A pendant over the tank. Bright blue-white with a strong shimmer." },
  { id: "party", name: "RGB Party Lamp", tier: "fancy", look: "party", color: "#ff7ad8", intensity: 2.6, tint: 0.2, beam: 0.13, cycle: true, blurb: "A colorful lens that slowly cycles through every hue." },
  { id: "brass", name: "Antique Brass Lamp", tier: "fancy", look: "brass", color: "#ffd59a", intensity: 2.4, tint: 0.16, beam: 0.11, blurb: "An old-fashioned hood lamp with a golden, cozy glow." },
];

// ───────────── Backgrounds ─────────────

export interface BackgroundDef {
  id: string;
  name: string;
  tier: StyleTier;
  blurb: string;
}

export const BACKGROUNDS: BackgroundDef[] = [
  { id: "none", name: "None", tier: "free", blurb: "Clear back glass, the classic look." },
  { id: "black", name: "Plain Black", tier: "common", blurb: "Makes colors pop." },
  { id: "blue", name: "Blue Gradient", tier: "common", blurb: "A calm fade from light to deep blue." },
  { id: "cliff", name: "Rocky Cliff", tier: "common", blurb: "Layered grey rock faces." },
  { id: "jungle", name: "Planted Jungle", tier: "common", blurb: "A dense wall of leafy water plants." },
  { id: "coral", name: "Coral Wall", tier: "fancy", blurb: "Bright coral heads stacked high." },
  { id: "ruins", name: "Sunken City Ruins", tier: "fancy", blurb: "Columns and arches of a lost city." },
  { id: "stars", name: "Starry Night", tier: "common", blurb: "A deep night sky full of stars." },
  { id: "driftwood", name: "Driftwood Forest", tier: "common", blurb: "Tangled branches in soft light." },
  { id: "abyss", name: "Deep Abyss", tier: "fancy", blurb: "Inky dark water with tiny glowing dots." },
];

// ───────────── Frames ─────────────

export interface FrameDef {
  id: string;
  name: string;
  tier: StyleTier;
  color: string;
  metalness: number;
  roughness: number;
  /** No rim at all, just glass. */
  frameless?: boolean;
  blurb: string;
}

export const FRAMES: FrameDef[] = [
  { id: "black", name: "Black", tier: "free", color: "#22262a", metalness: 0.1, roughness: 0.55, blurb: "The classic black rim." },
  { id: "white", name: "White", tier: "common", color: "#eef0ee", metalness: 0.05, roughness: 0.5, blurb: "Clean and bright." },
  { id: "wood", name: "Natural Wood", tier: "common", color: "#b8875a", metalness: 0, roughness: 0.8, blurb: "Warm, light wood." },
  { id: "dark-wood", name: "Dark Wood", tier: "common", color: "#5a3a26", metalness: 0, roughness: 0.75, blurb: "Rich walnut tones." },
  { id: "steel", name: "Brushed Steel", tier: "common", color: "#a8b0b8", metalness: 0.6, roughness: 0.35, blurb: "Cool, modern metal." },
  { id: "gold", name: "Gold", tier: "fancy", color: "#e0b040", metalness: 0.65, roughness: 0.3, blurb: "Shiny and a little fancy." },
  { id: "frameless", name: "Frameless", tier: "common", color: "#ffffff", metalness: 0, roughness: 0.2, frameless: true, blurb: "Rimless glass, nothing in the way." },
];

export const DEFAULT_STYLE = { lampId: "clip-basic", backgroundId: "none", frameId: "black" };

export function styleItem(kind: StyleKind, id: string): { id: string; name: string; tier: StyleTier; blurb: string } | undefined {
  const list = kind === "lamp" ? LAMPS : kind === "background" ? BACKGROUNDS : FRAMES;
  return (list as { id: string; name: string; tier: StyleTier; blurb: string }[]).find((x) => x.id === id);
}

export function stylePrice(biome: BiomeId, kind: StyleKind, id: string) {
  const item = styleItem(kind, id);
  if (!item || item.tier === "free") return 0;
  return friendly(equipmentBase(biome) * STYLE_PRICE[item.tier]);
}

// ───────────── Functional equipment ─────────────

export interface EquipmentDef {
  slot: EquipmentSlot;
  name: string;
  /** Share of the equipment base. */
  price: number;
  effect: string;
  blurb: string;
}

export const EQUIPMENT: EquipmentDef[] = [
  { slot: "airPump", name: "Air Pump + Bubble Stone", price: 0.05, effect: "+5% happiness", blurb: "A little pump outside the tank and a curtain of bubbles inside." },
  { slot: "filter", name: "Hang-on Filter", price: 0.08, effect: "Algae builds up slower (10 h instead of 6 h)", blurb: "Hangs on the back rim with a small waterfall." },
  { slot: "autoFeeder", name: "Auto Feeder", price: 0.12, effect: "Feeds the tank for you, so it never gets hungry (offline too)", blurb: "A drum feeder on the rim that turns and drops flakes." },
  { slot: "cleaner", name: "Algae Scraper Bot", price: 0.15, effect: "+5% income, algae stays under 50%", blurb: "A magnetic scraper gliding over the glass." },
];

/** Freshwater-ish shallow habitats get a cleaner snail instead of a scraper bot. */
export const SNAIL_HABITATS: BiomeId[] = ["swamp", "amazon", "tidepool"];

export function equipmentName(biome: BiomeId, slot: EquipmentSlot) {
  if (slot === "cleaner" && SNAIL_HABITATS.includes(biome)) return "Cleaner Snail";
  return EQUIPMENT.find((e) => e.slot === slot)!.name;
}

export function equipmentPrice(biome: BiomeId, slot: EquipmentSlot) {
  const def = EQUIPMENT.find((e) => e.slot === slot)!;
  return friendly(equipmentBase(biome) * def.price);
}

// ───────────── Effects & algae ─────────────

export const TANK = {
  /** Hours for algae to go from clean to 100%. */
  algaeHours: 6,
  algaeHoursWithFilter: 10,
  /** With a scraper/snail algae builds at this fraction of the speed and stops at the cap. */
  cleanerRate: 0.5,
  cleanerCap: 0.5,
  /** Cleaning at or above this level makes the tank Sparkling. */
  sparkleFrom: 0.5,
  sparkleIncome: 0.15,
  sparkleMinutes: 60,
  /** A wipe counts as done when this much of the facing glass is clean. */
  wipeDone: 0.9,
  /** Seconds in wipe mode before "Clean all" appears. */
  cleanAllAfter: 3,
  airPumpHappiness: 0.05,
  cleanerIncome: 0.05,
  /** Show the sponge button from this algae level. */
  spongeFrom: 0.15,
};
