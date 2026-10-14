// Visitor flow: one visitor every few minutes in the active habitat, tap within the
// window to befriend, otherwise it's logged as "spotted". Never punishes.
// The timer runs on the real clock and is saved, so it keeps going in another tab or
// with the game closed. When it's up, one visitor waits for you (never more), and the
// timer only starts again once that visitor has been dealt with.
import type { BiomeId } from "../data/biomes";
import { SPECIES_BY_ID, SIZE_SPACE } from "../data/creatures";
import { spawnHints, visitorPos } from "./handoff";
import { play } from "../utils/audio";
import { uid } from "../utils/id";
import { ECONOMY, capacityOf, nextExpansion, pickWeighted, spaceUsed, visitorWeights } from "./economy";
import { expandHabitat } from "./expandLogic";
import { useGame } from "./gameStore";
import { useUI, type ActiveVisitor } from "./uiStore";

const nameOf = (id: string) => SPECIES_BY_ID[id]?.name.toLowerCase() ?? "visitor";
const article = (word: string) => (/^[aeiou]/i.test(word) ? "An" : "A");

export function scheduleNextVisitor(now = Date.now()) {
  const { minIntervalSec, maxIntervalSec } = ECONOMY.visitor;
  useGame.getState().setVisitorDue(now + (minIntervalSec + Math.random() * (maxIntervalSec - minIntervalSec)) * 1000);
}

/** Now and then an old friend from the Sanctuary comes back instead of a new visitor. */
function pickReturning(biome: BiomeId) {
  const friends = useGame.getState().sanctuary.filter((e) => e.biome === biome);
  if (!friends.length || Math.random() >= ECONOMY.sanctuary.returnChance) return null;
  return friends[Math.floor(Math.random() * friends.length)];
}

export function spawnVisitor(now = Date.now(), forcedSpeciesId?: string, forceReturning = false) {
  const g = useGame.getState();
  const biome = g.activeBiome;
  const friend = forcedSpeciesId
    ? null
    : forceReturning
      ? (g.sanctuary.filter((e) => e.biome === biome).at(-1) ?? null)
      : pickReturning(biome);
  const speciesId = friend?.speciesId ?? forcedSpeciesId ?? pickWeighted(visitorWeights(biome, g.habitats[biome], g.codex))?.species.id;
  if (!speciesId) return;
  useUI.getState().setVisitor({
    id: uid(),
    speciesId,
    ...(friend ? { returning: friend.releasedAt, ...(friend.variantId ? { variantId: friend.variantId } : {}) } : {}),
    biome,
    startedAt: now,
    expiresAt: now + ECONOMY.visitor.tapWindowSec * 1000,
    state: "swimming",
  });
  g.markSpotted(speciesId);
  // No timer while a visitor is here; it restarts once this one is dealt with.
  g.setVisitorDue(0);
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
  // Wait until the away summary is closed, so the visitor isn't hidden behind it.
  const due = useGame.getState().visitorDueAt;
  if (ui.away) return;
  if (due === 0) scheduleNextVisitor(now); // e.g. the page was closed while a visitor was here
  else if (now >= due) spawnVisitor(now);
}

/** The tab was hidden for `ms`: give the current visitor that time back. */
export function pauseVisitorWindow(ms: number) {
  const ui = useUI.getState();
  const v = ui.visitor;
  if (!v || v.state !== "swimming" || ms <= 0) return;
  ui.setVisitor({ ...v, startedAt: v.startedAt + ms, expiresAt: v.expiresAt + ms });
}

function completeBefriend(v: ActiveVisitor) {
  const { speciesId, biome } = v;
  const wasOwned = useGame.getState().codex[speciesId] === "owned";
  const res = useGame.getState().befriend(speciesId, biome, { variantId: v.variantId, returning: v.returning });
  if (!res.ok) return false;
  if (res.uid) spawnHints.set(res.uid, { ...visitorPos });
  const ui = useUI.getState();
  ui.setVisitor(null);
  const sp = SPECIES_BY_ID[speciesId];
  const name = nameOf(speciesId);
  ui.toast(v.returning !== undefined ? `Your old friend the ${name} is home again.` : `${article(name)} ${name} moved in. Welcome home.`);
  if (!wasOwned && sp?.baseCost !== undefined) ui.toast(`You can now find the ${name} in the shop too.`);
  play("pop");
  scheduleNextVisitor();
  return true;
}

export function tapVisitor() {
  const ui = useUI.getState();
  const v = ui.visitor;
  if (!v || v.state !== "swimming") return;
  if (!completeBefriend(v)) ui.setVisitor({ ...v, state: "asking" });
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
    canAffordUpgrade: !!next && g.pearls >= next.cost,
    upgradeAdds: next ? next.spaceAfter - next.spaceBefore : 0,
  };
}

/** "Expand Habitat" from the visitor prompt. */
export function expandForVisitor() {
  const v = useUI.getState().visitor;
  if (!v) return;
  if (!expandHabitat(v.biome)) return;
  if (!completeBefriend(v)) useUI.getState().toast("A bit more room is needed. Try Make Room or one more expansion.");
}

/** "Make Room": pick who to release. The visitor waits (its timer is paused while asking). */
export function openVisitorMakeRoom() {
  if (useUI.getState().visitor?.state === "asking") useUI.getState().openMakeRoom({ kind: "visitor" });
}

/** After the Make Room release: welcome the waiting visitor. */
export function welcomeWaitingVisitor() {
  const ui = useUI.getState();
  const v = ui.visitor;
  if (!v) return;
  if (!completeBefriend(v)) ui.toast("Still a little short on space.");
}

export function letVisitorGo() {
  const ui = useUI.getState();
  const v = ui.visitor;
  if (!v) return;
  ui.setVisitor(null);
  ui.toast(`The ${nameOf(v.speciesId)} drifted off. It may come back another time.`);
  scheduleNextVisitor();
}
