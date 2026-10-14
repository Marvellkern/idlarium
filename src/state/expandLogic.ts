// Buying an expansion: the store does the bookkeeping, this kicks off the
// animation, sound and messages. Used by the Expand card and the visitor "Make room".
import { BIOMES, type BiomeId } from "../data/biomes";
import { SIZE_LEVELS, TERRAIN_FEATURES } from "../data/expansion";
import { play } from "../utils/audio";
import { fmt } from "../utils/format";
import { useGame } from "./gameStore";
import { useUI } from "./uiStore";

export function expandHabitat(biome: BiomeId): boolean {
  const res = useGame.getState().expandHabitat(biome);
  const ui = useUI.getState();
  if (!res.ok) {
    ui.toast(res.reason);
    return false;
  }
  const to = res.to ?? 2;
  ui.startExpansion({ biome, from: res.from ?? to - 1, to });
  play("chime");
  window.setTimeout(() => play("pop"), 350);
  const feature = TERRAIN_FEATURES[BIOMES[biome].expansion.features[to - 2]]?.name;
  if (to >= SIZE_LEVELS) {
    ui.toast(res.milestoneReward ? `Fully expanded! A thank-you gift: +${fmt(res.milestoneReward)} pearls.` : "Fully expanded!");
  } else {
    ui.toast(`More room to roam${feature ? `, plus ${feature.toLowerCase()}` : ""}.`);
  }
  return true;
}
