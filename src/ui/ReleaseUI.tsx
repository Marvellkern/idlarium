// Releasing creatures: the confirm dialog, the Make Room picker, a count stepper
// and the "+X pearls" pop-ups. Rules live in state/releaseLogic.ts and economy.ts.
import { useMemo, useState } from "react";
import type { BiomeId } from "../data/biomes";
import { RARITY_LABEL, SIZE_SPACE, SPECIES, SPECIES_BY_ID, VARIANT_BY_ID, type Species } from "../data/creatures";
import { freeSpace, habitatIncome, happiness, releaseOrder, releaseRefund } from "../state/economy";
import { hatchEgg } from "../state/eggLogic";
import { useGame } from "../state/gameStore";
import { cancelRelease, confirmRelease, plural, requestRelease } from "../state/releaseLogic";
import type { HabitatSave } from "../state/types";
import { useUI } from "../state/uiStore";
import { welcomeWaitingVisitor } from "../state/visitorLogic";
import { fmt, fmtRate } from "../utils/format";
import { CreatureGlyph } from "./CreatureGlyph";
import { Modal } from "./Panel";

export interface CreatureGroup {
  key: string;
  sp: Species;
  variantId?: string;
  name: string;
  uids: string[];
}

const SPECIES_INDEX = new Map(SPECIES.map((s, i) => [s.id, i]));

/** Creatures in a habitat grouped by species + color variant, in codex order. */
export function groupCreatures(h: HabitatSave | undefined): CreatureGroup[] {
  const groups = new Map<string, CreatureGroup>();
  for (const c of h?.creatures ?? []) {
    const sp = SPECIES_BY_ID[c.speciesId];
    if (!sp) continue;
    const key = c.speciesId + "|" + (c.variantId ?? "");
    let g = groups.get(key);
    if (!g) {
      g = { key, sp, variantId: c.variantId, name: (c.variantId && VARIANT_BY_ID[c.variantId]?.name) || sp.name, uids: [] };
      groups.set(key, g);
    }
    g.uids.push(c.uid);
  }
  return [...groups.values()].sort((a, b) => (SPECIES_INDEX.get(a.sp.id) ?? 0) - (SPECIES_INDEX.get(b.sp.id) ?? 0) || (a.variantId ? 1 : 0) - (b.variantId ? 1 : 0));
}

/** − n + with an "All" shortcut. */
export function Stepper({ value, max, min = 0, onChange, label }: { value: number; max: number; min?: number; onChange: (n: number) => void; label: string }) {
  const btn = "grid h-11 w-10 place-items-center rounded-xl bg-white/80 text-lg font-black hover:bg-white disabled:opacity-40";
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="One fewer">
        −
      </button>
      <span className="w-7 text-center font-black tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="One more">
        +
      </button>
      {max > 2 && (
        <button
          type="button"
          className="min-h-11 rounded-xl px-2 text-sm font-extrabold text-ink-soft hover:bg-black/5 disabled:opacity-40"
          disabled={value === max}
          onClick={() => onChange(max)}
        >
          All
        </button>
      )}
    </div>
  );
}

/** Totals for releasing these creatures right now. */
function releaseTotals(biome: BiomeId, h: HabitatSave, uids: string[]) {
  const now = Date.now();
  const home = habitatIncome(h, now);
  const mood = happiness(h, now).value;
  const set = new Set(uids);
  let space = 0;
  let income = 0;
  let refund = 0;
  for (const c of h.creatures) {
    if (!set.has(c.uid)) continue;
    const sp = SPECIES_BY_ID[c.speciesId];
    if (!sp) continue;
    space += SIZE_SPACE[sp.size];
    income += sp.pearlsPerSec * mood;
    refund += releaseRefund(sp, home);
  }
  return { space, income, refund, free: freeSpace(biome, h) };
}

/** Rares, legendaries and batches of 5+ ask first. */
export function ReleaseConfirmDialog() {
  const c = useUI((s) => s.releaseConfirm);
  const h = useGame((s) => (c ? s.habitats[c.biome] : undefined));
  if (!c || !h) return null;
  const groups = groupCreatures({ ...h, creatures: h.creatures.filter((x) => c.uids.includes(x.uid)) });
  if (!groups.length) return null;
  const t = releaseTotals(c.biome, h, c.uids);
  const single = groups.length === 1 ? groups[0] : null;
  const count = c.uids.length;
  const what = single ? (count === 1 ? `the ${single.name.toLowerCase()}` : `${count} ${plural(single.name.toLowerCase())}`) : `${count} creatures`;
  const label = c.confirmLabel ?? (single ? (count === 1 ? `Release ${single.name}` : `Release ${count} ${plural(single.name)}`) : `Release ${count} creatures`);
  const rare = groups.some((g) => g.sp.rarity === "rare" || g.sp.rarity === "legendary");

  return (
    <Modal title={count === 1 ? "Release this creature?" : `Release ${count} creatures?`} onClose={cancelRelease}>
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {groups.map((g) => {
            const r = RARITY_LABEL[g.sp.rarity];
            return (
              <li key={g.key} className="flex items-center gap-3 rounded-2xl bg-white/60 p-2">
                <div className="grid h-14 w-16 shrink-0 place-items-center rounded-xl bg-white/70">
                  <CreatureGlyph speciesId={g.sp.id} variantId={g.variantId} size={52} />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-black">
                    {g.name}
                    {g.uids.length > 1 && <span className="text-ink-soft"> ×{g.uids.length}</span>}
                  </div>
                  <div className="text-sm font-bold text-ink-soft">
                    <span aria-hidden>{r.icon}</span> {r.label}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <dl className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-white/70 px-2 py-2">
            <dt className="font-bold text-ink-soft">Space freed</dt>
            <dd className="font-black tabular-nums">+{t.space}</dd>
          </div>
          <div className="rounded-xl bg-white/70 px-2 py-2">
            <dt className="font-bold text-ink-soft">Income</dt>
            <dd className="font-black tabular-nums">−{fmtRate(t.income)}/s</dd>
          </div>
          <div className="rounded-xl bg-white/70 px-2 py-2">
            <dt className="font-bold text-ink-soft">Pearls back</dt>
            <dd className="font-black tabular-nums">+{fmt(t.refund)}</dd>
          </div>
        </dl>
        <p className="text-sm font-semibold text-ink-soft">
          {cap(what)} will swim off to explore. {count === 1 ? "It stays" : "They stay"} in your codex.
          {rare ? " Rare friends go to your Sanctuary and sometimes come back to visit." : ""}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={cancelRelease} className="min-h-12 rounded-xl bg-white/80 font-extrabold hover:bg-white">
            {count === 1 ? "Keep it" : "Keep them"}
          </button>
          <button type="button" onClick={confirmRelease} className="min-h-12 rounded-xl bg-ink px-2 font-extrabold text-white hover:brightness-125">
            {label}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Pick who to release so a visitor can move in or an egg can hatch.
 * Lowest rarity and income first. The visitor waits while this is open.
 */
export function MakeRoomPicker() {
  const target = useUI((s) => s.makeRoom);
  // A fresh picker (no leftover picks) every time it opens.
  return target ? <Picker key={JSON.stringify(target)} /> : null;
}

function Picker() {
  const target = useUI((s) => s.makeRoom);
  const visitor = useUI((s) => s.visitor);
  const habitats = useGame((s) => s.habitats);
  const [picked, setPicked] = useState<Record<string, number>>({});

  const info = useMemo(() => {
    if (!target) return null;
    if (target.kind === "visitor") {
      if (!visitor || visitor.state !== "asking") return null;
      return { biome: visitor.biome, speciesId: visitor.speciesId, variantId: visitor.variantId };
    }
    const egg = habitats[target.biome]?.eggs[target.index];
    return egg ? { biome: target.biome, speciesId: egg.speciesId, variantId: undefined } : null;
  }, [target, visitor, habitats]);

  const h = info ? habitats[info.biome] : undefined;
  const groups = useMemo(() => groupCreatures(h).sort((a, b) => releaseOrder(a.sp, b.sp)), [h]);
  if (!target || !info || !h) return null;

  const sp = SPECIES_BY_ID[info.speciesId];
  const name = (info.variantId && VARIANT_BY_ID[info.variantId]?.name) || sp.name;
  const needTotal = SIZE_SPACE[sp.size];
  const free = freeSpace(info.biome, h);
  const need = Math.max(0, needTotal - free);
  const freed = groups.reduce((a, g) => a + (picked[g.key] ?? 0) * SIZE_SPACE[g.sp.size], 0);
  const possible = groups.reduce((a, g) => a + g.uids.length * SIZE_SPACE[g.sp.size], 0);
  const enough = freed >= need;
  const isEgg = target.kind === "egg";
  const action = isEgg ? "Release & Hatch" : `Release & Welcome ${name}`;

  const close = () => useUI.getState().openMakeRoom(null);
  const go = () => {
    const uids = groups.flatMap((g) => g.uids.slice(0, picked[g.key] ?? 0));
    const t = target;
    close();
    const then = t.kind === "egg" ? () => hatchEgg(t.biome, t.index, t.at) : welcomeWaitingVisitor;
    if (!uids.length) then();
    // No Undo here: the freed space is used straight away.
    else requestRelease(info.biome, uids, { then, confirmLabel: action, undo: false });
  };

  return (
    <Modal title="Make room" onClose={close}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-2xl bg-sky-50/80 p-2.5">
          <div className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-white/80">
            <CreatureGlyph speciesId={sp.id} variantId={info.variantId} size={46} />
          </div>
          <div className="min-w-0 text-sm font-bold text-ink-soft">
            <div className="text-[15px] font-black text-ink">{isEgg ? `A ${sp.name.toLowerCase()} egg` : `The ${name.toLowerCase()}`}</div>
            {isEgg ? "It will wait as long as it takes." : "It's waiting patiently, no rush."}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm font-extrabold" aria-live="polite">
          <span>Space needed: {need}</span>
          <span className={enough ? "text-leaf" : "text-ink-soft"}>
            Freed: {freed}
            {enough ? " ✓" : ` / ${need}`}
          </span>
        </div>
        {possible < need && (
          <p className="text-sm font-semibold text-ink-soft">Even releasing everyone wouldn't be enough here. Expanding the habitat is the way to go.</p>
        )}
        <ul className="flex flex-col gap-2">
          {groups.map((g) => {
            const r = RARITY_LABEL[g.sp.rarity];
            const n = picked[g.key] ?? 0;
            return (
              <li key={g.key} className={`flex items-center gap-2 rounded-2xl p-2 ${n ? "bg-amber-50/90 ring-2 ring-sun/70" : "bg-white/60"}`}>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/70">
                  <CreatureGlyph speciesId={g.sp.id} variantId={g.variantId} size={42} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-black">
                    {g.name} <span className="text-ink-soft">×{g.uids.length}</span>
                  </div>
                  <div className="text-sm font-bold text-ink-soft">
                    <span aria-hidden>{r.icon}</span> {r.label} · frees {SIZE_SPACE[g.sp.size]} · {fmtRate(g.sp.pearlsPerSec)}/s
                  </div>
                </div>
                <Stepper
                  value={n}
                  max={g.uids.length}
                  label={`How many ${g.name} to release`}
                  onChange={(v) => setPicked((p) => ({ ...p, [g.key]: v }))}
                />
              </li>
            );
          })}
        </ul>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={close} className="min-h-12 rounded-xl bg-white/80 font-extrabold hover:bg-white">
            Back
          </button>
          <button
            type="button"
            onClick={go}
            disabled={!enough}
            className="min-h-12 rounded-xl bg-ink px-2 font-extrabold text-white enabled:hover:brightness-125 disabled:bg-black/8 disabled:text-ink-soft"
          >
            {enough ? action : `Pick ${need - freed} more space`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** "+X pearls" floating up by the pearl counter after a release. */
export function PearlFloaters() {
  const floaters = useUI((s) => s.floaters);
  return (
    <div className="pointer-events-none fixed top-[calc(64px+env(safe-area-inset-top))] left-6 z-40" aria-hidden>
      {floaters.map((f) => (
        <span key={f.id} className="animate-float-up absolute top-0 left-0 rounded-full bg-white/85 px-2 py-0.5 text-sm font-black whitespace-nowrap text-ink shadow-sm">
          {f.text}
        </span>
      ))}
    </div>
  );
}
