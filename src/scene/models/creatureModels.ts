// Procedural low poly creatures. Each model is authored facing +z (nose) with
// the tail toward −z, roughly 1 unit long, then scaled by `length` in the scene.

import * as THREE from "three";
import { SPECIES_BY_ID } from "../../data/creatures";
import { SwimMode } from "../swimShader";
import { cone, cyl, fin, flipWinding, glow, hashStr, ico, jitter, lathe, merge, mix, paint, sphere, tf, tube, type V3 } from "./geo";

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
  // A dark lining inside the pouch, so the open mouth doesn't show through.
  const lining = flipWinding(jaw.clone().translate(0, 0, -0.38).scale(0.95, 0.95, 0.95).translate(0, 0, 0.38));
  parts.push(paint(jaw, (p) => (p.y < -0.02 ? c[1] : c[0])));
  parts.push(paint(lining, "#2a1020"));
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
  const skirt = new THREE.ConeGeometry(0.22, 0.22, 8, 1);
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
  const cloak = new THREE.ConeGeometry(0.3, 0.32, 8, 2);
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

// ───────────────────────── Tidepool ─────────────────────────

/** Walking legs: from the body edge up to a knee and down to the ground. */
function walkingLegs(parts: THREE.BufferGeometry[], o: { n: number; x: number; z0: number; dz: number; reach: number; lift: number; drop: number; r: number; color: string }) {
  for (const s of [-1, 1]) {
    for (let i = 0; i < o.n; i++) {
      const z = o.z0 - i * o.dz;
      const sweep = (i - (o.n - 1) / 2) * 0.05;
      const base: V3 = [s * o.x, 0.03, z];
      const knee: V3 = [s * (o.x + o.reach * 0.55), o.lift, z - sweep];
      const foot: V3 = [s * (o.x + o.reach), o.drop, z - sweep * 2.2];
      parts.push(paint(tube([base, knee, foot], (t) => o.r * (1 - t * 0.6), 4), o.color));
    }
  }
}

/**
 * Crabs. Authored facing +z; with `sideways` the whole crab is turned so its
 * front faces +x, which makes it walk sideways as it moves forward.
 */
function crab(c: string[], o: { sideways?: boolean; reach?: number; claw?: number; tall?: boolean } = {}): Built {
  const [c0, c1, c2] = c;
  const parts: THREE.BufferGeometry[] = [];
  const shellH = o.tall ? 0.24 : 0.18;
  parts.push(paint(tf(sphere(0.5, 9, 5), { s: [0.56, shellH, 0.42], p: [0, 0.07, 0] }), (p, f) => (p.y < 0.03 ? c1 : speckle(f, 20) ? mix(c0, c2, 0.4) : c0)));
  walkingLegs(parts, { n: 4, x: 0.22, z0: 0.08, dz: 0.075, reach: o.reach ?? 0.3, lift: 0.15, drop: -0.07, r: 0.026, color: mix(c0, c1, 0.2) });
  const cl = o.claw ?? 1;
  for (const s of [-1, 1]) {
    parts.push(paint(tube([[s * 0.15, 0.06, 0.15], [s * 0.24, 0.1, 0.27], [s * 0.15, 0.08, 0.35]], 0.028 * cl, 4), c0));
    parts.push(paint(tf(sphere(0.5, 6, 4), { s: [0.1 * cl, 0.08 * cl, 0.14 * cl], p: [s * 0.13, 0.08, 0.42] }), (p) => (p.z > 0.47 ? c2 : c0)));
    parts.push(paint(tf(cyl(0.011, 0.011, 0.08, 4), { p: [s * 0.07, 0.17, 0.17] }), c0));
    parts.push(paint(tf(ico(0.022, 0), { p: [s * 0.07, 0.22, 0.17] }), EYE));
  }
  const g = merge(parts);
  if (o.sideways) g.rotateY(Math.PI / 2);
  return { geometry: g, swim: { amp: 0.006, freq: 8, mode: SwimMode.FISH } };
}

function hermitCrab(c: string[]): Built {
  const [shell, body, light] = c;
  const parts: THREE.BufferGeometry[] = [];
  // A coiled snail shell: shrinking whorls stacked up and back.
  for (let i = 0; i < 5; i++) {
    const r = 0.22 * (1 - i * 0.17);
    const a = i * 1.15;
    const g = tf(sphere(r, 8, 6), { p: [Math.sin(a) * 0.05, 0.17 + i * 0.07, -0.1 - i * 0.05 + Math.cos(a) * 0.03] });
    parts.push(paint(g, (p, f) => (Math.floor((p.y + p.z) * 22) % 3 === 0 ? light : speckle(f, 15) ? mix(shell, "#000000", 0.15) : shell)));
  }
  parts.push(paint(tf(cone(0.04, 0.12, 5), { r: [-0.6, 0, 0], p: [0.02, 0.5, -0.33] }), light));
  // The crab peeking out of the opening.
  parts.push(paint(tf(sphere(0.5, 7, 5), { s: [0.2, 0.13, 0.16], p: [0, 0.09, 0.14] }), body));
  parts.push(paint(tf(sphere(0.5, 6, 4), { s: [0.12, 0.1, 0.16], p: [0.1, 0.07, 0.3] }), (p) => (p.z > 0.35 ? light : body)));
  parts.push(paint(tf(sphere(0.5, 6, 4), { s: [0.07, 0.06, 0.1], p: [-0.09, 0.06, 0.27] }), body));
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const z = 0.16 - i * 0.07;
      parts.push(paint(tube([[s * 0.08, 0.06, z], [s * 0.2, 0.12, z + 0.03], [s * 0.27, -0.06, z + 0.06]], (t) => 0.022 * (1 - t * 0.5), 4), body));
    }
    parts.push(paint(tf(cyl(0.01, 0.01, 0.07, 4), { p: [s * 0.04, 0.17, 0.2] }), body));
    parts.push(paint(tf(ico(0.018, 0), { p: [s * 0.04, 0.21, 0.2] }), EYE));
    parts.push(paint(tube([[s * 0.03, 0.12, 0.22], [s * 0.08, 0.2, 0.36], [s * 0.14, 0.22, 0.46]], 0.005, 3), light));
  }
  return { geometry: merge(parts), swim: { amp: 0.004, freq: 6, mode: SwimMode.FISH } };
}

/** Sea stars: a flat disc with tapering arms and little bumps. */
function seaStar(c: string[], arms = 5, armLen = 0.45, armW = 0.11): Built {
  const [c0, c1, c2] = c;
  const parts: THREE.BufferGeometry[] = [paint(tf(cyl(0.14, 0.15, 0.07, arms * 2), { p: [0, 0.035, 0] }), (p) => (p.y < 0.01 ? c1 : c0))];
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2;
    const g = cone(armW, armLen, 5);
    g.rotateZ(-Math.PI / 2);
    g.scale(1, 0.45, 1);
    g.translate(armLen / 2 + 0.08, 0.03, 0);
    g.rotateY(a);
    parts.push(paint(g, (p) => (p.y < 0.012 ? c1 : c0)));
    // Many-armed stars skip the little bumps (they'd add up to a lot of triangles).
    for (let k = 1; k < (arms > 8 ? 1 : 5); k++) {
      const d = 0.1 + (k / 5) * armLen;
      parts.push(paint(tf(ico(0.022 * (1 - k * 0.12), 0), { p: [Math.cos(a) * d, 0.06 - k * 0.006, -Math.sin(a) * d] }), c2));
    }
  }
  return { geometry: merge(parts), swim: { amp: 0, freq: 1, mode: SwimMode.FISH } };
}

function sculpin(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.12,
    w: 0.11,
    tailZ: -0.3,
    noseZ: 0.42,
    profile: [0.22, 0.32, 0.48, 0.66, 0.84, 0.98, 1.0, 0.86, 0.0],
    tail: "round",
    dorsal: "long",
    dorsalSize: 0.8,
    pectoral: 1.3,
    pectoralColor: mix(c[0], c[2], 0.3),
    eye: 0.034,
    eyeTop: true,
    pattern: (p, f) => (speckle(f, 30) ? c[1] : speckle(f, 14, 4) ? c[2] : p.y < -0.05 ? mix(c[0], "#ffffff", 0.35) : null),
  });
  return { geometry: merge(parts), swim: { amp: 0.07, freq: 7, mode: SwimMode.FISH } };
}

function blenny(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.1,
    w: 0.075,
    tailZ: -0.42,
    noseZ: 0.44,
    profile: [0.3, 0.45, 0.62, 0.78, 0.9, 0.98, 1.0, 0.96, 0.0],
    tail: "round",
    dorsal: "long",
    dorsalSize: 1.15,
    anal: "long",
    pectoral: 1.0,
    eye: 0.03,
    eyeTop: true,
    pattern: (p, f) => (Math.floor((p.z + 1) * 12) % 2 && p.y > -0.02 ? c[2] : speckle(f, 22) ? c[1] : null),
  });
  return { geometry: merge(parts), swim: { amp: 0.09, freq: 7, mode: SwimMode.FISH } };
}

function nudibranch(c: string[]): Built {
  const [c0, c1, c2] = c;
  const body = lathe([[0.004, -0.5], [0.04, -0.4], [0.07, -0.2], [0.08, 0], [0.08, 0.2], [0.07, 0.34], [0.045, 0.45], [0, 0.5]], 8);
  body.scale(1.3, 0.7, 1);
  const parts: THREE.BufferGeometry[] = [
    paint(body, (p) => (Math.abs(p.x) < 0.025 && p.y > 0 ? c1 : c0)),
    paint(tf(sphere(0.5, 8, 3), { s: [0.24, 0.025, 0.95], p: [0, -0.04, 0] }), c0),
  ];
  // Cerata: soft spikes along the back, bright with pale tips.
  for (let i = 0; i < 8; i++) {
    const z = -0.34 + i * 0.08;
    for (const s of [-1, 1]) {
      for (const k of [0, 1]) {
        const g = cone(0.022, 0.12 - k * 0.02, 4);
        g.translate(0, 0.06, 0);
        g.rotateX(-0.35);
        g.rotateZ(-s * (0.35 + k * 0.45));
        g.translate(s * (0.03 + k * 0.04), 0.04, z + k * 0.02);
        parts.push(paint(g, (p) => (p.y > 0.13 - k * 0.02 ? "#ffffff" : c2)));
      }
    }
  }
  for (const s of [-1, 1]) {
    parts.push(paint(tf(cone(0.014, 0.12, 4), { r: [0.3, 0, -s * 0.2], p: [s * 0.035, 0.09, 0.4] }), c2));
    parts.push(paint(tube([[s * 0.03, 0.0, 0.46], [s * 0.08, 0.0, 0.56], [s * 0.13, -0.01, 0.6]], 0.008, 3), c1));
  }
  return { geometry: merge(parts), swim: { amp: 0.03, freq: 3, mode: SwimMode.FISH } };
}

function seaHare(c: string[]): Built {
  const [c0, c1, c2] = c;
  const skin = (_p: THREE.Vector3, f: number) => (speckle(f, 22) ? c1 : c0);
  const parts: THREE.BufferGeometry[] = [
    paint(tf(sphere(0.5, 9, 6), { s: [0.32, 0.26, 0.62], p: [0, 0.1, -0.06] }), skin),
    paint(tf(sphere(0.5, 7, 5), { s: [0.16, 0.13, 0.2], p: [0, 0.06, 0.32] }), skin),
  ];
  // Parapodia: soft flaps folded up over the back.
  for (const s of [-1, 1]) {
    parts.push(paint(tf(sphere(0.5, 6, 4), { s: [0.05, 0.16, 0.42], r: [0, 0, s * 0.45], p: [s * 0.09, 0.22, -0.08] }), (p) => (p.y > 0.28 ? c2 : c0)));
    parts.push(paint(tf(cone(0.03, 0.14, 4), { r: [0.35, 0, -s * 0.35], p: [s * 0.05, 0.17, 0.36] }), c0));
    parts.push(paint(tube([[s * 0.04, 0.02, 0.42], [s * 0.1, 0.0, 0.5], [s * 0.14, -0.02, 0.52]], 0.014, 3), c0));
    parts.push(paint(tf(ico(0.012, 0), { p: [s * 0.05, 0.1, 0.4] }), EYE));
  }
  return { geometry: merge(parts), swim: { amp: 0.025, freq: 2.5, mode: SwimMode.FISH } };
}

interface PinnipedOpts {
  bulk?: number;
  ears?: boolean;
  tusks?: boolean;
  spots?: number;
  fore?: number;
  head?: number;
  /** Belly color (defaults to colors[1]). */
  belly?: string;
}

/** Seals, sea lions and walruses: one fusiform body with flippers. */
function pinniped(c: string[], o: PinnipedOpts = {}): Built {
  const [c0, c1, c2] = c;
  const b = o.bulk ?? 1;
  const hd = o.head ?? 1;
  const body = lathe(
    [[0.02, -0.5], [0.06, -0.43], [0.1, -0.32], [0.14, -0.14], [0.15, 0.02], [0.135, 0.15], [0.1, 0.25], [0.085 * hd, 0.31], [0.09 * hd, 0.37], [0.08 * hd, 0.43], [0.045 * hd, 0.48], [0, 0.5]].map(
      ([r, z]) => [r * b, z] as [number, number],
    ),
    9,
  );
  body.scale(1, 0.9, 1);
  const belly = o.belly ?? c1;
  const parts: THREE.BufferGeometry[] = [paint(body, (p, f) => (p.y < -0.05 * b ? belly : o.spots && speckle(f, o.spots) ? c2 : c0))];
  const fore = o.fore ?? 1;
  for (const s of [-1, 1]) {
    parts.push(paint(tf(sphere(0.5, 6, 4), { s: [0.05, 0.02, 0.2 * fore], r: [0, s * 0.5, s * -0.35], p: [s * 0.14 * b, -0.07 * b, 0.12] }), mix(c0, "#000000", 0.12)));
    parts.push(paint(tf(sphere(0.5, 6, 4), { s: [0.07, 0.015, 0.16], r: [0, s * 0.35, 0], p: [s * 0.05, -0.005, -0.56] }), mix(c0, "#000000", 0.15)));
    parts.push(paint(tf(ico(0.02 * hd, 0), { p: [s * 0.055 * b * hd, 0.045 * b, 0.42] }), EYE));
    if (o.ears) parts.push(paint(tf(cone(0.012, 0.04, 3), { r: [-0.6, 0, 0], p: [s * 0.06 * b, 0.07 * b, 0.36] }), c0));
    if (o.tusks) parts.push(paint(tf(cone(0.016, 0.22, 5), { r: [Math.PI - 0.25, 0, 0], p: [s * 0.035, -0.12 * b, 0.46] }), "#f2ead8"));
  }
  parts.push(paint(tf(ico(0.02, 0), { p: [0, 0.01 * b, 0.5] }), "#2a2622"));
  return { geometry: merge(parts), swim: { amp: 0.045, freq: 3, mode: SwimMode.FISH } };
}

// ───────────────────────── Amazon River ─────────────────────────

function piranha(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.2,
    w: 0.075,
    tailZ: -0.26,
    noseZ: 0.42,
    profile: [0.2, 0.36, 0.62, 0.86, 0.98, 1.0, 0.92, 0.66, 0.0],
    tail: "fork",
    tailSize: 1.05,
    dorsal: "small",
    anal: "small",
    pectoral: 0.6,
    eye: 0.03,
    pattern: (p, f) => (p.y < -0.03 ? c[1] : p.y > 0.06 && speckle(f, 30) ? mix(c[0], "#ffffff", 0.3) : speckle(f, 12) ? c[2] : null),
  });
  return { geometry: merge(parts), swim: { amp: 0.07, freq: 7, mode: SwimMode.FISH } };
}

function discus(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.3,
    w: 0.05,
    tailZ: -0.3,
    noseZ: 0.36,
    profile: [0.32, 0.6, 0.84, 0.97, 1.0, 0.97, 0.86, 0.6, 0.0],
    tail: "round",
    tailSize: 0.8,
    dorsal: "long",
    dorsalSize: 1.05,
    dorsalZ: 0.08,
    anal: "long",
    analZ: -0.02,
    pectoral: 0.5,
    eye: 0.03,
    pattern: (p) => (Math.sin(p.y * 70 + p.z * 25) > 0.55 ? c[1] : null),
    finPaint: (p, _part, base) => (Math.sin(p.z * 60) > 0.6 ? c[1] : base),
  });
  return { geometry: merge(parts), swim: { amp: 0.04, freq: 5, mode: SwimMode.FISH } };
}

function angelfish(c: string[]): Built {
  const stripes = (p: THREE.Vector3) => (Math.floor((p.z + 1) * 9) % 3 === 0 ? c[1] : null);
  const parts = fish({
    colors: c,
    h: 0.18,
    w: 0.045,
    tailZ: -0.2,
    noseZ: 0.36,
    profile: [0.3, 0.55, 0.82, 0.97, 1.0, 0.95, 0.8, 0.55, 0.0],
    tail: "lunate",
    tailSize: 1.3,
    dorsal: "tall",
    dorsalSize: 2.1,
    dorsalZ: 0.0,
    anal: "none",
    pectoral: 0.4,
    eye: 0.03,
    pattern: stripes,
    finPaint: (p, _part, base) => stripes(p) ?? base,
  });
  // A tall, sweeping anal fin to match the dorsal, plus long trailing ventral threads.
  parts.push(paint(fin([[0.12, 0], [0.02, -0.3], [-0.06, -0.42], [-0.08, -0.2], [-0.06, 0]]).translate(0, -0.12, 0), (p) => stripes(p) ?? c[0]));
  for (const s of [-1, 1]) parts.push(paint(tube([[s * 0.02, -0.12, 0.14], [s * 0.03, -0.3, 0.1], [s * 0.04, -0.46, 0.0]], 0.006, 3), c[2]));
  return { geometry: merge(parts), swim: { amp: 0.05, freq: 5, mode: SwimMode.FISH } };
}

function arowana(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.1,
    w: 0.06,
    tailZ: -0.46,
    noseZ: 0.5,
    profile: [0.3, 0.55, 0.78, 0.92, 1.0, 1.0, 0.96, 0.82, 0.3],
    tail: "round",
    tailSize: 0.9,
    dorsal: "long",
    dorsalZ: -0.25,
    dorsalSize: 0.9,
    anal: "long",
    analZ: -0.06,
    pectoral: 0.8,
    eye: 0.026,
    eyeTop: true,
    pattern: (p, f) => (speckle(f, 35) ? mix(c[0], "#ffffff", 0.35) : p.y > 0.04 ? c[2] : null),
  });
  // Two chin barbels on the upturned mouth.
  for (const s of [-1, 1]) parts.push(paint(tube([[s * 0.01, 0.04, 0.48], [s * 0.02, 0.07, 0.56], [s * 0.025, 0.08, 0.62]], 0.006, 3), c[2]));
  return { geometry: merge(parts), swim: { amp: 0.06, freq: 4, mode: SwimMode.FISH } };
}

/** Rays: a flat disc with a whip tail. `pointed` makes bat-ray wings. */
function ray(c: string[], o: { pointed?: boolean; spots?: boolean } = {}): Built {
  const [c0, c1, c2] = c;
  const parts: THREE.BufferGeometry[] = [];
  if (o.pointed) {
    const shape = new THREE.Shape(
      ([[0, 0.26], [0.1, 0.22], [0.52, -0.02], [0.5, -0.08], [0.12, -0.18], [0, -0.22], [-0.12, -0.18], [-0.5, -0.08], [-0.52, -0.02], [-0.1, 0.22]] as [number, number][]).map(
        ([x, z]) => new THREE.Vector2(x, z),
      ),
    );
    const wings = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false, curveSegments: 1 });
    wings.rotateX(Math.PI / 2);
    wings.translate(0, 0.015, 0);
    parts.push(paint(wings, (p) => (p.y > 0 ? c0 : c1)));
    parts.push(paint(tf(sphere(0.5, 7, 4), { s: [0.14, 0.09, 0.2], p: [0, 0.02, 0.24] }), c0));
  } else {
    parts.push(
      paint(tf(sphere(0.5, 12, 4), { s: [0.82, 0.08, 0.76], p: [0, 0, 0.04] }), (p, f) => {
        if (p.y < 0) return c1;
        // Orange eyespots ringed in dark on the motoro's back.
        if (o.spots && speckle(f, 16)) return c2;
        return speckle(f, 18, 2) ? mix(c0, "#000000", 0.15) : c0;
      }),
    );
  }
  const tail = cone(0.022, 0.42, 4);
  tail.rotateX(-Math.PI / 2);
  tail.translate(0, 0.01, -0.5);
  parts.push(paint(tail, c0));
  for (const s of [-1, 1]) parts.push(paint(tf(ico(0.02, 0), { p: [s * 0.07, 0.05, o.pointed ? 0.27 : 0.22] }), EYE));
  return { geometry: merge(parts), swim: { amp: 0.1, freq: 2, mode: SwimMode.FLAP } };
}

function redtailCatfish(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.11,
    w: 0.14,
    profile: [0.25, 0.35, 0.55, 0.78, 0.92, 1, 1, 0.86, 0.48],
    tailZ: -0.34,
    noseZ: 0.5,
    tail: "fork",
    tailColor: c[2],
    belly: c[1],
    dorsal: "tall",
    dorsalSize: 0.7,
    dorsalZ: 0.12,
    pectoral: 0.9,
    eye: 0.02,
    // A pale band along each side, like the real fish.
    pattern: (p) => (p.y < 0.0 && p.y > -0.04 ? c[1] : null),
  });
  for (const [x, yaw, len] of [[0.07, 0.7, 0.3], [-0.07, -0.7, 0.3], [0.03, 0.35, 0.16], [-0.03, -0.35, 0.16]] as [number, number, number][]) {
    const g = cyl(0.007, 0.003, len, 3);
    g.translate(0, len / 2, 0);
    g.rotateX(Math.PI / 2);
    g.rotateY(yaw);
    g.rotateX(0.3);
    g.translate(x, -0.02, 0.48);
    parts.push(paint(g, c[1]));
  }
  return { geometry: merge(parts), swim: { amp: 0.06, freq: 4, mode: SwimMode.FISH } };
}

function mataMata(c: string[]): Built {
  const [shell, skin, dark] = c;
  const parts: THREE.BufferGeometry[] = [];
  // A flat, knobbly shell with three ridges, like a pile of bark and leaves.
  const dome = jitter(tf(new THREE.SphereGeometry(0.5, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2), { s: [0.6, 0.18, 0.72] }), 0.03, 81);
  parts.push(paint(dome, (_p, f) => (speckle(f, 30) ? dark : speckle(f, 20, 3) ? mix(shell, skin, 0.5) : shell)));
  // Underside of the shell.
  parts.push(paint(tf(cyl(0.5, 0.5, 0.03, 9), { s: [0.6, 1, 0.72], p: [0, -0.01, 0] }), mix(shell, skin, 0.4)));
  for (const x of [-0.12, 0, 0.12]) parts.push(paint(tf(sphere(0.5, 5, 3), { s: [0.05, 0.05, 0.5], p: [x, 0.08, -0.02] }), dark));
  // Long neck and a flat, triangular head with a fringed edge.
  parts.push(paint(tube([[0, 0.0, 0.3], [0, 0.0, 0.42], [0, 0.0, 0.52]], 0.065, 6), skin));
  const head = new THREE.Shape([[0, 0.14], [0.11, -0.05], [-0.11, -0.05]].map(([x, z]) => new THREE.Vector2(x, z)));
  const hg = new THREE.ExtrudeGeometry(head, { depth: 0.04, bevelEnabled: false });
  hg.rotateX(Math.PI / 2);
  hg.translate(0, 0.02, 0.58);
  parts.push(paint(hg, (_p, f) => (speckle(f, 25) ? dark : skin)));
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) parts.push(paint(tf(cone(0.012, 0.05, 3), { r: [0, 0, s * 1.4], p: [s * (0.07 + i * 0.012), -0.01, 0.42 + i * 0.05] }), skin));
    parts.push(paint(tf(ico(0.012, 0), { p: [s * 0.035, 0.03, 0.66] }), EYE));
    parts.push(paint(tf(sphere(0.5, 5, 4), { s: [0.12, 0.05, 0.08], p: [s * 0.27, -0.04, 0.22] }), skin));
    parts.push(paint(tf(sphere(0.5, 5, 4), { s: [0.12, 0.05, 0.08], p: [s * 0.25, -0.04, -0.26] }), skin));
  }
  return { geometry: merge(parts), swim: { amp: 0.004, freq: 2, mode: SwimMode.FISH } };
}

function arapaima(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.1,
    w: 0.085,
    tailZ: -0.42,
    noseZ: 0.5,
    profile: [0.32, 0.5, 0.72, 0.9, 1.0, 1.0, 0.96, 0.82, 0.4],
    tail: "round",
    tailColor: c[2],
    dorsal: "long",
    dorsalZ: -0.24,
    dorsalSize: 0.8,
    dorsalColor: mix(c[0], c[2], 0.5),
    anal: "long",
    analZ: -0.06,
    analColor: mix(c[0], c[2], 0.5),
    pectoral: 0.8,
    eye: 0.022,
    // The scales toward the tail are edged in red ("pirarucu" means red fish).
    pattern: (p, f) => (p.z < -0.05 && speckle(f, 45) ? c[2] : p.y < -0.04 ? c[1] : null),
  });
  return { geometry: merge(parts), swim: { amp: 0.06, freq: 3, mode: SwimMode.FISH } };
}

/** Otters: a long body, thick tail and short legs. `onBack` floats belly-up (sea otters). */
function otter(c: string[], o: { onBack?: boolean; tailFlat?: boolean } = {}): Built {
  const [c0, c1, c2] = c;
  const body = lathe([[0.03, -0.5], [0.05, -0.38], [0.07, -0.25], [0.1, -0.14], [0.115, 0.0], [0.11, 0.12], [0.085, 0.2], [0.08, 0.26], [0.085, 0.32], [0.075, 0.38], [0.04, 0.43], [0, 0.45]], 9);
  body.scale(1, 0.85, 1);
  const parts: THREE.BufferGeometry[] = [paint(body, (p) => (p.y < -0.02 && p.z > 0.15 ? c1 : p.y < -0.06 ? mix(c0, c1, 0.4) : c0))];
  if (o.tailFlat) parts.push(paint(tf(sphere(0.5, 6, 3), { s: [0.1, 0.025, 0.2], p: [0, 0, -0.52] }), c0));
  for (const s of [-1, 1]) {
    parts.push(paint(tf(sphere(0.5, 5, 4), { s: [0.06, 0.05, 0.09], p: [s * 0.09, -0.08, 0.16] }), c2));
    parts.push(paint(tf(sphere(0.5, 5, 4), { s: [0.08, 0.04, 0.12], p: [s * 0.09, -0.07, -0.18] }), c2));
    parts.push(paint(tf(ico(0.018, 0), { p: [s * 0.045, 0.045, 0.38] }), EYE));
    parts.push(paint(tf(sphere(0.02, 4, 3), { p: [s * 0.06, 0.07, 0.31] }), c0));
  }
  parts.push(paint(tf(ico(0.022, 0), { p: [0, 0.015, 0.45] }), "#1e1a18"));
  const g = merge(parts);
  // Sea otters float on their backs with paws on the chest.
  if (o.onBack) {
    g.rotateZ(Math.PI);
    const paws = merge([paint(tf(sphere(0.5, 5, 4), { s: [0.07, 0.05, 0.06], p: [0.04, 0.1, 0.22] }), c2), paint(tf(sphere(0.5, 5, 4), { s: [0.07, 0.05, 0.06], p: [-0.04, 0.1, 0.22] }), c2)]);
    return { geometry: merge([g, paws]), swim: { amp: 0.02, freq: 2, mode: SwimMode.FISH } };
  }
  return { geometry: g, swim: { amp: 0.07, freq: 4, mode: SwimMode.FISH } };
}

function riverDolphin(c: string[]): Built {
  // A bulging forehead, a long thin beak and a low ridge instead of a tall fin.
  const body = lathe(
    [[0.0, -0.5], [0.035, -0.44], [0.065, -0.32], [0.105, -0.14], [0.13, 0.04], [0.125, 0.18], [0.11, 0.26], [0.1, 0.3], [0.05, 0.34], [0.03, 0.42], [0.022, 0.5]],
    8,
  );
  body.scale(0.9, 1, 1);
  const parts: THREE.BufferGeometry[] = [paint(body, (p, f) => (p.y < -0.04 ? c[1] : speckle(f, 12) ? c[2] : c[0]))];
  parts.push(paint(fin([[0.08, 0], [0.0, 0.05], [-0.12, 0.05], [-0.16, 0]]).translate(0, 0.11, -0.04), c[0]));
  for (const s of [-1, 1]) {
    const g = fin([[0.05, 0], [-0.03, 0.14], [-0.1, 0.15], [-0.05, 0]]);
    g.rotateZ(-s * (Math.PI / 2 + 0.6));
    g.translate(s * 0.09, -0.05, 0.16);
    parts.push(paint(g, c[0]));
    parts.push(paint(tf(ico(0.01, 0), { p: [s * 0.07, 0.03, 0.29] }), EYE));
  }
  parts.push(flukes(-0.47, 0.14, c[0]));
  return { geometry: merge(parts), swim: { amp: 0.06, freq: 3.5, mode: SwimMode.FLUKE } };
}

// ───────────────────────── Kelp Forest ─────────────────────────

function garibaldi(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.17,
    w: 0.07,
    tailZ: -0.26,
    noseZ: 0.4,
    profile: [0.24, 0.42, 0.68, 0.88, 0.98, 1.0, 0.9, 0.62, 0.0],
    tail: "fork",
    tailSize: 0.95,
    tailColor: c[2],
    dorsal: "long",
    dorsalSize: 0.85,
    dorsalColor: c[2],
    anal: "small",
    pectoral: 0.7,
    eye: 0.03,
    pattern: (p) => (p.y < -0.06 ? c[1] : null),
  });
  return { geometry: merge(parts), swim: { amp: 0.06, freq: 6, mode: SwimMode.FISH } };
}

function rockfish(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.14,
    w: 0.07,
    tailZ: -0.3,
    noseZ: 0.44,
    profile: [0.25, 0.38, 0.6, 0.82, 0.96, 1.0, 0.94, 0.7, 0.0],
    tail: "round",
    dorsal: "long",
    dorsalSize: 1.1,
    anal: "small",
    pectoral: 0.9,
    eye: 0.034,
    pattern: (p, f) => (p.y < -0.06 ? c[1] : speckle(f, 26) ? c[2] : null),
  });
  return { geometry: merge(parts), swim: { amp: 0.07, freq: 6, mode: SwimMode.FISH } };
}

function urchin(c: string[]): Built {
  const [c0, c1, c2] = c;
  const body = tf(ico(0.22, 1), { s: [1, 0.7, 1], p: [0, 0.12, 0] });
  const parts: THREE.BufferGeometry[] = [paint(body.clone(), c1)];
  const pos = body.attributes.position as THREE.BufferAttribute;
  const seen = new Set<string>();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const key = v.toArray().map((x) => x.toFixed(3)).join();
    if (seen.has(key) || v.y < 0.04) continue;
    seen.add(key);
    const nrm = v.clone().sub(new THREE.Vector3(0, 0.12, 0)).normalize();
    const g = cone(0.014, 0.22, 3);
    g.translate(0, 0.11, 0);
    g.applyQuaternion(q.setFromUnitVectors(up, nrm));
    g.translate(v.x, v.y, v.z);
    parts.push(paint(g, (p) => (p.distanceTo(v) > 0.15 ? c2 : c0)));
  }
  body.dispose();
  return { geometry: merge(parts), swim: { amp: 0, freq: 1, mode: SwimMode.FISH } };
}

function leopardShark(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.08,
    w: 0.08,
    profile: [0.2, 0.32, 0.55, 0.8, 0.95, 1, 0.95, 0.75, 0.35, 0.02],
    tailZ: -0.36,
    noseZ: 0.55,
    tail: "shark",
    tailSize: 1.0,
    dorsal: "small",
    dorsalSize: 1.3,
    dorsalZ: 0.08,
    anal: "small",
    pectoral: 1.7,
    belly: c[1],
    eye: 0.016,
    // Dark saddles and spots along the back.
    pattern: (p, f) => (p.y > -0.01 && (Math.floor((p.z + 1) * 11) % 3 === 0 || speckle(f, 18)) ? c[2] : null),
    finPaint: (_p, _part, base) => base,
  });
  return { geometry: merge(parts), swim: { amp: 0.06, freq: 4, mode: SwimMode.FISH } };
}

function seaBass(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.16,
    w: 0.1,
    tailZ: -0.32,
    noseZ: 0.46,
    profile: [0.3, 0.45, 0.68, 0.88, 0.98, 1.0, 0.95, 0.75, 0.15],
    tail: "fan",
    tailSize: 0.9,
    dorsal: "long",
    dorsalSize: 1.0,
    anal: "small",
    pectoral: 1.1,
    eye: 0.026,
    pattern: (p, f) => (speckle(f, 20) ? c[2] : p.y < -0.07 ? c[1] : null),
  });
  return { geometry: merge(parts), swim: { amp: 0.04, freq: 3, mode: SwimMode.FISH } };
}

function grayWhale(c: string[]): Built {
  // No dorsal fin: a low hump and a row of "knuckles" instead. Mottled with barnacles.
  const body = lathe([[0.0, -0.5], [0.02, -0.45], [0.04, -0.36], [0.075, -0.16], [0.09, 0.04], [0.088, 0.2], [0.07, 0.34], [0.045, 0.45], [0.02, 0.5]], 9);
  body.scale(1.05, 0.95, 1);
  const parts: THREE.BufferGeometry[] = [paint(body, (_p, f) => (speckle(f, 22) ? c[2] : speckle(f, 30, 3) ? c[1] : c[0]))];
  for (let i = 0; i < 6; i++) parts.push(paint(tf(sphere(0.5, 4, 3), { s: [0.03, 0.02, 0.04], p: [0, 0.07 - i * 0.004, -0.12 - i * 0.05] }), c[0]));
  for (const s of [-1, 1]) {
    const g = fin([[0.03, 0], [-0.01, 0.08], [-0.05, 0.09], [-0.04, 0]]);
    g.rotateZ(-s * (Math.PI / 2 + 0.6));
    g.translate(s * 0.075, -0.04, 0.22);
    parts.push(paint(g, c[0]));
    parts.push(paint(tf(ico(0.008, 0), { p: [s * 0.072, 0.0, 0.36] }), EYE));
  }
  parts.push(flukes(-0.48, 0.13, c[0]));
  return { geometry: merge(parts), swim: { amp: 0.025, freq: 3, mode: SwimMode.FLUKE } };
}

// ───────────────────────── Polar Waters ─────────────────────────

function arcticCod(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.11,
    w: 0.07,
    tailZ: -0.36,
    noseZ: 0.46,
    profile: [0.22, 0.35, 0.58, 0.8, 0.96, 1.0, 0.94, 0.72, 0.0],
    tail: "fork",
    tailSize: 0.85,
    dorsal: "small",
    dorsalSize: 0.9,
    anal: "long",
    pectoral: 0.7,
    eye: 0.032,
    pattern: (p, f) => (p.y < -0.04 ? c[1] : speckle(f, 30) ? c[2] : null),
  });
  return { geometry: merge(parts), swim: { amp: 0.08, freq: 7, mode: SwimMode.FISH } };
}

function seaAngel(c: string[]): Built {
  const [c0, c1, c2] = c;
  // A see-through body with an orange gut and two flapping "wings".
  const body = lathe([[0.0, -0.5], [0.05, -0.42], [0.09, -0.25], [0.1, -0.05], [0.09, 0.12], [0.11, 0.22], [0.1, 0.32], [0.06, 0.4], [0, 0.44]], 8);
  const parts: THREE.BufferGeometry[] = [glow(paint(body, c0), 0.25), glow(paint(tf(sphere(0.5, 6, 4), { s: [0.1, 0.1, 0.3], p: [0, 0, -0.12] }), c1), 0.4)];
  for (const s of [-1, 1]) {
    const w = fin([[0.08, 0], [0.04, 0.22], [-0.06, 0.26], [-0.1, 0.12], [-0.06, 0]], 0.01);
    w.rotateZ(-s * Math.PI / 2);
    w.translate(s * 0.09, 0, 0.16);
    parts.push(glow(paint(w, c2), 0.3));
  }
  return { geometry: merge(parts), swim: { amp: 0.22, freq: 5, mode: SwimMode.FLAP } };
}

function krill(c: string[]): Built {
  const [c0, c1, c2] = c;
  // Kept light: krill come in big instanced swarms.
  const body = lathe([[0.0, -0.5], [0.06, -0.3], [0.08, 0.0], [0.08, 0.25], [0.04, 0.44], [0, 0.5]], 5);
  body.scale(0.9, 1, 1);
  const parts: THREE.BufferGeometry[] = [glow(paint(body, (p) => (Math.floor((p.z + 1) * 14) % 2 ? c0 : c1)), 0.2)];
  parts.push(paint(fin([[0.02, 0], [-0.06, 0.08], [-0.1, 0], [-0.06, -0.08]]).rotateZ(Math.PI / 2).translate(0, 0, -0.5), c0));
  for (let i = 0; i < 3; i++) {
    const z = 0.18 - i * 0.12;
    parts.push(paint(tf(cone(0.012, 0.12, 3), { r: [Math.PI, 0, 0], p: [0, -0.1, z] }), c2));
  }
  for (const s of [-1, 1]) {
    parts.push(paint(tf(ico(0.03, 0), { p: [s * 0.05, 0.04, 0.42] }), "#151515"));
    parts.push(paint(tf(cone(0.006, 0.4, 3), { r: [Math.PI / 2 - 0.2, s * 0.2, 0], p: [s * 0.04, 0.06, 0.68] }), c2));
  }
  return { geometry: merge(parts), swim: { amp: 0.05, freq: 9, mode: SwimMode.FISH } };
}

function penguin(c: string[]): Built {
  const [back, belly, patch] = c;
  // Swimming horizontally: a torpedo body, black back, white front, yellow ear patches.
  const body = lathe([[0.0, -0.5], [0.06, -0.42], [0.12, -0.25], [0.15, -0.05], [0.145, 0.12], [0.12, 0.25], [0.1, 0.32], [0.09, 0.4], [0.05, 0.46], [0, 0.48]], 9);
  body.scale(1, 0.9, 1);
  const parts: THREE.BufferGeometry[] = [paint(body, (p) => (p.y < -0.01 && p.z < 0.3 ? belly : p.z > 0.28 && p.y > -0.02 && Math.abs(p.x) > 0.055 && p.z < 0.38 ? patch : back))];
  parts.push(paint(tf(cone(0.03, 0.16, 4), { r: [Math.PI / 2, 0, 0], p: [0, -0.01, 0.54] }), (p) => (p.z > 0.56 ? "#3a3a3a" : "#e8743a")));
  for (const s of [-1, 1]) {
    parts.push(paint(tf(sphere(0.5, 5, 3), { s: [0.04, 0.02, 0.28], r: [0, s * 0.35, s * -0.4], p: [s * 0.16, -0.02, 0.0] }), back));
    parts.push(paint(tf(sphere(0.5, 4, 3), { s: [0.06, 0.02, 0.08], p: [s * 0.04, -0.06, -0.5] }), "#4a4a4a"));
    parts.push(paint(tf(ico(0.016, 0), { p: [s * 0.07, 0.03, 0.42] }), EYE));
  }
  return { geometry: merge(parts), swim: { amp: 0.03, freq: 5, mode: SwimMode.FISH } };
}

/** Belugas and narwhals: a rounded head, no dorsal fin, broad flippers. */
function toothedWhale(c: string[], o: { tusk?: boolean; mottled?: boolean } = {}): Built {
  const body = lathe([[0.0, -0.5], [0.03, -0.44], [0.06, -0.32], [0.1, -0.12], [0.12, 0.06], [0.115, 0.22], [0.105, 0.32], [0.1, 0.38], [0.075, 0.44], [0.035, 0.48], [0, 0.49]], 9);
  body.scale(1, 0.95, 1);
  const parts: THREE.BufferGeometry[] = [paint(body, (p, f) => (o.mottled && p.y > -0.02 && speckle(f, 40) ? c[2] : p.y < -0.04 ? c[1] : c[0]))];
  parts.push(paint(tf(sphere(0.5, 5, 3), { s: [0.05, 0.02, 0.3], p: [0, 0.11, -0.12] }), c[0]));
  for (const s of [-1, 1]) {
    const g = fin([[0.04, 0], [-0.02, 0.1], [-0.08, 0.1], [-0.05, 0]]);
    g.rotateZ(-s * (Math.PI / 2 + 0.55));
    g.translate(s * 0.09, -0.06, 0.24);
    parts.push(paint(g, c[0]));
    parts.push(paint(tf(ico(0.012, 0), { p: [s * 0.075, 0.03, 0.36] }), EYE));
  }
  if (o.tusk) {
    // A long spiral tooth: a slim cone with bands.
    const t = cone(0.018, 0.75, 5);
    t.rotateX(Math.PI / 2);
    t.translate(0.02, 0.0, 0.48 + 0.375);
    parts.push(paint(t, (p) => (Math.floor(p.z * 40) % 2 ? "#f2ead0" : "#d8ccb0")));
  }
  parts.push(flukes(-0.47, 0.13, c[0]));
  return { geometry: merge(parts), swim: { amp: 0.045, freq: 3, mode: SwimMode.FLUKE } };
}

function greenlandShark(c: string[]): Built {
  const parts = fish({
    colors: c,
    h: 0.1,
    w: 0.1,
    profile: [0.2, 0.32, 0.55, 0.8, 0.95, 1, 0.98, 0.85, 0.5, 0.05],
    tailZ: -0.34,
    noseZ: 0.52,
    tail: "shark",
    tailSize: 0.85,
    dorsal: "small",
    dorsalSize: 0.8,
    dorsalZ: 0.0,
    anal: "none",
    pectoral: 1.2,
    belly: c[1],
    eye: 0.012,
    pattern: (_p, f) => (speckle(f, 20) ? c[2] : null),
  });
  return { geometry: merge(parts), swim: { amp: 0.04, freq: 2, mode: SwimMode.FISH } };
}

function orca(c: string[]): Built {
  const [black, white, gray] = c;
  const body = lathe([[0.0, -0.5], [0.035, -0.44], [0.065, -0.32], [0.11, -0.12], [0.135, 0.06], [0.13, 0.2], [0.11, 0.3], [0.08, 0.38], [0.045, 0.44], [0.0, 0.47]], 9);
  body.scale(0.92, 1, 1);
  const paintOrca = (p: THREE.Vector3) => {
    if (p.y < -0.04 && p.z > -0.25) return white;
    // The white eye patch and the gray "saddle" behind the fin.
    if (p.z > 0.26 && p.z < 0.36 && p.y > 0.0 && p.y < 0.06 && Math.abs(p.x) > 0.06) return white;
    if (p.z < -0.05 && p.z > -0.18 && p.y > 0.08) return gray;
    return black;
  };
  const parts: THREE.BufferGeometry[] = [paint(body, paintOrca)];
  parts.push(paint(fin([[0.06, 0], [0.0, 0.22], [-0.03, 0.26], [-0.06, 0.1], [-0.09, 0]]).translate(0, 0.11, 0.0), black));
  for (const s of [-1, 1]) {
    const g = fin([[0.05, 0], [-0.03, 0.14], [-0.1, 0.14], [-0.05, 0]]);
    g.rotateZ(-s * (Math.PI / 2 + 0.6));
    g.translate(s * 0.1, -0.06, 0.22);
    parts.push(paint(g, black));
  }
  parts.push(flukes(-0.47, 0.14, black));
  return { geometry: merge(parts), swim: { amp: 0.05, freq: 3, mode: SwimMode.FLUKE } };
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
  "hermit-crab": { length: 0.42, build: hermitCrab },
  "ochre-sea-star": { length: 0.45, build: (c) => seaStar(c) },
  "shore-crab": { length: 0.4, build: (c) => crab(c, { sideways: true }) },
  "tidepool-sculpin": { length: 0.42, build: sculpin },
  blenny: { length: 0.5, build: blenny },
  nudibranch: { length: 0.36, build: nudibranch },
  "sea-hare": { length: 0.6, build: seaHare },
  "harbor-seal": { length: 1.7, build: (c) => pinniped(c, { spots: 28 }) },
  "giant-pacific-octopus": { length: 1.35, normalize: false, build: octopus },
  "red-bellied-piranha": { length: 0.42, build: piranha },
  discus: { length: 0.42, build: discus },
  "freshwater-angelfish": { length: 0.4, build: angelfish },
  "silver-arowana": { length: 0.95, build: arowana },
  "motoro-stingray": { length: 0.8, build: (c) => ray(c, { spots: true }) },
  "redtail-catfish": { length: 1.15, build: redtailCatfish },
  "mata-mata": { length: 0.7, build: mataMata },
  arapaima: { length: 2.2, build: arapaima },
  "giant-otter": { length: 1.5, build: (c) => otter(c, { tailFlat: true }) },
  "amazon-river-dolphin": { length: 2.1, build: riverDolphin },
  garibaldi: { length: 0.5, build: garibaldi },
  "blue-rockfish": { length: 0.5, build: rockfish },
  "purple-sea-urchin": { length: 0.32, build: urchin },
  "kelp-crab": { length: 0.45, build: (c) => crab(c, { reach: 0.4, claw: 0.8, tall: true }) },
  "sunflower-sea-star": { length: 0.9, build: (c) => seaStar(c, 18, 0.42, 0.055) },
  "bat-ray": { length: 1.6, build: (c) => ray(c, { pointed: true }) },
  "leopard-shark": { length: 1.6, build: leopardShark },
  "california-sea-lion": { length: 2.1, build: (c) => pinniped(c, { ears: true, fore: 1.6, head: 0.9 }) },
  "sea-otter": { length: 1.2, build: (c) => otter(c, { onBack: true, tailFlat: true }) },
  "giant-sea-bass": { length: 2.2, build: seaBass },
  "gray-whale": { length: 9, build: grayWhale },
  "arctic-cod": { length: 0.42, build: arcticCod },
  "sea-angel": { length: 0.3, build: seaAngel },
  "antarctic-krill": { length: 0.22, build: krill },
  "ringed-seal": { length: 1.4, build: (c) => pinniped(c, { spots: 35 }) },
  "emperor-penguin": { length: 1.2, build: penguin },
  walrus: { length: 2.6, build: (c) => pinniped(c, { tusks: true, bulk: 1.35, head: 1.15, fore: 1.2 }) },
  beluga: { length: 3.2, build: (c) => toothedWhale(c) },
  "leopard-seal": { length: 2.8, build: (c) => pinniped(c, { spots: 22, head: 1.25, fore: 1.4 }) },
  narwhal: { length: 3.2, build: (c) => toothedWhale(c, { tusk: true, mottled: true }) },
  "greenland-shark": { length: 3.2, build: greenlandShark },
  orca: { length: 7, build: orca },
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
