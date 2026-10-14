// Habitat switcher: one compact row per habitat in unlock order, so all eight fit
// on a phone without endless swiping. Locked ones show a silhouette and price;
// only habitats that are built and unlockable get an Unlock button.
import { BIOME_ORDER, BIOMES, type BiomeId } from "../data/biomes";
import { codexProgress } from "../state/economy";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { play } from "../utils/audio";
import { fmt } from "../utils/format";
import { LockIcon } from "./icons";
import { Panel, PearlButton } from "./Panel";

export function BiomeSwitcher() {
  const close = () => useUI.getState().setPanel(null);
  const unlocked = useGame((s) => s.biomesUnlocked.length);
  return (
    <Panel title="Habitats" subtitle={`${unlocked} of ${BIOME_ORDER.filter((b) => BIOMES[b].playable).length} open`} onClose={close}>
      <ol className="flex flex-col gap-2">
        {BIOME_ORDER.map((b, i) => (
          <BiomeRow key={b} id={b} step={i + 1} />
        ))}
      </ol>
    </Panel>
  );
}

function BiomeRow({ id, step }: { id: BiomeId; step: number }) {
  const b = BIOMES[id];
  const active = useGame((s) => s.activeBiome === id);
  const unlocked = useGame((s) => s.biomesUnlocked.includes(id));
  const pearls = useGame((s) => s.pearls);
  const count = useGame((s) => s.habitats[id]?.creatures.length ?? 0);
  const codex = useGame((s) => s.codex);
  const pct = Math.round(codexProgress(id, codex).pct * 100);

  const go = () => {
    useGame.getState().setActiveBiome(id);
    useUI.getState().setPanel(null);
    play("tap");
  };
  const unlock = () => {
    const r = useGame.getState().unlockBiome(id);
    if (r.ok) {
      play("chime");
      useUI.getState().setPanel(null);
      useUI.getState().toast(`${b.name} is open. Welcome to the ${b.tagline.toLowerCase()}.`);
    } else useUI.getState().toast(r.reason);
  };

  return (
    <li className={`flex items-center gap-3 rounded-2xl bg-white/60 p-2 ${active ? "ring-3 ring-ink" : ""}`}>
      <div
        className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl"
        style={{ background: `linear-gradient(160deg, ${b.palette.bgTop}, ${b.palette.water} 55%, ${b.palette.deep})` }}
        aria-hidden
      >
        {!unlocked && (
          <div className="absolute inset-0 grid place-items-center bg-black/25 text-white">
            <LockIcon size={20} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <h3 className="truncate font-black">{b.name}</h3>
        </div>
        <p className="truncate text-sm font-semibold text-ink-soft">
          {unlocked ? (
            <>
              {count} {count === 1 ? "resident" : "residents"} · codex {pct}%
            </>
          ) : (
            <>
              {step}. {b.group} · {b.tagline}
            </>
          )}
        </p>
      </div>
      <div className="shrink-0">
        {active ? (
          <span className="block rounded-xl bg-ink/10 px-3 py-2.5 text-sm font-extrabold">Here</span>
        ) : unlocked ? (
          <button type="button" onClick={go} className="min-h-11 rounded-xl bg-ink px-4 font-extrabold text-white hover:brightness-125">
            Visit
          </button>
        ) : !b.playable ? (
          <span className="block rounded-xl bg-black/5 px-2.5 py-2 text-center text-xs leading-tight font-extrabold text-ink-soft">
            Soon
          </span>
        ) : (
          <PearlButton cost={fmt(b.unlockCost)} canAfford={pearls >= b.unlockCost} onClick={unlock} ariaLabel={`Unlock ${b.name} for ${fmt(b.unlockCost)} pearls`} />
        )}
      </div>
    </li>
  );
}
