// Tank care: wiping the glass, buying equipment and style items, the lamp.
// The store does the bookkeeping; this adds the sounds, sparkles and messages.
import type { BiomeId } from "../data/biomes";
import { equipmentName, styleItem, TANK, type EquipmentSlot, type StyleKind } from "../data/equipment";
import { play } from "../utils/audio";
import { useGame } from "./gameStore";
import { useUI } from "./uiStore";

/** The glass is clean (wiped enough, or "Clean all"). */
export function finishWipe(biome: BiomeId) {
  const res = useGame.getState().cleanGlass(biome);
  const ui = useUI.getState();
  ui.setWiping(false);
  if (!res.ok) return;
  ui.setCleanBurst();
  play("chime");
  ui.toast(
    res.sparkled
      ? `Sparkling clean! +${Math.round(TANK.sparkleIncome * 100)}% pearls here for ${TANK.sparkleMinutes} minutes.`
      : "Squeaky clean. Let it get a bit cloudier next time for a Sparkling bonus.",
  );
}

export function toggleWipe() {
  const ui = useUI.getState();
  ui.setWiping(ui.wipingSince === null);
  play("tap");
}

export function buyEquipment(biome: BiomeId, slot: EquipmentSlot) {
  const res = useGame.getState().buyEquipment(biome, slot);
  if (!res.ok) {
    useUI.getState().toast(res.reason);
    return;
  }
  play("pop");
  useUI.getState().toast(`${equipmentName(biome, slot)} installed.`);
}

/** Buy (or switch to, if owned) a lamp, background or frame. */
export function chooseStyle(biome: BiomeId, kind: StyleKind, id: string) {
  const res = useGame.getState().buyStyle(biome, kind, id);
  const ui = useUI.getState();
  if (!res.ok) {
    ui.toast(res.reason);
    return;
  }
  ui.previewStyle(null);
  play("pop");
  const name = styleItem(kind, id)?.name;
  if (name) ui.toast(`${name} is on the tank.`);
}

export function toggleLamp(biome: BiomeId, on: boolean) {
  // Switching by hand turns off the schedule.
  useGame.getState().setLamp(biome, { on, auto: false });
  play("tap");
}
