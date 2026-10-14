import { useState } from "react";
import { ECONOMY } from "../state/economy";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { play } from "../utils/audio";
import { useHabitatStats } from "./hooks";
import { hatchEgg } from "../state/eggLogic";
import { SPECIES_BY_ID } from "../data/creatures";
import { EggIcon, FoodIcon } from "./icons";

export function moodWord(v: number) {
  if (v >= 1.3) return "Thriving";
  if (v >= 1.1) return "Happy";
  if (v >= 0.95) return "Content";
  if (v >= 0.75) return "Could use a snack";
  return "Sleepy and peckish";
}

/** Feed button + happiness meter, floating on the right edge. */
export function HabitatActions() {
  const biome = useGame((s) => s.activeBiome);
  const empty = useGame((s) => (s.habitats[s.activeBiome]?.creatures.length ?? 0) === 0);
  const stats = useHabitatStats(biome);
  const [floaters, setFloaters] = useState<number[]>([]);
  const panel = useUI((s) => s.panel);
  const eggs = useGame((s) => s.habitats[s.activeBiome]?.eggs);
  if (!stats || panel) return null;
  const v = stats.happiness.value;
  const { min, max } = ECONOMY.happiness;
  const pct = (v - min) / (max - min);

  const feed = () => {
    useGame.getState().feed(biome);
    useUI.getState().startFeeding(biome);
    play("plink");
    const id = Date.now();
    setFloaters((f) => [...f, id]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x !== id)), 1300);
  };

  const tip = `Happiness ${v.toFixed(2)}×: decorations +${stats.happiness.deco.toFixed(2)}${
    stats.happiness.fed ? `, recently fed +${stats.happiness.fed.toFixed(2)}` : ""
  }${stats.happiness.neglect > 0 ? `, hungry −${stats.happiness.neglect.toFixed(2)}` : ""}`;

  return (
    <div className="pointer-events-none fixed right-3 bottom-[calc(96px+env(safe-area-inset-bottom))] z-10 flex flex-col items-end gap-2 md:bottom-[110px]">
      {eggs && eggs.length > 0 && (
        <button
          type="button"
          onClick={() => hatchEgg(biome, 0)}
          title="Tap an egg cluster in the habitat, or here, to hatch it"
          aria-label={`Hatch an egg. ${eggs.length} waiting, first is a ${SPECIES_BY_ID[eggs[0].speciesId]?.name ?? "creature"} egg`}
          className="glass animate-shimmer pointer-events-auto flex min-h-[52px] items-center gap-2 py-1.5 pr-4 pl-2"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/70">
            <EggIcon size={20} />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[15px] font-extrabold">Hatch</span>
            <span className="block text-sm font-bold text-ink-soft">
              {eggs.length} {eggs.length === 1 ? "egg" : "eggs"} waiting
            </span>
          </span>
        </button>
      )}
      <div className="relative">
        {floaters.map((id) => (
          <span key={id} className="animate-float-up absolute -top-6 right-2 text-sm font-black text-ink">
            ♥ yum
          </span>
        ))}
        <button
          type="button"
          onClick={feed}
          disabled={empty}
          title={empty ? "Nobody to feed yet" : tip}
          aria-label={`Feed the habitat. Happiness ${v.toFixed(2)} times, ${moodWord(v)}`}
          className="glass pointer-events-auto flex min-h-[56px] items-center gap-2 py-2 pr-4 pl-2 disabled:opacity-60"
        >
          <span className="relative grid h-11 w-11 place-items-center rounded-full bg-white/70">
            <svg className="absolute inset-0" viewBox="0 0 44 44" aria-hidden>
              <circle cx="22" cy="22" r="19" fill="none" stroke="rgb(0 0 0 / 0.08)" strokeWidth="4" />
              <circle
                cx="22"
                cy="22"
                r="19"
                fill="none"
                stroke={pct > 0.45 ? "#5f9a4a" : "#e8a33a"}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(0.02, pct) * 119.4} 119.4`}
                transform="rotate(-90 22 22)"
              />
            </svg>
            <FoodIcon size={20} />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[15px] font-extrabold">Feed</span>
            <span className="block text-sm font-bold text-ink-soft tabular-nums">
              {v.toFixed(2)}× · {moodWord(v)}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
