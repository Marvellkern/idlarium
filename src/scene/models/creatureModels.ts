// Procedural low poly creatures. Each model is authored facing +z (nose) with
// the tail toward −z, roughly 1 unit long, then scaled by `length` in the scene.

import * as THREE from "three";
import { SPECIES_BY_ID } from "../../data/creatures";
import { SwimMode } from "../swimShader";
import { cone, cyl, fin, glow, hashStr, ico, jitter, lathe, merge, mix, paint, sphere, tf, tube, type V3 } from "./geo";

export interface ModelDef {
  geometry: THREE.BufferGeometry;
  /** World length of the creature. */
  length: number;
  swim: { amp: number; freq: number; mode: number };
  emissive?: { color: string; intensity: number };
  /** Idle color shifting (octopus). */
  colorShift?: boolean;
}

type Built = Omit<ModelDef, "length">;

const EYE = "#151515";
const speckle = (f: number, pct: number, salt = 0) => ((f * 2654435761 + salt * 97) >>> 0) % 100 < pct;

// ───────────────────────── Fish ─────────────────────────

type TailKind = "fork" | "fan" | "round" | "lunate" | "shark";
type DorsalKind = "small" | "tall" | "long" | "sail" | "none";
type FinPart = "tail" | "dorsal" | "anal" | "pectoral";

const TAILS: Record<TailKind, [number, number][]> = {
  fork: [[0.03, 0.035], [-0.16, 0.17], [-0.2, 0.15], [-0.11, 0], [-0.2, -0.15], [-0.16, -0.17], [0.03, -0.035]],
  fan: [[0.03, 0.03], [-0.12, 0.16], [-0.28, 0.2], [-0.34, 0.08], [-0.35, -0.02], [-0.3, -0.14], [-0.14, -0.16], [0.03, -0.03]],
  round: [[0.03, 0.04], [-0.08, 0.11], [-0.15, 0.08], [-0.17, 0], [-0.15, -0.08], [-0.08, -0.11], [0.03, -0.04]],
  lunate: [[0.03, 0.03], [-0.08, 0.12], [-0.15, 0.2], [-0.1, 0.06], [-0.08, 0], [-0.1, -0.06], [-0.15, -0.2], [-0.08, -0.12], [0.03, -0.03]],
  shark: [[0.04, 0.035], [-0.12, 0.16], [-0.24, 0.3], [-0.16, 0.06], [-0.1, -0.02], [-0.15, -0.15], [-0.04, -0.06], [0.04, -0.035]],
};

const DORSALS: Record<Exclude<DorsalKind, "none">, [number, number][]> = {
  small: [[0.07, 0], [0.0, 0.09], [-0.08, 0.07], [-0.1, 0]],
  tall: [[0.1, 0], [0.0, 0.2], [-0.05, 0.19], [-0.06, 0]],
  long: [[0.06, 0], [-0.06, 0.12], [-0.26, 0.16], [-0.3, 0.02], [-0.3, 0]],
  sail: [[0.12, 0], [0.08, 0.1], [-0.12, 0.13], [-0.18, 0]],
};

const ANALS = {
  small: [[0.05, 0], [-0.02, -0.07], [-0.08, -0.05], [-0.08, 0]] as [number, number][],
  long: [[0.08, 0], [-0.05, -0.14], [-0.3, -0.2], [-0.32, 0]] as [number, number][],
};

const PECTORAL: [number, number][] = [[0.03, 0], [-0.01, 0.08], [-0.07, 0.09], [-0.06, 0]];

interface FishOpts {
  colors: string[];
  h?: number;
  w?: number;
  tailZ?: number;
  noseZ?: number;
  profile?: number[];
  belly?: string;
  tail?: TailKind;
  tailSize?: number;
  tailColor?: string;
  dorsal?: DorsalKind;
  dorsalZ?: number;
  dorsalSize?: number;
  dorsalColor?: string;
  anal?: "small" | "long" | "none";
  analZ?: number;
  analColor?: string;
  pectoral?: number;
  pectoralColor?: string;
  eye?: number;
  eyeTop?: boolean;
  pattern?: (c: THREE.Vector3, f: number) => string | null;
  finPaint?: (c: THREE.Vector3, part: FinPart, base: string) => string;
  radial?: number;
}

function scaleShape(pts: [number, number][], s: number, dz: number, dy: number): [number, number][] {
  return pts.map(([z, y]) => [z * s + dz, y * s + dy]);
}

function fish(o: FishOpts): THREE.BufferGeometry[] {
  const [c0] = o.colors;
  const h = o.h ?? 0.14;
  const w = o.w ?? 0.07;
  const tailZ = o.tailZ ?? -0.28;
  const noseZ = o.noseZ ?? 0.48;
  const prof = o.profile ?? [0.22, 0.32, 0.55, 0.8, 0.96, 1.0, 0.92, 0.65, 0.0];
  const belly = o.belly ?? mix(c0, "#ffffff", 0.45);
  const n = prof.length;
  const zAt = (i: number) => tailZ + ((noseZ - tailZ) * i) / (n - 1);
  const rAt = (z: number) => {
    const t = Math.min(n - 1, Math.max(0, ((z - tailZ) / (noseZ - tailZ)) * (n - 1)));
    const i = Math.floor(t);
    const f = t - i;
    return h * (prof[i] * (1 - f) + (prof[Math.min(n - 1, i + 1)] ?? 0) * f);
  };

  const parts: THREE.BufferGeometry[] = [];
  const body = lathe(
    prof.map((p, i) => [p * h, zAt(i)]),
    o.radial ?? 7,
  );
  body.scale(w / h, 1, 1);
  parts.push(paint(body, (c, f) => o.pattern?.(c, f) ?? (c.y < -h * 0.3 ? belly : c0)));

  const fp = (part: FinPart, base: string) =>
    o.finPaint ? (c: THREE.Vector3) => o.finPaint!(c, part, base) : base;

  // Tail
  const ts = o.tailSize ?? 1;
  parts.push(paint(fin(scaleShape(TAILS[o.tail ?? "fork"], ts, tailZ + 0.02, 0)), fp("tail", o.tailColor ?? c0)));

  // Dorsal
  if ((o.dorsal ?? "small") !== "none") {
    const dz = o.dorsalZ ?? (noseZ + tailZ) / 2 + 0.02;
    const top = rAt(dz) * 0.82;
    parts.push(
      paint(
        fin(scaleShape(DORSALS[(o.dorsal ?? "small") as Exclude<DorsalKind, "none">], o.dorsalSize ?? 1, dz, top)),
        fp("dorsal", o.dorsalColor ?? c0),
      ),
    );
  }

  // Anal
  const anal = o.anal ?? "small";
  if (anal !== "none") {
    const az = o.analZ ?? tailZ + 0.16;
    parts.push(paint(fin(scaleShape(ANALS[anal], 1, az, -rAt(az) * 0.8)), fp("anal", o.analColor ?? c0)));
  }

  // Pectorals
  const ps = o.pectoral ?? 0.7;
  if (ps > 0) {
    const pz = noseZ - (noseZ - tailZ) * 0.3;
    const pr = rAt(pz);
    for (const s of [-1, 1]) {
      const g = fin(scaleShape(PECTORAL, ps, 0, 0));
      g.rotateZ(-s * (Math.PI / 2 + 0.5));
      g.translate(s * (w / h) * pr * 0.85, -pr * 0.35, pz);
      parts.push(paint(g, fp("pectoral", o.pectoralColor ?? o.tailColor ?? c0)));
    }
  }

  // Eyes
  const er = o.eye ?? 0.03;
  const ez = noseZ - (noseZ - tailZ) * 0.14;
  const rr = rAt(ez);
  for (const s of [-1, 1]) {
    const p: V3 = o.eyeTop ? [s * er * 1.1, rr * 0.95, ez] : [s * (w / h) * rr * 0.82, rr * 0.25, ez];
    parts.push(paint(tf(ico(er, 0), { p }), EYE));
  }
  return parts;
}

// ───────────────────────── Species builders ─────────────────────────

function guppy(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.13,
    w: 0.065,
    tailZ: -0.16,
    noseZ: 0.45,
    tail: "fan",
    tailSize: 1.05,
    tailColor: c[2],
    dorsal: "small",
    dorsalColor: c[2],
    pectoral: 0.5,
    eye: 0.034,
    pattern: (p, f) => (p.z < 0.05 && p.y > -0.03 && speckle(f, 35) ? mix(c[0], c[2], 0.6) : null),
  });
  return { geometry: merge(parts), swim: { amp: 0.09, freq: 6, mode: SwimMode.FISH } };
}

function neonTetra(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.11,
    w: 0.05,
    tailZ: -0.3,
    noseZ: 0.48,
    tail: "fork",
    tailSize: 0.8,
    belly: mix(c[0], "#ffffff", 0.4),
    pectoral: 0.4,
    eye: 0.04,
    pattern: (p) => {
      if (Math.abs(p.y - 0.02) < 0.024 && p.z > -0.32) return c[1];
      if (p.y < 0.0 && p.z < 0.1) return c[2];
      return null;
    },
  });
  return { geometry: merge(parts), swim: { amp: 0.08, freq: 6, mode: SwimMode.FISH } };
}

function betta(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.14,
    w: 0.07,
    tailZ: -0.12,
    noseZ: 0.42,
    tail: "fan",
    tailSize: 1.5,
    tailColor: mix(c[0], c[1], 0.4),
    dorsal: "long",
    dorsalColor: mix(c[0], c[2], 0.35),
    anal: "long",
    analZ: 0.08,
    analColor: mix(c[0], c[1], 0.5),
    pectoral: 0.6,
    pectoralColor: c[2],
    eye: 0.032,
  });
  return { geometry: merge(parts), swim: { amp: 0.12, freq: 5, mode: SwimMode.FISH } };
}

function catfish(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.11,
    w: 0.13,
    profile: [0.25, 0.35, 0.55, 0.75, 0.9, 1, 1, 0.85, 0.45],
    tailZ: -0.32,
    noseZ: 0.5,
    tail: "fork",
    tailSize: 0.9,
    belly: c[1],
    pectoral: 0.9,
    eye: 0.022,
    pattern: (p, f) => (p.y > 0.02 && speckle(f, 14) ? c[2] : null),
  });
  // Barbels ("whiskers")
  const barbels: [number, number, number, number][] = [
    [0.06, -0.01, 0.7, 0.24],
    [-0.06, -0.01, -0.7, 0.24],
    [0.03, -0.05, 0.35, 0.13],
    [-0.03, -0.05, -0.35, 0.13],
  ];
  for (const [x, y, yaw, len] of barbels) {
    const g = cyl(0.007, 0.003, len, 3);
    g.translate(0, len / 2, 0);
    g.rotateX(Math.PI / 2);
    g.rotateY(yaw);
    g.rotateX(0.35);
    g.translate(x, y, 0.47);
    parts.push(paint(g, c[2]));
  }
  return { geometry: merge(parts), swim: { amp: 0.07, freq: 5, mode: SwimMode.FISH } };
}

function mudskipper(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.1,
    w: 0.09,
    profile: [0.3, 0.42, 0.6, 0.8, 0.95, 1, 1, 0.9, 0.4],
    tailZ: -0.28,
    noseZ: 0.48,
    tail: "round",
    tailSize: 0.9,
    dorsal: "sail",
    dorsalColor: mix(c[0], c[2], 0.35),
    belly: c[1],
    pectoral: 1.4,
    eye: 0.04,
    eyeTop: true,
    pattern: (p, f) => (p.y > 0 && speckle(f, 18) ? c[2] : null),
  });
  return { geometry: merge(parts), swim: { amp: 0.06, freq: 5, mode: SwimMode.FISH } };
}

function alligatorGar(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.075,
    w: 0.075,
    profile: [0.45, 0.6, 0.8, 0.95, 1, 1, 1, 0.95, 0.8, 0.55],
    tailZ: -0.42,
    noseZ: 0.3,
    tail: "round",
    tailSize: 0.75,
    dorsal: "small",
    dorsalZ: -0.3,
    dorsalSize: 0.7,
    anal: "small",
    analZ: -0.28,
    belly: c[1],
    pectoral: 0.6,
    eye: 0.018,
    pattern: (p, f) => (p.y > -0.01 && speckle(f, 16) ? c[2] : null),
  });
  const snout = cone(0.042, 0.28, 5);
  snout.rotateX(Math.PI / 2);
  snout.scale(1.3, 0.55, 1);
  snout.translate(0, -0.005, 0.3 + 0.13);
  parts.push(paint(snout, (p) => (p.y < -0.008 ? c[1] : c[0])));
  return { geometry: merge(parts), swim: { amp: 0.07, freq: 7, mode: SwimMode.FISH } };
}

function clownfish(c: string[]): Built {
  const bands = [0.28, 0.03, -0.24];
  const parts = fish({
    colors: c,
    h: 0.16,
    w: 0.075,
    tailZ: -0.28,
    noseZ: 0.45,
    tail: "round",
    belly: c[0],
    dorsal: "small",
    dorsalSize: 1.3,
    pectoral: 0.7,
    eye: 0.03,
    pattern: (p) => (bands.some((b) => Math.abs(p.z - b) < 0.038) ? c[1] : null),
    finPaint: (p, part, base) => (part === "tail" && p.z < -0.42 ? c[2] : base),
  });
  return { geometry: merge(parts), swim: { amp: 0.08, freq: 6, mode: SwimMode.FISH } };
}

function blueTang(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.22,
    w: 0.05,
    profile: [0.3, 0.45, 0.7, 0.88, 0.98, 1, 0.95, 0.75, 0.3],
    tailZ: -0.3,
    noseZ: 0.42,
    tail: "lunate",
    tailColor: c[2],
    dorsal: "long",
    dorsalZ: 0.18,
    dorsalColor: c[1],
    anal: "long",
    analZ: 0.08,
    analColor: c[1],
    pectoral: 0.7,
    pectoralColor: c[2],
    belly: c[0],
    eye: 0.03,
    pattern: (p) => {
      if (p.z < 0.28 && p.z > -0.32) {
        const arc = 0.07 - 0.9 * (p.z - 0.02) * (p.z - 0.02);
        if (Math.abs(p.y - arc) < 0.035) return c[1];
        if (p.y > 0.17) return c[1];
      }
      return null;
    },
  });
  return { geometry: merge(parts), swim: { amp: 0.07, freq: 5, mode: SwimMode.FISH } };
}

function damselfish(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.15,
    w: 0.06,
    tailZ: -0.25,
    noseZ: 0.45,
    tail: "fork",
    tailColor: c[2],
    belly: c[1],
    analColor: c[2],
    pectoral: 0.6,
    eye: 0.032,
  });
  return { geometry: merge(parts), swim: { amp: 0.09, freq: 6, mode: SwimMode.FISH } };
}

function reefShark(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.1,
    w: 0.09,
    profile: [0.2, 0.3, 0.5, 0.75, 0.92, 1, 0.95, 0.75, 0.35, 0.02],
    tailZ: -0.32,
    noseZ: 0.55,
    tail: "shark",
    tailSize: 1.1,
    dorsal: "tall",
    dorsalZ: 0.1,
    anal: "small",
    pectoral: 2.0,
    belly: c[1],
    eye: 0.018,
    finPaint: (p, part, base) => {
      if (part === "dorsal" && p.y > 0.22) return c[2];
      if (part === "tail" && (p.y > 0.24 || p.y < -0.12)) return c[2];
      if (part === "pectoral" && Math.abs(p.x) > 0.2) return c[2];
      return base;
    },
  });
  return { geometry: merge(parts), swim: { amp: 0.06, freq: 4, mode: SwimMode.FISH } };
}

function pufferfish(c: string[]): Built {
  const parts: THREE.BufferGeometry[] = [];
  const body = tf(ico(0.27, 1), { s: [1, 0.92, 1.1] });
  parts.push(paint(body.clone(), (p, f) => (p.y < -0.08 ? c[1] : speckle(f, 22) ? c[2] : c[0])));
  // Spikes from the unique body vertices
  const pos = body.attributes.position as THREE.BufferAttribute;
  const seen = new Set<string>();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const key = v.toArray().map((x) => x.toFixed(3)).join();
    if (seen.has(key) || v.z > 0.25) continue;
    seen.add(key);
    const nrm = v.clone().normalize();
    const g = cone(0.016, 0.06, 3);
    g.translate(0, 0.03, 0);
    g.applyQuaternion(q.setFromUnitVectors(up, nrm));
    g.translate(v.x, v.y, v.z);
    parts.push(paint(g, nrm.y < -0.3 ? c[1] : mix(c[0], c[2], 0.3)));
  }
  body.dispose();
  parts.push(paint(fin(scaleShape(TAILS.round, 0.8, -0.28, 0)), c[0]));
  parts.push(paint(fin(scaleShape(DORSALS.small, 0.7, -0.17, 0.18)), c[0]));
  parts.push(paint(fin(scaleShape(ANALS.small, 0.8, -0.15, -0.17)), c[0]));
  for (const s of [-1, 1]) {
    const g = fin(scaleShape(PECTORAL, 0.6, 0, 0));
    g.rotateZ(-s * (Math.PI / 2 - 0.2));
    g.translate(s * 0.25, -0.02, 0.08);
    parts.push(paint(g, c[0]));
    parts.push(paint(tf(ico(0.045, 0), { p: [s * 0.15, 0.08, 0.19] }), EYE));
  }
  return { geometry: merge(parts), swim: { amp: 0.03, freq: 5, mode: SwimMode.FISH } };
}

function frog(c: string[]): Built {
  const [c0, c1, c2] = c;
  const skin = (p: THREE.Vector3, f: number) => (p.y < -0.06 ? c1 : speckle(f, 15, 3) ? c2 : c0);
  const parts: THREE.BufferGeometry[] = [
    paint(tf(sphere(0.5, 8, 6), { s: [0.3, 0.2, 0.42], p: [0, 0, -0.04] }), skin),
    paint(tf(sphere(0.5, 8, 5), { s: [0.28, 0.16, 0.26], p: [0, 0.04, 0.2] }), skin),
  ];
  for (const s of [-1, 1]) {
    parts.push(paint(tf(sphere(0.065, 6, 4), { p: [s * 0.1, 0.13, 0.24] }), c0));
    parts.push(paint(tf(ico(0.04, 0), { p: [s * 0.12, 0.155, 0.27] }), EYE));
    parts.push(paint(tf(sphere(0.5, 6, 4), { s: [0.11, 0.08, 0.26], r: [0, s * 0.5, 0], p: [s * 0.2, -0.05, -0.17] }), c0));
    parts.push(paint(tf(sphere(0.5, 5, 4), { s: [0.07, 0.04, 0.28], r: [0, -s * 0.25, 0], p: [s * 0.25, -0.1, -0.24] }), c2));
    parts.push(paint(tf(cyl(0.025, 0.02, 0.16, 4), { r: [0.4, 0, s * 0.3], p: [s * 0.14, -0.12, 0.17] }), c0));
  }
  return { geometry: merge(parts), swim: { amp: 0.02, freq: 4, mode: SwimMode.FISH } };
}

function turtle(c: string[], sea: boolean): Built {
  const [shell, skin, rim] = c;
  const parts: THREE.BufferGeometry[] = [];
  const dome = tf(new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), { s: [0.66, 0.34, 0.84] });
  parts.push(paint(dome, (p, f) => (p.y < 0.035 ? rim : f % 3 === 0 ? mix(shell, skin, 0.25) : shell)));
  parts.push(paint(tf(cyl(0.5, 0.5, 0.04, 8), { s: [0.62, 1, 0.8], p: [0, -0.01, 0] }), mix(skin, "#ffffff", 0.3)));
  // Painted turtles: dark skin with yellow stripes. Sea turtles: plain tan skin.
  const headSkin = (_p: THREE.Vector3, f: number) => (!sea && speckle(f, 30) ? skin : mix(skin, shell, sea ? 0.15 : 0.6));
  parts.push(paint(tf(sphere(0.5, 6, 5), { s: [0.15, 0.12, 0.2], p: [0, 0.02, 0.48] }), headSkin));
  for (const s of [-1, 1]) {
    parts.push(paint(tf(ico(0.022, 0), { p: [s * 0.055, 0.05, 0.55] }), EYE));
    if (sea) {
      parts.push(paint(tf(sphere(0.5, 6, 4), { s: [0.44, 0.04, 0.13], r: [0, s * -0.5, s * -0.15], p: [s * 0.4, -0.02, 0.2] }), skin));
      parts.push(paint(tf(sphere(0.5, 6, 4), { s: [0.2, 0.03, 0.1], r: [0, s * 0.6, 0], p: [s * 0.24, -0.02, -0.36] }), skin));
    } else {
      parts.push(paint(tf(sphere(0.5, 5, 4), { s: [0.13, 0.07, 0.1], p: [s * 0.29, -0.05, 0.24] }), headSkin));
      parts.push(paint(tf(sphere(0.5, 5, 4), { s: [0.13, 0.07, 0.1], p: [s * 0.27, -0.05, -0.28] }), headSkin));
    }
  }
  parts.push(paint(tf(cone(0.04, 0.12, 4), { r: [-Math.PI / 2, 0, 0], p: [0, -0.01, -0.46] }), skin));
  return { geometry: merge(parts), swim: { amp: 0.012, freq: 3, mode: SwimMode.FISH } };
}

function eel(c: string[], moray: boolean): Built {
  const [c0, c1, c2] = c;
  const R = moray ? 0.06 : 0.05;
  const N = 16;
  const prof: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1); // tail → nose
    let r = 0.12 + 0.88 * Math.min(1, t / 0.45);
    if (t > 0.86) r *= 1 - ((t - 0.86) / 0.14) * (moray ? 0.55 : 0.65);
    prof.push([r * R, -0.5 + t]);
  }
  const body = lathe(prof, 6);
  body.scale(moray ? 0.85 : 1, moray ? 1.25 : 1, 1);
  const parts: THREE.BufferGeometry[] = [
    paint(body, (p, f) => {
      if (moray) return speckle(f, 30) ? c2 : p.y < -R * 0.5 ? c1 : c0;
      return p.y < -R * 0.3 ? c1 : c0;
    }),
  ];
  if (moray) {
    parts.push(paint(fin([[0.3, 0], [0.26, 0.035], [-0.46, 0.03], [-0.5, 0]]), (p) => (p.z < -0.3 ? c2 : c0)));
    parts[parts.length - 1].translate(0, R * 1.1, 0);
    const an = fin([[0.0, 0], [-0.04, -0.03], [-0.46, -0.025], [-0.5, 0]]);
    an.translate(0, -R * 1.1, 0);
    parts.push(paint(an, c0));
  } else {
    const an = fin([[0.25, 0], [0.2, -0.05], [-0.45, -0.04], [-0.5, 0]]);
    an.translate(0, -R * 0.8, 0);
    parts.push(paint(an, mix(c1, c0, 0.4)));
  }
  for (const s of [-1, 1]) parts.push(paint(tf(ico(moray ? 0.014 : 0.01, 0), { p: [s * R * 0.62, R * 0.4, 0.42] }), moray ? "#e8e070" : EYE));
  return {
    geometry: merge(parts),
    swim: { amp: 0.11, freq: 10, mode: SwimMode.FISH },
    emissive: moray ? undefined : { color: c2, intensity: 0.12 },
  };
}

function axolotl(c: string[]): Built {
  const [c0, c1, c2] = c;
  const body = lathe(
    [[0.004, -0.5], [0.03, -0.35], [0.05, -0.15], [0.07, 0.0], [0.075, 0.12], [0.06, 0.22], [0.1, 0.3], [0.11, 0.38], [0.09, 0.46], [0.0, 0.5]],
    7,
  );
  body.scale(1.15, 0.85, 1);
  const parts: THREE.BufferGeometry[] = [paint(body, (p) => (p.y < -0.03 ? c1 : c0))];
  parts.push(
    paint(fin([[0.0, 0.035], [-0.12, 0.09], [-0.45, 0.05], [-0.52, 0], [-0.4, -0.04], [-0.12, -0.06], [0, -0.035]]), mix(c0, "#ffffff", 0.3)),
  );
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const g = cyl(0.014, 0.006, 0.13 - i * 0.015, 3);
      g.translate(0, 0.065, 0);
      g.rotateX(-0.6);
      g.rotateZ(-s * (0.5 + i * 0.45));
      g.translate(s * 0.085, 0.02 + i * 0.02, 0.29);
      parts.push(paint(g, c2));
    }
    for (const z of [0.2, -0.08]) {
      const g = cyl(0.016, 0.012, 0.11, 4);
      g.translate(0, -0.055, 0);
      g.rotateZ(s * 0.9);
      g.translate(s * 0.07, -0.02, z);
      parts.push(paint(g, c0));
    }
    parts.push(paint(tf(ico(0.016, 0), { p: [s * 0.09, 0.045, 0.4] }), EYE));
  }
  return { geometry: merge(parts), swim: { amp: 0.08, freq: 5, mode: SwimMode.FISH } };
}

function seahorse(c: string[]): Built {
  const [c0, c1, c2] = c;
  const pts: V3[] = [
    [0, 0.28, 0.0],
    [0, 0.18, 0.04],
    [0, 0.08, 0.06],
    [0, -0.02, 0.05],
    [0, -0.12, 0.02],
    [0, -0.2, -0.02],
    [0, -0.28, -0.04],
    [0, -0.33, 0.0],
    [0, -0.32, 0.05],
    [0, -0.27, 0.07],
    [0, -0.24, 0.04],
  ];
  const trunk = tube(pts, (t) => (t < 0.35 ? 0.085 - t * 0.04 : Math.max(0.01, 0.07 - (t - 0.35) * 0.1)), 6);
  const parts: THREE.BufferGeometry[] = [
    paint(trunk, (p) => (Math.floor((p.y + 1) * 28) % 2 ? mix(c0, c1, 0.4) : c0)),
    paint(tf(sphere(0.5, 6, 5), { s: [0.1, 0.1, 0.13], r: [0.3, 0, 0], p: [0, 0.34, 0.03] }), c0),
    paint(tf(cyl(0.02, 0.03, 0.15, 5), { r: [Math.PI / 2 + 0.25, 0, 0], p: [0, 0.31, 0.14] }), mix(c0, c1, 0.3)),
    paint(tf(cone(0.03, 0.07, 4), { p: [0, 0.42, 0.0] }), c2),
    paint(tf(fin([[0.0, 0.06], [-0.07, 0.04], [-0.07, -0.04], [0, -0.06]]), { p: [0, 0.05, -0.04] }), mix(c2, "#ffffff", 0.3)),
  ];
  for (const s of [-1, 1]) parts.push(paint(tf(ico(0.018, 0), { p: [s * 0.045, 0.36, 0.06] }), EYE));
  return { geometry: merge(parts), swim: { amp: 0.01, freq: 4, mode: SwimMode.FISH } };
}

function octopus(c: string[]): Built {
  const [c0, c1, c2] = c;
  const skin = (_p: THREE.Vector3, f: number) => (speckle(f, 18) ? c2 : c0);
  const parts: THREE.BufferGeometry[] = [
    paint(tf(sphere(0.5, 8, 6), { s: [0.34, 0.42, 0.4], r: [-0.5, 0, 0], p: [0, 0.2, -0.1] }), skin),
    paint(tf(sphere(0.5, 8, 5), { s: [0.3, 0.2, 0.3], p: [0, 0.0, 0.04] }), skin),
  ];
  for (const s of [-1, 1]) {
    parts.push(paint(tf(sphere(0.05, 5, 4), { p: [s * 0.12, 0.06, 0.1] }), c1));
    parts.push(paint(tf(ico(0.028, 0), { p: [s * 0.14, 0.065, 0.13] }), EYE));
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const b: V3 = [dx * 0.09, -0.06, dz * 0.09 + 0.04];
    const arm = tube(
      [
        b,
        [b[0] + dx * 0.14, -0.15, b[2] + dz * 0.14],
        [b[0] + dx * 0.24, -0.32, b[2] + dz * 0.24],
        [b[0] + dx * 0.3, -0.46, b[2] + dz * 0.3],
        [b[0] + dx * 0.38, -0.52, b[2] + dz * 0.38],
      ],
      (t) => 0.042 * (1 - t) + 0.006,
      5,
    );
    parts.push(paint(arm, (_p, f) => (f % 5 === 0 ? c1 : c0)));
  }
  return { geometry: merge(parts), swim: { amp: 0.28, freq: 5, mode: SwimMode.TENTACLE }, colorShift: true };
}


// ───────────────────────── Open Ocean ─────────────────────────

/** Horizontal tail flukes for whales and dolphins (span along x). */
function flukes(z: number, span: number, color: THREE.ColorRepresentation | ((c: THREE.Vector3) => THREE.ColorRepresentation), scalloped = false) {
  const pts: [number, number][] = scalloped
    ? [[0.03, 0], [-0.05, 0.5], [-0.12, 1], [-0.1, 0.75], [-0.13, 0.5], [-0.1, 0.25], [-0.07, 0], [-0.1, -0.25], [-0.13, -0.5], [-0.1, -0.75], [-0.12, -1], [-0.05, -0.5]]
    : [[0.03, 0], [-0.05, 0.6], [-0.11, 1], [-0.09, 0.6], [-0.07, 0], [-0.09, -0.6], [-0.11, -1], [-0.05, -0.6]];
  const g = fin(pts.map(([zz, y]) => [zz, y * span] as [number, number]), 0.02);
  g.rotateZ(Math.PI / 2);
  g.translate(0, 0, z);
  return paint(g, typeof color === "function" ? (c) => color(c) : color);
}

function sardine(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.11,
    w: 0.06,
    tailZ: -0.3,
    noseZ: 0.48,
    tail: "fork",
    tailSize: 0.9,
    belly: c[1],
    pectoral: 0.4,
    eye: 0.032,
    pattern: (p, f) => (p.y > 0.035 ? c[2] : Math.abs(p.y - 0.012) < 0.012 && speckle(f, 30) ? c[2] : null),
  });
  return { geometry: merge(parts), swim: { amp: 0.09, freq: 6, mode: SwimMode.FISH } };
}

function tuna(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.15,
    w: 0.12,
    profile: [0.18, 0.28, 0.55, 0.8, 0.95, 1, 0.95, 0.75, 0.35],
    tailZ: -0.34,
    noseZ: 0.48,
    tail: "lunate",
    tailSize: 1.2,
    tailColor: c[0],
    dorsal: "small",
    dorsalZ: 0.14,
    belly: c[1],
    pectoral: 0.9,
    eye: 0.03,
    pattern: (p) => (p.y > 0.05 ? c[0] : p.y > -0.02 && Math.abs(p.y - 0.03) < 0.01 ? c[2] : null),
  });
  // Long yellow sickle fins (second dorsal and anal) and the little finlets near the tail.
  parts.push(paint(fin([[0.06, 0], [-0.04, 0.2], [-0.07, 0.19], [-0.04, 0]]).translate(0, 0.1, -0.02), c[2]));
  parts.push(paint(fin([[0.06, 0], [-0.04, -0.2], [-0.07, -0.19], [-0.04, 0]]).translate(0, -0.1, -0.04), c[2]));
  for (let i = 0; i < 5; i++) {
    const z = -0.12 - i * 0.045;
    const r = 0.07 - i * 0.008;
    parts.push(paint(fin([[0.015, 0], [-0.005, 0.03], [-0.02, 0]]).translate(0, r, z), c[2]));
    parts.push(paint(fin([[0.015, 0], [-0.005, -0.03], [-0.02, 0]]).translate(0, -r, z), c[2]));
  }
  return { geometry: merge(parts), swim: { amp: 0.06, freq: 4, mode: SwimMode.FISH } };
}

function mahiMahi(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.14,
    w: 0.06,
    profile: [0.25, 0.4, 0.6, 0.8, 0.94, 1, 1, 0.98, 0.7],
    tailZ: -0.32,
    noseZ: 0.42,
    tail: "fork",
    tailSize: 1.1,
    tailColor: c[1],
    dorsal: "none",
    anal: "long",
    analZ: 0.05,
    analColor: c[1],
    belly: c[1],
    pectoral: 0.6,
    pectoralColor: c[2],
    eye: 0.028,
    pattern: (p, f) => (p.y > 0.03 ? (speckle(f, 15) ? c[2] : c[0]) : speckle(f, 12) ? c[2] : null),
  });
  // Dorsal fin running from the blunt forehead almost to the tail.
  parts.push(paint(fin([[0.36, 0], [0.3, 0.07], [-0.1, 0.08], [-0.28, 0.04], [-0.3, 0]]).translate(0, 0.12, 0), c[2]));
  return { geometry: merge(parts), swim: { amp: 0.08, freq: 5, mode: SwimMode.FISH } };
}

function sailfish(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.075,
    w: 0.06,
    profile: [0.3, 0.45, 0.7, 0.9, 1, 1, 0.95, 0.75, 0.4],
    tailZ: -0.4,
    noseZ: 0.26,
    tail: "lunate",
    tailSize: 1.1,
    dorsal: "none",
    belly: c[1],
    pectoral: 0.6,
    eye: 0.02,
    pattern: (p) => (p.y > 0.025 ? c[0] : null),
  });
  const bill = cone(0.018, 0.3, 4);
  bill.rotateX(Math.PI / 2);
  bill.translate(0, 0.005, 0.26 + 0.15);
  parts.push(paint(bill, c[0]));
  // The huge "sail".
  parts.push(
    paint(fin([[0.22, 0], [0.18, 0.26], [0.0, 0.3], [-0.15, 0.22], [-0.22, 0.04], [-0.24, 0]]).translate(0, 0.06, 0), (_p) => c[2]),
  );
  return { geometry: merge(parts), swim: { amp: 0.06, freq: 4, mode: SwimMode.FISH } };
}

function dolphin(c: string[]): Built {
  const body = lathe(
    [[0.0, -0.5], [0.035, -0.44], [0.06, -0.32], [0.1, -0.14], [0.125, 0.04], [0.12, 0.2], [0.1, 0.3], [0.075, 0.37], [0.035, 0.41], [0.025, 0.5]],
    8,
  );
  body.scale(0.88, 1, 1);
  const parts: THREE.BufferGeometry[] = [paint(body, (p) => (p.y < -0.035 ? c[1] : p.y > 0.06 ? c[2] : c[0]))];
  parts.push(paint(fin([[0.06, 0], [-0.01, 0.1], [-0.08, 0.13], [-0.05, 0.06], [-0.09, 0]]).translate(0, 0.1, -0.02), c[2]));
  for (const s of [-1, 1]) {
    const g = fin([[0.04, 0], [-0.02, 0.1], [-0.08, 0.11], [-0.04, 0]]);
    g.rotateZ(-s * (Math.PI / 2 + 0.6));
    g.translate(s * 0.08, -0.05, 0.2);
    parts.push(paint(g, c[0]));
    parts.push(paint(tf(ico(0.014, 0), { p: [s * 0.07, 0.02, 0.33] }), EYE));
  }
  parts.push(flukes(-0.47, 0.13, c[0]));
  return { geometry: merge(parts), swim: { amp: 0.06, freq: 4, mode: SwimMode.FLUKE } };
}

function mantaRay(c: string[]): Built {
  // Diamond-shaped wings in the x/z plane.
  const shape = new THREE.Shape(
    ([[0, 0.3], [0.08, 0.34], [0.12, 0.26], [0.5, 0.02], [0.56, -0.06], [0.16, -0.16], [0.03, -0.24], [-0.03, -0.24], [-0.16, -0.16], [-0.56, -0.06], [-0.5, 0.02], [-0.12, 0.26], [-0.08, 0.34]] as [number, number][]).map(
      ([x, z]) => new THREE.Vector2(x, z),
    ),
  );
  const wings = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false, curveSegments: 1 });
  wings.rotateX(Math.PI / 2);
  wings.translate(0, 0.018, 0);
  // Subdivide-ish look: jitter keeps it organic.
  const parts: THREE.BufferGeometry[] = [
    paint(wings, (p, f) => (p.y > 0 ? c[0] : speckle(f, 10) ? c[2] : c[1])),
    paint(tf(sphere(0.5, 8, 4), { s: [0.24, 0.07, 0.42], p: [0, 0.01, 0.02] }), (p) => (p.y > 0 ? c[0] : c[1])),
  ];
  const tail = cone(0.012, 0.32, 4);
  tail.rotateX(-Math.PI / 2);
  tail.translate(0, 0, -0.4);
  parts.push(paint(tail, c[0]));
  for (const s of [-1, 1]) parts.push(paint(tf(ico(0.016, 0), { p: [s * 0.1, 0.025, 0.26] }), EYE));
  return { geometry: merge(parts), swim: { amp: 0.16, freq: 2, mode: SwimMode.FLAP } };
}

function hammerhead(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.1,
    w: 0.09,
    profile: [0.2, 0.3, 0.5, 0.75, 0.92, 1, 0.92, 0.7, 0.45, 0.3],
    tailZ: -0.32,
    noseZ: 0.5,
    tail: "shark",
    tailSize: 1.15,
    dorsal: "tall",
    dorsalZ: 0.1,
    dorsalSize: 1.2,
    anal: "small",
    pectoral: 1.8,
    belly: c[1],
    eye: 0.001,
  });
  // The "hammer" (cephalofoil), with eyes at each end.
  parts.push(paint(tf(sphere(0.5, 10, 4), { s: [0.36, 0.035, 0.09], p: [0, 0.01, 0.5] }), (p) => (p.y < 0 ? c[1] : c[0])));
  for (const s of [-1, 1]) parts.push(paint(tf(ico(0.016, 0), { p: [s * 0.18, 0.012, 0.5] }), EYE));
  return { geometry: merge(parts), swim: { amp: 0.06, freq: 4, mode: SwimMode.FISH } };
}

function whaleShark(c: string[]): Built {
  const body = lathe([[0.0, -0.5], [0.04, -0.4], [0.07, -0.25], [0.11, -0.05], [0.13, 0.15], [0.13, 0.3], [0.115, 0.42], [0.09, 0.5]], 9);
  body.scale(1.15, 0.85, 1);
  const parts: THREE.BufferGeometry[] = [
    paint(body, (p, f) => {
      if (p.y < -0.04) return c[1];
      if (p.z > 0.47 && Math.abs(p.y) < 0.03) return "#1a2028"; // wide mouth
      return speckle(f, 22) ? c[2] : c[0];
    }),
  ];
  parts.push(paint(fin(scaleShape(DORSALS.tall, 0.7, -0.05, 0.1)), c[0]));
  parts.push(paint(fin(scaleShape(TAILS.shark, 1.3, -0.46, 0)), c[0]));
  for (const s of [-1, 1]) {
    const g = fin(scaleShape(PECTORAL, 2.2, 0, 0));
    g.rotateZ(-s * (Math.PI / 2 + 0.4));
    g.translate(s * 0.12, -0.05, 0.18);
    parts.push(paint(g, c[0]));
    parts.push(paint(tf(ico(0.01, 0), { p: [s * 0.13, 0.0, 0.43] }), EYE));
  }
  return { geometry: merge(parts), swim: { amp: 0.04, freq: 3, mode: SwimMode.FISH } };
}

function humpback(c: string[]): Built {
  const body = lathe([[0.0, -0.5], [0.03, -0.44], [0.06, -0.34], [0.1, -0.18], [0.13, 0.0], [0.13, 0.15], [0.11, 0.3], [0.08, 0.42], [0.035, 0.5]], 9);
  body.scale(1, 0.95, 1);
  const parts: THREE.BufferGeometry[] = [
    paint(body, (p) => {
      // Throat pleats: light stripes under the head.
      if (p.y < -0.04 && p.z > 0.05) return Math.floor((p.x + 1) * 40) % 2 ? c[1] : c[2];
      return p.y < -0.06 ? c[2] : c[0];
    }),
  ];
  // Knobbly tubercles on the head.
  for (let i = 0; i < 9; i++) parts.push(paint(tf(ico(0.012, 0), { p: [((i % 3) - 1) * 0.035, 0.06 + (i % 2) * 0.01, 0.3 + Math.floor(i / 3) * 0.05] }), c[0]));
  parts.push(paint(fin([[0.06, 0], [0.0, 0.035], [-0.04, 0.03], [-0.06, 0]]).translate(0, 0.11, -0.14), c[0]));
  // Very long pectoral fins (about a third of the body), white underneath.
  for (const s of [-1, 1]) {
    const g = fin([[0.04, 0], [0.0, 0.18], [-0.04, 0.34], [-0.07, 0.33], [-0.05, 0.16], [-0.04, 0]]);
    g.rotateZ(-s * (Math.PI / 2 + 0.7));
    g.translate(s * 0.1, -0.06, 0.2);
    parts.push(paint(g, (p) => (p.y < -0.12 ? c[1] : c[2])));
    parts.push(paint(tf(ico(0.01, 0), { p: [s * 0.11, -0.01, 0.34] }), EYE));
  }
  parts.push(flukes(-0.47, 0.17, (p) => (p.y < 0 ? c[1] : c[0]), true));
  return { geometry: merge(parts), swim: { amp: 0.03, freq: 3, mode: SwimMode.FLUKE } };
}

function blueWhale(c: string[]): Built {
  const body = lathe([[0.0, -0.5], [0.02, -0.45], [0.04, -0.35], [0.07, -0.15], [0.085, 0.05], [0.085, 0.2], [0.075, 0.35], [0.05, 0.46], [0.025, 0.5]], 9);
  body.scale(1.1, 0.9, 1);
  const parts: THREE.BufferGeometry[] = [paint(body, (p, f) => (p.y < -0.03 ? (speckle(f, 30) ? c[1] : c[2]) : speckle(f, 28) ? c[1] : c[0]))];
  parts.push(paint(fin([[0.02, 0], [-0.01, 0.025], [-0.03, 0.02], [-0.03, 0]]).translate(0, 0.06, -0.3), c[0]));
  for (const s of [-1, 1]) {
    const g = fin([[0.03, 0], [-0.01, 0.07], [-0.04, 0.08], [-0.03, 0]]);
    g.rotateZ(-s * (Math.PI / 2 + 0.6));
    g.translate(s * 0.07, -0.04, 0.22);
    parts.push(paint(g, c[0]));
    parts.push(paint(tf(ico(0.008, 0), { p: [s * 0.075, 0.0, 0.38] }), EYE));
  }
  parts.push(flukes(-0.48, 0.12, c[0]));
  return { geometry: merge(parts), swim: { amp: 0.025, freq: 3, mode: SwimMode.FLUKE } };
}

// ───────────────────────── Deep Sea ─────────────────────────

function lanternfish(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.12,
    w: 0.06,
    tailZ: -0.28,
    noseZ: 0.46,
    tail: "fork",
    belly: c[1],
    pectoral: 0.4,
    eye: 0.05,
  });
  // Rows of glowing photophores along the belly, and a lamp near the eye.
  for (let i = 0; i < 7; i++) {
    for (const s of [-1, 1]) parts.push(glow(paint(tf(ico(0.012, 0), { p: [s * 0.035, -0.045, 0.3 - i * 0.07] }), c[2]), 1));
  }
  for (const s of [-1, 1]) parts.push(glow(paint(tf(ico(0.016, 0), { p: [s * 0.04, 0.0, 0.42] }), c[2]), 1));
  return { geometry: merge(parts), swim: { amp: 0.09, freq: 6, mode: SwimMode.FISH } };
}

function giantIsopod(c: string[]): Built {
  const parts: THREE.BufferGeometry[] = [];
  // Overlapping armored segments.
  for (let i = 0; i < 8; i++) {
    const z = 0.3 - i * 0.08;
    const w = 0.2 - Math.abs(i - 3) * 0.015;
    parts.push(paint(tf(sphere(0.5, 8, 4), { s: [w * 2, 0.11, 0.11], p: [0, 0.02, z] }), (p) => (p.y > 0.04 ? (i % 2 ? c[0] : mix(c[0], c[1], 0.3)) : c[1])));
  }
  parts.push(paint(tf(sphere(0.5, 8, 4), { s: [0.3, 0.09, 0.12], p: [0, 0.01, 0.4] }), c[0]));
  for (const s of [-1, 1]) {
    parts.push(paint(tf(ico(0.03, 0), { p: [s * 0.11, 0.03, 0.42] }), "#2a2a2a"));
    // Antennae
    const a = cyl(0.006, 0.004, 0.3, 3);
    a.translate(0, 0.15, 0);
    a.rotateX(Math.PI / 2 - 0.3);
    a.rotateY(s * 0.5);
    a.translate(s * 0.05, 0.02, 0.45);
    parts.push(paint(a, c[2]));
    for (let i = 0; i < 6; i++) {
      const leg = cyl(0.008, 0.005, 0.1, 3);
      leg.translate(0, -0.05, 0);
      leg.rotateZ(s * 0.9);
      leg.translate(s * 0.15, -0.02, 0.28 - i * 0.09);
      parts.push(paint(leg, c[2]));
    }
  }
  parts.push(paint(fin([[0.02, 0.08], [-0.08, 0.06], [-0.08, -0.06], [0.02, -0.08]]).rotateZ(Math.PI / 2).translate(0, 0.0, -0.32), c[0]));
  return { geometry: merge(parts), swim: { amp: 0.01, freq: 3, mode: SwimMode.FISH } };
}

function anglerfish(c: string[]): Built {
  const parts: THREE.BufferGeometry[] = [
    paint(jitter(tf(ico(0.24, 1), { s: [1, 0.95, 1.05] }), 0.03, 3), (p, f) => (p.y < -0.12 ? c[1] : speckle(f, 15) ? c[1] : c[0])),
  ];
  // Big jaw with needle teeth.
  parts.push(paint(tf(sphere(0.5, 7, 3), { s: [0.36, 0.12, 0.2], p: [0, -0.08, 0.17] }), c[1]));
  for (let i = 0; i < 9; i++) {
    const a = -0.9 + i * 0.22;
    const t = cone(0.008, 0.06, 3);
    t.translate(Math.sin(a) * 0.15, -0.04, 0.2 + Math.cos(a) * 0.08);
    parts.push(paint(t, "#e8e4d8"));
  }
  // The lure: a stalk from the head ending in a glowing bulb.
  parts.push(paint(tube([[0, 0.2, 0.08], [0, 0.34, 0.16], [0, 0.32, 0.3]], 0.008, 3), c[0]));
  parts.push(glow(paint(tf(ico(0.03, 1), { p: [0, 0.31, 0.32] }), c[2]), 1));
  parts.push(paint(fin(scaleShape(TAILS.round, 0.7, -0.22, 0)), c[0]));
  for (const s of [-1, 1]) parts.push(paint(tf(ico(0.018, 0), { p: [s * 0.1, 0.08, 0.18] }), EYE));
  return { geometry: merge(parts), swim: { amp: 0.03, freq: 4, mode: SwimMode.FISH } };
}

function gulperEel(c: string[]): Built {
  // Huge pouch mouth, then a long whip of a tail with a glowing tip.
  const N = 14;
  const prof: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    prof.push([0.004 + 0.035 * Math.pow(t, 3), -0.5 + t * 0.75]);
  }
  const tail = lathe(prof, 5);
  const parts: THREE.BufferGeometry[] = [paint(tail, c[0])];
  parts.push(glow(paint(tf(ico(0.012, 0), { p: [0, 0, -0.5] }), c[2]), 1));
  const jaw = new THREE.SphereGeometry(0.5, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.7);
  jaw.scale(0.16, 0.16, 0.26);
  jaw.rotateX(-Math.PI / 2);
  jaw.translate(0, 0, 0.38);
  parts.push(paint(jaw, (p) => (p.y < -0.02 ? c[1] : c[0])));
  for (const s of [-1, 1]) parts.push(paint(tf(ico(0.008, 0), { p: [s * 0.03, 0.04, 0.47] }), EYE));
  return { geometry: merge(parts), swim: { amp: 0.14, freq: 9, mode: SwimMode.FISH } };
}

function barreleye(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.1,
    w: 0.06,
    tailZ: -0.3,
    noseZ: 0.42,
    tail: "fork",
    tailSize: 0.9,
    pectoral: 1,
    eye: 0.001,
  });
  // Transparent dome over the head, with upward-looking tube eyes that glow green.
  parts.push(paint(tf(sphere(0.5, 8, 5), { s: [0.13, 0.16, 0.24], p: [0, 0.07, 0.25] }), c[1]));
  for (const s of [-1, 1]) parts.push(glow(paint(tf(cyl(0.022, 0.026, 0.07, 6), { p: [s * 0.025, 0.1, 0.25] }), c[2]), 0.9));
  return { geometry: merge(parts), swim: { amp: 0.04, freq: 4, mode: SwimMode.FISH } };
}

function dumboOctopus(c: string[]): Built {
  const parts: THREE.BufferGeometry[] = [paint(tf(sphere(0.5, 9, 6), { s: [0.3, 0.32, 0.3], p: [0, 0.12, 0] }), (p) => (p.y > 0.2 ? c[0] : c[1]))];
  // The "ears": fins on top of the head.
  for (const s of [-1, 1]) {
    const ear = fin([[0.06, 0], [0.02, 0.12], [-0.06, 0.1], [-0.06, 0]]);
    ear.rotateZ(-s * 1.0);
    ear.translate(s * 0.13, 0.2, 0);
    parts.push(paint(ear, c[2]));
    parts.push(paint(tf(ico(0.03, 0), { p: [s * 0.1, 0.1, 0.12] }), EYE));
  }
  // Short webbed arms forming a skirt.
  const skirt = new THREE.ConeGeometry(0.22, 0.22, 8, 1, true);
  skirt.translate(0, -0.08, 0);
  parts.push(paint(skirt, c[1]));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(paint(tube([[Math.cos(a) * 0.08, -0.02, Math.sin(a) * 0.08], [Math.cos(a) * 0.2, -0.17, Math.sin(a) * 0.2], [Math.cos(a) * 0.24, -0.26, Math.sin(a) * 0.24]], (t) => 0.022 * (1 - t) + 0.006, 4), c[0]));
  }
  return { geometry: merge(parts), swim: { amp: 0.12, freq: 3, mode: SwimMode.TENTACLE } };
}

function vampireSquid(c: string[]): Built {
  const parts: THREE.BufferGeometry[] = [paint(tf(sphere(0.5, 8, 6), { s: [0.24, 0.3, 0.24], p: [0, 0.15, 0] }), c[0])];
  for (const s of [-1, 1]) {
    parts.push(paint(fin([[0.04, 0], [0.0, 0.08], [-0.05, 0.06], [-0.05, 0]]).rotateZ(-s * 1.2).translate(s * 0.11, 0.24, 0), c[0]));
    parts.push(glow(paint(tf(ico(0.03, 0), { p: [s * 0.1, 0.1, 0.1] }), "#4ab0ff"), 0.6));
  }
  // Webbed "cloak" between the arms, with glowing tips.
  const cloak = new THREE.ConeGeometry(0.3, 0.32, 8, 2, true);
  cloak.translate(0, -0.12, 0);
  parts.push(paint(cloak, (_p, f) => (speckle(f, 30) ? c[1] : c[0])));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(paint(tube([[Math.cos(a) * 0.1, 0.0, Math.sin(a) * 0.1], [Math.cos(a) * 0.26, -0.18, Math.sin(a) * 0.26], [Math.cos(a) * 0.3, -0.3, Math.sin(a) * 0.3]], (t) => 0.02 * (1 - t) + 0.006, 4), c[0]));
    parts.push(glow(paint(tf(ico(0.014, 0), { p: [Math.cos(a) * 0.3, -0.31, Math.sin(a) * 0.3] }), c[2]), 1));
  }
  return { geometry: merge(parts), swim: { amp: 0.1, freq: 3, mode: SwimMode.TENTACLE } };
}

function giantSquid(c: string[]): Built {
  // Torpedo mantle at the back (−z) with fins, arms and two long tentacles trailing forward.
  const mantle = lathe([[0.0, -0.5], [0.02, -0.45], [0.05, -0.35], [0.065, -0.2], [0.07, -0.05], [0.06, 0.02]], 8);
  const parts: THREE.BufferGeometry[] = [paint(mantle, (_p, f) => (speckle(f, 25) ? c[1] : c[0]))];
  for (const s of [-1, 1]) {
    const g = fin([[0.0, 0], [-0.06, 0.07], [-0.12, 0.04], [-0.12, 0]]);
    g.rotateZ(-s * (Math.PI / 2));
    g.translate(s * 0.02, 0, -0.38);
    parts.push(paint(g, c[0]));
    // Dinner-plate eyes.
    parts.push(paint(tf(sphere(0.5, 6, 5), { s: [0.04, 0.05, 0.05], p: [s * 0.055, 0, 0.05] }), c[2]));
    parts.push(paint(tf(ico(0.018, 0), { p: [s * 0.072, 0, 0.05] }), EYE));
  }
  parts.push(paint(tf(sphere(0.5, 7, 5), { s: [0.1, 0.09, 0.1], p: [0, 0, 0.04] }), c[0]));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const dx = Math.cos(a) * 0.035;
    const dy = Math.sin(a) * 0.035;
    parts.push(paint(tube([[dx, dy, 0.08], [dx * 1.8, dy * 1.8, 0.2], [dx * 1.5, dy * 1.5, 0.3]], (t) => 0.012 * (1 - t) + 0.003, 4), c[0]));
  }
  for (const s of [-1, 1]) {
    parts.push(paint(tube([[s * 0.02, 0, 0.08], [s * 0.04, -0.01, 0.28], [s * 0.03, 0.01, 0.42], [s * 0.05, 0, 0.5]], (t) => (t > 0.85 ? 0.012 : 0.005), 4), c[0]));
  }
  // Squid cruise mantle-first, arms trailing behind.
  const g = merge(parts);
  g.rotateY(Math.PI);
  return { geometry: g, swim: { amp: 0.05, freq: 5, mode: SwimMode.FISH } };
}

function spermWhale(c: string[]): Built {
  // The giant box-shaped head is about a third of the body.
  const body = lathe([[0.0, -0.5], [0.03, -0.44], [0.06, -0.32], [0.09, -0.15], [0.11, 0.05], [0.115, 0.2], [0.115, 0.38], [0.11, 0.47], [0.07, 0.5]], 8);
  body.scale(0.85, 1.05, 1);
  const parts: THREE.BufferGeometry[] = [paint(body, (p, f) => (p.y < -0.07 && p.z > 0.15 ? c[1] : speckle(f, 22) ? c[1] : c[0]))];
  // Narrow lower jaw with teeth.
  parts.push(paint(tf(sphere(0.5, 6, 4), { s: [0.05, 0.03, 0.3], p: [0, -0.1, 0.32] }), c[2]));
  // Low dorsal hump and knuckles along the back.
  for (let i = 0; i < 5; i++) parts.push(paint(tf(ico(0.02 - i * 0.002, 0), { p: [0, 0.075 - i * 0.008, -0.15 - i * 0.06] }), c[0]));
  for (const s of [-1, 1]) {
    const g = fin([[0.03, 0], [-0.01, 0.06], [-0.04, 0.07], [-0.03, 0]]);
    g.rotateZ(-s * (Math.PI / 2 + 0.6));
    g.translate(s * 0.08, -0.05, 0.1);
    parts.push(paint(g, c[0]));
    parts.push(paint(tf(ico(0.009, 0), { p: [s * 0.085, -0.03, 0.12] }), EYE));
  }
  parts.push(flukes(-0.48, 0.14, c[0]));
  return { geometry: merge(parts), swim: { amp: 0.03, freq: 3, mode: SwimMode.FLUKE } };
}

// ───────────────────────── Registry ─────────────────────────

interface Entry {
  length: number;
  normalize?: boolean;
  build: (colors: string[]) => Built;
}

const REGISTRY: Record<string, Entry> = {
  guppy: { length: 0.4, build: guppy },
  "neon-tetra": { length: 0.32, build: neonTetra },
  betta: { length: 0.5, build: betta },
  frog: { length: 0.5, build: frog },
  catfish: { length: 0.95, build: catfish },
  mudskipper: { length: 0.5, build: mudskipper },
  "painted-turtle": { length: 0.7, build: (c) => turtle(c, false) },
  axolotl: { length: 0.65, build: axolotl },
  "electric-eel": { length: 1.5, build: (c) => eel(c, false) },
  "alligator-gar": { length: 2.0, build: alligatorGar },
  clownfish: { length: 0.48, build: clownfish },
  "blue-tang": { length: 0.62, build: blueTang },
  damselfish: { length: 0.4, build: damselfish },
  seahorse: { length: 0.65, normalize: false, build: seahorse },
  pufferfish: { length: 0.55, build: pufferfish },
  "moray-eel": { length: 1.5, build: (c) => eel(c, true) },
  octopus: { length: 0.9, normalize: false, build: octopus },
  "sea-turtle": { length: 1.4, build: (c) => turtle(c, true) },
  "reef-shark": { length: 2.2, build: reefShark },
  sardine: { length: 0.4, build: sardine },
  tuna: { length: 1.1, build: tuna },
  "mahi-mahi": { length: 1.1, build: mahiMahi },
  sailfish: { length: 2.6, build: sailfish },
  dolphin: { length: 2.2, build: dolphin },
  "manta-ray": { length: 2.4, build: mantaRay },
  hammerhead: { length: 2.8, build: hammerhead },
  "whale-shark": { length: 7, build: whaleShark },
  humpback: { length: 8, build: humpback },
  "blue-whale": { length: 10, build: blueWhale },
  lanternfish: { length: 0.35, build: lanternfish },
  "giant-isopod": { length: 0.45, build: giantIsopod },
  anglerfish: { length: 0.5, build: anglerfish },
  "gulper-eel": { length: 1.3, build: gulperEel },
  barreleye: { length: 0.45, build: barreleye },
  "dumbo-octopus": { length: 0.55, normalize: false, build: dumboOctopus },
  "vampire-squid": { length: 0.7, normalize: false, build: vampireSquid },
  "giant-squid": { length: 9, build: giantSquid },
  "sperm-whale": { length: 9, build: spermWhale },
};

const cache = new Map<string, ModelDef>();

/** Normalize so the model spans z ∈ [−0.5, 0.5] and sits centered on x/y. */
function normalize(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const len = bb.max.z - bb.min.z;
  const cz = (bb.max.z + bb.min.z) / 2;
  const cy = (bb.max.y + bb.min.y) / 2;
  g.translate(0, -cy, -cz);
  g.scale(1 / len, 1 / len, 1 / len);
  g.computeBoundingBox();
  g.computeBoundingSphere();
}

export function getCreatureModel(speciesId: string, variantId?: string): ModelDef {
  const key = speciesId + "|" + (variantId ?? "");
  const hit = cache.get(key);
  if (hit) return hit;
  const sp = SPECIES_BY_ID[speciesId];
  const entry = REGISTRY[speciesId];
  const colors = sp?.variants?.find((v) => v.id === variantId)?.colors ?? sp?.colors ?? ["#999999", "#cccccc", "#ffffff"];
  let built: Built;
  let length = 0.4;
  if (entry) {
    built = entry.build(colors);
    length = entry.length;
    if (entry.normalize !== false) normalize(built.geometry);
    jitter(built.geometry, 0.008, hashStr(speciesId));
  } else {
    built = guppy(colors);
    normalize(built.geometry);
  }
  built.geometry.computeVertexNormals();
  const def: ModelDef = { ...built, length };
  cache.set(key, def);
  return def;
}

export function hasProceduralModel(speciesId: string) {
  return speciesId in REGISTRY;
}
