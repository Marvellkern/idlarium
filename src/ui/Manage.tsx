// Manage: every creature in the active habitat, grouped by species, with a
// release stepper per group (so a school of 30 sardines isn't 30 taps).
import { useState } from "react";
import { BIOMES } from "../data/biomes";
import { RARITY_LABEL, SIZE_SPACE } from "../data/creatures";
import { capacityOf, spaceUsed } from "../state/economy";
import { useGame } from "../state/gameStore";
import { requestRelease } from "../state/releaseLogic";
import { useUI } from "../state/uiStore";
import { fmtRate } from "../utils/format";
import { CreatureGlyph } from "./CreatureGlyph";
import { useHabitatStats } from "./hooks";
import { Panel } from "./Panel";
import { groupCreatures, Stepper, type CreatureGroup } from "./ReleaseUI";

export function Manage() {
  const biome = useGame((s) => s.activeBiome);
  const h = useGame((s) => s.habitats[s.activeBiome]);
  const stats = useHabitatStats(biome);
  const close = () => useUI.getState().setPanel(null);
  if (!h) return null;
  const groups = groupCreatures(h);
  const used = spaceUsed(h);
  const cap = capacityOf(biome, h);

  return (
    <Panel
      title="Your creatures"
      subtitle={
        <span className="tabular-nums">
          {BIOMES[biome].name} · {used}/{cap} space · +{fmtRate(stats?.income ?? 0)}/s
        </span>
      }
      onClose={close}
    >
      {groups.length === 0 ? (
        <p className="rounded-xl bg-white/50 px-3 py-3 text-center font-semibold text-ink-soft">Nobody lives here yet.</p>
      ) : (
        <>
          <p className="mb-2 text-sm font-semibold text-ink-soft">
            Released creatures swim off to explore. They stay in your codex, and you get a few pearls back.
          </p>
          <ul className="flex flex-col gap-2">
            {groups.map((g) => (
              <Row key={g.key} g={g} mood={stats?.happiness.value ?? 1} />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function Row({ g, mood }: { g: CreatureGroup; mood: number }) {
  const biome = useGame((s) => s.activeBiome);
  const [n, setN] = useState(1);
  const count = g.uids.length;
  const pick = Math.min(Math.max(1, n), count);
  const r = RARITY_LABEL[g.sp.rarity];
  const space = SIZE_SPACE[g.sp.size];
  return (
    <li className="rounded-2xl bg-white/60 p-2.5">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-16 shrink-0 place-items-center rounded-xl bg-white/70">
          <CreatureGlyph speciesId={g.sp.id} variantId={g.variantId} size={52} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-black">
            {g.name} <span className="text-ink-soft">×{count}</span>
          </div>
          <div className="text-sm font-bold text-ink-soft">
            <span aria-hidden>{r.icon}</span> {r.label} · {space} space each · {space * count} total
          </div>
          <div className="text-sm font-extrabold text-leaf">+{fmtRate(g.sp.pearlsPerSec * mood)}/s each</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        {count > 1 && <Stepper value={pick} min={1} max={count} label={`How many ${g.name} to release`} onChange={(v) => setN(Math.max(1, v))} />}
        <button
          type="button"
          onClick={() => {
            requestRelease(biome, g.uids.slice(0, pick));
            setN(1);
          }}
          className="min-h-11 rounded-xl bg-white/80 px-3.5 font-extrabold text-ink ring-1 ring-black/10 hover:bg-white"
        >
          Release{count > 1 ? ` ${pick}` : ""}
        </button>
      </div>
    </li>
  );
}
