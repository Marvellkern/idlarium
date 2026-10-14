// Free terrain features that come with each expansion level. Most reuse decoration
// models; a few are built here. Authored in decoration units (scaled by decoScale).
import * as THREE from "three";
import { getDecoModel } from "./decoModels";
import { box, cyl, glow, ico, jitter, merge, mix, paint, rng, sphere, tf, tube, type V3 } from "./geo";

export interface FeaturePart {
  geometry: THREE.BufferGeometry;
  /** Local offset (decoration units) and turn. */
  x: number;
  z: number;
  rotY: number;
  scale: number;
  sway: number;
  spin?: number;
  light?: { color: string; intensity: number; y: number };
}

const speckle = (f: number, pct: number, salt = 0) => ((f * 2654435761 + salt * 97) >>> 0) % 100 < pct;

function sandbar() {
  const g = jitter(tf(sphere(0.5, 12, 4), { s: [2.4, 0.22, 1.1], p: [0, 0.02, 0] }), 0.04, 3);
  const parts = [paint(g, (_p, f) => (speckle(f, 12) ? "#b8a678" : "#d8c896"))];
  const r = rng(5);
  for (let i = 0; i < 8; i++) parts.push(paint(tf(ico(0.05 + r() * 0.04, 0), { p: [(r() - 0.5) * 1.8, 0.1, (r() - 0.5) * 0.6] }), "#8a8270"));
  return merge(parts);
}

function coralShelf() {
  const parts = [paint(jitter(tf(box(1.7, 0.4, 0.9), { p: [0, 0.2, 0] }), 0.06, 7), (_p, f) => (speckle(f, 20) ? "#9a8a7a" : "#b8a690"))];
  const r = rng(9);
  const cols = ["#ff7b6b", "#ffd166", "#b06ad8", "#5fbf8f", "#ff9ab8"];
  for (let i = 0; i < 9; i++) {
    const g = jitter(tf(ico(0.12 + r() * 0.1, 1), { s: [1, 0.7, 1], p: [(r() - 0.5) * 1.4, 0.45, (r() - 0.5) * 0.7] }), 0.02, i);
    parts.push(paint(g, cols[i % cols.length]));
  }
  return merge(parts);
}

function sandChannel() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const g = jitter(tf(sphere(0.5, 8, 3), { s: [0.45, 0.06, 0.32], p: [0, 0.03, -1.3 + i * 0.32] }), 0.01, i);
    parts.push(paint(g, i % 2 ? "#fff4d8" : "#f2e2b6"));
  }
  return merge(parts);
}

function rockArch() {
  const rock = (_p: THREE.Vector3, f: number) => (speckle(f, 18) ? "#6a7a7a" : speckle(f, 15, 2) ? "#ff9a8a" : "#8a9696");
  const parts = [
    paint(jitter(tf(cyl(0.18, 0.28, 0.9, 7, 2), { p: [-0.55, 0.45, 0] }), 0.05, 1), rock),
    paint(jitter(tf(cyl(0.18, 0.28, 0.9, 7, 2), { p: [0.55, 0.45, 0] }), 0.05, 2), rock),
    paint(
      tube(
        ([[-0.55, 0.8, 0], [-0.3, 1.15, 0], [0.3, 1.15, 0], [0.55, 0.8, 0]] as V3[]),
        0.17,
        6,
      ),
      rock,
    ),
  ];
  return merge(parts);
}

function dropOff() {
  const parts: THREE.BufferGeometry[] = [];
  const r = rng(13);
  for (let i = 0; i < 6; i++) {
    const g = jitter(tf(box(0.6, 0.5 + r() * 0.4, 0.5), { p: [-1.5 + i * 0.6, 0.25, (r() - 0.5) * 0.15] }), 0.06, i);
    parts.push(paint(g, (p) => (p.y > 0.45 ? mix("#2f5a6a", "#5fbf8f", 0.4) : "#24404e")));
  }
  return merge(parts);
}

function trenchGlow() {
  const parts = [paint(tf(box(3.2, 0.04, 0.5), { p: [0, 0.02, 0] }), "#05070c")];
  parts.push(glow(paint(tf(box(3.2, 0.03, 0.05), { p: [0, 0.05, 0.27] }), "#3df5d0"), 0.8));
  const r = rng(17);
  for (let i = 0; i < 12; i++) parts.push(glow(paint(tf(ico(0.025, 0), { p: [(r() - 0.5) * 3, 0.06, 0.3 + r() * 0.15] }), "#8affea"), 1));
  return merge(parts);
}

function bacteriaField() {
  const parts: THREE.BufferGeometry[] = [];
  const r = rng(19);
  for (let i = 0; i < 9; i++) {
    const g = new THREE.CircleGeometry(0.12 + r() * 0.16, 9);
    g.rotateX(-Math.PI / 2);
    g.translate((r() - 0.5) * 1.6, 0.03 + i * 0.002, (r() - 0.5) * 1.2);
    parts.push(glow(paint(g, mix("#f2e8a0", "#a8ffe8", r())), 0.55));
  }
  return merge(parts);
}

const cache = new Map<string, FeaturePart[]>();

/** Parts for a terrain feature. `waterH` is in decoration units (for reeds, kelp, mangroves). */
/** Tidepool: a tall, wet rock pillar with a band of barnacles. */
function seaStack() {
  const rock = (_p: THREE.Vector3, f: number) => (speckle(f, 20) ? "#5a5656" : speckle(f, 12, 3) ? "#8a8484" : "#6e6a6a");
  const parts = [paint(jitter(tf(cyl(0.32, 0.5, 1.6, 8, 4), { p: [0, 0.8, 0] }), 0.08, 61), rock)];
  const r = rng(62);
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const y = 0.15 + r() * 0.5;
    const k = 0.48 - y * 0.12;
    parts.push(paint(tf(cyl(0.02, 0.045, 0.04, 5), { p: [Math.cos(a) * k, y, Math.sin(a) * k] }), "#efe9dc"));
  }
  parts.push(paint(tf(sphere(0.5, 6, 3), { s: [0.5, 0.08, 0.5], p: [0, 1.6, 0] }), "#7aa87a"));
  return merge(parts);
}

export function getFeatureParts(id: string, waterH: number): FeaturePart[] {
  const key = id + "|" + waterH.toFixed(2);
  const hit = cache.get(key);
  if (hit) return hit;
  const deco = (decoId: string, x = 0, z = 0, scale = 1, rotY = 0): FeaturePart => {
    const m = getDecoModel(decoId, waterH / scale);
    return { geometry: m.geometry, x, z, rotY, scale, sway: m.sway, spin: m.spin, light: m.light };
  };
  const own = (geometry: THREE.BufferGeometry, sway = 0): FeaturePart => ({ geometry, x: 0, z: 0, rotY: 0, scale: 1, sway });
  let parts: FeaturePart[];
  switch (id) {
    case "lily-cluster":
      parts = [deco("lily-pads", 0, 0, 1.1, 0.6), deco("lily-pads", -0.7, 0.4, 0.8, 2.2)];
      break;
    case "mangrove-edge":
      parts = [deco("mangrove-roots", 0, 0, 1.1), deco("mangrove-roots", 0.9, -0.3, 0.8, 1.4)];
      break;
    case "fallen-tree":
      parts = [deco("sunken-log", 0, 0, 1.6, 0.8)];
      break;
    case "sandbar":
      parts = [own(sandbar())];
      break;
    case "coral-shelf":
      parts = [own(coralShelf())];
      break;
    case "sand-channel":
      parts = [own(sandChannel())];
      break;
    case "rock-arch":
      parts = [own(rockArch())];
      break;
    case "drop-off":
      parts = [own(dropOff())];
      break;
    case "kelp-edge":
      parts = [deco("kelp-column", -0.6, 0, 1), deco("kelp-column", 0.1, 0.25, 0.9, 1), deco("kelp-column", 0.8, -0.1, 1.05, 2)];
      break;
    case "far-seamount":
      parts = [deco("seamount", 0, 0, 1.6)];
      break;
    case "more-floor":
      parts = [deco("pillow-lava", 0, 0, 1.2)];
      break;
    case "second-vent":
      parts = [deco("hydrothermal-vent", 0, 0, 1)];
      break;
    case "trench-glow":
      parts = [own(trenchGlow())];
      break;
    case "bacteria-field":
      parts = [own(bacteriaField())];
      break;
    case "barnacle-ridge":
      parts = [deco("barnacle-rock", -0.6, 0, 1.1), deco("barnacle-rock", 0.15, 0.2, 0.9, 1.2), deco("barnacle-rock", 0.8, -0.1, 1.2, 2.4)];
      break;
    case "sea-stack":
      parts = [own(seaStack())];
      break;
    case "mussel-bed":
      parts = [deco("mussel-cluster", -0.5, 0, 1.1), deco("mussel-cluster", 0.3, 0.25, 1, 1.4), deco("mussel-cluster", 0.4, -0.35, 0.9, 2.6)];
      break;
    case "anemone-garden":
      parts = [deco("green-anemone", -0.45, 0, 1.1), deco("coralline-algae", 0.35, 0.25, 0.9, 1.1), deco("green-anemone", 0.5, -0.3, 0.8, 2)];
      break;
    case "root-curtain":
      parts = [deco("hanging-roots", 0, 0, 1.2), deco("hanging-roots", 0.8, 0.3, 1, 0.8)];
      break;
    case "sandy-bank":
      parts = [own(sandbar())];
      break;
    case "flooded-grove":
      parts = [deco("flooded-trunk", 0, 0, 1.1), deco("flooded-trunk", 0.8, 0.4, 0.85, 1.7)];
      break;
    case "lily-lagoon":
      parts = [deco("victoria-lily", 0, 0, 1.2), deco("victoria-lily", -0.9, 0.5, 0.9, 2.1)];
      break;
    case "kelp-thicket":
      parts = [deco("giant-kelp", -0.5, 0, 1), deco("giant-kelp", 0.3, 0.3, 0.9, 1.4), deco("kelp-cluster", 0.5, -0.4, 1, 2.2)];
      break;
    case "boulder-field":
      parts = [deco("rocky-boulder", -0.5, 0, 1), deco("rocky-boulder", 0.45, 0.25, 0.7, 1.3), deco("abalone-rock", 0.3, -0.45, 0.8, 2.4)];
      break;
    case "ice-floes":
      parts = [deco("floating-ice", 0, 0, 1), deco("floating-ice", -0.8, 0.4, 0.7, 1.5), deco("floating-ice", 0.6, 0.5, 0.6, 2.8)];
      break;
    case "ice-cave-edge":
      parts = [deco("ice-cave", 0, 0, 1.3), deco("snowy-rock", 0.9, 0.3, 0.7, 1)];
      break;
    case "iceberg-keel":
      parts = [deco("iceberg-underside", 0, 0, 1.5)];
      break;
    case "aurora-crystals":
      parts = [deco("aurora-crystal", 0, 0, 1.1), deco("aurora-crystal", 0.7, 0.3, 0.8, 1.2), deco("aurora-crystal", -0.6, 0.35, 0.7, 2.5)];
      break;
    default:
      parts = [];
  }
  cache.set(key, parts);
  return parts;
}
