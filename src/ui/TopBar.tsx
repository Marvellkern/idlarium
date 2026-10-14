import { BIOMES } from "../data/biomes";
import { capacityOf, spaceUsed } from "../state/economy";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { fmt, fmtRate } from "../utils/format";
import { isHighTide, tidePhase } from "../data/signatures";
import { useWeather } from "../state/weather";
import { useAnimatedNumber, useDaylight, useNow, useTotalIncome } from "./hooks";
import { GearIcon, GlassIcon, PearlIcon, SpaceIcon } from "./icons";
import { algaeLevel, isSparkling } from "../state/economy";
import { EQUIPMENT, equipmentName } from "../data/equipment";

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
        <SignatureStatus />
        <TankStatus />
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

/** Tidepool tide and Amazon rain, as a small line under the habitat name. */
function SignatureStatus() {
  const sig = useGame((s) => BIOMES[s.activeBiome].signature);
  const rainUntil = useWeather((s) => s.rainUntil);
  useUI((s) => s.clockTick);
  const now = useNow(sig === "tides" ? 20_000 : 5_000);
  if (sig === "tides") {
    const high = isHighTide(now);
    // Rising if the tide is higher a few minutes from now.
    const rising = tidePhase(now + 10 * 60_000) > tidePhase(now);
    return (
      <div className="text-xs font-extrabold text-ink-soft" title="The tide follows a real 12.4-hour cycle. High tide brings visitors a little sooner.">
        <span aria-hidden>≋ </span>
        {high ? "High tide" : "Low tide"}
        <span className="font-bold"> · {rising ? "rising" : "falling"}</span>
      </div>
    );
  }
  if (sig === "rain" && now < rainUntil)
    return (
      <div className="text-xs font-extrabold text-ink-soft" title="A light shower. Eggs are a little more likely while it rains.">
        <span aria-hidden>☂ </span>Rain shower
      </div>
    );
  return null;
}

/** Glass algae, the Sparkling countdown and which automations are running. */
function TankStatus() {
  const biome = useGame((s) => s.activeBiome);
  const h = useGame((s) => s.habitats[s.activeBiome]);
  const now = useNow(15_000);
  if (!h) return null;
  const level = algaeLevel(h, now);
  const sparkle = isSparkling(h, now);
  const gear = EQUIPMENT.filter((e) => h.equipment[e.slot]).map((e) => equipmentName(biome, e.slot));
  if (level < 0.05 && !sparkle && !gear.length) return null;
  const mins = sparkle ? Math.ceil(((h.sparklingUntil ?? 0) - now) / 60_000) : 0;
  return (
    <div className="flex items-center justify-center gap-2 text-xs font-extrabold text-ink-soft">
      <span className="flex items-center gap-0.5" title={`Glass ${Math.round(level * 100)}% cloudy`}>
        <GlassIcon size={13} level={level} />
        <span className="tabular-nums">{Math.round(level * 100)}%</span>
      </span>
      {sparkle && (
        <span className="text-amber-600 tabular-nums" title="Sparkling: +15% pearls in this habitat">
          ✦ {mins}m
        </span>
      )}
      {gear.length > 0 && (
        <span title={gear.join(", ")} aria-label={`Running: ${gear.join(", ")}`}>
          ⚙ {gear.length}
        </span>
      )}
    </div>
  );
}
