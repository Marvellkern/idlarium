// Development builds only, with ?debug in the URL (never shipped to production).
// Handy for testing pacing, expansion and day/night without waiting.
import { SIZE_SPACE, speciesForBiome } from "../data/creatures";
import { useGame } from "../state/gameStore";
import { spawnVisitor } from "../state/visitorLogic";
import { freeSpace, nextExpansion } from "../state/economy";
import { uid } from "../utils/id";
import { expandHabitat } from "../state/expandLogic";
import { useUI } from "../state/uiStore";
import { getHourOverride, setHourOverride } from "../utils/time";
import { BIOME_ORDER, BIOMES } from "../data/biomes";
import { getTideOverride, setTideOverride } from "../data/signatures";
import { newHabitat } from "../state/economy";
import { useWeather } from "../state/weather";

const HOUR = 3600_000;

export default function DebugPanel() {
  useUI((s) => s.clockTick);
  const biome = useGame((s) => s.activeBiome);
  const level = useGame((s) => s.habitats[s.activeBiome]?.sizeLevel ?? 1);
  const g = () => useGame.getState();
  const visitors = speciesForBiome(biome).filter((s) => s.obtain === "visitor");
  const btn = "min-h-9 rounded-lg bg-white/80 px-2 text-xs font-extrabold hover:bg-white";
  return (
    <details open className="glass pointer-events-auto fixed top-[calc(76px+env(safe-area-inset-top))] left-3 z-40 max-w-[180px] p-2 text-xs">
      <summary className="cursor-pointer font-black">Debug</summary>
      <div className="mt-1 flex flex-col gap-1">
      <div className="flex items-center gap-1" role="group" aria-label="Set habitat size level">
        <span className="font-bold">Size</span>
        {[1, 2, 3, 4, 5].map((l) => (
          <button key={l} className={`${btn} min-w-6 px-1 ${l === level ? "bg-sun" : ""}`} onClick={() => g().debugSetSize(biome, l)}>
            {l}
          </button>
        ))}
      </div>
      <button
        className={btn}
        onClick={() => {
          const next = nextExpansion(biome, g().habitats[biome]);
          if (!next) return;
          g().debugAddPearls(next.cost);
          expandHabitat(biome);
        }}
      >
        Expand (free, animated)
      </button>
      <select
        className="min-h-9 rounded-lg bg-white/80 px-1 text-xs font-bold"
        value={getHourOverride() ?? ""}
        onChange={(e) => {
          setHourOverride(e.target.value === "" ? null : Number(e.target.value));
          useUI.getState().bumpClock();
        }}
        aria-label="Pretend time of day"
      >
        <option value="">Real clock</option>
        <option value="6">06:00 dawn</option>
        <option value="12">12:00 day</option>
        <option value="18">18:00 dusk</option>
        <option value="23">23:00 night</option>
      </select>
      <button
        className={btn}
        onClick={() => {
          // Unlock every built habitat (keeps what's already there).
          const s = g();
          const open = BIOME_ORDER.filter((b) => BIOMES[b].playable);
          const habitats = { ...s.habitats };
          for (const b of open) habitats[b] ??= newHabitat(Date.now());
          useGame.setState({ biomesUnlocked: open, habitats });
        }}
      >
        Unlock all habitats
      </button>
      {BIOMES[biome].signature === "tides" && (
        <select
          className="min-h-9 rounded-lg bg-white/80 px-1 text-xs font-bold"
          value={getTideOverride() ?? ""}
          onChange={(e) => {
            setTideOverride(e.target.value === "" ? null : Number(e.target.value));
            useUI.getState().bumpClock();
          }}
          aria-label="Pretend tide"
        >
          <option value="">Real tide</option>
          <option value="0">Low tide</option>
          <option value="0.5">Mid tide</option>
          <option value="1">High tide</option>
        </select>
      )}
      {BIOMES[biome].signature === "rain" && (
        <button className={btn} onClick={() => (useWeather.getState().rainUntil > Date.now() ? useWeather.getState().stopRain() : useWeather.getState().startRain(3))}>
          Toggle rain
        </button>
      )}
      <button className={btn} onClick={() => g().debugAddPearls(1000)}>+1K pearls</button>
      <button className={btn} onClick={() => g().debugAddPearls(100000)}>+100K pearls</button>
      <button className={btn} onClick={() => g().debugAddPearls(1e9)}>+1B pearls</button>
      <button className={btn} onClick={() => spawnVisitor()}>Spawn visitor</button>
      <button className={btn} onClick={() => spawnVisitor(Date.now(), undefined, true)}>
        Old friend visits
      </button>
      <button
        className={btn}
        onClick={() => {
          // Fill the free space with the cheapest shop creature.
          const s = g();
          const h = s.habitats[biome];
          const sp = speciesForBiome(biome).find((x) => x.obtain === "shop");
          if (!h || !sp) return;
          const n = Math.floor(freeSpace(biome, h) / SIZE_SPACE[sp.size]);
          const add = Array.from({ length: n }, () => ({ uid: uid(), speciesId: sp.id }));
          useGame.setState({ habitats: { ...s.habitats, [biome]: { ...h, creatures: [...h.creatures, ...add] } }, codex: { ...s.codex, [sp.id]: "owned" } });
        }}
      >
        Fill habitat
      </button>
      <select
        className="min-h-9 rounded-lg bg-white/80 px-1 text-xs font-bold"
        value=""
        onChange={(e) => e.target.value && spawnVisitor(Date.now(), e.target.value)}
        aria-label="Spawn specific visitor"
      >
        <option value="">Visitor…</option>
        {visitors.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button className={btn} onClick={() => g().debugShiftTime(2 * HOUR)}>Away 2h</button>
      <button className={btn} onClick={() => g().debugShiftTime(10 * HOUR)}>Away 10h (cap)</button>
      <button className={btn} onClick={() => g().debugShiftFed(20 * HOUR)}>Unfed 20h</button>
      <button
        className={btn}
        onClick={() => {
          const c = g().habitats[biome]?.creatures[0];
          if (c) g().debugLayEgg(c.speciesId);
        }}
      >
        Lay egg
      </button>
      </div>
    </details>
  );
}
