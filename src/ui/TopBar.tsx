import { BIOMES } from "../data/biomes";
import { capacityOf, spaceUsed } from "../state/economy";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { fmt, fmtRate } from "../utils/format";
import { useAnimatedNumber, useDaylight, useTotalIncome } from "./hooks";
import { GearIcon, PearlIcon, SpaceIcon } from "./icons";

export function TopBar() {
  const pearls = useGame((s) => s.pearls);
  const biome = useGame((s) => s.activeBiome);
  const h = useGame((s) => s.habitats[s.activeBiome]);
  const income = useTotalIncome();
  const shown = useAnimatedNumber(pearls);
  const togglePanel = useUI((s) => s.togglePanel);
  const used = spaceUsed(h);
  const cap = h ? capacityOf(biome, h) : 0;
  const { phase } = useDaylight();
  const sunlit = BIOMES[biome].sunlit;
  const phaseIcon = !sunlit ? "✧" : phase === "night" ? "☾" : phase === "day" ? "☀" : "◐";
  const phaseLabel = !sunlit ? "No sunlight reaches here" : phase === "night" ? "Night" : phase === "day" ? "Day" : phase === "dawn" ? "Dawn" : "Dusk";

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]">
      <div className="glass pointer-events-auto flex min-h-[52px] items-center gap-2 py-1.5 pr-4 pl-2.5" title="Pearls">
        <PearlIcon size={30} />
        <div className="leading-tight">
          <div className="text-xl font-black tabular-nums" aria-live="off">
            {fmt(shown)}
            <span className="sr-only"> pearls</span>
          </div>
          <div className="text-sm font-bold text-ink-soft tabular-nums">+{fmtRate(income)}/s</div>
        </div>
      </div>

      <div className="glass pointer-events-auto flex min-h-[52px] min-w-0 flex-col items-center justify-center px-3 py-1.5 text-center leading-tight">
        <div className="truncate text-[15px] font-extrabold">
          <span aria-hidden className="mr-1" title={phaseLabel}>
            {phaseIcon}
          </span>
          <span className="sr-only">{phaseLabel}. </span>
          {BIOMES[biome].name}
        </div>
        <button
          type="button"
          onClick={() => useUI.getState().openExpand()}
          className="flex min-h-6 items-center gap-1 rounded-md text-sm font-bold text-ink-soft hover:text-ink"
          title="Space used / capacity. Tap to expand the habitat"
          aria-label={`${used} of ${cap} space used, size ${h?.sizeLevel ?? 1} of 5. Open habitat expansion`}
        >
          <SpaceIcon size={14} />
          <span className="tabular-nums">
            {used}/{cap} · Lv{h?.sizeLevel ?? 1}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => togglePanel("settings")}
        className="glass pointer-events-auto grid h-[52px] w-[52px] shrink-0 place-items-center text-ink-soft hover:text-ink"
        aria-label="Settings"
        title="Settings"
      >
        <GearIcon size={24} />
      </button>
    </header>
  );
}
