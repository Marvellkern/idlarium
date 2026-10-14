import { BIOMES } from "../data/biomes";
import { canBreed, RARITY_LABEL, SIZE_SPACE, speciesForBiome, type Species } from "../data/creatures";
import { capacityOf, creatureCost, ECONOMY, inShop, ownedCount, spaceUsed } from "../state/economy";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { play } from "../utils/audio";
import { fmt, fmtRate } from "../utils/format";
import { CreatureGlyph } from "./CreatureGlyph";
import { ExpandCard } from "./ExpandCard";
import { moodWord } from "./HabitatActions";
import { useHabitatStats } from "./hooks";
import { Panel, PearlButton } from "./Panel";

export function Shop() {
  const tab = useUI((s) => s.shopTab);
  const setTab = useUI((s) => s.setShopTab);
  const biome = useGame((s) => s.activeBiome);
  const close = () => useUI.getState().setPanel(null);
  return (
    <Panel title="Shop" subtitle={BIOMES[biome].name} onClose={close}>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1" role="tablist">
        {(["creatures", "habitat"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 rounded-lg text-[15px] font-extrabold capitalize ${tab === t ? "bg-white shadow-sm" : "text-ink-soft"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "creatures" ? <CreatureList onNeedRoom={() => setTab("habitat")} /> : <HabitatTab />}
    </Panel>
  );
}

function CreatureList({ onNeedRoom }: { onNeedRoom: () => void }) {
  const biome = useGame((s) => s.activeBiome);
  const codex = useGame((s) => s.codex);
  const all = speciesForBiome(biome);
  const buyable = all.filter((s) => inShop(s, codex)).sort((a, b) => (a.baseCost ?? 0) - (b.baseCost ?? 0));
  const visitorsLeft = all.filter((s) => !inShop(s, codex) && codex[s.id] !== "owned").length;
  return (
    <div className="flex flex-col gap-2">
      {buyable.map((s) => (
        <CreatureCard key={s.id} sp={s} onNeedRoom={onNeedRoom} />
      ))}
      {visitorsLeft > 0 && (
        <p className="mt-1 rounded-xl bg-white/50 px-3 py-2.5 text-sm font-semibold text-ink-soft">
          {visitorsLeft} more {visitorsLeft === 1 ? "species only arrives" : "species only arrive"} as visitors. Keep an eye out, and
          decorations can help.
        </p>
      )}
    </div>
  );
}

function CreatureCard({ sp, onNeedRoom }: { sp: Species; onNeedRoom: () => void }) {
  const pearls = useGame((s) => s.pearls);
  const h = useGame((s) => s.habitats[sp.biome]);
  const owned = ownedCount(h, sp.id);
  const cost = creatureCost(sp, owned);
  const free = h ? capacityOf(sp.biome, h) - spaceUsed(h) : 0;
  const space = SIZE_SPACE[sp.size];
  const noRoom = free < space;
  const r = RARITY_LABEL[sp.rarity];

  const buy = () => {
    const res = useGame.getState().buyCreature(sp.id);
    if (res.ok) {
      play("pop");
      if (owned === 0) useUI.getState().toast(`Welcome, ${sp.name.toLowerCase()}.`);
    } else useUI.getState().toast(res.reason);
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/60 p-2.5">
      <div className="grid h-14 w-16 shrink-0 place-items-center rounded-xl bg-white/70">
        <CreatureGlyph speciesId={sp.id} size={54} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate font-black">{sp.name}</span>
          {owned > 0 && <span className="text-sm font-bold text-ink-soft">×{owned}</span>}
        </div>
        <div className="text-sm font-bold text-ink-soft">
          <span aria-hidden>{r.icon}</span> {r.label} · {sp.size} ({space} space)
          {sp.schoolSize ? ` · school of ${sp.schoolSize}` : ""}
        </div>
        <div className="text-sm font-extrabold text-leaf">+{fmtRate(sp.pearlsPerSec)} pearls/s</div>
        {owned === 1 && canBreed(sp) && <div className="text-sm font-semibold text-ink-soft">A second one might mean eggs.</div>}
      </div>
      {noRoom ? (
        <button type="button" onClick={onNeedRoom} className="min-h-11 shrink-0 rounded-xl bg-black/8 px-3 text-sm font-extrabold text-ink-soft">
          No room
        </button>
      ) : (
        <PearlButton cost={fmt(cost)} canAfford={pearls >= cost} onClick={buy} className="shrink-0" ariaLabel={`Buy ${sp.name} for ${fmt(cost)} pearls`} />
      )}
    </div>
  );
}

function HabitatTab() {
  const biome = useGame((s) => s.activeBiome);
  const h = useGame((s) => s.habitats[s.activeBiome]);
  const stats = useHabitatStats(biome);
  if (!h || !stats) return null;
  const cap = capacityOf(biome, h);
  const used = spaceUsed(h);
  const hp = stats.happiness;

  return (
    <div className="flex flex-col gap-3">
      <ExpandCard />
      <div className="rounded-2xl bg-white/60 p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-black">Space</h3>
          <span className="text-sm font-bold text-ink-soft tabular-nums">
            {used} / {cap}
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/8" role="progressbar" aria-valuenow={used} aria-valuemax={cap} aria-label="Space used">
          <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} />
        </div>
        <p className="mt-2 text-sm font-semibold text-ink-soft">Small creatures use 1 space, medium 2, large 5, and giants 15.</p>
      </div>

      <div className="rounded-2xl bg-white/60 p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-black">Happiness</h3>
          <span className="text-sm font-bold text-ink-soft tabular-nums">
            {hp.value.toFixed(2)}× · {moodWord(hp.value)}
          </span>
        </div>
        <ul className="mt-2 space-y-1 text-sm font-semibold text-ink-soft">
          <li>Base: 1.00×</li>
          <li>
            Decorations: +{hp.deco.toFixed(2)} (up to +{ECONOMY.happiness.decoMax.toFixed(2)}, each kind counts once)
          </li>
          <li>Recently fed: {hp.fed > 0 ? `+${hp.fed.toFixed(2)}` : "feed for a small boost"}</li>
          {hp.neglect > 0 && <li>Peckish: −{hp.neglect.toFixed(2)} (a quick feed fixes it)</li>}
        </ul>
        <p className="mt-2 text-sm font-semibold text-ink-soft">
          This habitat makes <b className="text-ink">{fmtRate(stats.income)}/s</b>.
        </p>
      </div>
    </div>
  );
}
