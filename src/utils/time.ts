/** Local calendar date key, e.g. "2026-10-12". Daily goals reset when this changes. */
export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function hoursSince(ts: number, now = Date.now()) {
  return Math.max(0, (now - ts) / 3600_000);
}

// ───────────── Real-clock day / night ─────────────

/** Dawn and dusk windows in local hours. */
export const DAWN = [5, 7] as const;
export const DUSK = [17, 19] as const;

let hourOverride: number | null = null;

/** Debug only: pretend it's this hour (0–24), or null for the real clock. */
export function setHourOverride(h: number | null) {
  hourOverride = h;
}

export function getHourOverride() {
  return hourOverride;
}

/** Current local hour as a decimal, e.g. 18.5 for 18:30. */
export function localHour(d = new Date()) {
  if (hourOverride !== null) return hourOverride;
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** 0 = night, 1 = full day, with smooth transitions at dawn and dusk. */
export function daylight(hour = localHour()) {
  if (hour < DAWN[0] || hour >= DUSK[1]) return 0;
  if (hour >= DAWN[1] && hour < DUSK[0]) return 1;
  if (hour < DAWN[1]) return smooth((hour - DAWN[0]) / (DAWN[1] - DAWN[0]));
  return 1 - smooth((hour - DUSK[0]) / (DUSK[1] - DUSK[0]));
}

export type DayPhase = "night" | "dawn" | "day" | "dusk";

export function dayPhase(hour = localHour()): DayPhase {
  if (hour < DAWN[0] || hour >= DUSK[1]) return "night";
  if (hour < DAWN[1]) return "dawn";
  if (hour < DUSK[0]) return "day";
  return "dusk";
}
