// Drives the idle economy while the page is open:
//  - ticks pearls 4×/s from real timestamps
//  - when the tab was hidden/closed for more than ECONOMY.awayThresholdSec,
//    applies offline earnings (capped, half rate) and shows the away summary
//  - runs the visitor timer
//  - pauses rendering while hidden
import { useEffect, useRef } from "react";
import { BIOMES } from "../data/biomes";
import { useDaylight } from "../ui/hooks";
import { localDateKey } from "../utils/time";
import { playAmbient, setSoundEnabled } from "../utils/audio";
import { useGame } from "./gameStore";
import { useUI } from "./uiStore";
import { scheduleNextVisitor, visitorTick } from "./visitorLogic";

const TICK_MS = 250;

function tick() {
  const now = Date.now();
  if (useGame.getState().liveTick(now) === "away") {
    const summary = useGame.getState().applyAway(now);
    if (summary.total >= 1 || summary.passedBy || summary.eggsLaid > 0) useUI.getState().setAway(summary);
    scheduleNextVisitor(now);
  }
}

export function useGameLoop() {
  useEffect(() => {
    tick();
    scheduleNextVisitor();
    const iv = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      tick();
      visitorTick();
    }, TICK_MS);
    const onVis = () => {
      const hidden = document.visibilityState === "hidden";
      useUI.getState().setHidden(hidden);
      if (!hidden) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Sound is off by default; keep the audio layer in sync with settings.
  const sound = useGame((s) => s.settings.sound);
  const biome = useGame((s) => s.activeBiome);
  useEffect(() => {
    setSoundEnabled(sound);
    playAmbient(biome);
  }, [sound, biome]);

  // Page backdrop follows the active biome and darkens at night.
  const { daylight: lit, phase } = useDaylight();
  useEffect(() => {
    const b = BIOMES[biome];
    const night = b.sunlit ? (1 - lit) * 0.85 : 0;
    const top = mixHex(b.palette.bgTop, "#2a3550", night);
    const bottom = mixHex(b.palette.bgBottom, "#0b1220", night);
    document.body.style.setProperty("--bg-top", top);
    document.body.style.setProperty("--bg-bottom", bottom);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bottom);
  }, [biome, lit]);

  // "The swamp is sleepy tonight." once per night per habitat, never as a nag.
  const said = useRef(new Set<string>());
  useEffect(() => {
    const b = BIOMES[biome];
    if (phase !== "night" || !b.sunlit || !b.nightLine) return;
    const key = biome + localDateKey();
    if (said.current.has(key)) return;
    said.current.add(key);
    const t = setTimeout(() => useUI.getState().toast(b.nightLine), 1200);
    return () => clearTimeout(t);
  }, [biome, phase]);
}

function mixHex(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return "#" + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1);
}
