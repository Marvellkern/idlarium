import { useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES, type BiomeId } from "../data/biomes";
import { SPECIES_BY_ID, type Species } from "../data/creatures";
import { useGame } from "../state/gameStore";
import { spawnHints } from "../state/handoff";
import { useUI } from "../state/uiStore";
import { play } from "../utils/audio";
import { fadeBox, swimBounds, terrainHeight, type Dims } from "./layout";
import { getCreatureModel } from "./models/creatureModels";
import { createAgent, faceVelocity, resizeAgent, ROLL_SECONDS, startle, updateAgent } from "./movement";
import { agents, creatureLengths, creaturePositions, habitatCtx, pairBook } from "./registry";
import { OTTERS } from "../data/signatures";
import { hashStr } from "./models/geo";
import { createSwimMaterial, setEdgeFade } from "./swimShader";

interface Props {
  uid: string;
  speciesId: string;
  variantId?: string;
  biome: BiomeId;
  castShadow: boolean;
  /** Current habitat size (swim bounds follow it). */
  dims: Dims;
  /** Changes when the habitat starts growing: creatures dart briefly. */
  startleAt?: number;
}

const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
const hitGeometry = new THREE.SphereGeometry(0.5, 6, 4);
const shiftColor = new THREE.Color();

/** Nocturnal species rest by day, day species rest at night. Never in the sunless deep. */
export function isResting(sp: Species | undefined, biome: BiomeId, daylight: number) {
  if (!sp || !BIOMES[biome].sunlit) return false;
  if (sp.activity === "night") return daylight > 0.55;
  if (sp.activity === "day") return daylight < 0.35;
  return false;
}

export function Creature({ uid, speciesId, variantId, biome, castShadow, dims, startleAt }: Props) {
  const sp = SPECIES_BY_ID[speciesId];
  const giant = sp?.size === "XL";
  const model = useMemo(() => getCreatureModel(speciesId, variantId), [speciesId, variantId]);
  const material = useMemo(() => {
    const m = createSwimMaterial({
      amp: model.swim.amp,
      freq: model.swim.freq,
      mode: model.swim.mode,
      emissive: model.emissive?.color,
      emissiveIntensity: model.emissive?.intensity,
    });
    return m;
  }, [model]);
  useEffect(() => setEdgeFade(material, fadeBox(biome, dims), giant ? 1.6 : 0.6), [material, biome, dims, giant]);
  useEffect(() => () => material.dispose(), [material]);

  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const selected = useUI((s) => s.selectedUid === uid);

  const agent = useMemo(() => {
    const hint = spawnHints.get(uid);
    spawnHints.delete(uid);
    return createAgent({
      behavior: sp?.behavior === "school" ? "wander" : (sp?.behavior ?? "wander"),
      bounds: swimBounds(dims, model.length),
      length: model.length,
      floorAt: (x, z) => terrainHeight(biome, x, z, dims),
      waterTop: dims.h,
      spawn: hint ? new THREE.Vector3(hint.x, hint.y, hint.z) : undefined,
      habitat: dims,
      giant,
      trick: sp?.trick,
      perches: sp?.perches,
    });
    // Created once per mount; the creature keeps swimming across re-renders.
  }, []);

  useEffect(() => {
    creaturePositions.set(uid, (out) => out.copy(agent.pos));
    creatureLengths.set(uid, model.length);
    agents.set(uid, agent);
    return () => {
      creaturePositions.delete(uid);
      creatureLengths.delete(uid);
      agents.delete(uid);
    };
  }, [uid, agent, model.length]);

  // Sea otters pair up: 1st with 2nd, 3rd with 4th, … (in arrival order).
  const pairs = !!sp?.pairs;
  useEffect(() => {
    if (!pairs) return;
    const list = pairBook.get(speciesId) ?? [];
    list.push(uid);
    pairBook.set(speciesId, list);
    return () => {
      const l = pairBook.get(speciesId);
      if (l) l.splice(l.indexOf(uid), 1);
    };
  }, [pairs, speciesId, uid]);

  // Habitat grew (or shrank in debug): use the new space right away.
  const sizedFor = useRef(dims);
  useEffect(() => {
    if (sizedFor.current === dims) return;
    sizedFor.current = dims;
    resizeAgent(agent, { bounds: swimBounds(dims, model.length), waterTop: dims.h, habitat: dims, floorAt: (x, z) => terrainHeight(biome, x, z, dims) });
  }, [dims, agent, biome, model.length]);
  useEffect(() => {
    if (startleAt) startle(agent);
  }, [startleAt, agent]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    agent.resting = isResting(sp, biome, habitatCtx.daylight);
    // Tides: the surface (and how high anyone can swim) follows the water level.
    agent.waterTop = dims.h * habitatCtx.waterLevel;
    updateAgent(agent, {
      time: t,
      dt,
      feed: habitatCtx.feed,
      pads: habitatCtx.pads,
      hideouts: habitatCtx.hideouts,
      splashes: habitatCtx.splashes,
    });
    if (pairs) holdPaws(uid, speciesId, agent, t, dt);
    g.position.copy(agent.pos);
    const cruise = sp?.behavior === "cruise";
    if (!agent.restingOn) {
      if (agent.airborne) faceVelocity(g, agent.vel, dt, 4, 6);
      else faceVelocity(g, agent.vel, dt, cruise ? 1.5 : 4, giant ? 0.35 : cruise ? 0.2 : 0.5);
    }
    // Otters roll over at the surface now and then.
    if (body.current) body.current.rotation.z = agent.rollT > 0 ? (1 - agent.rollT / ROLL_SECONDS) * Math.PI * 2 : 0;
    const u = material.userData.swim;
    u.uPhase.value = agent.swimPhase;
    u.uRim.value = THREE.MathUtils.lerp(u.uRim.value, selected ? 1.1 : 0.35, 1 - Math.exp(-dt * 6));
    // Bioluminescent parts breathe slowly.
    u.uGlow.value = 0.75 + Math.sin(t * 1.3 + agent.swimPhase * 0.1) * 0.25;
    if (model.colorShift) {
      // Octopus idle color shift: drift through warm hues.
      const k = (Math.sin(t * 0.35 + agent.swimPhase * 0.05) + 1) / 2;
      shiftColor.setHSL(0.02 + k * 0.08, 0.35, 0.75 + k * 0.25);
      u.uTint.value.copy(shiftColor).multiplyScalar(1.25);
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useUI.getState().select(uid);
    useGame.getState().trackGoal("watch");
    play("tap");
  };

  const s = model.length;
  return (
    <group ref={group} position={agent.pos}>
      <group ref={body}>
      {sp?.modelUrl ? (
        <Suspense fallback={<mesh geometry={model.geometry} material={material} scale={s} />}>
          <GlbBody url={sp.modelUrl} length={s} />
        </Suspense>
      ) : (
        <mesh geometry={model.geometry} material={material} scale={s} castShadow={castShadow && model.length > 0.45} />
      )}
      </group>
      {/* Generous invisible hit target so small fish are easy to tap. */}
      <mesh
        geometry={hitGeometry}
        material={hitMaterial}
        scale={[Math.max(0.35, s * 0.6), Math.max(0.35, s * 0.4), Math.max(0.4, s)]}
        onClick={onClick}
      />
    </group>
  );
}

const side = new THREE.Vector3();
const spot = new THREE.Vector3();
const APART = (OTTERS.apartSeconds[0] + OTTERS.apartSeconds[1]) / 2;
const HOLD = (OTTERS.holdSeconds[0] + OTTERS.holdSeconds[1]) / 2;

/**
 * The second otter of a pair drifts over to float beside the first, facing the
 * same way, for a while ("holding paws"), then lets go and floats off again.
 */
function holdPaws(uid: string, speciesId: string, agent: ReturnType<typeof createAgent>, t: number, dt: number) {
  const list = pairBook.get(speciesId);
  const i = list ? list.indexOf(uid) : -1;
  if (!list || i < 1 || i % 2 === 0) return;
  const lead = agents.get(list[i - 1]);
  if (!lead || lead.restingOn) return;
  const phase = (t + (hashStr(list[i - 1]) % 50)) % (APART + HOLD);
  if (phase < APART) return;
  side.set(-lead.vel.z, 0, lead.vel.x);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize().multiplyScalar(OTTERS.gap);
  spot.copy(lead.pos).add(side);
  spot.y = lead.pos.y;
  agent.pos.lerp(spot, 1 - Math.exp(-Math.min(dt, 0.1) * 1.4));
  agent.vel.copy(lead.vel);
}

/** Drop-in replacement body for species that set `modelUrl` (CC0/CC-BY .glb). */
function GlbBody({ url, length }: { url: string; length: number }) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => {
    const c = gltf.scene.clone(true);
    const bb = new THREE.Box3().setFromObject(c);
    const size = bb.getSize(new THREE.Vector3());
    const k = length / Math.max(size.z, 1e-3);
    c.scale.setScalar(k);
    c.position.sub(bb.getCenter(new THREE.Vector3()).multiplyScalar(k));
    return c;
  }, [gltf, length]);
  return <primitive object={scene} />;
}
