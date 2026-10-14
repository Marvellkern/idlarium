import type { BiomeId } from "../data/biomes";
import { SPECIES_BY_ID, VARIANT_BY_ID } from "../data/creatures";
import { play } from "../utils/audio";
import { spaceShort } from "./economy";
import { useGame } from "./gameStore";
import { spawnHints, type Vec3 } from "./handoff";
import { useUI } from "./uiStore";

/**
 * Hatch one egg; `at` is where the egg sits so the hatchling starts there.
 * Without room the egg keeps waiting and the Make Room picker opens instead.
 */
export function hatchEgg(biome: BiomeId, index: number, at?: Vec3) {
  const h = useGame.getState().habitats[biome];
  const egg = h?.eggs[index];
  const ui = useUI.getState();
  if (egg && spaceShort(biome, h, egg.speciesId) > 0) {
    ui.openMakeRoom({ kind: "egg", biome, index, ...(at ? { at } : {}) });
    return;
  }
  const res = useGame.getState().hatchEgg(biome, index);
  if (!res.ok) {
    ui.toast(res.reason);
    return;
  }
  if (res.uid && at) spawnHints.set(res.uid, { ...at });
  play("pop");
  const name = SPECIES_BY_ID[egg?.speciesId ?? ""]?.name.toLowerCase() ?? "hatchling";
  if (res.variantId) {
    ui.toast(`A rare color: a ${VARIANT_BY_ID[res.variantId]?.name ?? "new variant"} hatched. New codex entry.`);
    play("chime");
  } else ui.toast(`A baby ${name} hatched.`);
}
