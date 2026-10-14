// Released creatures swim off: turn, head for the nearest side of the diorama,
// pick up a soft sparkle and fade out as they leave (about 1.5 s).
// With reduced motion they simply fade where they are.
import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BiomeId } from "../data/biomes";
import { SPECIES_BY_ID } from "../data/creatures";
import { ECONOMY } from "../state/economy";
import { useUI, type Departing } from "../state/uiStore";
import { prefersReducedMotion } from "../utils/motion";
import { fadeBox, fitLength, type Dims } from "./layout";
import { getCreatureModel } from "./models/creatureModels";
import { faceVelocity } from "./movement";
import { createSwimMaterial, setEdgeFade } from "./swimShader";

export function Departures({ biome, dims }: { biome: BiomeId; dims: Dims }) {
  const departing = useUI((s) => s.departing);
  const reduced = useMemo(prefersReducedMotion, []);
  return (
    <>
      {departing
        .filter((d) => d.biome === biome)
        // Huge batches: a handful swim, a dozen fade, the rest just slip away unseen.
        .slice(0, MAX_SHOWN)
        .map((d) => (
          <Leaver key={d.key} d={d} biome={biome} dims={dims} still={reduced || !d.swim} />
        ))}
    </>
  );
}

const smooth = THREE.MathUtils.smoothstep;
const MAX_SHOWN = 16;

function Leaver({ d, biome, dims, still }: { d: Departing; biome: BiomeId; dims: Dims; still: boolean }) {
  const sp = SPECIES_BY_ID[d.speciesId];
  const model = useMemo(() => getCreatureModel(d.speciesId, d.variantId), [d.speciesId, d.variantId]);
  const material = useMemo(() => {
    const m = createSwimMaterial({ amp: model.swim.amp, freq: model.swim.freq, mode: model.swim.mode, transparent: true, rim: 0.9, rimColor: "#fff3c4" });
    // Dissolve at the glass like everything else that crosses the walls.
    setEdgeFade(m, fadeBox(biome, dims), sp?.size === "XL" ? 1.6 : 0.6);
    return m;
    // Built once per departure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);
  useEffect(() => () => material.dispose(), [material]);

  // A school leaves as a small cluster.
  const fish = useMemo(() => {
    const n = sp?.behavior === "school" ? Math.min(sp.schoolSize ?? 1, still ? 3 : 4) : 1;
    return Array.from({ length: n }, (_, i) =>
      i === 0 ? new THREE.Vector3() : new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.5),
    );
  }, [sp, still]);

  const plan = useMemo(() => {
    const start = d.from ? new THREE.Vector3(d.from.x, d.from.y, d.from.z) : new THREE.Vector3(0, dims.h * 0.5, 0);
    // Head for the nearest side wall (or the back); never straight at the camera.
    const nx = start.x / (dims.w / 2);
    const nz = start.z / (dims.d / 2);
    const dir = Math.abs(nx) > 0.15 || nz > -0.2 ? new THREE.Vector3(Math.sign(nx || (Math.random() - 0.5)), 0.12, 0) : new THREE.Vector3(0, 0.12, -1);
    dir.normalize();
    const distToWall = dir.x !== 0 ? dims.w / 2 - Math.abs(start.x) : dims.d / 2 + start.z;
    const dist = Math.max(1, distToWall) + fitLength(model.length, dims) * 1.2;
    // Start facing sideways to the exit, so the turn reads.
    const heading = new THREE.Vector3(-dir.z || 0.001, 0, dir.x).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
    return { start, dir, dist, heading };
  }, [d.from, dims, model.length]);

  const group = useRef<THREE.Group>(null);
  const vel = useMemo(() => new THREE.Vector3(), []);
  const phase = useRef(Math.random() * 10);
  const placed = useRef(false);

  useFrame((_s, dt) => {
    const g = group.current;
    if (!g) return;
    const ms = ECONOMY.release.animMs;
    const t = Math.min(1, (performance.now() - d.startedAt) / ms);
    if (still) {
      // Reduced motion (and the rest of a big batch): fade out in place.
      g.position.copy(plan.start);
      material.opacity = 1 - smooth(t, 0, 0.45);
    } else {
      if (!placed.current) {
        placed.current = true;
        g.lookAt(tmp.copy(plan.start).add(plan.heading));
      }
      // Turn first, then accelerate toward the edge.
      const turn = smooth(t, 0, 0.3);
      vel.copy(plan.heading).multiplyScalar(1 - turn).addScaledVector(plan.dir, turn);
      faceVelocity(g, vel, dt, 6, 0.4);
      const travel = Math.pow(smooth(t, 0.12, 1), 1.6) * plan.dist;
      g.position.copy(plan.start).addScaledVector(plan.dir, travel);
      material.opacity = 1 - smooth(t, 0.55, 1);
      phase.current += dt * (4 + turn * 10);
    }
    material.userData.swim.uPhase.value = phase.current;
    g.visible = material.opacity > 0.01;
  });

  const s = fitLength(model.length, dims);
  return (
    <group ref={group} position={plan.start}>
      {fish.map((p, i) => (
        <mesh key={i} geometry={model.geometry} material={material} position={p} scale={s} />
      ))}
      {!still && <Sparkles count={14} scale={[Math.max(0.6, s * 1.6), Math.max(0.4, s * 0.8), Math.max(0.6, s * 1.6)]} size={3} speed={0.6} color="#fff3b0" />}
    </group>
  );
}

const tmp = new THREE.Vector3();
