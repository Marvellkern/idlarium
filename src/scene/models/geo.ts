// Helpers for building procedural low poly models: every part is converted to
// non-indexed geometry, painted per face (crisp flat colors), then merged into a
// single BufferGeometry so each creature is one draw call.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type V3 = [number, number, number];
export type Painter = THREE.ColorRepresentation | ((centroid: THREE.Vector3, faceIndex: number) => THREE.ColorRepresentation);

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Apply scale → rotation (XYZ) → position. Mutates and returns the geometry. */
export function tf(g: THREE.BufferGeometry, t: { s?: V3 | number; r?: V3; p?: V3 }) {
  if (t.s !== undefined) {
    const s = typeof t.s === "number" ? [t.s, t.s, t.s] : t.s;
    g.scale(s[0], s[1], s[2]);
  }
  if (t.r) {
    if (t.r[0]) g.rotateX(t.r[0]);
    if (t.r[1]) g.rotateY(t.r[1]);
    if (t.r[2]) g.rotateZ(t.r[2]);
  }
  if (t.p) g.translate(t.p[0], t.p[1], t.p[2]);
  return g;
}

const _c = new THREE.Color();
const _v = new THREE.Vector3();

/** Non-indexed copy with a per-face color attribute. */
export function paint(g: THREE.BufferGeometry, painter: Painter): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  for (const name of Object.keys(ng.attributes)) if (name !== "position") ng.deleteAttribute(name);
  const pos = ng.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const faces = pos.count / 3;
  for (let f = 0; f < faces; f++) {
    _v.set(0, 0, 0);
    for (let k = 0; k < 3; k++) {
      _v.x += pos.getX(f * 3 + k);
      _v.y += pos.getY(f * 3 + k);
      _v.z += pos.getZ(f * 3 + k);
    }
    _v.multiplyScalar(1 / 3);
    _c.set(typeof painter === "function" ? painter(_v, f) : painter);
    for (let k = 0; k < 3; k++) {
      colors[(f * 3 + k) * 3] = _c.r;
      colors[(f * 3 + k) * 3 + 1] = _c.g;
      colors[(f * 3 + k) * 3 + 2] = _c.b;
    }
  }
  ng.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  ng.setAttribute("aGlow", new THREE.BufferAttribute(new Float32Array(pos.count), 1));
  return ng;
}

/** Make a painted part glow (bioluminescence). Strength 0–1, or per face via a function. */
export function glow(g: THREE.BufferGeometry, strength: number | ((centroid: THREE.Vector3) => number)) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const attr = g.attributes.aGlow as THREE.BufferAttribute;
  for (let f = 0; f < pos.count / 3; f++) {
    let v = typeof strength === "number" ? strength : 0;
    if (typeof strength === "function") {
      _v.set(0, 0, 0);
      for (let k = 0; k < 3; k++) _v.add(new THREE.Vector3(pos.getX(f * 3 + k), pos.getY(f * 3 + k), pos.getZ(f * 3 + k)));
      v = strength(_v.multiplyScalar(1 / 3));
    }
    for (let k = 0; k < 3; k++) attr.setX(f * 3 + k, v);
  }
  attr.needsUpdate = true;
  return g;
}

/** Merge painted parts into one geometry with flat normals. */
export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!g) throw new Error("mergeGeometries failed");
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/**
 * Push vertices around a little for an organic, hand-made look. Positions that are
 * shared between faces move together, so the mesh stays closed.
 */
export function jitter(g: THREE.BufferGeometry, amount: number, seed = 1) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const moved = new Map<string, V3>();
  const r = rng(seed);
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    let d = moved.get(key);
    if (!d) {
      d = [(r() - 0.5) * amount, (r() - 0.5) * amount, (r() - 0.5) * amount];
      moved.set(key, d);
    }
    pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
  }
  pos.needsUpdate = true;
  return g;
}

/** Lathe around the z axis. profile = [radius, z] from tail (−z) to nose (+z). */
export function lathe(profile: [number, number][], radial = 7) {
  const g = new THREE.LatheGeometry(
    profile.map(([r, z]) => new THREE.Vector2(Math.max(r, 0.0005), z)),
    radial,
  );
  // Lathe builds around y; rotating +90° about x maps y → z.
  g.rotateX(Math.PI / 2);
  return g;
}

/** Thin flat fin in the y/z plane. points = [z, y] pairs. */
export function fin(points: [number, number][], thick = 0.012) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -thick / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

export function sphere(r: number, w = 7, h = 5) {
  return new THREE.SphereGeometry(r, w, h);
}

export function ico(r: number, detail = 0) {
  return new THREE.IcosahedronGeometry(r, detail);
}

export function cone(r: number, h: number, seg = 5) {
  return new THREE.ConeGeometry(r, h, seg);
}

export function cyl(rt: number, rb: number, h: number, seg = 5, hs = 1) {
  return new THREE.CylinderGeometry(rt, rb, h, seg, hs);
}

export function box(w: number, h: number, d: number) {
  return new THREE.BoxGeometry(w, h, d);
}

/** Reverse triangle winding (after a mirroring scale). */
export function flipWinding(g: THREE.BufferGeometry) {
  if (g.index) {
    const idx = g.index.array as Uint16Array | Uint32Array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
    g.index.needsUpdate = true;
  }
  return g;
}

/** A tube following points (for tails, roots, arms). */
export function tube(points: V3[], radius: number | ((t: number) => number), radial = 5) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const segs = Math.max(4, points.length * 3);
  const g = new THREE.TubeGeometry(curve, segs, typeof radius === "number" ? radius : 1, radial, false);
  if (typeof radius === "function") {
    // Taper: scale each ring around its center point on the curve.
    const pos = g.attributes.position as THREE.BufferAttribute;
    const ring = radial + 1;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const c = curve.getPointAt(t);
      const r = radius(t);
      for (let j = 0; j < ring; j++) {
        const k = i * ring + j;
        _v.set(pos.getX(k), pos.getY(k), pos.getZ(k)).sub(c).multiplyScalar(r).add(c);
        pos.setXYZ(k, _v.x, _v.y, _v.z);
      }
    }
  }
  return g;
}

export function mix(a: THREE.ColorRepresentation, b: THREE.ColorRepresentation, t: number) {
  return "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}
