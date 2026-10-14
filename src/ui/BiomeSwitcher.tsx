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
  return (
    <Panel title="Habitats" subtitle="Swipe through your dioramas" onClose={close}>
      <div className="no-scrollbar -mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 md:mx-0 md:flex-col md:px-0">
        {BIOME_ORDER.map((b) => (
          <BiomeCard key={b} id={b} />
        ))}
      </div>
    </Panel>
  );
}

function BiomeCard({ id }: { id: BiomeId }) {
  const b = BIOMES[id];
  const active = useGame((s) => s.activeBiome === id);
  const unlocked = useGame((s) => s.biomesUnlocked.includes(id));
  const pearls = useGame((s) => s.pearls);
  const count = useGame((s) => s.habitats[id]?.creatures.length ?? 0);
  const codex = useGame((s) => s.codex);
  const prog = codexProgress(id, codex);

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
    <article
      className={`flex w-[78%] shrink-0 snap-center flex-col overflow-hidden rounded-2xl bg-white/60 md:w-full ${active ? "ring-3 ring-ink" : ""}`}
    >
      <div
        className="relative h-20"
        style={{ background: `linear-gradient(160deg, ${b.palette.bgTop}, ${b.palette.water} 55%, ${b.palette.deep})` }}
      >
        {!unlocked && (
          <div className="absolute inset-0 grid place-items-center bg-black/10 text-white">
            <LockIcon size={26} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="font-black">{b.name}</h3>
        <p className="text-sm font-semibold text-ink-soft">{b.tagline}</p>
        {unlocked && (
          <p className="text-sm font-bold text-ink-soft">
            {count} {count === 1 ? "resident" : "residents"} · codex {Math.round(prog.pct * 100)}%
          </p>
        )}
        <div className="mt-2">
          {!b.playable ? (
            <div className="rounded-xl bg-black/5 px-3 py-2.5 text-center text-sm font-extrabold text-ink-soft">
              Coming soon · {fmt(b.unlockCost)} pearls
            </div>
          ) : active ? (
            <div className="rounded-xl bg-ink/10 px-3 py-2.5 text-center text-sm font-extrabold">You're here</div>
          ) : unlocked ? (
            <button type="button" onClick={go} className="min-h-11 w-full rounded-xl bg-ink font-extrabold text-white hover:brightness-125">
              Visit
            </button>
          ) : (
            <PearlButton label="Unlock" cost={fmt(b.unlockCost)} canAfford={pearls >= b.unlockCost} onClick={unlock} className="w-full" />
          )}
        </div>
      </div>
    </article>
  );
}
