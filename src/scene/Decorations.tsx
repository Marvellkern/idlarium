import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES, type BiomeId } from "../data/biomes";
import { DECORATION_BY_ID } from "../data/decorations";
import type { PlacedDecoration } from "../state/types";
import { useUI } from "../state/uiStore";
import { play } from "../utils/audio";
import { decoScale, decoSlots, type Dims, type Slot } from "./layout";
import { getDecoModel } from "./models/decoModels";
import { habitatCtx, sceneTime } from "./registry";
import { createSwimMaterial, SwimMode } from "./swimShader";

interface Props {
  biome: BiomeId;
  placed: PlacedDecoration[];
  decorating: boolean;
  castShadow: boolean;
  /** Size level whose slots are available. */
  level: number;
  /** Current diorama size (ground height and water surface). */
  dims: Dims;
}

export function Decorations({ biome, placed, decorating, castShadow, level, dims }: Props) {
  const slots = useMemo(() => decoSlots(biome, level, dims), [biome, level, dims]);
  const byKey = useMemo(() => new Map(slots.map((sl) => [sl.key, sl])), [slots]);
  const scale = decoScale(biome);

  // Lily pads are resting spots for frogs; hideouts shelter resting creatures.
  useEffect(() => {
    habitatCtx.pads = placed
      .filter((p) => p.decoId === "lily-pads")
      .map((p) => byKey.get(p.slot)?.pos.clone().add(new THREE.Vector3(0, 0.02, 0)))
      .filter((v): v is THREE.Vector3 => !!v);
    habitatCtx.hideouts = placed
      .filter((p) => DECORATION_BY_ID[p.decoId]?.hideout)
      .map((p) => byKey.get(p.slot)?.pos.clone())
      .filter((v): v is THREE.Vector3 => !!v);
    return () => {
      habitatCtx.pads = [];
      habitatCtx.hideouts = [];
    };
  }, [placed, byKey]);

  return (
    <group>
      {placed.map((p) => {
        const slot = byKey.get(p.slot);
        if (!slot) return null;
        return <PlacedDeco key={p.slot + p.decoId} slot={slot} deco={p} biome={biome} scale={scale} castShadow={castShadow} waterH={dims.h} />;
      })}
      {decorating && slots.map((s) => <SlotMarker key={s.key} slot={s} filled={placed.some((p) => p.slot === s.key)} scale={scale} />)}
    </group>
  );
}

function PlacedDeco({
  slot,
  deco,
  biome,
  scale,
  castShadow,
  waterH,
}: {
  slot: Slot;
  deco: PlacedDecoration;
  biome: BiomeId;
  scale: number;
  castShadow: boolean;
  waterH: number;
}) {
  // Reeds and mangroves are built to poke out of the water, so they follow its height.
  const model = useMemo(() => getDecoModel(deco.decoId, waterH / scale), [deco.decoId, waterH, scale]);
  const mat = useMemo(
    () => createSwimMaterial({ mode: SwimMode.PLANT, amp: model.sway, freq: 1.5, rim: 0.15, side: THREE.DoubleSide }),
    [model],
  );
  const glowMat = useMemo(
    () => (model.glow ? new THREE.MeshBasicMaterial({ color: model.glow.color, toneMapped: false }) : null),
    [model],
  );
  useEffect(() => () => (mat.dispose(), glowMat?.dispose()), [mat, glowMat]);
  const glowRef = useRef<THREE.Mesh>(null);
  const spinRef = useRef<THREE.Group>(null);
  const phase = useMemo(() => (slot.pos.x * 3.1 + slot.pos.z * 1.7) % 10, [slot.pos.x, slot.pos.z]);
  useFrame((_s, dt) => {
    mat.userData.swim.uPhase.value = sceneTime.value + phase;
    if (spinRef.current && model.spin) spinRef.current.rotation.y += dt * model.spin;
    // Fireflies only come out after dusk (and twinkle).
    if (glowRef.current) {
      const night = BIOMES[biome].sunlit ? habitatCtx.daylight < 0.6 : true;
      glowRef.current.visible = night && Math.sin(sceneTime.value * 2 + phase) > -0.6;
    }
  });
  const isSurface = DECORATION_BY_ID[deco.decoId]?.placement === "surface";
  return (
    <group position={slot.pos} rotation={[0, (deco.rotation * Math.PI) / 2, 0]} scale={scale}>
      <group ref={spinRef}>
        <mesh geometry={model.geometry} material={mat} castShadow={castShadow && !isSurface && !model.spin} receiveShadow />
      </group>
      {model.glow && glowMat && <mesh ref={glowRef} geometry={model.glow.geometry} material={glowMat} />}
      {model.light && <pointLight color={model.light.color} intensity={model.light.intensity} distance={7} decay={1.5} position={[0, model.light.y, 0]} />}
    </group>
  );
}

const ringGeo = new THREE.RingGeometry(0.36, 0.46, 24);
ringGeo.rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(0.36, 24);
discGeo.rotateX(-Math.PI / 2);

function SlotMarker({ slot, filled, scale }: { slot: Slot; filled: boolean; scale: number }) {
  const active = useUI((s) => s.decoSlot === slot.key);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.scale.setScalar(scale * (active ? 1.1 + Math.sin(sceneTime.value * 4) * 0.05 : 1));
  });
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useUI.getState().setDecoSlot(slot.key);
    play("tap");
  };
  const color = active ? "#ffd166" : filled ? "#ffffff" : slot.kind === "surface" ? "#bff3ff" : "#e8f6e0";
  return (
    <group ref={ref} position={[slot.pos.x, slot.pos.y + 0.05, slot.pos.z]}>
      <mesh geometry={ringGeo} renderOrder={10}>
        <meshBasicMaterial color={color} transparent opacity={0.95} depthTest={false} />
      </mesh>
      <mesh geometry={discGeo} renderOrder={9} onClick={onClick}>
        <meshBasicMaterial color={color} transparent opacity={active ? 0.35 : 0.15} depthTest={false} />
      </mesh>
    </group>
  );
}
