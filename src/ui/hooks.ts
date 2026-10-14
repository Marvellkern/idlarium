import { useEffect, useRef, useState } from "react";
import type { BiomeId } from "../data/biomes";
import { happiness, habitatIncome, totalIncome } from "../state/economy";
import { useGame } from "../state/gameStore";
import { prefersReducedMotion } from "../utils/motion";
import { useUI } from "../state/uiStore";
import { dayPhase, daylight, localHour } from "../utils/time";

/** Smoothly counts toward `target` (satisfying count-up on big jumps). */
export function useAnimatedNumber(target: number) {
  const [value, setValue] = useState(target);
  const cur = useRef(target);
  const tgt = useRef(target);
  tgt.current = target;
  useEffect(() => {
    if (prefersReducedMotion()) {
      cur.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      // rAF timestamps can predate `last`; never step backwards (it would overshoot).
      const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
      last = t;
      const diff = tgt.current - cur.current;
      if (Math.abs(diff) < 0.05) cur.current = tgt.current;
      // Count up gently, but drop quickly when spending so purchases feel instant.
      else cur.current += diff * (1 - Math.exp(-dt * (diff < 0 ? 18 : 5)));
      setValue(cur.current);
      if (cur.current !== tgt.current) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

/** Re-render every `ms` so time-based numbers stay fresh. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(iv);
  }, [ms]);
  return now;
}

export function useTotalIncome() {
  const habitats = useGame((s) => s.habitats);
  const now = useNow(2000);
  return totalIncome({ habitats }, now);
}

export function useHabitatStats(biome: BiomeId) {
  const h = useGame((s) => s.habitats[biome]);
  const now = useNow(2000);
  if (!h) return null;
  return { income: habitatIncome(h, now), happiness: happiness(h, now) };
}

/** Real-clock daylight (0 night … 1 day) and phase, refreshed every 20 s. */
export function useDaylight() {
  useUI((s) => s.clockTick);
  useNow(20_000);
  const hour = localHour();
  return { daylight: daylight(hour), phase: dayPhase(hour), hour };
}
