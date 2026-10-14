// Procedural aquarium equipment, in the same flat-shaded low poly style as the rest.
// Sizes are in "tank units" (scaled by the tank size in Tank.tsx). Each lamp model's
// origin is where it mounts on the rim; LAMP_HEAD gives where its light comes from.
import * as THREE from "three";
import type { LampLook } from "../../data/equipment";
import { box, cone, cyl, glow, ico, merge, mix, paint, sphere, tf, tube, type V3 } from "./geo";

const BLACK = "#24272b";
const STEEL = "#9aa2aa";

/** Where the light comes out, relative to the mount point (before scaling). */
export const LAMP_HEAD: Record<LampLook, V3> = {
  clip: [0, 0.95, 0.75],
  hood: [0, 1.0, 0.8],
  party: [0, 0.95, 0.75],
  brass: [0, 1.05, 0.8],
  bar: [0, 0.08, 0],
  pendant: [0, 0, 0],
};

/** Beam spread (radians) per look. */
export const LAMP_ANGLE: Record<LampLook, number> = { clip: 0.42, hood: 0.5, party: 0.45, brass: 0.48, bar: 0.75, pendant: 0.55 };

function clipArm(color: string, head: V3): THREE.BufferGeometry[] {
  // A clip straddling the back rim and an arm arcing over the water.
  return [
    paint(tf(box(0.16, 0.22, 0.2), { p: [0, 0.02, 0] }), color),
    paint(tube([[0, 0.12, 0.02], [0, head[1] * 0.75, 0.05], [0, head[1] + 0.05, head[2] * 0.45], [0, head[1] + 0.08, head[2] - 0.1]], 0.025, 5), color),
  ];
}

/** A lamp model and the color of its glowing lens (lit up while the lamp is on). */
export function lampModel(look: LampLook, lensColor: string): { body: THREE.BufferGeometry; lens: THREE.BufferGeometry } {
  const h = LAMP_HEAD[look];
  const parts: THREE.BufferGeometry[] = [];
  let lens: THREE.BufferGeometry;
  switch (look) {
    case "clip": {
      parts.push(...clipArm(BLACK, h));
      parts.push(paint(tf(cone(0.14, 0.2, 8), { r: [0, 0, 0], p: [h[0], h[1] + 0.07, h[2]] }), BLACK));
      lens = tf(cyl(0.12, 0.12, 0.02, 10), { p: [h[0], h[1] - 0.03, h[2]] });
      break;
    }
    case "hood": {
      parts.push(...clipArm(BLACK, h));
      // A round, domed hood.
      parts.push(paint(tf(new THREE.SphereGeometry(0.2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), { p: [h[0], h[1] - 0.02, h[2]] }), "#e8e2d8"));
      lens = tf(cyl(0.19, 0.19, 0.02, 12), { p: [h[0], h[1] - 0.03, h[2]] });
      break;
    }
    case "party": {
      parts.push(...clipArm(BLACK, h));
      parts.push(paint(tf(cone(0.15, 0.2, 8), { p: [h[0], h[1] + 0.07, h[2]] }), BLACK));
      // A faceted, rainbow lens.
      const g = tf(ico(0.11, 0), { s: [1, 0.45, 1], p: [h[0], h[1] - 0.03, h[2]] });
      lens = g;
      parts.push(paint(tf(cyl(0.16, 0.16, 0.03, 8), { p: [h[0], h[1], h[2]] }), (_p, f) => ["#ff5a7a", "#ffd23a", "#5ad27a", "#4aa8ff", "#b07aff"][f % 5]));
      break;
    }
    case "brass": {
      const brass = "#b8862e";
      parts.push(...clipArm(brass, h));
      parts.push(paint(tf(new THREE.CylinderGeometry(0.08, 0.24, 0.2, 10, 1, true), { p: [h[0], h[1] + 0.07, h[2]] }), (_p, f) => (f % 4 === 0 ? "#e0b45a" : brass)));
      parts.push(paint(tf(sphere(0.05, 6, 4), { p: [h[0], h[1] + 0.2, h[2]] }), "#e0b45a"));
      lens = tf(cyl(0.2, 0.2, 0.02, 12), { p: [h[0], h[1] - 0.03, h[2]] });
      break;
    }
    case "bar": {
      // Built at unit length along x; Tank.tsx stretches it across the tank.
      parts.push(paint(tf(box(1, 0.06, 0.16), { p: [0, 0.06, 0] }), "#dfe4ea"));
      for (const x of [-0.5, 0.5]) parts.push(paint(tf(box(0.03, 0.1, 0.18), { p: [x, 0.04, 0] }), STEEL));
      lens = tf(box(0.96, 0.012, 0.11), { p: [0, 0.028, 0] });
      break;
    }
    case "pendant": {
      // A shade hanging from a cable (the cable goes up out of view).
      parts.push(paint(tf(cyl(0.008, 0.008, 4, 4), { p: [0, 2.15, 0] }), BLACK));
      parts.push(paint(tf(new THREE.CylinderGeometry(0.12, 0.42, 0.16, 12, 1, true), { p: [0, 0.08, 0] }), "#2e3640"));
      parts.push(paint(tf(cyl(0.12, 0.12, 0.03, 10), { p: [0, 0.17, 0] }), "#2e3640"));
      lens = tf(cyl(0.4, 0.4, 0.015, 14), { p: [0, 0.005, 0] });
      break;
    }
  }
  return { body: merge(parts), lens: paint(lens!, lensColor) };
}

export function filterModel(): THREE.BufferGeometry {
  // A box that hangs on the back rim: body outside (−z), lip reaching in (+z).
  const body = "#3a3f46";
  return merge([
    paint(tf(box(0.55, 0.5, 0.26), { p: [0, -0.05, -0.2] }), (_p, f) => (f % 6 === 0 ? "#4a5058" : body)),
    paint(tf(box(0.58, 0.06, 0.3), { p: [0, 0.22, -0.2] }), "#2a2e33"),
    paint(tf(box(0.34, 0.05, 0.22), { p: [0, 0.16, 0.06] }), body),
    // Intake tube down into the water.
    paint(tf(cyl(0.03, 0.03, 0.9, 6), { p: [0.18, -0.35, 0.08] }), "#cfd6dc"),
    paint(tf(cyl(0.05, 0.05, 0.1, 6), { p: [0.18, -0.82, 0.08] }), "#8a9298"),
  ]);
}

export function airPumpModel(): THREE.BufferGeometry {
  return merge([
    paint(tf(box(0.4, 0.2, 0.28), { p: [0, 0.1, 0] }), (p) => (p.y > 0.15 ? "#e8ecef" : "#c8d0d6")),
    paint(tf(box(0.3, 0.02, 0.18), { p: [0, 0.21, 0] }), "#9aa6b0"),
    paint(tf(cyl(0.02, 0.02, 0.06, 6), { p: [0.16, 0.24, 0] }), "#5a6a74"),
  ]);
}

/** The air stone on the floor (a bar the bubbles rise from). */
export function airStoneModel(length: number): THREE.BufferGeometry {
  return paint(tf(cyl(0.05, 0.05, length, 6), { r: [Math.PI / 2, 0, 0] }), "#8a96a0");
}

export function feederModel(): { clip: THREE.BufferGeometry; drum: THREE.BufferGeometry } {
  const clip = merge([paint(tf(box(0.14, 0.24, 0.18), { p: [0, 0, 0] }), BLACK), paint(tf(box(0.3, 0.06, 0.24), { p: [0, 0.13, 0.04] }), "#3a3e44")]);
  // The drum turns around x; a little window shows the flakes inside.
  const drum = merge([
    paint(tf(cyl(0.12, 0.12, 0.26, 10), { r: [0, 0, Math.PI / 2] }), (p, f) => (p.y > 0.06 && f % 3 !== 0 ? "#cfe6f2" : "#e8763a")),
    paint(tf(cyl(0.13, 0.13, 0.02, 10), { r: [0, 0, Math.PI / 2], p: [0.13, 0, 0] }), "#c85a2a"),
    paint(tf(cyl(0.13, 0.13, 0.02, 10), { r: [0, 0, Math.PI / 2], p: [-0.13, 0, 0] }), "#c85a2a"),
  ]);
  return { clip, drum };
}

export function scraperBotModel(): THREE.BufferGeometry {
  // A rounded magnetic scraper with a blue light, lying flat on the glass (facing +z).
  return merge([
    paint(tf(box(0.36, 0.22, 0.08), {}), (p) => (p.z > 0.02 ? "#f2f4f6" : "#c8ced4")),
    paint(tf(box(0.3, 0.04, 0.06), { p: [0, -0.12, 0] }), "#5a6a78"),
    glow(paint(tf(sphere(0.03, 6, 4), { p: [0.11, 0.06, 0.045] }), "#5ad2ff"), 1),
  ]);
}

export function snailModel(): THREE.BufferGeometry {
  // A small snail crawling on the glass: foot flat against it (local −z), shell outward.
  const parts: THREE.BufferGeometry[] = [paint(tf(sphere(0.5, 8, 4), { s: [0.16, 0.36, 0.06], p: [0, 0.02, -0.02] }), "#c8b89a")];
  for (let i = 0; i < 4; i++) {
    const r = 0.13 * (1 - i * 0.2);
    const a = i * 1.2;
    parts.push(paint(tf(sphere(r, 8, 6), { p: [Math.sin(a) * 0.03, -0.04 + i * 0.03, 0.08 + i * 0.035] }), (_p, f) => (f % 4 === 0 ? "#6a4a2a" : mix("#a8743a", "#d8a860", i / 4))));
  }
  for (const s of [-1, 1]) parts.push(paint(tube([[s * 0.03, 0.18, 0.0], [s * 0.05, 0.27, 0.04], [s * 0.06, 0.32, 0.06]], 0.008, 3), "#c8b89a"));
  return merge(parts);
}
