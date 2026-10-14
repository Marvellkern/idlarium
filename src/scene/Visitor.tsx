import { Sparkles } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { tapVisitor } from "../state/visitorLogic";
import type { ActiveVisitor } from "../state/uiStore";
import { SPECIES_BY_ID } from "../data/creatures";
import { fadeBox, swimBounds, type Dims } from "./layout";
import { getCreatureModel } from "./models/creatureModels";
import { faceVelocity } from "./movement";
import { visitorPos } from "../state/handoff";
import { createSwimMaterial, setEdgeFade } from "./swimShader";

const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
const hitGeometry = new THREE.SphereGeometry(0.5, 6, 4);

export function Visitor({ visitor, dims }: { visitor: ActiveVisitor; dims: Dims }) {
  const model = useMemo(() => getCreatureModel(visitor.speciesId, visitor.variantId), [visitor.speciesId, visitor.variantId]);
  const sp = SPECIES_BY_ID[visitor.speciesId];
  const giant = sp?.size === "XL";
  const material = useMemo(() => {
    const m = createSwimMaterial({ amp: model.swim.amp, freq: model.swim.freq, mode: model.swim.mode, rim: 1.2, rimColor: "#ffe9a8" });
    setEdgeFade(m, fadeBox(visitor.biome, dims), giant ? 1.6 : 0.6);
    return m;
  }, [model, visitor.biome, giant, dims]);
  useEffect(() => () => material.dispose(), [material]);
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);

  // A gentle path across the habitat, randomly left→right or right→left.
  const path = useMemo(() => {
    const b = swimBounds(dims, model.length);
    // Giants pass straight through: they start and end beyond the walls, dissolving at the glass.
    if (giant) {
      const { w } = dims;
      b.min.x = -(w / 2 + model.length * 0.55);
      b.max.x = w / 2 + model.length * 0.55;
    }
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = THREE.MathUtils.lerp(b.min.y, b.max.y, 0.35 + Math.random() * 0.4);
    const z = THREE.MathUtils.lerp(b.min.z, b.max.z, 0.3 + Math.random() * 0.4);
    return { b, dir, y, z, wobble: Math.random() * 10 };
  }, [model.length, giant, dims]);
  const diveIn = sp?.trick === "dive";

  const state = useRef({ phase: 0, prev: new THREE.Vector3(), vel: new THREE.Vector3(), frozen: null as THREE.Vector3 | null });

  useFrame((s, dt) => {
    const g = group.current;
    if (!g) return;
    const st = state.current;
    const now = Date.now();
    const span = visitor.expiresAt - visitor.startedAt;
    const f = THREE.MathUtils.clamp((now - visitor.startedAt) / span, 0, 1);
    const { b, dir, y, z, wobble } = path;
    if (visitor.state === "asking") {
      if (!st.frozen) st.frozen = g.position.clone();
      g.position.set(st.frozen.x, st.frozen.y + Math.sin(s.clock.elapsedTime * 1.5) * 0.05, st.frozen.z);
      st.vel.set(dir * 0.05, 0, 0);
    } else {
      st.frozen = null;
      const x0 = dir > 0 ? b.min.x : b.max.x;
      const x1 = dir > 0 ? b.max.x : b.min.x;
      st.prev.copy(g.position);
      const top = dims.h;
      // A sperm whale "dives in": it sinks through the top before swimming across.
      const diveY = THREE.MathUtils.lerp(top + model.length * 0.45, y, THREE.MathUtils.smoothstep(f, 0, 0.45));
      g.position.set(
        THREE.MathUtils.lerp(x0, x1, f),
        diveIn ? diveY : THREE.MathUtils.clamp(y + Math.sin(f * 7 + wobble) * 0.25, b.min.y, b.max.y),
        THREE.MathUtils.clamp(z + Math.sin(f * 5 + wobble) * 0.5, b.min.z, b.max.z),
      );
      if (dt > 0) st.vel.copy(g.position).sub(st.prev).divideScalar(dt);
    }
    faceVelocity(g, st.vel, dt, 3, diveIn ? 0.8 : 0.3);
    st.phase += dt * (2.5 + st.vel.length() * 14);
    const u = material.userData.swim;
    u.uPhase.value = st.phase;
    u.uRim.value = 0.9 + Math.sin(s.clock.elapsedTime * 3) * 0.35;
    // Fade in and out at the ends of the path by scaling.
    const k = visitor.state === "asking" || giant ? 1 : Math.min(1, f * 10, (1 - f) * 10);
    body.current?.scale.setScalar(Math.max(0.001, k));
    visitorPos.x = g.position.x;
    visitorPos.y = g.position.y;
    visitorPos.z = g.position.z;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    tapVisitor();
  };

  const s = model.length;
  const top = dims.h;
  return (
    <group ref={group} position={[0, top / 2, 0]}>
      <group ref={body}>
        <mesh geometry={model.geometry} material={material} scale={s} />
        <Sparkles count={18} scale={[s * 1.4, Math.max(0.5, s * 0.6), s * 1.4]} size={3} speed={0.4} color="#fff3b0" opacity={0.9} />
      </group>
      <mesh
        geometry={hitGeometry}
        material={hitMaterial}
        scale={[Math.max(0.6, s * 0.8), Math.max(0.6, s * 0.6), Math.max(0.7, s * 1.2)]}
        onClick={onClick}
      />
    </group>
  );
}
