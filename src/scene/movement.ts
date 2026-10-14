// Steering behaviors for individual creatures. Schools use boids in CreatureSchool.
//
//  wander / bottom / surface / hover: pick a target, steer with a limited turn rate, idle, repeat.
//  cruise: slow wide loop. Giants (XL) swim a big loop that stays just inside the glass
//          (they're drawn at a size that fits the tank; see fitLength in layout.ts).
//  resting: nocturnal species by day (and day species at night) tuck into hideouts or
//           settle on the bottom and barely move.
//  tricks: "jump" (dolphins leap out of the surface), "breach" (humpbacks launch half out
//          of the water), "dive" (sperm whales sink in from above and rise back out),
//          "breathe" (arapaima nose up through the surface to gulp air), "roll" (otters
//          roll over at the surface; the roll itself is drawn by Creature.tsx).
import * as THREE from "three";
import type { Behavior } from "../data/creatures";
import type { Bounds } from "./layout";

export type Trick = "jump" | "breach" | "dive" | "breathe" | "roll";

/** How long an otter roll takes (s). */
export const ROLL_SECONDS = 1.4;

export interface Splash {
  pos: THREE.Vector3;
  size: number;
  at: number;
}

export interface Agent {
  behavior: Behavior;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  target: THREE.Vector3;
  idle: number;
  speed: number;
  bounds: Bounds;
  length: number;
  swimPhase: number;
  loopT: number;
  loopDir: number;
  restingOn: THREE.Vector3 | null;
  goingToPad: THREE.Vector3 | null;
  floorAt: (x: number, z: number) => number;
  waterTop: number;
  rand: () => number;
  anchor: THREE.Vector3;
  /** Set every frame from the day/night clock. */
  resting: boolean;
  wasResting: boolean;
  hideIdx: number;
  /** Giant loop that passes beyond the diorama walls. */
  wide: { rx: number; rz: number; cy: number; ry: number } | null;
  trick?: Trick;
  /** Climbs onto perches (lily pads, ice floes) to rest. */
  perches?: boolean;
  /** Seconds left in an otter roll (0 = not rolling). */
  rollT: number;
  /** Seconds until the next trick. */
  trickIn: number;
  /** Currently mid-air / mid-breach. */
  airborne: boolean;
  wasAbove: boolean;
}

export interface MoveContext {
  time: number;
  dt: number;
  /** While feeding, creatures gather here. */
  feed: THREE.Vector3 | null;
  /** Surface resting spots (lily pads) frogs can sit on. */
  pads: THREE.Vector3[];
  /** Hideout decorations resting creatures tuck into. */
  hideouts: THREE.Vector3[];
  /** Splashes get pushed here when something breaks the surface. */
  splashes?: Splash[];
}

const GRAVITY = 6;
const desired = new THREE.Vector3();
const tmp = new THREE.Vector3();

function randIn(a: Agent, min: number, max: number) {
  return min + a.rand() * (max - min);
}

/** Seconds between tricks: dolphins leap now and then, humpbacks breach only occasionally. */
const TRICK_GAP: Record<Trick, [number, number]> = { jump: [25, 60], breach: [150, 360], dive: [0, 0], breathe: [40, 90], roll: [12, 30] };

export function createAgent(opts: {
  behavior: Behavior;
  bounds: Bounds;
  length: number;
  floorAt: (x: number, z: number) => number;
  waterTop: number;
  rand?: () => number;
  spawn?: THREE.Vector3;
  /** Habitat size; when set with `giant`, the creature loops beyond the walls. */
  habitat?: { w: number; h: number; d: number };
  giant?: boolean;
  trick?: Trick;
  perches?: boolean;
}): Agent {
  const rand = opts.rand ?? Math.random;
  const { min, max } = opts.bounds;
  const pos =
    opts.spawn?.clone() ??
    new THREE.Vector3(min.x + rand() * (max.x - min.x), min.y + rand() * (max.y - min.y), min.z + rand() * (max.z - min.z));
  const base = THREE.MathUtils.clamp(0.22 + opts.length * 0.3, 0.22, 0.9);
  const speedMul: Record<Behavior, number> = { wander: 1, school: 1, bottom: 0.45, surface: 0.7, cruise: 0.75, hover: 0.18 };
  const wide = opts.giant && opts.habitat ? wideLoop(opts.habitat, opts.length) : null;
  const a: Agent = {
    behavior: opts.behavior,
    pos,
    vel: new THREE.Vector3((rand() - 0.5) * 0.1, 0, (rand() - 0.5) * 0.1),
    target: pos.clone(),
    idle: rand() * 1.5,
    speed: wide ? Math.min(1.4, 0.5 + opts.length * 0.08) : base * speedMul[opts.behavior],
    bounds: opts.bounds,
    length: opts.length,
    swimPhase: rand() * 10,
    loopT: rand() * Math.PI * 2,
    loopDir: rand() < 0.5 ? 1 : -1,
    restingOn: null,
    goingToPad: null,
    floorAt: opts.floorAt,
    waterTop: opts.waterTop,
    rand,
    anchor: pos.clone(),
    resting: false,
    wasResting: false,
    hideIdx: Math.floor(rand() * 100),
    wide,
    trick: opts.trick,
    perches: opts.perches,
    rollT: 0,
    trickIn: opts.trick ? (TRICK_GAP[opts.trick][0] + rand() * (TRICK_GAP[opts.trick][1] - TRICK_GAP[opts.trick][0])) * 0.5 : 0,
    airborne: false,
    wasAbove: false,
  };
  if (wide && !opts.spawn) loopPoint(a, a.loopT, a.pos);
  clampToBounds(a);
  pickTarget(a, { time: 0, dt: 0, feed: null, pads: [], hideouts: [] });
  return a;
}

/**
 * A giant's loop scales with the habitat and keeps the whole body inside the glass:
 * half a body length (plus a little) from every wall, even mid-turn.
 */
function wideLoop(habitat: { w: number; h: number; d: number }, length: number) {
  return {
    rx: Math.max(0.5, habitat.w / 2 - length * 0.55 - 0.2),
    rz: Math.max(0.5, habitat.d / 2 - length * 0.55 - 0.2),
    cy: habitat.h * 0.5,
    ry: habitat.h * 0.15,
  };
}

/**
 * The habitat changed size: adopt the new bounds right away and head somewhere
 * in the new space, so nobody stays stuck at the old wall.
 */
export function resizeAgent(
  a: Agent,
  opts: { bounds: Bounds; waterTop: number; habitat: { w: number; h: number; d: number }; floorAt: (x: number, z: number) => number; length?: number },
) {
  if (opts.length) a.length = opts.length;
  a.bounds = opts.bounds;
  a.waterTop = opts.waterTop;
  a.floorAt = opts.floorAt;
  if (a.wide) a.wide = wideLoop(opts.habitat, a.length);
  a.anchor.clamp(opts.bounds.min, opts.bounds.max);
  a.restingOn = null;
  a.goingToPad = null;
  a.idle = 0;
  pickTarget(a, { time: 0, dt: 0, feed: null, pads: [], hideouts: [] });
}

/** A quick dart in a random direction (creatures react when their habitat grows). */
export function startle(a: Agent) {
  if (a.airborne || a.wide) return;
  a.restingOn = null;
  const angle = a.rand() * Math.PI * 2;
  a.vel.x += Math.cos(angle) * a.speed * 2.2 + 0.15;
  a.vel.z += Math.sin(angle) * a.speed * 2.2;
  a.idle = 0;
}

function clampToBounds(a: Agent) {
  if (a.restingOn || a.airborne) return;
  const { min, max } = a.bounds;
  if (!a.wide) {
    a.pos.x = THREE.MathUtils.clamp(a.pos.x, min.x, max.x);
    a.pos.z = THREE.MathUtils.clamp(a.pos.z, min.z, max.z);
  }
  if (a.trick === "dive") return; // dives follow their own loop (it stays in the water)
  const floor = a.floorAt(a.pos.x, a.pos.z) + a.length * 0.12 + 0.03;
  // waterTop can sit below the bounds when the tide is out.
  const top = a.behavior === "surface" ? a.waterTop - 0.02 : Math.min(max.y, a.waterTop - a.length * 0.3);
  a.pos.y = THREE.MathUtils.clamp(a.pos.y, Math.min(floor, top), top);
}

function pickTarget(a: Agent, ctx: MoveContext) {
  const { min, max } = a.bounds;
  a.goingToPad = null;
  if (ctx.feed && a.behavior !== "cruise" && !a.resting) {
    a.target.set(ctx.feed.x + randIn(a, -0.4, 0.4), ctx.feed.y + randIn(a, -0.5, 0.1), ctx.feed.z + randIn(a, -0.4, 0.4));
    return;
  }
  if (a.resting && a.behavior !== "cruise") {
    // Tuck into a hideout if there is one, otherwise settle on the bottom.
    if (ctx.hideouts.length) {
      const h = ctx.hideouts[a.hideIdx % ctx.hideouts.length];
      const x = THREE.MathUtils.clamp(h.x + randIn(a, -0.35, 0.35), min.x, max.x);
      const z = THREE.MathUtils.clamp(h.z + randIn(a, -0.35, 0.35), min.z, max.z);
      a.target.set(x, a.floorAt(x, z) + a.length * 0.15 + 0.08 + a.rand() * 0.15, z);
    } else {
      const x = randIn(a, min.x, max.x);
      const z = randIn(a, min.z, max.z);
      a.target.set(x, a.floorAt(x, z) + a.length * 0.12 + 0.05, z);
    }
    return;
  }
  const x = randIn(a, min.x, max.x);
  const z = randIn(a, min.z, max.z);
  switch (a.behavior) {
    case "bottom":
      a.target.set(x, a.floorAt(x, z) + a.length * 0.12 + 0.05 + a.rand() * 0.12, z);
      break;
    case "surface":
      if (a.perches && ctx.pads.length && a.rand() < 0.45) {
        const pad = ctx.pads[Math.floor(a.rand() * ctx.pads.length)];
        a.target.copy(pad);
        a.goingToPad = pad;
        return;
      }
      a.target.set(x, a.waterTop - 0.03 - a.rand() * 0.35, z);
      break;
    case "hover":
      a.anchor.set(
        THREE.MathUtils.clamp(a.anchor.x + randIn(a, -0.7, 0.7), min.x, max.x),
        THREE.MathUtils.clamp(a.anchor.y + randIn(a, -0.4, 0.4), min.y, max.y),
        THREE.MathUtils.clamp(a.anchor.z + randIn(a, -0.7, 0.7), min.z, max.z),
      );
      a.target.copy(a.anchor);
      break;
    default:
      a.target.set(x, randIn(a, min.y, max.y), z);
  }
}

/** Self-heal: if a position ever becomes invalid, put the creature back somewhere sensible. */
function heal(a: Agent, ctx: MoveContext) {
  if (Number.isFinite(a.pos.x + a.pos.y + a.pos.z + a.vel.x + a.vel.y + a.vel.z)) return;
  if (import.meta.env.DEV) console.warn("[idlarium] creature position was invalid; reset it", a.behavior, a.trick);
  const { min, max } = a.bounds;
  a.pos.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
  a.anchor.copy(a.pos);
  a.vel.set(0, 0, 0);
  a.airborne = false;
  a.restingOn = null;
  a.idle = 0;
  if (!Number.isFinite(a.loopT)) a.loopT = 0;
  if (!Number.isFinite(a.trickIn)) a.trickIn = 30;
  pickTarget(a, ctx);
}

/** Point on the creature's loop: inside the bounds (giants: their own wide loop, still inside). */
function loopPoint(a: Agent, t: number, out: THREE.Vector3) {
  if (a.wide) {
    const { rx, rz, cy, ry } = a.wide;
    // Sperm whales dive: the loop sweeps from near the top down toward the floor.
    const y = a.trick === "dive" ? cy + Math.sin(t * 0.5) * Math.max(ry, cy - a.length * 0.25 - 0.3) : cy + Math.sin(t * 0.5 + 1) * ry;
    return out.set(Math.cos(t) * rx, y, Math.sin(t) * rz);
  }
  const { min, max } = a.bounds;
  const rx = Math.max(0.1, (max.x - min.x) / 2) * 0.92;
  const rz = Math.max(0.1, (max.z - min.z) / 2) * 0.88;
  const midY = (min.y + max.y) / 2;
  const ry = Math.max(0, (max.y - min.y) / 2) * (a.resting ? 0.2 : 0.6);
  return out.set((min.x + max.x) / 2 + Math.cos(t) * rx, (a.resting ? min.y + ry : midY) + Math.sin(t * 0.5 + 1) * ry, (min.z + max.z) / 2 + Math.sin(t) * rz);
}

function startTrick(a: Agent) {
  if (!a.trick || a.trick === "dive") return;
  if (a.trick === "roll") {
    if (a.pos.y < a.waterTop - 0.6) return;
    a.rollT = ROLL_SECONDS;
    return;
  }
  if (a.trick === "breathe") {
    // Nose up through the surface for a gulp of air, then back down.
    if (a.pos.y < a.waterTop - 1.6) return;
    const rise = a.waterTop + a.length * 0.12 - a.pos.y;
    a.vel.y = Math.sqrt(2 * GRAVITY * Math.max(0.15, rise));
    a.vel.x *= 0.5;
    a.vel.z *= 0.5;
  } else if (a.trick === "jump") {
    if (a.pos.y < a.waterTop - 1.2) return; // only leap from near the surface
    const rise = a.waterTop + a.length * 0.6 - a.pos.y;
    a.vel.y = Math.sqrt(2 * GRAVITY * Math.max(0.2, rise));
    const h = Math.hypot(a.vel.x, a.vel.z) || 1;
    a.vel.x = (a.vel.x / h) * a.speed * 1.6;
    a.vel.z = (a.vel.z / h) * a.speed * 1.6;
  } else {
    // Breach: launch roughly half the body out of the water.
    const rise = a.waterTop + a.length * 0.35 - a.pos.y;
    a.vel.y = Math.sqrt(2 * GRAVITY * Math.max(0.5, rise));
    a.vel.x *= 0.4;
    a.vel.z *= 0.4;
  }
  a.airborne = true;
  a.wasAbove = false;
}

/** Advance one agent. Returns its current speed (for swim animation). */
export function updateAgent(a: Agent, ctx: MoveContext): number {
  const dt = Math.min(Math.max(ctx.dt, 0), 0.1);
  heal(a, ctx);
  const feeding = !!ctx.feed && a.behavior !== "cruise" && !a.resting;

  if (a.resting !== a.wasResting) {
    a.wasResting = a.resting;
    a.restingOn = null;
    a.idle = 0;
    pickTarget(a, ctx);
  }

  // Ballistic leap / breach
  if (a.airborne) {
    a.vel.y -= GRAVITY * dt;
    a.pos.addScaledVector(a.vel, dt);
    const above = a.pos.y > a.waterTop;
    if (above !== a.wasAbove) {
      ctx.splashes?.push({ pos: new THREE.Vector3(a.pos.x, a.waterTop, a.pos.z), size: a.length * 0.5, at: ctx.time });
      a.wasAbove = above;
    }
    if (a.vel.y < 0 && a.pos.y < a.waterTop - a.length * 0.4) {
      a.airborne = false;
      a.vel.multiplyScalar(0.5);
      a.trickIn = randIn(a, ...TRICK_GAP[a.trick!]);
    }
    a.swimPhase += dt * 3;
    return a.vel.length();
  }

  // Sitting on a lily pad
  if (a.restingOn) {
    a.vel.set(0, 0, 0);
    a.pos.copy(a.restingOn).add(tmp.set(0, 0.04, 0));
    a.idle -= dt;
    if (a.idle <= 0 || feeding) {
      a.restingOn = null;
      a.pos.y = a.waterTop - 0.1;
      pickTarget(a, ctx);
    }
    return 0;
  }

  if (a.rollT > 0) a.rollT = Math.max(0, a.rollT - dt);
  if (a.trick && a.trick !== "dive" && !a.resting) {
    a.trickIn -= dt;
    if (a.trickIn <= 0) {
      startTrick(a);
      if (a.rollT > 0) a.trickIn = randIn(a, ...TRICK_GAP.roll);
      else if (!a.airborne) a.trickIn = 3; // not near the surface yet; try again soon
      else return a.vel.length();
    }
  }

  const restMul = a.resting ? 0.35 : 1;

  if (a.behavior === "cruise") {
    const R = a.wide ? a.wide.rx : Math.max(0.5, (a.bounds.max.x - a.bounds.min.x) / 2);
    a.loopT += (dt * a.speed * restMul * a.loopDir) / R;
    loopPoint(a, a.loopT + 0.45 * a.loopDir, a.target);
  }

  if (feeding && a.idle > 0) a.idle = 0;

  if (a.idle > 0) {
    a.idle -= dt;
    a.vel.multiplyScalar(Math.exp(-dt * 2.5));
    a.vel.y += Math.sin(ctx.time * 1.6 + a.swimPhase) * 0.02 * dt;
    if (a.idle <= 0) pickTarget(a, ctx);
  } else {
    desired.copy(a.target).sub(a.pos);
    const dist = desired.length();
    const speed = a.speed * (feeding ? 1.7 : 1) * restMul;
    if (a.behavior !== "cruise" && dist < Math.max(0.08, a.length * 0.15)) {
      if (a.goingToPad && a.behavior === "surface" && !a.resting) {
        a.restingOn = a.goingToPad;
        a.goingToPad = null;
        a.idle = 6 + a.rand() * 10;
      } else {
        const idleRange: Record<Behavior, [number, number]> = {
          wander: [0.6, 2.4],
          bottom: [2, 6],
          surface: [1, 3],
          hover: [2, 5],
          school: [0.5, 1.5],
          cruise: [0, 0],
        };
        const [lo, hi] = a.resting ? [6, 14] : idleRange[a.behavior];
        a.idle = feeding ? 0.2 : randIn(a, lo, hi);
        if (feeding) pickTarget(a, ctx);
      }
    } else {
      const arrive = a.behavior === "cruise" ? 1 : Math.min(1, dist / 0.6);
      desired.normalize().multiplyScalar(speed * Math.max(0.25, arrive));
      const turn = a.behavior === "cruise" ? (a.wide ? 0.5 : 0.8) : 1.6;
      a.vel.lerp(desired, 1 - Math.exp(-dt * turn));
    }
  }

  a.pos.addScaledVector(a.vel, dt);
  if (a.behavior === "hover") a.pos.y += Math.sin(ctx.time * 1.2 + a.swimPhase) * 0.04 * dt;
  clampToBounds(a);

  const v = a.vel.length();
  a.swimPhase += dt * (a.resting ? 1.2 : 2.5 + v * 14);
  return v;
}

const lookM = new THREE.Matrix4();
const up = new THREE.Vector3(0, 1, 0);
const origin = new THREE.Vector3();
const dirTmp = new THREE.Vector3();
const qTmp = new THREE.Quaternion();

/** Smoothly turn an object to face its velocity, with limited pitch. */
export function faceVelocity(obj: THREE.Object3D, vel: THREE.Vector3, dt: number, rate = 4, maxPitch = 0.5) {
  if (vel.lengthSq() < 1e-5) return;
  dirTmp.copy(vel);
  const horiz = Math.hypot(dirTmp.x, dirTmp.z);
  dirTmp.y = THREE.MathUtils.clamp(dirTmp.y, -horiz * maxPitch, horiz * maxPitch);
  if (dirTmp.lengthSq() < 1e-6) return;
  dirTmp.normalize();
  // Straight up/down: nudge so lookAt has a stable up vector.
  if (Math.abs(dirTmp.y) > 0.999) dirTmp.x += 0.001;
  lookM.lookAt(dirTmp, origin, up);
  qTmp.setFromRotationMatrix(lookM);
  obj.quaternion.slerp(qTmp, 1 - Math.exp(-dt * rate));
}
