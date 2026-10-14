// Each newer habitat has one special touch. All the tuning lives here.
// Pure data and helpers (no three.js), so the UI can use them too.

/** Tidepool: the water rises and falls on a real ~12.4 h cycle (two high tides a day). */
export const TIDES = {
  periodHours: 12.42,
  /** Water height at low and high tide, as a fraction of the full height. */
  low: 0.72,
  high: 1,
  /** Counted as "high tide" above this point of the cycle (0 = lowest, 1 = highest). */
  highFrom: 0.6,
  /** At high tide the next visitor comes a bit sooner (interval × this). */
  highTideVisitorInterval: 0.75,
  /** Species that mostly turn up at high tide get this extra visitor weight then. */
  highTideVisitorBoost: 2.5,
};

let tideOverride: number | null = null;
/** Debug only: pin the tide (0 = low, 1 = high), or null for the real clock. */
export function setTideOverride(phase: number | null) {
  tideOverride = phase;
}
export function getTideOverride() {
  return tideOverride;
}

/** 0 = lowest tide, 1 = highest. Real clock, the same for everyone. */
export function tidePhase(now = Date.now()) {
  if (tideOverride !== null) return tideOverride;
  const t = now / 3600_000 / TIDES.periodHours;
  return (Math.sin(t * Math.PI * 2) + 1) / 2;
}

export function isHighTide(now = Date.now()) {
  return tidePhase(now) >= TIDES.highFrom;
}

/** Water height factor for the current tide. */
export function tideLevel(now = Date.now()) {
  return TIDES.low + (TIDES.high - TIDES.low) * tidePhase(now);
}

/** Amazon River: light rain showers now and then while the game is open. */
export const RAIN = {
  /** Chance per minute (while open) that a shower starts: about once an hour. */
  chancePerMinute: 1 / 60,
  minMinutes: 3,
  maxMinutes: 5,
  /** Egg chance in the habitat while it rains. */
  eggBoost: 1.6,
  /** Daylight dims a little while it rains. */
  lightDim: 0.7,
};

/** Kelp Forest: sea otters float together and sometimes hold paws. */
export const OTTERS = {
  /** Seconds of floating apart, then holding paws. */
  apartSeconds: [25, 45] as [number, number],
  holdSeconds: [18, 30] as [number, number],
  /** How far apart two otters float while holding paws. */
  gap: 0.42,
};

/** Polar Waters: aurora at night, drifting ice by day. */
export const AURORA = {
  colors: ["#6dffb4", "#a07bff"] as [string, string],
  /** Strongest when daylight is below this. */
  fullBelow: 0.15,
  /** Gone when daylight is above this. */
  goneAbove: 0.45,
  /** How much it tints the water and light at its peak. */
  tint: 0.18,
  iceChunks: 6,
};
