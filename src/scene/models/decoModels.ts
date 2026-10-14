// Procedural decorations. Authored with a footprint of about 1 unit around the
// origin (y = 0 is the floor, or the water surface for surface items).
import * as THREE from "three";
import { box, cone, cyl, glow, hashStr, ico, jitter, lathe, merge, mix, paint, rng, sphere, tf, tube, type V3 } from "./geo";

export interface DecoModel {
  geometry: THREE.BufferGeometry;
  /** Plant sway amplitude (0 = static). */
  sway: number;
  glow?: { geometry: THREE.BufferGeometry; color: string };
  /** The glow is daylight (sunbeams), shown softly by day instead of at night. */
  dayGlow?: boolean;
  /** Slow rotation in rad/s (swirling bait balls, drifting swarms). */
  spin?: number;
  /** A small point light (hydrothermal vents light up the dark). y is in local units. */
  light?: { color: string; intensity: number; y: number };
}

interface Ctx {
  /** Water height in this decoration's local units. */
  waterH: number;
}

const speckle = (f: number, pct: number, salt = 0) => ((f * 2654435761 + salt * 97) >>> 0) % 100 < pct;

// ───────────── Swamp ─────────────

function lilyPads(): DecoModel {
  const parts: THREE.BufferGeometry[] = [];
  const pads: [number, number, number, number][] = [
    [0, 0, 0.36, 0.3],
    [0.45, 0.25, 0.24, 1.9],
    [-0.35, 0.35, 0.2, 3.7],
  ];
  pads.forEach(([x, z, r, rot], i) => {
    const g = new THREE.CylinderGeometry(r, r, 0.025, 10, 1, false, rot, Math.PI * 2 - 0.55);
    g.translate(x, 0.02, z);
    parts.push(paint(g, (_p, f) => (speckle(f, 20, i) ? "#5f8a46" : "#7aa35c")));
  });
  // A small pink flower
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const p = cone(0.05, 0.14, 3);
    p.rotateZ(0.7);
    p.rotateY(a);
    p.translate(0.45 + Math.cos(a) * 0.04, 0.09, 0.25 + Math.sin(a) * 0.04);
    parts.push(paint(p, "#f2a0c0"));
  }
  parts.push(paint(tf(ico(0.035, 0), { p: [0.45, 0.1, 0.25] }), "#f2e27a"));
  return { geometry: merge(parts), sway: 0 };
}

function fireflyReeds(): DecoModel {
  const r = rng(11);
  const parts: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const x = (r() - 0.5) * 0.5;
    const z = (r() - 0.5) * 0.5;
    const h = 1.0 + r() * 0.7;
    const g = cyl(0.012, 0.02, h, 4);
    g.translate(x, h / 2 - 0.5, z);
    g.rotateZ((r() - 0.5) * 0.2);
    parts.push(paint(g, mix("#6f9a4a", "#a8c070", r())));
  }
  for (let i = 0; i < 10; i++) {
    glow.push(paint(tf(ico(0.03, 0), { p: [(r() - 0.5) * 1.1, 0.4 + r() * 1.0, (r() - 0.5) * 1.1] }), "#f6ff9a"));
  }
  return { geometry: merge(parts), sway: 0.02, glow: { geometry: merge(glow), color: "#e8f27a" } };
}

function cattails(ctx: Ctx): DecoModel {
  const r = rng(7);
  const parts: THREE.BufferGeometry[] = [];
  const top = ctx.waterH + 0.5;
  for (let i = 0; i < 5; i++) {
    const x = (r() - 0.5) * 0.5;
    const z = (r() - 0.5) * 0.5;
    const h = top + r() * 0.5;
    const stalk = cyl(0.018, 0.026, h, 4);
    stalk.translate(x, h / 2, z);
    parts.push(paint(stalk, "#7f9a52"));
    const head = cyl(0.05, 0.05, 0.3, 6);
    head.translate(x, h - 0.25, z);
    parts.push(paint(head, "#6b4a2a"));
  }
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    const h = ctx.waterH * (0.6 + r() * 0.5);
    const leaf = cone(0.05, h, 3);
    leaf.scale(1, 1, 0.3);
    leaf.translate(0, h / 2, 0);
    leaf.rotateZ(0.12);
    leaf.rotateY(a);
    parts.push(paint(leaf, mix("#6f9a4a", "#9ab86a", r())));
  }
  return { geometry: merge(parts), sway: 0.0035 };
}

function mossyRock(): DecoModel {
  const g = jitter(tf(ico(0.42, 1), { s: [1, 0.62, 0.85], p: [0, 0.15, 0] }), 0.12, 5);
  return { geometry: merge([paint(g, (p, f) => (p.y > 0.28 ? (speckle(f, 30) ? "#9ac070" : "#7aa35c") : speckle(f, 25) ? "#6e6a5e" : "#85806f"))]), sway: 0 };
}

function waterFern(): DecoModel {
  const r = rng(3);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.4;
    const len = 0.45 + r() * 0.35;
    const leaf = sphere(0.5, 5, 3);
    leaf.scale(0.16, 0.03, len);
    leaf.translate(0, 0, len * 0.45);
    leaf.rotateX(-0.9 - r() * 0.4);
    leaf.rotateY(a);
    leaf.translate(0, 0.05, 0);
    parts.push(paint(leaf, mix("#4f7a3a", "#8ab060", r())));
  }
  return { geometry: merge(parts), sway: 0.06 };
}

function sunkenLog(): DecoModel {
  const log = cyl(0.2, 0.24, 1.6, 7, 3);
  log.rotateZ(Math.PI / 2);
  log.rotateY(0.25);
  log.translate(0, 0.17, 0);
  const parts = [
    paint(log, (p, f) => (Math.abs(p.x) > 0.74 ? "#b8956a" : speckle(f, 22) ? "#6f8a4a" : speckle(f, 30, 2) ? "#4f3a28" : "#5e4630")),
  ];
  const branch = cyl(0.05, 0.08, 0.5, 5);
  branch.translate(0, 0.25, 0);
  branch.rotateZ(-0.6);
  branch.translate(0.3, 0.3, 0.05);
  parts.push(paint(branch, "#5e4630"));
  return { geometry: merge(parts), sway: 0 };
}

function clayPot(): DecoModel {
  const pot = lathe(
    [[0.0, -0.36], [0.2, -0.35], [0.3, -0.2], [0.34, 0.0], [0.28, 0.2], [0.2, 0.3], [0.24, 0.36]],
    9,
  );
  pot.rotateY(0.4);
  pot.rotateX(0.18);
  pot.translate(0, 0.3, 0);
  return {
    geometry: merge([paint(pot, (p, f) => (p.y > 0.5 && speckle(f, 40) ? "#7aa35c" : speckle(f, 18) ? "#a8583a" : "#c06a44"))]),
    sway: 0,
  };
}

function mangroveRoots(ctx: Ctx): DecoModel {
  const parts: THREE.BufferGeometry[] = [];
  const base = 0.9;
  const top = ctx.waterH + 0.9;
  const trunk = cyl(0.09, 0.13, top - base, 6);
  trunk.translate(0, base + (top - base) / 2, 0);
  parts.push(paint(trunk, "#6b5238"));
  const r = rng(9);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.3;
    const reach = 0.45 + r() * 0.2;
    const sy = base + r() * 0.5;
    const pts: V3[] = [
      [0, sy, 0],
      [Math.cos(a) * reach * 0.5, sy + 0.1, Math.sin(a) * reach * 0.5],
      [Math.cos(a) * reach, sy * 0.45, Math.sin(a) * reach],
      [Math.cos(a) * reach * 1.1, -0.05, Math.sin(a) * reach * 1.1],
    ];
    parts.push(paint(tube(pts, (t) => 0.055 - t * 0.025, 4), (_p, f) => (speckle(f, 15) ? "#7a8a4a" : "#5e4630")));
  }
  for (let i = 0; i < 4; i++) {
    const g = jitter(tf(ico(0.35, 0), { s: [1, 0.6, 1], p: [(r() - 0.5) * 0.5, top + 0.1 + r() * 0.2, (r() - 0.5) * 0.5] }), 0.05, i);
    parts.push(paint(g, mix("#4f7a3a", "#7aa35c", r())));
  }
  return { geometry: merge(parts), sway: 0 };
}

// ───────────── Reef ─────────────

function seagrass(): DecoModel {
  const r = rng(21);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const h = 0.5 + r() * 0.6;
    const blade = box(0.06, h, 0.012);
    blade.translate((r() - 0.5) * 0.7, h / 2, (r() - 0.5) * 0.7);
    blade.rotateY(r() * Math.PI);
    parts.push(paint(blade, mix("#4f9f6f", "#8fcf7f", r())));
  }
  return { geometry: merge(parts), sway: 0.12 };
}

function brainCoral(): DecoModel {
  const g = jitter(tf(ico(0.45, 2), { s: [1, 0.62, 0.9], p: [0, 0.12, 0] }), 0.03, 4);
  return {
    geometry: merge([paint(g, (p) => (Math.sin(p.x * 22 + Math.sin(p.z * 9) * 2) > 0.2 ? "#e8b07a" : "#c98a5a"))]),
    sway: 0,
  };
}

function staghorn(): DecoModel {
  const parts: THREE.BufferGeometry[] = [];
  const r = rng(31);
  const grow = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
    const to = from.clone().addScaledVector(dir, len);
    const g = cyl(rad * 0.7, rad, len, 5);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.translate(from.x, from.y, from.z);
    parts.push(paint(g, depth === 0 ? "#f2d8b8" : "#d8a878"));
    if (depth === 0) return;
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const nd = dir
        .clone()
        .add(new THREE.Vector3((r() - 0.5) * 1.4, 0.3 + r() * 0.3, (r() - 0.5) * 1.4))
        .normalize();
      grow(to, nd, len * 0.72, rad * 0.7, depth - 1);
    }
  };
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    grow(new THREE.Vector3(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12), new THREE.Vector3(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4).normalize(), 0.35, 0.06, 2);
  }
  return { geometry: merge(parts), sway: 0 };
}

function anemone(): DecoModel {
  const parts: THREE.BufferGeometry[] = [paint(tf(cyl(0.2, 0.26, 0.22, 8), { p: [0, 0.11, 0] }), "#a85a8a")];
  const r = rng(41);
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 0.18;
    const h = 0.25 + r() * 0.2;
    const t = cone(0.022, h, 4);
    t.translate(0, h / 2, 0);
    t.rotateX((r() - 0.5) * 0.9);
    t.rotateZ((r() - 0.5) * 0.9);
    t.translate(Math.cos(a) * d, 0.2, Math.sin(a) * d);
    parts.push(paint(t, (p) => (p.y > 0.38 ? "#ffd0e8" : "#e87ab0")));
  }
  return { geometry: merge(parts), sway: 0.25 };
}

function seaFan(): DecoModel {
  // A flat fan of thin branches, like a gorgonian.
  const parts: THREE.BufferGeometry[] = [paint(tf(cyl(0.03, 0.05, 0.2, 5), { p: [0, 0.1, 0] }), "#8a3a4a")];
  const r = rng(51);
  const branch = (x: number, y: number, angle: number, len: number, depth: number) => {
    const x2 = x + Math.sin(angle) * len;
    const y2 = y + Math.cos(angle) * len;
    const g = cyl(0.012 + depth * 0.004, 0.016 + depth * 0.005, len, 4);
    g.translate(0, len / 2, 0);
    g.rotateZ(-angle);
    g.translate(x, y, 0);
    parts.push(paint(g, depth > 1 ? "#c84a6a" : "#e86a7a"));
    if (depth === 0) return;
    for (const s of [-1, 1]) branch(x2, y2, angle + s * (0.35 + r() * 0.3), len * (0.72 + r() * 0.12), depth - 1);
  };
  branch(0, 0.18, 0, 0.3, 4);
  return { geometry: merge(parts), sway: 0.04 };
}

function tubeSponge(): DecoModel {
  const parts: THREE.BufferGeometry[] = [];
  const cols = ["#b06ad8", "#ff9a5a", "#c47ae8"];
  const spots: [number, number, number][] = [
    [0, 0, 0.9],
    [0.22, 0.1, 0.65],
    [-0.18, 0.15, 0.55],
    [0.05, -0.22, 0.45],
  ];
  spots.forEach(([x, z, h], i) => {
    const g = lathe([[0.08, 0], [0.11, h * 0.5], [0.13, h], [0.1, h]], 7);
    g.rotateX(-Math.PI / 2);
    g.translate(x, 0, z);
    parts.push(paint(g, (_p, f) => (speckle(f, 25, i) ? mix(cols[i % 3], "#ffffff", 0.2) : cols[i % 3])));
  });
  return { geometry: merge(parts), sway: 0.02 };
}

function giantClam(): DecoModel {
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const half = new THREE.SphereGeometry(0.42, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    half.scale(1, 0.55, 0.62);
    half.rotateZ(s * (Math.PI / 2 - 0.25));
    half.translate(s * 0.06, 0.25, 0);
    parts.push(paint(jitter(half, 0.03, s + 3), (_p, f) => (speckle(f, 30) ? "#c8c0a8" : "#e8e0c8")));
  }
  parts.push(paint(tf(sphere(0.5, 8, 4), { s: [0.16, 0.42, 0.5], p: [0, 0.32, 0] }), (_p, f) => (speckle(f, 35) ? "#7af0e0" : "#2fb0b8")));
  return { geometry: merge(parts), sway: 0 };
}

function shipwreck(): DecoModel {
  const parts: THREE.BufferGeometry[] = [];
  const hull = new THREE.BoxGeometry(0.75, 0.45, 1.9, 2, 2, 4);
  const pos = hull.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const y = pos.getY(i);
    let x = pos.getX(i);
    if (z > 0.4) x *= 1 - (z - 0.4) * 0.9; // pointed bow
    if (y < 0) x *= 0.75; // narrower keel
    pos.setX(i, x);
  }
  hull.rotateZ(0.32);
  hull.rotateX(0.06);
  hull.translate(0, 0.16, 0);
  const wood = (_p: THREE.Vector3, f: number) => (speckle(f, 10) ? "#6f8a5a" : speckle(f, 30, 1) ? "#5a4030" : "#8a6444");
  parts.push(paint(hull, wood));
  const mast = cyl(0.05, 0.06, 1.3, 5);
  mast.translate(0, 0.65, 0);
  mast.rotateZ(0.9);
  mast.translate(0.1, 0.3, -0.2);
  parts.push(paint(mast, "#6a4a32"));
  const plank = box(0.5, 0.04, 0.12);
  plank.rotateY(0.6);
  plank.translate(-0.55, 0.03, 0.6);
  parts.push(paint(plank, "#7a5a3e"));
  return { geometry: merge(parts), sway: 0 };
}


// ───────────── Open Ocean ─────────────

function buoy(): DecoModel {
  const parts = [
    paint(tf(cyl(0.16, 0.2, 0.3, 8), { p: [0, 0.05, 0] }), (p) => (Math.floor((p.y + 1) * 10) % 2 ? "#e8463a" : "#f2f2ea")),
    paint(tf(cyl(0.03, 0.04, 0.5, 5), { p: [0, 0.45, 0] }), "#d8d8d0"),
    paint(tf(cone(0.08, 0.12, 6), { p: [0, 0.74, 0] }), "#e8463a"),
  ];
  const lamp = glow(paint(tf(ico(0.05, 1), { p: [0, 0.68, 0] }), "#ffe08a"), 1);
  return { geometry: merge(parts), sway: 0, glow: { geometry: merge([lamp]), color: "#ffe08a" } };
}

function driftingLog(): DecoModel {
  const log = cyl(0.13, 0.15, 1.4, 7, 2);
  log.rotateZ(Math.PI / 2);
  log.rotateY(0.4);
  const parts = [paint(log, (p, f) => (Math.abs(p.x) > 0.6 ? "#b8956a" : speckle(f, 18) ? "#d8d0b0" : "#6e5236"))];
  for (let i = 0; i < 6; i++) parts.push(paint(tf(cone(0.03, 0.04, 5), { p: [-0.4 + i * 0.16, -0.12, (i % 2) * 0.05], r: [Math.PI, 0, 0] }), "#e8e0c8"));
  return { geometry: merge(parts), sway: 0 };
}

function sargassum(): DecoModel {
  const r = rng(61);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 26; i++) {
    const g = sphere(0.5, 5, 3);
    g.scale(0.09 + r() * 0.08, 0.03, 0.05 + r() * 0.06);
    g.rotateY(r() * Math.PI);
    g.translate((r() - 0.5) * 1.1, 0.01 - r() * 0.05, (r() - 0.5) * 0.8);
    parts.push(paint(g, mix("#a8822a", "#d8b450", r())));
  }
  for (let i = 0; i < 18; i++) parts.push(paint(tf(ico(0.025, 0), { p: [(r() - 0.5) * 1, -0.03, (r() - 0.5) * 0.7] }), "#c8a03a"));
  return { geometry: merge(parts), sway: 0 };
}

function kelpColumn(ctx: Ctx): DecoModel {
  const r = rng(71);
  const parts: THREE.BufferGeometry[] = [];
  const top = ctx.waterH * 0.92;
  for (let s = 0; s < 3; s++) {
    const ox = (s - 1) * 0.16;
    const pts: V3[] = [];
    for (let i = 0; i <= 6; i++) pts.push([ox + Math.sin(i * 1.3 + s) * 0.08, (top * i) / 6, Math.cos(i * 1.1 + s) * 0.06]);
    parts.push(paint(tube(pts, 0.018, 4), "#6f7a2a"));
    for (let i = 1; i < 14; i++) {
      const y = (top * i) / 14;
      const leaf = sphere(0.5, 5, 3);
      leaf.scale(0.05, 0.22, 0.012);
      leaf.translate(0, 0.11, 0);
      leaf.rotateZ((i % 2 ? 1 : -1) * (0.6 + r() * 0.4));
      leaf.rotateY(r() * Math.PI);
      leaf.translate(ox + Math.sin((i / 14) * 6 * 1.3 + s) * 0.08, y, 0);
      parts.push(paint(leaf, mix("#8a8a2a", "#b8a83a", r())));
      if (i % 3 === 0) parts.push(paint(tf(ico(0.03, 0), { p: [ox, y, 0.02] }), "#c8b04a"));
    }
  }
  return { geometry: merge(parts), sway: 0.008 };
}

function moonJellies(ctx: Ctx): DecoModel {
  const r = rng(81);
  const parts: THREE.BufferGeometry[] = [];
  for (let j = 0; j < 5; j++) {
    const x = (r() - 0.5) * 0.9;
    const z = (r() - 0.5) * 0.9;
    const y = ctx.waterH * (0.3 + r() * 0.45);
    const s = 0.12 + r() * 0.08;
    const bell = new THREE.SphereGeometry(s, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    bell.scale(1, 0.55, 1);
    bell.translate(x, y, z);
    parts.push(glow(paint(bell, (p) => (Math.hypot(p.x - x, p.z - z) < s * 0.45 ? "#f2b8d8" : "#dfe4f8")), 0.25));
    for (let t = 0; t < 6; t++) {
      const a = (t / 6) * Math.PI * 2;
      parts.push(paint(tube([[x + Math.cos(a) * s * 0.8, y, z + Math.sin(a) * s * 0.8], [x + Math.cos(a) * s * 0.9, y - s * 0.8, z + Math.sin(a) * s * 0.9], [x + Math.cos(a) * s, y - s * 1.5, z + Math.sin(a) * s]], 0.005, 3), "#e8ecf8"));
    }
  }
  return { geometry: merge(parts), sway: 0, spin: 0.05 };
}

/** A shell of tiny fish around a center; the whole ball slowly spins. */
function swarm(opts: { y: number; r: number; n: number; seed: number; color: string; glowAmt: number; fish: boolean; squash?: number }): THREE.BufferGeometry[] {
  const rr = rng(opts.seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < opts.n; i++) {
    const u = rr() * 2 - 1;
    const a = rr() * Math.PI * 2;
    const k = Math.sqrt(1 - u * u);
    const rad = opts.r * (0.7 + rr() * 0.3);
    const p = new THREE.Vector3(Math.cos(a) * k * rad, u * rad * (opts.squash ?? 1) + opts.y, Math.sin(a) * k * rad);
    let g: THREE.BufferGeometry;
    if (opts.fish) {
      g = cone(0.018, 0.08, 3);
      g.rotateZ(-Math.PI / 2);
      g.rotateY(-a); // pointing around the ball, like a swirl
    } else g = ico(0.016, 0);
    g.translate(p.x, p.y, p.z);
    parts.push(glow(paint(g, mix(opts.color, "#ffffff", rr() * 0.3)), opts.glowAmt));
  }
  return parts;
}

function baitBall(ctx: Ctx): DecoModel {
  return { geometry: merge(swarm({ y: ctx.waterH * 0.45, r: 0.45, n: 90, seed: 91, color: "#b8c8d8", glowAmt: 0, fish: true })), sway: 0, spin: 0.9 };
}

function krillSwarm(ctx: Ctx): DecoModel {
  return { geometry: merge(swarm({ y: ctx.waterH * 0.5, r: 0.6, n: 140, seed: 92, color: "#ff8a5a", glowAmt: 0.25, fish: false, squash: 0.6 })), sway: 0, spin: 0.3 };
}

function planktonBloom(ctx: Ctx): DecoModel {
  return { geometry: merge(swarm({ y: ctx.waterH * 0.6, r: 0.8, n: 160, seed: 93, color: "#b8d86a", glowAmt: 0.35, fish: false, squash: 0.5 })), sway: 0, spin: 0.12 };
}

function seamount(): DecoModel {
  const g = jitter(new THREE.ConeGeometry(0.55, 1.5, 8, 4), 0.1, 17);
  g.translate(0, 0.75, 0);
  return {
    geometry: merge([paint(g, (p, f) => (p.y > 1.2 && speckle(f, 40) ? "#d87a5a" : speckle(f, 20) ? "#5a6a7a" : "#3f4a58"))]),
    sway: 0,
  };
}

// ───────────── Deep Sea ─────────────

function pillowLava(): DecoModel {
  const r = rng(101);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const g = jitter(tf(sphere(0.5, 7, 5), { s: [0.3 + r() * 0.2, 0.2 + r() * 0.12, 0.25 + r() * 0.15], p: [(r() - 0.5) * 0.7, 0.08 + r() * 0.12, (r() - 0.5) * 0.6] }), 0.03, i);
    parts.push(paint(g, (_p, f) => (speckle(f, 15) ? "#3a3f4a" : "#22262e")));
  }
  return { geometry: merge(parts), sway: 0 };
}

function seaPen(): DecoModel {
  const parts: THREE.BufferGeometry[] = [paint(tf(cyl(0.025, 0.035, 0.9, 5), { p: [0, 0.45, 0] }), "#c87aa8")];
  for (let i = 0; i < 9; i++) {
    const y = 0.35 + i * 0.065;
    for (const s of [-1, 1]) {
      const leaf = sphere(0.5, 5, 3);
      leaf.scale(0.17 - i * 0.012, 0.025, 0.04);
      leaf.translate(s * (0.09 - i * 0.006), 0, 0);
      leaf.rotateZ(s * 0.35);
      leaf.translate(0, y, 0);
      parts.push(glow(paint(leaf, "#e89ad0"), 0.55));
    }
  }
  return { geometry: merge(parts), sway: 0.05 };
}

function glassSponge(): DecoModel {
  const g = lathe([[0.08, 0], [0.12, 0.2], [0.17, 0.5], [0.2, 0.8], [0.22, 0.95], [0.2, 0.96]], 10);
  g.rotateX(-Math.PI / 2);
  return { geometry: merge([glow(paint(g, (_p, f) => (f % 3 === 0 ? "#bfe8f0" : "#e8f4f2")), 0.35)]), sway: 0 };
}

function tubeWorms(): DecoModel {
  const r = rng(111);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const x = (r() - 0.5) * 0.6;
    const z = (r() - 0.5) * 0.6;
    const h = 0.4 + r() * 0.5;
    parts.push(paint(tf(cyl(0.025, 0.03, h, 5), { p: [x, h / 2, z], r: [(r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2] }), "#e8e4d8"));
    parts.push(paint(tf(cone(0.045, 0.14, 6), { p: [x, h + 0.06, z] }), "#d8283a"));
  }
  return { geometry: merge(parts), sway: 0.06 };
}

function coldWaterCoral(): DecoModel {
  const m = staghorn();
  // Repaint the staghorn shape pale white for Lophelia-style deep coral.
  const col = m.geometry.attributes.color as THREE.BufferAttribute;
  const c = new THREE.Color();
  for (let i = 0; i < col.count; i++) {
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).lerp(new THREE.Color("#f2f0e8"), 0.75);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  return m;
}

function hydrothermalVent(): DecoModel {
  const parts: THREE.BufferGeometry[] = [];
  const glowParts: THREE.BufferGeometry[] = [];
  const r = rng(121);
  for (let i = 0; i < 4; i++) {
    const h = 0.35 + i * 0.22;
    const g = jitter(cyl(0.16 - i * 0.03, 0.22 - i * 0.03, h * 0.6, 7, 2), 0.03, i);
    g.translate((r() - 0.5) * 0.05, h * 0.55, 0);
    parts.push(paint(g, (_p, f) => (speckle(f, 14) ? "#ff6a3d" : speckle(f, 30, 2) ? "#3a2a24" : "#2a2422")));
  }
  // Glowing cracks and the hot mouth at the top.
  const mouth = glow(paint(tf(cyl(0.07, 0.08, 0.05, 7), { p: [0, 1.0, 0] }), "#ff8a3d"), 1);
  glowParts.push(mouth);
  for (let i = 0; i < 6; i++) glowParts.push(glow(paint(tf(ico(0.03, 0), { p: [(r() - 0.5) * 0.3, 0.15 + r() * 0.7, (r() - 0.5) * 0.25] }), "#ff6a3d"), 1));
  // Plume of dark mineral "smoke" rising out.
  for (let i = 0; i < 10; i++) parts.push(paint(tf(ico(0.06 + i * 0.012, 0), { p: [Math.sin(i) * 0.05, 1.08 + i * 0.09, Math.cos(i) * 0.04] }), mix("#3a3436", "#20242a", i / 10)));
  return { geometry: merge(parts), sway: 0.015, glow: { geometry: merge(glowParts), color: "#ff6a3d" }, light: { color: "#ff7a3d", intensity: 6, y: 1.1 } };
}

function brinePool(): DecoModel {
  const pool = new THREE.CircleGeometry(0.5, 14);
  pool.rotateX(-Math.PI / 2);
  pool.translate(0, 0.03, 0);
  const parts = [glow(paint(pool, (_p, f) => (f % 4 === 0 ? "#1f3a5a" : "#0f2236")), 0.25)];
  const r = rng(131);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    parts.push(paint(tf(sphere(0.5, 5, 3), { s: [0.08, 0.05, 0.05], r: [0, -a, 0], p: [Math.cos(a) * (0.52 + r() * 0.05), 0.04, Math.sin(a) * (0.52 + r() * 0.05)] }), mix("#3a3a46", "#6a5a7a", r())));
  }
  return { geometry: merge(parts), sway: 0 };
}

function whaleFall(): DecoModel {
  const bone = "#e8e2d0";
  const parts: THREE.BufferGeometry[] = [];
  // Spine
  for (let i = 0; i < 16; i++) {
    const z = 0.8 - i * 0.1;
    parts.push(paint(tf(box(0.08, 0.07, 0.07), { p: [Math.sin(i * 0.3) * 0.05, 0.06, z] }), bone));
  }
  // Ribs, half-buried
  for (let i = 0; i < 9; i++) {
    const z = 0.5 - i * 0.09;
    const w = 0.3 - Math.abs(i - 3) * 0.025;
    for (const s of [-1, 1]) parts.push(paint(tube([[0, 0.08, z], [s * w * 0.7, 0.26, z], [s * w, 0.05, z - 0.04]], 0.018, 4), bone));
  }
  // Skull block
  parts.push(paint(jitter(tf(box(0.32, 0.18, 0.42), { p: [0, 0.09, 0.98] }), 0.02, 5), bone));
  // Bacterial mats and tiny scavengers colonising it.
  const r = rng(141);
  for (let i = 0; i < 14; i++) parts.push(glow(paint(tf(ico(0.03, 0), { p: [(r() - 0.5) * 0.6, 0.03, (r() - 0.5) * 1.6] }), "#f2d8a0"), 0.3));
  return { geometry: merge(parts), sway: 0 };
}

// ───────────── Tidepool ─────────────

const WET_ROCK = (_p: THREE.Vector3, f: number) => (speckle(f, 20) ? "#5a5656" : speckle(f, 12, 3) ? "#8a8484" : "#6e6a6a");

/** Little white volcano cones scattered over a surface. */
function barnacles(parts: THREE.BufferGeometry[], n: number, seed: number, place: (r: () => number) => V3, size = 0.045) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = place(r);
    const s = size * (0.7 + r() * 0.6);
    parts.push(paint(tf(cyl(s * 0.45, s, s * 0.9, 5), { p: [x, y + s * 0.4, z] }), (p) => (p.y > y + s * 0.8 ? "#9a9488" : "#efe9dc")));
  }
}

function barnacleRock(): DecoModel {
  const parts = [paint(jitter(tf(ico(0.5, 1), { s: [1, 0.6, 0.8], p: [0, 0.22, 0] }), 0.06, 41), WET_ROCK)];
  barnacles(parts, 22, 42, (r) => {
    const a = r() * Math.PI * 2;
    const k = 0.3 + r() * 0.15;
    return [Math.cos(a) * k, 0.38 + r() * 0.12, Math.sin(a) * k * 0.8];
  });
  return { geometry: merge(parts), sway: 0 };
}

function musselCluster(): DecoModel {
  const parts = [paint(jitter(tf(ico(0.4, 1), { s: [1.1, 0.4, 0.9], p: [0, 0.1, 0] }), 0.05, 43), WET_ROCK)];
  const r = rng(44);
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const k = r() * 0.32;
    const g = tf(sphere(0.5, 6, 4), { s: [0.07, 0.05, 0.16], r: [r() * 0.8 - 0.4, a, 0.3], p: [Math.cos(a) * k, 0.2 + r() * 0.08, Math.sin(a) * k] });
    parts.push(paint(g, (p) => (p.y > 0.25 ? "#3a4a6a" : "#1e2432")));
  }
  return { geometry: merge(parts), sway: 0 };
}

function greenAnemone(): DecoModel {
  const parts: THREE.BufferGeometry[] = [paint(jitter(tf(ico(0.35, 1), { s: [1, 0.35, 1], p: [0, 0.06, 0] }), 0.04, 45), WET_ROCK)];
  const r = rng(46);
  for (const [cx, cz, s] of [[0, 0, 1], [0.32, 0.2, 0.7]] as [number, number, number][]) {
    parts.push(paint(tf(cyl(0.16 * s, 0.2 * s, 0.22 * s, 9), { p: [cx, 0.17 * s, cz] }), "#4f8a5a"));
    parts.push(paint(tf(cyl(0.18 * s, 0.17 * s, 0.03, 12), { p: [cx, 0.29 * s, cz] }), "#a8e0a0"));
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + r() * 0.2;
      const k = (0.08 + r() * 0.09) * s;
      parts.push(paint(tf(cone(0.022 * s, 0.11 * s, 3), { r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], p: [cx + Math.cos(a) * k, 0.33 * s, cz + Math.sin(a) * k] }), mix("#7ad87a", "#c8f0a8", r())));
    }
  }
  return { geometry: merge(parts), sway: 0.006 };
}

function seaLettuce(): DecoModel {
  const r = rng(47);
  const parts: THREE.BufferGeometry[] = [paint(jitter(tf(ico(0.22, 0), { s: [1, 0.5, 1], p: [0, 0.05, 0] }), 0.03, 48), WET_ROCK)];
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const leaf = sphere(0.5, 6, 4);
    leaf.scale(0.26 + r() * 0.12, 0.42 + r() * 0.2, 0.03);
    leaf.translate(0, 0.2, 0);
    leaf.rotateX((r() - 0.5) * 0.8);
    leaf.rotateY(a);
    leaf.translate(Math.cos(a) * 0.08, 0.04, Math.sin(a) * 0.08);
    parts.push(paint(leaf, mix("#5fbf4a", "#a8e070", r())));
  }
  return { geometry: merge(parts), sway: 0.03 };
}

function corallineAlgae(): DecoModel {
  const parts: THREE.BufferGeometry[] = [paint(jitter(tf(ico(0.42, 1), { s: [1.1, 0.35, 0.9], p: [0, 0.08, 0] }), 0.05, 49), (_p, f) => (speckle(f, 30) ? "#e8a0b8" : "#c87a98"))];
  const r = rng(50);
  for (let i = 0; i < 14; i++) {
    const x = (r() - 0.5) * 0.6;
    const z = (r() - 0.5) * 0.5;
    const h = 0.12 + r() * 0.12;
    parts.push(paint(tube([[x, 0.15, z], [x + (r() - 0.5) * 0.06, 0.15 + h * 0.5, z], [x + (r() - 0.5) * 0.1, 0.15 + h, z + (r() - 0.5) * 0.06]], 0.016, 3), mix("#e890b0", "#ffc8d8", r())));
  }
  return { geometry: merge(parts), sway: 0 };
}

function tidePuddle(): DecoModel {
  const parts: THREE.BufferGeometry[] = [];
  const r = rng(51);
  // A ring of rocks around a shallow, sandy hollow with a few shells.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.3;
    const k = 0.42 + r() * 0.06;
    parts.push(paint(jitter(tf(ico(0.13 + r() * 0.07, 0), { s: [1, 0.7, 1], p: [Math.cos(a) * k, 0.07, Math.sin(a) * k] }), 0.02, i), WET_ROCK));
  }
  parts.push(paint(tf(cyl(0.38, 0.38, 0.02, 14), { p: [0, 0.015, 0] }), "#d8c89a"));
  parts.push(paint(tf(cyl(0.34, 0.34, 0.012, 14), { p: [0, 0.035, 0] }), "#9ad8d0"));
  for (let i = 0; i < 4; i++) parts.push(paint(tf(cone(0.03, 0.05, 5), { p: [(r() - 0.5) * 0.4, 0.04, (r() - 0.5) * 0.4] }), mix("#f2d0a0", "#ff9f68", r())));
  barnacles(parts, 8, 52, (rr) => {
    const a = rr() * Math.PI * 2;
    return [Math.cos(a) * 0.45, 0.13, Math.sin(a) * 0.45];
  }, 0.03);
  return { geometry: merge(parts), sway: 0 };
}

function driftwood(): DecoModel {
  const wood = (_p: THREE.Vector3, f: number) => (speckle(f, 22) ? "#a8a090" : "#cfc6b4");
  const parts = [
    paint(tube([[-0.6, 0.08, -0.1], [-0.2, 0.12, 0.02], [0.2, 0.1, -0.04], [0.6, 0.06, 0.08]], (t) => 0.09 * (1 - t * 0.5), 6), wood),
    paint(tube([[-0.05, 0.12, 0.0], [0.05, 0.26, 0.18], [0.0, 0.36, 0.32]], (t) => 0.04 * (1 - t * 0.7), 4), wood),
    paint(tube([[0.3, 0.1, -0.02], [0.42, 0.2, -0.22], [0.5, 0.24, -0.3]], (t) => 0.03 * (1 - t * 0.7), 4), wood),
  ];
  return { geometry: merge(parts), sway: 0 };
}

function seaArch(): DecoModel {
  const parts = [
    paint(jitter(tf(cyl(0.2, 0.3, 0.85, 7, 2), { p: [-0.5, 0.42, 0] }), 0.05, 53), WET_ROCK),
    paint(jitter(tf(cyl(0.2, 0.3, 0.85, 7, 2), { p: [0.5, 0.42, 0] }), 0.05, 54), WET_ROCK),
    paint(tube([[-0.52, 0.75, 0], [-0.28, 1.08, 0], [0.28, 1.08, 0], [0.52, 0.75, 0]], 0.18, 6), WET_ROCK),
  ];
  barnacles(parts, 18, 55, (r) => [(r() - 0.5) * 1.2, r() * 0.35, (r() < 0.5 ? -1 : 1) * 0.22]);
  parts.push(paint(tf(sphere(0.5, 6, 3), { s: [0.5, 0.05, 0.3], p: [0, 0.02, 0] }), "#c87a98"));
  return { geometry: merge(parts), sway: 0 };
}

// ───────────── Amazon River ─────────────

const BARK = (_p: THREE.Vector3, f: number) => (speckle(f, 25) ? "#4a3620" : speckle(f, 15, 2) ? "#6e5232" : "#5b4630");

function riverStones(): DecoModel {
  const r = rng(101);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const s = 0.12 + r() * 0.12;
    parts.push(paint(tf(sphere(s, 7, 5), { s: [1.2, 0.55, 1], r: [0, r() * 3, 0], p: [(r() - 0.5) * 0.8, s * 0.4, (r() - 0.5) * 0.7] }), mix("#7a6a52", "#a89a80", r())));
  }
  return { geometry: merge(parts), sway: 0 };
}

function sunkenBranch(): DecoModel {
  const parts = [
    paint(tube([[-0.55, 0.06, -0.2], [-0.1, 0.12, 0], [0.3, 0.08, 0.15], [0.55, 0.05, 0.3]], (t) => 0.06 * (1 - t * 0.5), 5), BARK),
    paint(tube([[-0.1, 0.12, 0], [-0.15, 0.3, 0.2], [-0.3, 0.45, 0.3]], (t) => 0.03 * (1 - t * 0.6), 4), BARK),
    paint(tube([[0.2, 0.1, 0.1], [0.3, 0.32, -0.1], [0.25, 0.5, -0.25]], (t) => 0.025 * (1 - t * 0.6), 4), BARK),
    paint(tube([[0.35, 0.08, 0.18], [0.5, 0.22, 0.0], [0.6, 0.3, -0.05]], (t) => 0.02 * (1 - t * 0.6), 4), BARK),
  ];
  return { geometry: merge(parts), sway: 0 };
}

function leafShape(len: number, w: number) {
  const s = new THREE.Shape([[0, len / 2], [w / 2, 0], [0, -len / 2], [-w / 2, 0]].map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  return g;
}

function floatingLeaves(): DecoModel {
  const r = rng(102);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const g = leafShape(0.2 + r() * 0.12, 0.1 + r() * 0.05);
    g.rotateY(r() * Math.PI * 2);
    g.translate((r() - 0.5) * 0.9, 0.02, (r() - 0.5) * 0.9);
    parts.push(paint(g, mix(["#8a6a2a", "#a8803a", "#6e8a3a", "#c89a4a"][i % 4], "#000000", r() * 0.15)));
  }
  return { geometry: merge(parts), sway: 0 };
}

function waterLettuce(ctx: Ctx): DecoModel {
  const r = rng(103);
  const parts: THREE.BufferGeometry[] = [];
  for (const [cx, cz, s] of [[0, 0, 1], [0.38, 0.22, 0.75], [-0.32, 0.3, 0.65]] as [number, number, number][]) {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const leaf = sphere(0.5, 5, 4);
      leaf.scale(0.12 * s, 0.05 * s, 0.2 * s);
      leaf.rotateX(-0.5);
      leaf.translate(0, 0.04 * s, 0.09 * s);
      leaf.rotateY(a);
      leaf.translate(cx, 0.02, cz);
      parts.push(paint(leaf, mix("#9ac86a", "#c8e8a0", r())));
    }
    // Feathery roots dangling below the surface.
    for (let k = 0; k < 5; k++) {
      const x = cx + (r() - 0.5) * 0.1;
      const z = cz + (r() - 0.5) * 0.1;
      const d = Math.min(ctx.waterH * 0.3, 0.45) * s;
      parts.push(paint(tube([[x, 0, z], [x + (r() - 0.5) * 0.05, -d * 0.5, z], [x + (r() - 0.5) * 0.08, -d, z + (r() - 0.5) * 0.05]], 0.008, 3), "#d8c8a8"));
    }
  }
  return { geometry: merge(parts), sway: 0.01 };
}

function mossyLog(): DecoModel {
  const moss = (p: THREE.Vector3, f: number) => (p.y > 0.13 ? (speckle(f, 30) ? "#7aa84a" : "#5f8a3a") : BARK(p, f));
  const parts = [
    paint(tube([[-0.6, 0.11, 0], [0, 0.12, 0.02], [0.6, 0.1, -0.02]], 0.11, 7), moss),
    paint(tf(cyl(0.11, 0.11, 0.02, 7), { r: [0, 0, Math.PI / 2], p: [0.61, 0.1, -0.02] }), "#a8865a"),
    paint(tube([[0.2, 0.18, 0.0], [0.28, 0.35, 0.12], [0.26, 0.48, 0.22]], (t) => 0.025 * (1 - t * 0.5), 4), BARK),
  ];
  return { geometry: merge(parts), sway: 0 };
}

function hangingRoots(ctx: Ctx): DecoModel {
  const r = rng(104);
  const parts: THREE.BufferGeometry[] = [];
  // A low branch just above the water with roots trailing down into it.
  parts.push(paint(tube([[-0.6, 0.5, -0.1], [0, 0.42, 0], [0.6, 0.5, 0.1]], 0.07, 6), BARK));
  for (let i = 0; i < 9; i++) {
    const x = -0.5 + i * 0.12 + (r() - 0.5) * 0.06;
    const z = (r() - 0.5) * 0.3;
    const d = ctx.waterH * (0.25 + r() * 0.3);
    parts.push(paint(tube([[x, 0.42, z], [x + (r() - 0.5) * 0.1, 0.1, z], [x + (r() - 0.5) * 0.12, -d * 0.6, z + (r() - 0.5) * 0.1], [x + (r() - 0.5) * 0.15, -d, z]], (t) => 0.018 * (1 - t * 0.6), 4), mix("#6e5232", "#a8865a", r())));
  }
  for (let i = 0; i < 6; i++) {
    const g = leafShape(0.18, 0.08);
    g.rotateZ(0.6);
    g.rotateY(r() * Math.PI * 2);
    g.translate((r() - 0.5) * 1.1, 0.5 + r() * 0.1, (r() - 0.5) * 0.3);
    parts.push(paint(g, "#5f9e4a"));
  }
  return { geometry: merge(parts), sway: 0.01 };
}

function victoriaLily(): DecoModel {
  const parts: THREE.BufferGeometry[] = [];
  // Huge round pads with a red, upturned rim.
  for (const [x, z, rad] of [[0, 0, 0.42], [0.55, 0.3, 0.3], [-0.45, 0.35, 0.26]] as [number, number, number][]) {
    parts.push(paint(tf(cyl(rad, rad, 0.02, 16), { p: [x, 0.02, z] }), (_p, f) => (speckle(f, 15) ? "#4f8a3a" : "#5f9e4a")));
    parts.push(paint(tf(new THREE.CylinderGeometry(rad + 0.02, rad, 0.07, 16, 1, true), { p: [x, 0.05, z] }), "#b8403a"));
  }
  // One pale flower.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const pt = cone(0.05, 0.16, 3);
    pt.rotateZ(0.6);
    pt.rotateY(a);
    pt.translate(0.55 + Math.cos(a) * 0.05, 0.1, -0.35 + Math.sin(a) * 0.05);
    parts.push(paint(pt, k % 2 ? "#fff4f0" : "#f6c8d8"));
  }
  parts.push(paint(tf(ico(0.045, 0), { p: [0.55, 0.12, -0.35] }), "#f2d26a"));
  return { geometry: merge(parts), sway: 0 };
}

function floodedTrunk(ctx: Ctx): DecoModel {
  const top = ctx.waterH + 0.7;
  const parts: THREE.BufferGeometry[] = [paint(jitter(tf(cyl(0.16, 0.22, top, 7, 6), { p: [0, top / 2, 0] }), 0.02, 105), BARK)];
  // Buttress roots flaring out at the base.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    parts.push(paint(tube([[0, 0.45, 0], [Math.cos(a) * 0.25, 0.15, Math.sin(a) * 0.25], [Math.cos(a) * 0.45, 0.02, Math.sin(a) * 0.45]], (t) => 0.07 * (1 - t * 0.6), 4), BARK));
  }
  // Branches and leaves above the waterline.
  for (const [a, h] of [[0.4, 0.82], [2.6, 0.9], [4.4, 0.95]] as [number, number][]) {
    const y = top * h;
    parts.push(paint(tube([[0, y, 0], [Math.cos(a) * 0.3, y + 0.15, Math.sin(a) * 0.3], [Math.cos(a) * 0.5, y + 0.25, Math.sin(a) * 0.5]], 0.03, 4), BARK));
    parts.push(paint(tf(ico(0.18, 0), { s: [1, 0.6, 1], p: [Math.cos(a) * 0.5, y + 0.3, Math.sin(a) * 0.5] }), "#5f9e4a"));
  }
  // A green waterline stain where the river usually sits.
  parts.push(paint(tf(cyl(0.175, 0.175, 0.06, 7), { p: [0, ctx.waterH * 0.98, 0] }), "#6e7a3a"));
  return { geometry: merge(parts), sway: 0 };
}

// ───────────── Kelp Forest ─────────────

const REEF_ROCK = (_p: THREE.Vector3, f: number) => (speckle(f, 22) ? "#4a525c" : speckle(f, 12, 4) ? "#c86a8a" : "#5a6470");

/** One kelp stipe from the holdfast to `top`, with blades and gas floats along it. */
function kelpStipe(parts: THREE.BufferGeometry[], r: () => number, ox: number, oz: number, top: number, phase: number) {
  const pts: V3[] = [];
  for (let i = 0; i <= 8; i++) pts.push([ox + Math.sin(i * 0.9 + phase) * 0.07, (top * i) / 8, oz + Math.cos(i * 0.8 + phase) * 0.05]);
  parts.push(paint(tube(pts, 0.02, 4), "#7a6a2a"));
  const n = Math.max(8, Math.round(top * 5));
  for (let i = 1; i < n; i++) {
    const y = (top * i) / n;
    const t = i / n;
    const x = ox + Math.sin(t * 8 * 0.9 + phase) * 0.07;
    const leaf = sphere(0.5, 5, 3);
    leaf.scale(0.06, 0.28, 0.012);
    leaf.translate(0, 0.14, 0);
    leaf.rotateZ((i % 2 ? 1 : -1) * (0.5 + r() * 0.4));
    leaf.rotateY(r() * Math.PI);
    leaf.translate(x, y, oz);
    parts.push(paint(leaf, mix("#8a7a2f", "#b8a040", r())));
    if (i % 3 === 0) parts.push(paint(tf(ico(0.03, 0), { p: [x, y, oz + 0.02] }), "#c8a83a"));
  }
}

function kelpCluster(): DecoModel {
  const r = rng(121);
  const parts: THREE.BufferGeometry[] = [paint(jitter(tf(ico(0.16, 0), { s: [1, 0.5, 1], p: [0, 0.05, 0] }), 0.02, 122), "#6a5a2a")];
  for (let s = 0; s < 4; s++) kelpStipe(parts, r, (s - 1.5) * 0.1, (r() - 0.5) * 0.15, 1.1 + r() * 0.6, s * 1.7);
  return { geometry: merge(parts), sway: 0.02 };
}

function giantKelp(ctx: Ctx): DecoModel {
  const r = rng(123);
  const top = ctx.waterH * 0.98;
  const parts: THREE.BufferGeometry[] = [paint(jitter(tf(ico(0.22, 0), { s: [1, 0.5, 1], p: [0, 0.06, 0] }), 0.03, 124), "#6a5a2a")];
  for (let s = 0; s < 4; s++) kelpStipe(parts, r, (s - 1.5) * 0.12, (r() - 0.5) * 0.18, top, s * 1.3);
  // The canopy: blades spreading out flat along the surface.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + r() * 0.3;
    const leaf = sphere(0.5, 5, 3);
    leaf.scale(0.08, 0.012, 0.34);
    leaf.translate(0, 0, 0.2);
    leaf.rotateY(a);
    leaf.translate(0, top - 0.02, 0);
    parts.push(paint(leaf, mix("#8a7a2f", "#a89038", r())));
  }
  return { geometry: merge(parts), sway: 0.012 };
}

function rockyBoulder(): DecoModel {
  const parts = [paint(jitter(tf(ico(0.5, 1), { s: [1.1, 0.75, 0.9], p: [0, 0.3, 0] }), 0.07, 125), REEF_ROCK)];
  const r = rng(126);
  for (let i = 0; i < 5; i++) parts.push(paint(tf(cyl(0.04, 0.05, 0.08, 6), { p: [(r() - 0.5) * 0.6, 0.55 + r() * 0.1, (r() - 0.5) * 0.4] }), mix("#ff8a6a", "#ffd0a0", r())));
  return { geometry: merge(parts), sway: 0 };
}

function seaPalm(): DecoModel {
  const r = rng(127);
  const parts: THREE.BufferGeometry[] = [paint(jitter(tf(ico(0.14, 0), { s: [1, 0.5, 1], p: [0, 0.04, 0] }), 0.02, 128), REEF_ROCK)];
  for (const [x, z, h] of [[0, 0, 0.7], [0.28, 0.15, 0.5], [-0.22, 0.2, 0.55]] as [number, number, number][]) {
    parts.push(paint(tube([[x, 0.05, z], [x + 0.03, h * 0.5, z], [x - 0.02, h, z + 0.02]], 0.03, 5), "#8a6a3a"));
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const leaf = sphere(0.5, 4, 3);
      leaf.scale(0.035, 0.012, 0.22);
      leaf.translate(0, 0, 0.11);
      leaf.rotateX(0.7);
      leaf.rotateY(a);
      leaf.translate(x - 0.02, h, z + 0.02);
      parts.push(paint(leaf, mix("#8a7a2f", "#a89a48", r())));
    }
  }
  return { geometry: merge(parts), sway: 0.02 };
}

function abaloneRock(): DecoModel {
  const parts = [paint(jitter(tf(ico(0.42, 1), { s: [1.1, 0.55, 0.9], p: [0, 0.18, 0] }), 0.05, 129), REEF_ROCK)];
  const r = rng(130);
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2;
    const g = tf(sphere(0.5, 7, 4), { s: [0.16, 0.06, 0.12], r: [0.3, a, 0], p: [Math.cos(a) * 0.25, 0.32, Math.sin(a) * 0.2] });
    // Rough brick-red outside with a shimmer of mother-of-pearl.
    parts.push(paint(g, (_p, f) => (speckle(f, 30) ? ["#9ad8e8", "#e8b8f0", "#c8f0d0"][f % 3] : "#9a5a4a")));
  }
  return { geometry: merge(parts), sway: 0 };
}

function urchinBarren(): DecoModel {
  const r = rng(131);
  const parts: THREE.BufferGeometry[] = [paint(tf(cyl(0.55, 0.6, 0.04, 12), { p: [0, 0.02, 0] }), (_p, f) => (speckle(f, 25) ? "#c86a8a" : "#8a8a8a"))];
  for (let i = 0; i < 14; i++) {
    const x = (r() - 0.5) * 0.9;
    const z = (r() - 0.5) * 0.9;
    if (Math.hypot(x, z) > 0.5) continue;
    parts.push(paint(tf(ico(0.05, 0), { p: [x, 0.08, z] }), "#4a1a5a"));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      parts.push(paint(tf(cone(0.006, 0.08, 3), { r: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1], p: [x + Math.cos(a) * 0.04, 0.09, z + Math.sin(a) * 0.04] }), "#7a3a9a"));
    }
  }
  return { geometry: merge(parts), sway: 0 };
}

function sandyChannel(): DecoModel {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) parts.push(paint(jitter(tf(sphere(0.5, 8, 3), { s: [0.5, 0.05, 0.36], p: [0, 0.02, -0.7 + i * 0.35] }), 0.01, i), i % 2 ? "#e8dcb4" : "#d8c8a0"));
  const r = rng(132);
  for (let i = 0; i < 6; i++) parts.push(paint(tf(cone(0.03, 0.05, 5), { r: [0, 0, 1.4], p: [(r() - 0.5) * 0.4, 0.04, (r() - 0.5) * 1.2] }), mix("#f2e0c0", "#e8a080", r())));
  return { geometry: merge(parts), sway: 0 };
}

function sunbeamGap(ctx: Ctx): DecoModel {
  const top = ctx.waterH;
  const parts: THREE.BufferGeometry[] = [paint(tf(cyl(0.5, 0.55, 0.02, 14), { p: [0, 0.015, 0] }), "#f4ead0")];
  // Crossed sheets of light from the surface down to a bright patch of sand.
  const rays: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(0.5, top, 1, 1);
    g.translate(0, top / 2, 0);
    g.rotateY((i / 3) * Math.PI);
    rays.push(glow(paint(g, "#fff4c8"), 0.55));
  }
  return { geometry: merge(parts), sway: 0, glow: { geometry: merge(rays), color: "#fff8d8" }, dayGlow: true };
}

// ───────────── Polar Waters ─────────────

const ICE = (p: THREE.Vector3, f: number) => (speckle(f, 22) ? "#cfe6f4" : p.y < 0 ? "#a8d0e8" : speckle(f, 14, 5) ? "#ffffff" : "#e6f4fc");

/** A chunk of ice: a squashed, jittered rock shape. */
function iceChunk(r: number, sx: number, sy: number, sz: number, seed: number) {
  return jitter(tf(ico(r, 1), { s: [sx, sy, sz] }), r * 0.12, seed);
}

function snowyRock(): DecoModel {
  const rock = jitter(tf(ico(0.45, 1), { s: [1.1, 0.7, 0.9], p: [0, 0.22, 0] }), 0.06, 141);
  return { geometry: merge([paint(rock, (p, f) => (p.y > 0.36 ? (speckle(f, 15) ? "#dfeaf2" : "#f6fbff") : speckle(f, 20) ? "#5a6a78" : "#6f8fa8"))]), sway: 0 };
}

function frozenKelp(): DecoModel {
  const r = rng(142);
  const parts: THREE.BufferGeometry[] = [paint(jitter(tf(ico(0.16, 0), { s: [1, 0.5, 1], p: [0, 0.05, 0] }), 0.02, 143), "#6f8fa8")];
  for (let s = 0; s < 4; s++) {
    const ox = (s - 1.5) * 0.12;
    const h = 0.8 + r() * 0.5;
    const pts: V3[] = [];
    for (let i = 0; i <= 5; i++) pts.push([ox + Math.sin(i * 0.9 + s) * 0.06, (h * i) / 5, Math.cos(i + s) * 0.05]);
    parts.push(paint(tube(pts, 0.02, 4), "#6a7a5a"));
    for (let i = 1; i < 8; i++) {
      const leaf = sphere(0.5, 4, 3);
      leaf.scale(0.05, 0.2, 0.012);
      leaf.translate(0, 0.1, 0);
      leaf.rotateZ((i % 2 ? 1 : -1) * 0.6);
      leaf.translate(ox, (h * i) / 8, 0);
      // Frost on the blade tips.
      parts.push(paint(leaf, (p) => (p.y > (h * i) / 8 + 0.12 ? "#eef7ff" : mix("#6a7a4a", "#9ab8c8", r()))));
    }
  }
  return { geometry: merge(parts), sway: 0.008 };
}

function iceShelfCrack(): DecoModel {
  // A thick slab at the surface with a bright crack of daylight down the middle.
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) parts.push(paint(iceChunk(0.4, 1.4, 0.32, 1.6, 144 + s), ICE).translate(s * 0.48, 0.02, 0));
  const crack = new THREE.PlaneGeometry(0.07, 1.1, 1, 6);
  crack.rotateX(-Math.PI / 2);
  crack.translate(0, 0.1, 0);
  const light = new THREE.PlaneGeometry(0.35, 1.2);
  light.translate(0, -0.6, 0);
  return {
    geometry: merge(parts),
    sway: 0,
    glow: { geometry: merge([glow(paint(crack, "#ffffff"), 1), glow(paint(light, "#e8f6ff"), 1)]), color: "#eaf8ff" },
    dayGlow: true,
  };
}

function floatingIce(): DecoModel {
  const parts = [paint(iceChunk(0.38, 1.4, 0.35, 1.1, 145), ICE), paint(iceChunk(0.18, 1.2, 0.4, 1, 146), ICE).translate(0.5, 0, 0.3)];
  return { geometry: merge(parts), sway: 0 };
}

function iceArch(): DecoModel {
  const parts = [
    paint(iceChunk(0.3, 0.8, 1.5, 0.8, 147), ICE).translate(-0.5, 0.42, 0),
    paint(iceChunk(0.3, 0.8, 1.5, 0.8, 148), ICE).translate(0.5, 0.42, 0),
    paint(tube([[-0.52, 0.75, 0], [-0.25, 1.05, 0], [0.25, 1.05, 0], [0.52, 0.75, 0]], 0.16, 6), ICE),
  ];
  return { geometry: merge(parts), sway: 0 };
}

function icebergUnderside(ctx: Ctx): DecoModel {
  // Most of the berg hangs below the surface; just a little pokes up.
  const depth = Math.min(ctx.waterH * 0.45, 2.4);
  const parts: THREE.BufferGeometry[] = [
    paint(jitter(tf(new THREE.ConeGeometry(0.62, depth, 7, 4), { r: [Math.PI, 0, 0], p: [0, -depth / 2, 0] }), 0.08, 149), ICE),
    paint(iceChunk(0.4, 1.4, 0.5, 1.2, 150), ICE).translate(0, 0.08, 0),
    paint(iceChunk(0.2, 1, 1.4, 1, 151), ICE).translate(0.2, 0.28, -0.1),
  ];
  return { geometry: merge(parts), sway: 0 };
}

function iceCave(): DecoModel {
  const mound = jitter(tf(new THREE.SphereGeometry(0.55, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), { s: [1.1, 0.9, 1] }), 0.06, 152);
  const parts = [paint(mound, ICE)];
  // The dark mouth of the cave.
  parts.push(paint(tf(new THREE.CircleGeometry(0.22, 8), { p: [0, 0.18, 0.56] }), "#2e5a7a"));
  return { geometry: merge(parts), sway: 0 };
}

function auroraCrystal(): DecoModel {
  const r = rng(153);
  const parts: THREE.BufferGeometry[] = [paint(snowyRock().geometry.clone().scale(0.6, 0.5, 0.6), "#6f8fa8")];
  const glows: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const h = 0.3 + r() * 0.45;
    const g = cone(0.06 + r() * 0.04, h, 5);
    g.translate(0, h / 2, 0);
    g.rotateZ((r() - 0.5) * 0.7);
    g.rotateX((r() - 0.5) * 0.7);
    g.translate((r() - 0.5) * 0.4, 0.18, (r() - 0.5) * 0.4);
    const col = mix("#6dffb4", "#a07bff", r());
    parts.push(glow(paint(g.clone(), col), 0.35));
    glows.push(paint(g.scale(1.02, 1.02, 1.02), col));
  }
  // The crystals light up at night (Decorations shows glow geometry after dark).
  return { geometry: merge(parts), sway: 0, glow: { geometry: merge(glows), color: "#9affd0" } };
}

const BUILDERS: Record<string, (ctx: Ctx) => DecoModel> = {
  "lily-pads": lilyPads,
  "firefly-reeds": fireflyReeds,
  cattails,
  "mossy-rock": mossyRock,
  "water-fern": waterFern,
  "sunken-log": sunkenLog,
  "clay-pot": clayPot,
  "mangrove-roots": mangroveRoots,
  seagrass,
  "brain-coral": brainCoral,
  "staghorn-coral": staghorn,
  "sea-anemone": anemone,
  "sea-fan": seaFan,
  "tube-sponge": tubeSponge,
  "giant-clam": giantClam,
  shipwreck,
  buoy,
  "drifting-log": driftingLog,
  sargassum,
  "kelp-column": kelpColumn,
  "moon-jellies": moonJellies,
  "bait-ball": baitBall,
  seamount,
  "plankton-bloom": planktonBloom,
  "krill-swarm": krillSwarm,
  "pillow-lava": pillowLava,
  "sea-pen": seaPen,
  "glass-sponge": glassSponge,
  "tube-worms": tubeWorms,
  "cold-water-coral": coldWaterCoral,
  "hydrothermal-vent": hydrothermalVent,
  "brine-pool": brinePool,
  "whale-fall": whaleFall,
  "barnacle-rock": barnacleRock,
  "mussel-cluster": musselCluster,
  "green-anemone": greenAnemone,
  "sea-lettuce": seaLettuce,
  "coralline-algae": corallineAlgae,
  "tide-puddle": tidePuddle,
  driftwood,
  "sea-arch": seaArch,
  "river-stones": riverStones,
  "sunken-branch": sunkenBranch,
  "floating-leaves": floatingLeaves,
  "water-lettuce": waterLettuce,
  "mossy-log": mossyLog,
  "hanging-roots": hangingRoots,
  "victoria-lily": victoriaLily,
  "flooded-trunk": floodedTrunk,
  "kelp-cluster": kelpCluster,
  "giant-kelp": giantKelp,
  "rocky-boulder": rockyBoulder,
  "sea-palm": seaPalm,
  "abalone-rock": abaloneRock,
  "urchin-barren": urchinBarren,
  "sandy-channel": sandyChannel,
  "sunbeam-gap": sunbeamGap,
  "snowy-rock": snowyRock,
  "frozen-kelp": frozenKelp,
  "ice-shelf-crack": iceShelfCrack,
  "floating-ice": floatingIce,
  "ice-arch": iceArch,
  "iceberg-underside": icebergUnderside,
  "ice-cave": iceCave,
  "aurora-crystal": auroraCrystal,
};

const cache = new Map<string, DecoModel>();

export function getDecoModel(decoId: string, waterH: number): DecoModel {
  const key = decoId + "|" + waterH.toFixed(2);
  const hit = cache.get(key);
  if (hit) return hit;
  const build = BUILDERS[decoId] ?? mossyRock;
  const m = build({ waterH });
  jitter(m.geometry, 0.006, hashStr(decoId));
  m.geometry.computeVertexNormals();
  cache.set(key, m);
  return m;
}
