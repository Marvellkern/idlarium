// Drives the idle economy while the page is open:
//  - ticks pearls 4×/s from real timestamps
//  - when the tab was hidden/closed for more than ECONOMY.awayThresholdSec,
//    applies offline earnings (capped, half rate) and shows the away summary
//  - runs the visitor timer (on the real clock; it keeps going while away)
//  - pauses rendering while hidden
import { useEffect, useRef } from "react";
import { BIOMES } from "../data/biomes";
import { useDaylight } from "../ui/hooks";
import { localDateKey } from "../utils/time";
import { playAmbient, setRainSound, setSoundEnabled } from "../utils/audio";
import { isRaining, useWeather, weatherMinute } from "./weather";
import { useGame } from "./gameStore";
import { useUI } from "./uiStore";
import { pauseVisitorWindow, scheduleNextVisitor, visitorTick } from "./visitorLogic";

const TICK_MS = 250;

function tick() {
  const now = Date.now();
  if (useGame.getState().liveTick(now) === "away") {
    const summary = useGame.getState().applyAway(now);
    if (summary.total >= 1 || summary.passedBy || summary.eggsLaid > 0) useUI.getState().setAway(summary);
  }
}

export function useGameLoop() {
  useEffect(() => {
    tick();
    // Brand-new save: start the first visitor timer.
    if (!useGame.getState().visitorDueAt) scheduleNextVisitor();
    let hiddenAt = 0;
    let weatherAt = Date.now() + 60_000;
    const iv = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      tick();
      visitorTick();
      // Weather (Amazon showers) is rolled once a minute while the game is open.
      const now = Date.now();
      if (now >= weatherAt) {
        weatherAt = now + 60_000;
        const g = useGame.getState();
        if (g.biomesUnlocked.some((b) => BIOMES[b].signature === "rain")) weatherMinute(now);
      }
    }, TICK_MS);
    const onVis = () => {
      const hidden = document.visibilityState === "hidden";
      useUI.getState().setHidden(hidden);
      if (hidden) hiddenAt = Date.now();
      else {
        // A visitor on screen doesn't run out while you're in another tab.
        if (hiddenAt) pauseVisitorWindow(Date.now() - hiddenAt);
        hiddenAt = 0;
        tick();
      }
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
  // Rain sound only where it rains, and only while it does.
  const rainUntil = useWeather((s) => s.rainUntil);
  useEffect(() => {
    const on = sound && BIOMES[biome].signature === "rain" && isRaining();
    setRainSound(on);
    if (!on) return;
    const t = setTimeout(() => setRainSound(false), Math.max(0, rainUntil - Date.now()));
    return () => clearTimeout(t);
  }, [sound, biome, rainUntil]);

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
