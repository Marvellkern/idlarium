// One InstancedMesh per schooling species. Each owned creature shows as
// `schoolSize` fish; they all move together with simple boids.
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BiomeId } from "../data/biomes";
import { SPECIES_BY_ID } from "../data/creatures";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { isResting } from "./Creature";
import { play } from "../utils/audio";
import { swimBounds, type Dims } from "./layout";
import { getCreatureModel } from "./models/creatureModels";
import { spawnHints } from "../state/handoff";
import { creatureLengths, creaturePositions, habitatCtx } from "./registry";
import { createSwimMaterial } from "./swimShader";

interface Props {
  speciesId: string;
  variantId?: string;
  uids: string[];
  biome: BiomeId;
  castShadow: boolean;
  dims: Dims;
  startleAt?: number;
}

const BOIDS = {
  neighbor: 0.8,
  separation: 0.22,
  wCohesion: 0.8,
  wAlignment: 1.0,
  wSeparation: 2.2,
  wGoal: 0.9,
  wBounds: 4,
  minSpeed: 0.18,
  maxSpeed: 0.55,
};

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();
const look = new THREE.Matrix4();
const scl = new THREE.Vector3();
const tmpMax = new THREE.Vector3();

export function CreatureSchool({ speciesId, variantId, uids, biome, castShadow, dims, startleAt }: Props) {
  const sp = SPECIES_BY_ID[speciesId];
  const per = sp?.schoolSize ?? 1;
  const count = uids.length * per;
  const model = useMemo(() => getCreatureModel(speciesId, variantId), [speciesId, variantId]);
  const material = useMemo(
    () => createSwimMaterial({ amp: model.swim.amp, freq: model.swim.freq, mode: model.swim.mode, instanced: true }),
    [model],
  );
  useEffect(() => () => material.dispose(), [material]);
  const bounds = useMemo(() => swimBounds(dims, model.length), [dims, model.length]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const selectedUid = useUI((s) => s.selectedUid);

  // Simulation state survives count changes: existing fish keep their place.
  const sim = useRef({
    pos: [] as THREE.Vector3[],
    vel: [] as THREE.Vector3[],
    phase: [] as number[],
    goal: new THREE.Vector3(),
    goalTimer: 0,
    wasResting: false,
  });

  const phaseAttr = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count)), 1), [count]);

  useLayoutEffect(() => {
    const s = sim.current;
    const { min, max } = bounds;
    const center = s.pos[0]?.clone() ?? new THREE.Vector3((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
    while (s.pos.length < count) {
      const i = s.pos.length;
      const hint = spawnHints.get(uids[Math.floor(i / per)]);
      const p = (hint ? new THREE.Vector3(hint.x, hint.y, hint.z) : center.clone()).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.5));
      s.pos.push(p);
      s.vel.push(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3));
      s.phase.push(Math.random() * 10);
    }
    s.pos.length = count;
    s.vel.length = count;
    s.phase.length = count;
    if (s.goal.lengthSq() === 0) s.goal.copy(center);
    mesh.current?.geometry.setAttribute("aPhase", phaseAttr);
  }, [count, bounds, uids, per, phaseAttr]);

  // New size or a startle: pick a fresh goal (into the new space) and scatter a little.
  useEffect(() => {
    sim.current.goalTimer = 0;
  }, [bounds]);
  useEffect(() => {
    if (!startleAt) return;
    for (const v of sim.current.vel) v.set((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.2);
  }, [startleAt]);

  useEffect(() => {
    uids.forEach((uid, k) => {
      spawnHints.delete(uid);
      creaturePositions.set(uid, (out) => out.copy(sim.current.pos[k * per] ?? out));
      creatureLengths.set(uid, model.length);
    });
    return () =>
      uids.forEach((uid) => {
        creaturePositions.delete(uid);
        creatureLengths.delete(uid);
      });
  }, [uids, per, model.length]);

  // The geometry is shared across schools of the same species, so give each its own copy
  // (the per-instance phase attribute lives on it).
  const geometry = useMemo(() => model.geometry.clone(), [model]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_state, dtRaw) => {
    const im = mesh.current;
    if (!im) return;
    const dt = Math.min(dtRaw, 0.1);
    const s = sim.current;
    const { min } = bounds;
    // Tides can lower the water below the usual top.
    const max = tmpMax.copy(bounds.max);
    max.y = Math.max(min.y + 0.1, Math.min(max.y, dims.h * habitatCtx.waterLevel - model.length * 0.5));
    const n = s.pos.length;

    // Move the shared goal around like a wanderer (or to the food). Resting schools
    // drift slowly in a tight group just above the bottom.
    const resting = isResting(sp, biome, habitatCtx.daylight);
    if (resting !== s.wasResting) {
      s.wasResting = resting;
      s.goalTimer = 0;
    }
    s.goalTimer -= dt;
    if (habitatCtx.feed && !resting) {
      s.goal.copy(habitatCtx.feed);
    } else if (s.goalTimer <= 0) {
      const top = resting ? min.y + (max.y - min.y) * 0.15 : max.y;
      s.goal.set(min.x + Math.random() * (max.x - min.x), min.y + Math.random() * (top - min.y), min.z + Math.random() * (max.z - min.z));
      s.goalTimer = resting ? 10 + Math.random() * 8 : 4 + Math.random() * 5;
    }

    const coh = new THREE.Vector3();
    const ali = new THREE.Vector3();
    const sep = new THREE.Vector3();
    const steer = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const p = s.pos[i];
      const v = s.vel[i];
      coh.set(0, 0, 0);
      ali.set(0, 0, 0);
      sep.set(0, 0, 0);
      let nb = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d = p.distanceTo(s.pos[j]);
        if (d < BOIDS.neighbor) {
          coh.add(s.pos[j]);
          ali.add(s.vel[j]);
          nb++;
          if (d < BOIDS.separation && d > 1e-4) sep.add(tmp.copy(p).sub(s.pos[j]).divideScalar(d * d));
        }
      }
      steer.set(0, 0, 0);
      if (nb > 0) {
        steer.addScaledVector(coh.divideScalar(nb).sub(p), BOIDS.wCohesion);
        steer.addScaledVector(ali.divideScalar(nb).sub(v), BOIDS.wAlignment);
      }
      steer.addScaledVector(sep, BOIDS.wSeparation * 0.05);
      steer.addScaledVector(tmp.copy(s.goal).sub(p).normalize(), BOIDS.wGoal * (habitatCtx.feed ? 2 : 1));
      // Soft walls
      for (const ax of ["x", "y", "z"] as const) {
        if (p[ax] < min[ax] + 0.2) steer[ax] += BOIDS.wBounds * (min[ax] + 0.2 - p[ax]);
        if (p[ax] > max[ax] - 0.2) steer[ax] -= BOIDS.wBounds * (p[ax] - (max[ax] - 0.2));
      }
      v.addScaledVector(steer, dt);
      v.y *= 1 - dt * 1.5; // schools mostly swim level
      const sp = v.length();
      const maxS = BOIDS.maxSpeed * (resting ? 0.4 : habitatCtx.feed ? 1.5 : 1);
      if (sp > maxS) v.multiplyScalar(maxS / sp);
      else if (sp < BOIDS.minSpeed * (resting ? 0.4 : 1)) v.multiplyScalar((BOIDS.minSpeed * (resting ? 0.4 : 1)) / Math.max(sp, 1e-4));
      p.addScaledVector(v, dt);
      if (!Number.isFinite(p.x + p.y + p.z + v.x + v.y + v.z)) {
        p.copy(s.goal);
        v.set(0.1, 0, 0);
      }
      p.x = THREE.MathUtils.clamp(p.x, min.x, max.x);
      p.y = THREE.MathUtils.clamp(p.y, min.y, max.y);
      p.z = THREE.MathUtils.clamp(p.z, min.z, max.z);

      s.phase[i] += dt * (resting ? 1.2 : 3 + v.length() * 14);
      phaseAttr.setX(i, s.phase[i]);

      tmp.copy(v).normalize();
      look.lookAt(tmp, new THREE.Vector3(), up);
      q.setFromRotationMatrix(look);
      const selected = selectedUid !== null && uids[Math.floor(i / per)] === selectedUid;
      scl.setScalar(model.length * (selected ? 1.25 : 1));
      m4.compose(p, q, scl);
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
    phaseAttr.needsUpdate = true;
    material.userData.swim.uPhase.value = 0;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const uid = uids[Math.floor(e.instanceId / per)];
    if (uid) {
      useUI.getState().select(uid);
      useGame.getState().trackGoal("watch");
      play("tap");
    }
  };

  if (count === 0) return null;
  return (
    <instancedMesh
      key={count}
      ref={mesh}
      args={[geometry, material, count]}
      castShadow={castShadow && model.length > 0.6}
      frustumCulled={false}
      onClick={onClick}
    />
  );
}

