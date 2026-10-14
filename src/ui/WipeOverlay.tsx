// Wipe mode banner (with a "Clean all" button for players who can't drag), and the
// one-time tip the first time a tank gets cloudy.
import { useEffect, useState } from "react";
import { TANK } from "../data/equipment";
import { algaeLevel } from "../state/economy";
import { useGame } from "../state/gameStore";
import { finishWipe, toggleWipe } from "../state/tankLogic";
import { useUI } from "../state/uiStore";
import { useNow } from "./hooks";
import { SpongeIcon } from "./icons";

export function WipeOverlay() {
  const since = useUI((s) => s.wipingSince);
  return since !== null ? <WipeBanner since={since} /> : <AlgaeTip />;
}

function WipeBanner({ since }: { since: number }) {
  const biome = useGame((s) => s.activeBiome);
  const [canCleanAll, setCanCleanAll] = useState(false);
  useEffect(() => {
    const left = TANK.cleanAllAfter * 1000 - (performance.now() - since);
    const t = setTimeout(() => setCanCleanAll(true), Math.max(0, left));
    return () => clearTimeout(t);
  }, [since]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(76px+env(safe-area-inset-top))] z-30 flex justify-center px-3">
      <div className="glass-strong animate-pop-in pointer-events-auto flex max-w-sm items-center gap-2 py-1.5 pr-1.5 pl-3" role="status">
        <SpongeIcon size={20} className="shrink-0" />
        <div className="min-w-0 text-sm leading-tight font-bold">
          <div className="text-[15px] font-extrabold">Wipe the glass</div>
          <div className="text-ink-soft">Drag across the tank. The camera holds still.</div>
        </div>
        {canCleanAll && (
          <button type="button" onClick={() => finishWipe(biome)} className="min-h-11 shrink-0 rounded-xl bg-ink px-3 text-sm font-extrabold text-white hover:brightness-125">
            Clean all
          </button>
        )}
        <button type="button" onClick={toggleWipe} className="min-h-11 shrink-0 rounded-xl bg-white/80 px-3 text-sm font-extrabold ring-1 ring-black/10 hover:bg-white">
          Done
        </button>
      </div>
    </div>
  );
}

/** Shown once, the first time the tank you're looking at reaches 50% algae. */
function AlgaeTip() {
  const shown = useGame((s) => s.milestones.algaeTip);
  const h = useGame((s) => s.habitats[s.activeBiome]);
  const panel = useUI((s) => s.panel);
  const away = useUI((s) => s.away);
  const tutorial = useGame((s) => s.tutorial);
  const now = useNow(5000);
  if (shown || !h || panel || away || tutorial >= 0 || algaeLevel(h, now) < TANK.sparkleFrom) return null;
  const dismiss = () => useGame.getState().setMilestone("algaeTip", true);
  return (
    <div className="pointer-events-none fixed right-3 bottom-[calc(250px+env(safe-area-inset-bottom))] z-30 flex max-w-[260px] md:bottom-[260px]">
      <div className="glass-strong animate-pop-in pointer-events-auto relative p-3 text-sm font-semibold" role="dialog" aria-label="Tip">
        <p>
          <b>The glass is getting cloudy.</b> Tap the sponge below and drag across the tank to wipe it. Cleaning it now makes the tank Sparkling: +
          {Math.round(TANK.sparkleIncome * 100)}% pearls for an hour.
        </p>
        <button type="button" onClick={dismiss} className="mt-2 min-h-11 w-full rounded-xl bg-ink font-extrabold text-white hover:brightness-125">
          Got it
        </button>
        <span aria-hidden className="absolute -bottom-2 right-10 h-4 w-4 rotate-45 bg-white/90" />
      </div>
    </div>
  );
}
