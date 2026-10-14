// Tiny sound layer. Uses audio files from data/audio.ts when provided, otherwise
// synthesizes soft UI blips and ambient beds with WebAudio. Fails silently.

import { AMBIENT, UI_SOUNDS } from "../data/audio";
import type { BiomeId } from "../data/biomes";

let ctx: AudioContext | null = null;
let enabled = false;
let ambientEl: HTMLAudioElement | null = null;
let ambientSynth: { stop(): void } | null = null;

function getCtx() {
  if (!ctx) {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (!on) stopAmbient();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number, out?: AudioNode) {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.05, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(out ?? ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export type UiSound = keyof typeof UI_SOUNDS;

export function play(name: UiSound) {
  if (!enabled) return;
  const file = UI_SOUNDS[name];
  if (file) {
    const a = new Audio(file);
    a.volume = 0.5;
    a.play().catch(() => {});
    return;
  }
  switch (name) {
    case "plink":
      tone(1320, 0.18, "sine", 0.08);
      tone(1980, 0.14, "sine", 0.04, 0.05);
      break;
    case "pop":
      tone(420, 0.12, "triangle", 0.12, 0, 900);
      break;
    case "chime":
      tone(880, 0.5, "sine", 0.06);
      tone(1108, 0.5, "sine", 0.05, 0.12);
      tone(1318, 0.7, "sine", 0.05, 0.24);
      break;
    case "tap":
      tone(660, 0.06, "sine", 0.04);
      break;
  }
}

function stopAmbient() {
  ambientEl?.pause();
  ambientEl = null;
  ambientSynth?.stop();
  ambientSynth = null;
}

export function playAmbient(biome: BiomeId) {
  stopAmbient();
  if (!enabled) return;
  const file = AMBIENT[biome];
  if (file) {
    ambientEl = new Audio(file);
    ambientEl.loop = true;
    ambientEl.volume = 0.35;
    ambientEl.play().catch(() => {});
    return;
  }
  ambientSynth = synthAmbient(biome);
}

/**
 * Placeholder ambience until real loops are added:
 * swamp/reef: soft water noise + bubbles; ocean: distant whale-song glides; deep: low hum + pings.
 */
function synthAmbient(biome: BiomeId): { stop(): void } | null {
  const ac = getCtx();
  if (!ac) return null;
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, ac.currentTime);
  master.gain.linearRampToValueAtTime(1, ac.currentTime + 2.5);
  master.connect(ac.destination);
  const sources: AudioScheduledSourceNode[] = [];

  // Brown-noise water bed
  const buf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = biome === "deep" ? 220 : biome === "ocean" ? 380 : biome === "reef" ? 900 : 600;
  const ng = ac.createGain();
  ng.gain.value = biome === "deep" ? 0.05 : 0.035;
  noise.connect(lp).connect(ng).connect(master);
  noise.start();
  sources.push(noise);

  if (biome === "deep") {
    for (const f of [55, 55.7, 82.4]) {
      const o = ac.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ac.createGain();
      g.gain.value = 0.018;
      o.connect(g).connect(master);
      o.start();
      sources.push(o);
    }
  }

  const tick = () => {
    if (!enabled) return;
    if (biome === "swamp" || biome === "reef") {
      // Bubble: a short rising blip.
      const f = 300 + Math.random() * 500;
      tone(f, 0.08 + Math.random() * 0.06, "sine", 0.025, 0, f * 1.8, master);
    } else if (biome === "ocean" && Math.random() < 0.18) {
      // Distant whale song: a slow, filtered glide.
      const f = 180 + Math.random() * 160;
      tone(f, 2.2 + Math.random() * 1.5, "sine", 0.02, 0, f * (Math.random() < 0.5 ? 0.6 : 1.5), master);
    } else if (biome === "deep" && Math.random() < 0.12) {
      tone(1400 + Math.random() * 400, 1.2, "sine", 0.008, 0, undefined, master);
    }
  };
  const iv = window.setInterval(tick, biome === "swamp" || biome === "reef" ? 900 : 2500);

  return {
    stop() {
      window.clearInterval(iv);
      const t = ac.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0.0001, t + 0.6);
      window.setTimeout(() => {
        sources.forEach((s) => {
          try {
            s.stop();
          } catch {
            /* already stopped */
          }
        });
        master.disconnect();
      }, 800);
    },
  };
}
