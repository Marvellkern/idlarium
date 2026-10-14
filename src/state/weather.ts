// Live weather: Amazon rain showers. Only while the game is open (never offline),
// in memory, so a reload simply starts dry. Tuning lives in data/signatures.ts.
import { create } from "zustand";
import { RAIN } from "../data/signatures";

interface WeatherState {
  /** Rain falls until this time (ms). 0 = dry. */
  rainUntil: number;
  startRain(minutes?: number, now?: number): void;
  stopRain(): void;
}

export const useWeather = create<WeatherState>()((set) => ({
  rainUntil: 0,
  startRain: (minutes, now = Date.now()) => {
    const m = minutes ?? RAIN.minMinutes + Math.random() * (RAIN.maxMinutes - RAIN.minMinutes);
    set({ rainUntil: now + m * 60_000 });
  },
  stopRain: () => set({ rainUntil: 0 }),
}));

export function isRaining(now = Date.now()) {
  return now < useWeather.getState().rainUntil;
}

/** Called once a minute while the game is open: maybe start a shower. */
export function weatherMinute(now = Date.now()) {
  if (isRaining(now)) return;
  if (Math.random() < RAIN.chancePerMinute) useWeather.getState().startRain(undefined, now);
}
