import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES, type BiomeId } from "../data/biomes";
import { SPECIES_BY_ID } from "../data/creatures";
import { EXPAND_ANIM_MS, REDUCED_FADE_MS } from "../data/expansion";
import { habitatDims } from "../data/habitatGeometry";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { isTouchDevice, prefersReducedMotion } from "../utils/motion";
import { Atmosphere } from "./Atmosphere";
import { CameraRig } from "./CameraRig";
import { Creature } from "./Creature";
import { CreatureSchool } from "./CreatureSchool";
import { Decorations, Scenery } from "./Decorations";
import { Departures } from "./Departures";
import { Diorama, LightShafts } from "./Diorama";
import { Eggs } from "./Eggs";
import { ExpansionBurst } from "./ExpansionBurst";
import { Feeding } from "./Feeding";
import { creaturePositions, expansionCtx } from "./registry";
import { sceneLookup } from "../state/handoff";
import { Signature } from "./Signatures";
import { Tank } from "./Tank";
import { TerrainFeatures } from "./TerrainFeatures";
import { Visitor } from "./Visitor";

// Postprocessing is only needed down in the Deep Sea, so it loads on demand.
const DeepBloom = lazy(() => import("./DeepBloom"));

export function HabitatScene({ biome }: { biome: BiomeId }) {
  const b = BIOMES[biome];
  const habitat = useGame((s) => s.habitats[biome]);
  const quality = useGame((s) => s.settings.quality);
  const decorating = useUI((s) => s.panel === "decorate");
  const visitor = useUI((s) => (s.visitor?.biome === biome ? s.visitor : null));
  const expansion = useUI((s) => (s.expansion?.biome === biome ? s.expansion : null));
  const preview = useUI((s) => s.expandPreview);
  const high = quality === "high";
  const p = b.palette;

  // Size levels: the visuals grow from `from` to `level`; creatures, slots and visitors
  // keep the old size until the walls have finished moving, then switch over.
  const level = habitat?.sizeLevel ?? 1;
  const simLevel = expansion ? expansion.from : level;
  const dims = useMemo(() => habitatDims(biome, level), [biome, level]);
  const simDims = useMemo(() => habitatDims(biome, simLevel), [biome, simLevel]);
  const camDims = useMemo(() => habitatDims(biome, preview && !expansion && level < 5 ? level + 1 : level), [biome, preview, expansion, level]);

  // Drive the growth animation (about 2 s; tap or reduced motion jumps to the end).
  const reduced = useMemo(prefersReducedMotion, []);
  const ending = useRef<number | null>(null);
  useFrame(() => {
    if (!expansion) {
      expansionCtx.t = 1;
      return;
    }
    const elapsed = performance.now() - expansion.startedAt;
    // Reduced motion: no growth animation; switch while the fade covers the screen.
    const t = expansion.skipped ? 1 : reduced ? (elapsed >= REDUCED_FADE_MS * 0.4 ? 1 : 0) : elapsed / EXPAND_ANIM_MS;
    expansionCtx.t = Math.min(1, Math.max(0, t));
    const fadeDone = !reduced || expansion.skipped || elapsed >= REDUCED_FADE_MS;
    if (t >= 1 && fadeDone && ending.current !== expansion.startedAt) {
      ending.current = expansion.startedAt;
      useUI.getState().endExpansion();
    }
  });

  const { singles, schools } = useMemo(() => {
    const singles: { uid: string; speciesId: string; variantId?: string }[] = [];
    // One instanced school per species + color variant.
    const schools = new Map<string, { speciesId: string; variantId?: string; uids: string[] }>();
    for (const c of habitat?.creatures ?? []) {
      if (SPECIES_BY_ID[c.speciesId]?.behavior === "school") {
        const key = c.speciesId + "|" + (c.variantId ?? "");
        const entry = schools.get(key) ?? { speciesId: c.speciesId, variantId: c.variantId, uids: [] };
        entry.uids.push(c.uid);
        schools.set(key, entry);
      } else singles.push(c);
    }
    return { singles, schools: [...schools.entries()] };
  }, [habitat?.creatures]);

  // Lets game logic ask where a creature is (released ones swim off from there).
  useEffect(() => {
    const v = new THREE.Vector3();
    sceneLookup.positionOf = (uid) => {
      const get = creaturePositions.get(uid);
      if (!get) return null;
      get(v);
      return { x: v.x, y: v.y, z: v.z };
    };
    return () => {
      sceneLookup.positionOf = null;
    };
  }, []);

  const startleAt = expansion?.startedAt;
  const moreLight = b.expansion.features.indexOf("more-light") + 2;

  return (
    <>
      <Atmosphere biome={biome} shadows={high} dims={dims} />

      <Diorama biome={biome} quality={quality} level={level} fromLevel={expansion ? expansion.from : null} preview={preview && !expansion} />
      <TerrainFeatures biome={biome} level={level} dims={dims} growingTo={expansion ? expansion.to : null} />
      <Scenery biome={biome} dims={dims} castShadow={high && !isTouchDevice()} />
      <Signature biome={biome} dims={dims} high={high} />
      <Tank biome={biome} dims={dims} high={high} />
      {habitat && (
        // Phones skip decoration shadows: it halves the shadow-pass draw calls in a full Lv5 habitat.
        <Decorations biome={biome} placed={habitat.decorations} decorating={decorating} castShadow={high && !isTouchDevice()} level={simLevel} dims={dims} />
      )}

      {singles.map((c) => (
        <Creature
          key={c.uid}
          uid={c.uid}
          speciesId={c.speciesId}
          variantId={c.variantId}
          biome={biome}
          castShadow={high}
          dims={simDims}
          startleAt={startleAt}
        />
      ))}
      {schools.map(([key, s]) => (
        <CreatureSchool
          key={key}
          speciesId={s.speciesId}
          variantId={s.variantId}
          uids={s.uids}
          biome={biome}
          castShadow={high}
          dims={simDims}
          startleAt={startleAt}
        />
      ))}
      {habitat && habitat.eggs.length > 0 && <Eggs biome={biome} eggs={habitat.eggs} />}

      {visitor && <Visitor key={visitor.id} visitor={visitor} dims={simDims} />}
      <Departures biome={biome} dims={simDims} />
      <Feeding biome={biome} dims={simDims} />
      {expansion && !reduced && <ExpansionBurst startedAt={expansion.startedAt} dims={dims} />}

      <Sparkles
        count={high ? 40 : 15}
        scale={[dims.w * 0.9, dims.h * 0.85, dims.d * 0.9]}
        position={[0, dims.h / 2, 0]}
        size={biome === "swamp" ? 2 : 1.5}
        speed={0.15}
        opacity={0.45}
        color={biome === "swamp" ? p.glow : "#ffffff"}
      />
      {high && b.lightShafts > 0 && <LightShafts dims={dims} count={moreLight >= 2 && level >= moreLight ? Math.round(b.lightShafts * 1.8) : b.lightShafts} />}

      {high && biome === "deep" && (
        <Suspense fallback={null}>
          <DeepBloom />
        </Suspense>
      )}
      <CameraRig biome={biome} decorating={decorating} dims={camDims} />
    </>
  );
}
