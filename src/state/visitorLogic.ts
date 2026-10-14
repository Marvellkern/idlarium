// Visitor flow: spawn every few minutes in the active habitat, tap within the window
// to befriend, otherwise it's logged as "spotted". Never punishes.
import type { BiomeId } from "../data/biomes";
import { SPECIES_BY_ID, SIZE_SPACE } from "../data/creatures";
import { spawnHints, visitorPos } from "./handoff";
import { play } from "../utils/audio";
import { uid } from "../utils/id";
import { ECONOMY, capacityOf, nextExpansion, pickWeighted, spaceUsed, visitorWeights } from "./economy";
import { expandHabitat } from "./expandLogic";
import { useGame } from "./gameStore";
import { useUI } from "./uiStore";

const nameOf = (id: string) => SPECIES_BY_ID[id]?.name.toLowerCase() ?? "visitor";
const article = (word: string) => (/^[aeiou]/i.test(word) ? "An" : "A");

export function scheduleNextVisitor(now = Date.now()) {
  const { minIntervalSec, maxIntervalSec } = ECONOMY.visitor;
  useUI.getState().setNextVisitorAt(now + (minIntervalSec + Math.random() * (maxIntervalSec - minIntervalSec)) * 1000);
}

export function spawnVisitor(now = Date.now(), forcedSpeciesId?: string) {
  const g = useGame.getState();
  const biome = g.activeBiome;
  const speciesId = forcedSpeciesId ?? pickWeighted(visitorWeights(biome, g.habitats[biome], g.codex))?.species.id;
  if (!speciesId) return;
  useUI.getState().setVisitor({
    id: uid(),
    speciesId,
    biome,
    startedAt: now,
    expiresAt: now + ECONOMY.visitor.tapWindowSec * 1000,
    state: "swimming",
  });
  g.markSpotted(speciesId);
  play("chime");
}

/** Called about once a second while the game is visible. */
export function visitorTick(now = Date.now()) {
  const ui = useUI.getState();
  const v = ui.visitor;
  const active = useGame.getState().activeBiome;
  if (v) {
    if (v.biome !== active) {
      ui.setVisitor(null);
      scheduleNextVisitor(now);
    } else if (v.state === "swimming" && now > v.expiresAt) {
      ui.setVisitor(null);
      const owned = useGame.getState().codex[v.speciesId] === "owned";
      ui.toast(owned ? `The ${nameOf(v.speciesId)} swam on.` : `The ${nameOf(v.speciesId)} swam off. It's in your codex as spotted.`);
      scheduleNextVisitor(now);
    }
    return;
  }
  if (ui.away || ui.nextVisitorAt === 0) return;
  if (now >= ui.nextVisitorAt) spawnVisitor(now);
}

function completeBefriend(speciesId: string, biome: BiomeId) {
  const wasOwned = useGame.getState().codex[speciesId] === "owned";
  const res = useGame.getState().befriend(speciesId, biome);
  if (!res.ok) return false;
  if (res.uid) spawnHints.set(res.uid, { ...visitorPos });
  const ui = useUI.getState();
  ui.setVisitor(null);
  const sp = SPECIES_BY_ID[speciesId];
  const name = nameOf(speciesId);
  ui.toast(`${article(name)} ${name} moved in. Welcome home.`);
  if (!wasOwned && sp?.baseCost !== undefined) ui.toast(`You can now find the ${name} in the shop too.`);
  play("pop");
  scheduleNextVisitor();
  return true;
}

export function tapVisitor() {
  const ui = useUI.getState();
  const v = ui.visitor;
  if (!v || v.state !== "swimming") return;
  if (!completeBefriend(v.speciesId, v.biome)) ui.setVisitor({ ...v, state: "asking" });
}

/** Space the waiting visitor still needs, and what the next upgrade would cost. */
export function roomInfo() {
  const v = useUI.getState().visitor;
  const g = useGame.getState();
  if (!v) return null;
  const h = g.habitats[v.biome];
  const sp = SPECIES_BY_ID[v.speciesId];
  if (!h || !sp) return null;
  const need = SIZE_SPACE[sp.size];
  const free = capacityOf(v.biome, h) - spaceUsed(h);
  const next = nextExpansion(v.biome, h);
  return {
    need,
    free,
    upgradeCost: next?.cost ?? 0,
    canUpgrade: !!next,
    upgradeAdds: next ? next.spaceAfter - next.spaceBefore : 0,
  };
}

export function makeRoom() {
  const v = useUI.getState().visitor;
  if (!v) return;
  if (!expandHabitat(v.biome)) return;
  if (!completeBefriend(v.speciesId, v.biome)) useUI.getState().toast("A bit more room is needed. Try one more expansion.");
}

export function letVisitorGo() {
  const ui = useUI.getState();
  const v = ui.visitor;
  if (!v) return;
  ui.setVisitor(null);
  ui.toast(`The ${nameOf(v.speciesId)} drifted off. It may come back another time.`);
  scheduleNextVisitor();
}
