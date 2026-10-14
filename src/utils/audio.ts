// Tiny sound layer. Uses audio files from data/audio.ts when provided, otherwise
// synthesizes soft UI blips and ambient beds with WebAudio. Fails silently.

import { AMBIENT, AMBIENT_SYNTH, RAIN_LOOP, UI_SOUNDS, type AmbientEvent } from "../data/audio";
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
    case "squeak": {
      // A soft rubbery squeak on glass.
      const f = 1500 + Math.random() * 500;
      tone(f, 0.07, "triangle", 0.012, 0, f * 1.25);
      break;
    }
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

/** Brown noise: a soft water/wind bed. */
function noiseBuffer(ac: AudioContext) {
  const buf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

/** One small ambient sound. */
function ambientEvent(kind: AmbientEvent, out: AudioNode) {
  const r = Math.random;
  switch (kind) {
    case "bubble": {
      const f = 300 + r() * 500;
      tone(f, 0.08 + r() * 0.06, "sine", 0.025, 0, f * 1.8, out);
      break;
    }
    case "whale": {
      const f = 180 + r() * 160;
      tone(f, 2.2 + r() * 1.5, "sine", 0.02, 0, f * (r() < 0.5 ? 0.6 : 1.5), out);
      break;
    }
    case "ping":
      tone(1400 + r() * 400, 1.2, "sine", 0.008, 0, undefined, out);
      break;
    case "gull":
      // Two thin, falling cries far away.
      tone(1700 + r() * 200, 0.22, "triangle", 0.006, 0, 1100, out);
      tone(1650 + r() * 200, 0.26, "triangle", 0.005, 0.3, 1000, out);
      break;
    case "trickle":
      for (let i = 0; i < 3; i++) tone(1400 + r() * 1200, 0.04, "sine", 0.008, i * (0.05 + r() * 0.08), 2600, out);
      break;
    case "bird":
      for (let i = 0; i < 2 + Math.floor(r() * 2); i++) tone(2400 + r() * 900, 0.09, "sine", 0.006, i * 0.14, 3400, out);
      break;
    case "insect":
      for (let i = 0; i < 4; i++) tone(4200 + r() * 300, 0.04, "square", 0.0016, i * 0.07, undefined, out);
      break;
    case "bark":
      tone(330, 0.16, "sawtooth", 0.006, 0, 250, out);
      tone(320, 0.16, "sawtooth", 0.005, 0.3, 240, out);
      break;
    case "creak":
      tone(85 + r() * 30, 0.9, "sawtooth", 0.006, 0, 65, out);
      break;
  }
}

/** Synthesized ambience from the habitat's recipe in data/audio.ts, used until real loops are added. */
function synthAmbient(biome: BiomeId): { stop(): void } | null {
  const ac = getCtx();
  if (!ac) return null;
  const recipe = AMBIENT_SYNTH[biome];
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, ac.currentTime);
  master.gain.linearRampToValueAtTime(1, ac.currentTime + 2.5);
  master.connect(ac.destination);
  const sources: AudioScheduledSourceNode[] = [];

  // Noise bed (water or wind), optionally swelling slowly like waves.
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer(ac);
  noise.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = recipe.bed.cutoff;
  const ng = ac.createGain();
  ng.gain.value = recipe.bed.gain;
  noise.connect(lp).connect(ng).connect(master);
  noise.start();
  sources.push(noise);
  if (recipe.bed.swell) {
    const lfo = ac.createOscillator();
    lfo.frequency.value = 1 / recipe.bed.swell;
    const depth = ac.createGain();
    depth.gain.value = recipe.bed.gain * 0.6;
    lfo.connect(depth).connect(ng.gain);
    lfo.start();
    sources.push(lfo);
  }

  for (const f of recipe.hum ?? []) {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = 0.018;
    o.connect(g).connect(master);
    o.start();
    sources.push(o);
  }

  const tick = () => {
    if (!enabled) return;
    for (const e of recipe.events) if (Math.random() < e.chance) ambientEvent(e.kind, master);
  };
  const iv = window.setInterval(tick, recipe.tickMs);

  return {
    stop() {
      window.clearInterval(iv);
      fadeOut(ac, master, sources);
    },
  };
}

function fadeOut(ac: AudioContext, master: GainNode, sources: AudioScheduledSourceNode[]) {
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
}

// ───────────── Rain (Amazon showers) ─────────────

let rainEl: HTMLAudioElement | null = null;
let rainSynth: { stop(): void } | null = null;

/** Soft rain on the water: a hissy noise layer with the odd heavier drop. */
export function setRainSound(on: boolean) {
  if (!on || !enabled) {
    rainEl?.pause();
    rainEl = null;
    rainSynth?.stop();
    rainSynth = null;
    return;
  }
  if (rainEl || rainSynth) return;
  if (RAIN_LOOP) {
    rainEl = new Audio(RAIN_LOOP);
    rainEl.loop = true;
    rainEl.volume = 0.3;
    rainEl.play().catch(() => {});
    return;
  }
  const ac = getCtx();
  if (!ac) return;
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, ac.currentTime);
  master.gain.linearRampToValueAtTime(1, ac.currentTime + 3);
  master.connect(ac.destination);
  const noise = ac.createBufferSource();
  // White-ish noise for the hiss.
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noise.buffer = buf;
  noise.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2600;
  bp.Q.value = 0.6;
  const g = ac.createGain();
  g.gain.value = 0.018;
  noise.connect(bp).connect(g).connect(master);
  noise.start();
  const iv = window.setInterval(() => {
    if (enabled && Math.random() < 0.6) tone(900 + Math.random() * 900, 0.05, "sine", 0.006, Math.random() * 0.3, 500, master);
  }, 300);
  rainSynth = {
    stop() {
      window.clearInterval(iv);
      fadeOut(ac, master, [noise]);
    },
  };
}
