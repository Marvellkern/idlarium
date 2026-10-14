import { BIOMES, type BiomeId } from "../data/biomes";
import { SPECIES_BY_ID } from "../data/creatures";
import { ECONOMY } from "../state/economy";
import { useUI } from "../state/uiStore";
import { play } from "../utils/audio";
import { fmt, fmtDuration } from "../utils/format";
import { useAnimatedNumber } from "./hooks";
import { PearlIcon } from "./icons";
import { Modal } from "./Panel";

const SHORT: Record<BiomeId, string> = { swamp: "swamp", reef: "reef", ocean: "ocean", deep: "deep sea", polar: "polar waters" };

export function AwaySummary() {
  const away = useUI((s) => s.away);
  const shown = useAnimatedNumber(away ? away.total : 0);
  if (!away) return null;
  const close = () => {
    play("plink");
    useUI.getState().setAway(null);
  };
  const capped = away.seconds >= ECONOMY.offlineCapHours * 3600 - 1;
  const passer = away.passedBy ? SPECIES_BY_ID[away.passedBy] : undefined;

  return (
    <Modal title="While you were away" onClose={close}>
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-semibold text-ink-soft">You were gone for {fmtDuration(away.seconds)}{capped ? " or more" : ""}.</p>
        <div className="flex items-center gap-2 text-4xl font-black tabular-nums">
          <PearlIcon size={40} /> +{fmt(shown)}
        </div>
        <ul className="space-y-1 font-semibold">
          {(Object.entries(away.perBiome) as [BiomeId, number][]).map(([b, v]) => (
            <li key={b}>
              Your {SHORT[b] ?? BIOMES[b].name} earned {fmt(v)} pearls.
            </li>
          ))}
        </ul>
        {away.eggsLaid > 0 && (
          <p className="font-bold">
            {away.eggsLaid === 1 ? "An egg was laid" : `${away.eggsLaid} eggs were laid`}. Tap them in the habitat to hatch.
          </p>
        )}
        {passer && (
          <p className="rounded-xl bg-white/70 px-3 py-2 font-bold">
            A {passer.name.toLowerCase()} passed by while you were away. It's in your codex now.
          </p>
        )}
        {capped && (
          <p className="text-sm font-semibold text-ink-soft">
            Pearls stop piling up after {ECONOMY.offlineCapHours} hours, so there's never a rush.
          </p>
        )}
        <button type="button" onClick={close} className="min-h-12 w-full rounded-xl bg-ink text-lg font-extrabold text-white hover:brightness-125">
          Collect
        </button>
      </div>
    </Modal>
  );
}
