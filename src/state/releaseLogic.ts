// Releasing creatures: one tap (with Undo) for everyday ones, a confirm dialog for
// rares, legendaries and big batches. The store does the bookkeeping; this adds the
// swim-off animation, the "+X pearls" pop-up and the messages.
import type { BiomeId } from "../data/biomes";
import { SPECIES_BY_ID } from "../data/creatures";
import { play } from "../utils/audio";
import { fmt } from "../utils/format";
import { ECONOMY, releaseNeedsConfirm } from "./economy";
import { useGame } from "./gameStore";
import { sceneLookup, spawnHints, type Vec3 } from "./handoff";
import type { OwnedCreature } from "./types";
import { useUI } from "./uiStore";

const INVARIANT = /(fish|squid|mahi-mahi|sheep)$/;

/** "clownfish" → "clownfish", "guppy" → "guppies", "seahorse" → "seahorses". */
export function plural(name: string) {
  if (INVARIANT.test(name)) return name;
  if (/[^aeiou]y$/.test(name)) return name.slice(0, -1) + "ies";
  if (/(s|sh|ch|x)$/.test(name)) return name + "es";
  return name + "s";
}

function creaturesOf(biome: BiomeId, uids: string[]) {
  const h = useGame.getState().habitats[biome];
  const set = new Set(uids);
  return h ? h.creatures.filter((c) => set.has(c.uid)) : [];
}

/** "The clownfish swam off to explore." / "3 guppies swam off to explore." */
export function releaseLine(released: OwnedCreature[]) {
  const ids = new Set(released.map((c) => c.speciesId));
  const name = SPECIES_BY_ID[released[0]?.speciesId]?.name.toLowerCase() ?? "creature";
  if (released.length === 1) return `The ${name} swam off to explore.`;
  if (ids.size === 1) return `${released.length} ${plural(name)} swam off to explore.`;
  return `${released.length} creatures swam off to explore.`;
}

/**
 * Start a release. Everyday creatures go right away with an Undo; rares,
 * legendaries and batches of 5+ open the confirm dialog first.
 */
export function requestRelease(
  biome: BiomeId,
  uids: string[],
  opts: { then?: () => void; confirmLabel?: string; /** false: no Undo (the space is about to be used). */ undo?: boolean } = {},
) {
  const list = creaturesOf(biome, uids);
  if (!list.length) return;
  const confirm = list.some((c) => {
    const sp = SPECIES_BY_ID[c.speciesId];
    return !sp || releaseNeedsConfirm(sp, list.length);
  });
  if (confirm) {
    useUI.getState().askRelease({ biome, uids: list.map((c) => c.uid), then: opts.then, confirmLabel: opts.confirmLabel });
    return;
  }
  if (performRelease(biome, list.map((c) => c.uid), opts.undo ?? true)) opts.then?.();
}

/** The confirm dialog's "Release" button. */
export function confirmRelease() {
  const ui = useUI.getState();
  const c = ui.releaseConfirm;
  if (!c) return;
  ui.askRelease(null);
  if (performRelease(c.biome, c.uids, false)) c.then?.();
}

export function cancelRelease() {
  useUI.getState().askRelease(null);
}

function performRelease(biome: BiomeId, uids: string[], undoable: boolean) {
  // Grab where everyone is before they leave the habitat.
  const from = new Map<string, Vec3 | null>();
  for (const u of uids) from.set(u, sceneLookup.positionOf?.(u) ?? null);

  const res = useGame.getState().releaseCreatures(biome, uids);
  if (!res.ok) return false;
  const ui = useUI.getState();
  if (ui.selectedUid && uids.includes(ui.selectedUid)) ui.select(null);

  const now = performance.now();
  const departing = res.released.map((c, i) => ({
    key: `${c.uid}:${now}`,
    speciesId: c.speciesId,
    variantId: c.variantId,
    biome,
    from: from.get(c.uid) ?? null,
    startedAt: now,
    swim: i < ECONOMY.release.animateMax,
  }));
  const keys = departing.map((d) => d.key);
  ui.addDeparting(departing);
  window.setTimeout(() => useUI.getState().removeDeparting(keys), ECONOMY.release.animMs + 300);

  play("chime");
  if (res.refund > 0) ui.floatText(`+${fmt(res.refund)} pearls`);
  let line = releaseLine(res.released) + (res.refund > 0 ? ` +${fmt(res.refund)} pearls.` : "");
  if (res.toSanctuary) line += res.released.length === 1 ? " It might come back to visit one day." : " Old friends sometimes come back to visit.";

  if (undoable) {
    let toastId = 0;
    toastId = ui.toast(line, {
      ms: ECONOMY.release.undoSeconds * 1000,
      action: {
        label: "Undo",
        run: () => {
          useUI.getState().dismissToast(toastId);
          undoRelease(biome, res.released, res.refund, keys, from);
        },
      },
    });
  } else ui.toast(line);
  return true;
}

function undoRelease(biome: BiomeId, creatures: OwnedCreature[], refund: number, keys: string[], from: Map<string, Vec3 | null>) {
  const res = useGame.getState().restoreCreatures(biome, creatures, refund);
  const ui = useUI.getState();
  if (!res.ok) {
    ui.toast(res.reason);
    return;
  }
  // They swim back in from where they left.
  for (const c of creatures) {
    const p = from.get(c.uid);
    if (p) spawnHints.set(c.uid, p);
  }
  ui.removeDeparting(keys);
  play("pop");
  ui.toast(creatures.length === 1 ? "Changed your mind? It swam right back." : "They swam right back.");
}
