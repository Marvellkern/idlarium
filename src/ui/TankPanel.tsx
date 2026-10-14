// Tank: the lamp switch, functional equipment, and the cosmetic style picks (lamp,
// background, frame). Picking a style item previews it on the tank before buying.
import { BACKGROUNDS, EQUIPMENT, equipmentName, equipmentPrice, FRAMES, LAMPS, styleItem, stylePrice, type StyleKind } from "../data/equipment";
import { BIOMES } from "../data/biomes";
import { algaeLevel } from "../state/economy";
import { useGame } from "../state/gameStore";
import { buyEquipment, chooseStyle, toggleLamp } from "../state/tankLogic";
import { useUI } from "../state/uiStore";
import { fmt } from "../utils/format";
import { daylight } from "../utils/time";
import { useNow } from "./hooks";
import { BulbIcon } from "./icons";
import { Panel, PearlButton } from "./Panel";

const LISTS: { kind: StyleKind; title: string; items: { id: string; name: string }[] }[] = [
  { kind: "lamp", title: "Lamp", items: LAMPS },
  { kind: "background", title: "Background", items: BACKGROUNDS },
  { kind: "frame", title: "Frame", items: FRAMES },
];

/** A little color chip so the choices are easy to tell apart. */
const SWATCH: Record<string, string> = {
  ...Object.fromEntries(LAMPS.map((l) => [`lamp:${l.id}`, l.cycle ? "conic-gradient(#ff5a7a,#ffd23a,#5ad27a,#4aa8ff,#b07aff,#ff5a7a)" : l.color])),
  ...Object.fromEntries(FRAMES.map((f) => [`frame:${f.id}`, f.frameless ? "linear-gradient(135deg,#ffffff 45%,#cfe6f2 55%)" : f.color])),
  "background:none": "linear-gradient(135deg,#ffffff 45%,#cfe6f2 55%)",
  "background:black": "#111418",
  "background:blue": "linear-gradient(#9adcff,#0b2f55)",
  "background:cliff": "linear-gradient(#9fc4d2 30%,#6a7880 30%)",
  "background:jungle": "radial-gradient(circle at 30% 60%,#7ab85a 20%,#2a5a2a 60%)",
  "background:coral": "radial-gradient(circle at 40% 70%,#ff7b6b 18%,#ffb04a 30%,#2f9aa8 55%)",
  "background:ruins": "linear-gradient(90deg,#3f8a96 20%,#cfc2a2 20% 32%,#3f8a96 32% 60%,#cfc2a2 60% 72%,#3f8a96 72%)",
  "background:stars": "radial-gradient(circle at 70% 30%,#fff6d8 8%,#1c2a50 12%)",
  "background:driftwood": "linear-gradient(135deg,#a8ccc4 40%,#6e5232 40% 50%,#a8ccc4 50%)",
  "background:abyss": "radial-gradient(circle at 60% 40%,#3df5d0 6%,#020610 14%)",
};

export function TankPanel() {
  const biome = useGame((s) => s.activeBiome);
  const h = useGame((s) => s.habitats[s.activeBiome]);
  const pearls = useGame((s) => s.pearls);
  const preview = useUI((s) => s.stylePreview);
  const now = useNow(5000);
  const close = () => useUI.getState().setPanel(null);
  if (!h) return null;
  const lampOn = h.style.lampAuto ? daylight() > 0.5 : h.style.lampOn;
  const algae = Math.round(algaeLevel(h, now) * 100);

  const owned = (kind: StyleKind, id: string) => styleItem(kind, id)?.tier === "free" || h.ownedStyle.includes(`${kind}:${id}`);
  const current = (kind: StyleKind) => (kind === "lamp" ? h.style.lampId : kind === "background" ? h.style.backgroundId : h.style.frameId);
  const pick = (kind: StyleKind, id: string) => {
    if (owned(kind, id)) {
      chooseStyle(biome, kind, id);
      return;
    }
    // Not owned yet: show it on the tank first.
    useUI.getState().previewStyle(preview?.kind === kind && preview.id === id ? null : { kind, id });
  };

  return (
    <Panel title="Tank" subtitle={`${BIOMES[biome].name} · glass ${algae}% cloudy`} onClose={close} compact>
      <div className="flex flex-col gap-3">
        {/* Lamp switch + schedule */}
        <div className="flex items-center gap-2 rounded-2xl bg-white/60 p-2.5">
          <BulbIcon size={22} className={lampOn ? "text-amber-500" : "text-ink-soft"} />
          <div className="min-w-0 flex-1 text-sm font-bold text-ink-soft">
            <div className="text-[15px] font-black text-ink">Lamp {lampOn ? "on" : "off"}</div>
            {h.style.lampAuto ? "On by day, off at night" : "Tap the lamp on the tank too"}
          </div>
          <button
            type="button"
            onClick={() => toggleLamp(biome, !lampOn)}
            className="min-h-11 rounded-xl bg-white/80 px-3 text-sm font-extrabold ring-1 ring-black/10 hover:bg-white"
            aria-pressed={lampOn}
          >
            {lampOn ? "Turn off" : "Turn on"}
          </button>
          <label className="flex min-h-11 items-center gap-1.5 px-1 text-sm font-extrabold">
            <input
              type="checkbox"
              checked={h.style.lampAuto}
              onChange={(e) => useGame.getState().setLamp(biome, { auto: e.target.checked })}
              className="h-5 w-5 accent-[#1f2a24]"
            />
            Auto
          </label>
        </div>

        {/* Functional equipment */}
        <section>
          <h3 className="mb-1.5 font-black">Equipment</h3>
          <ul className="flex flex-col gap-2">
            {EQUIPMENT.map((e) => {
              const has = h.equipment[e.slot];
              const cost = equipmentPrice(biome, e.slot);
              return (
                <li key={e.slot} className="flex items-center gap-3 rounded-2xl bg-white/60 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-black">{equipmentName(biome, e.slot)}</div>
                    <div className="text-sm font-bold text-leaf">{e.effect}</div>
                  </div>
                  {has ? (
                    <span className="rounded-xl bg-leaf/15 px-3 py-2 text-sm font-extrabold text-leaf">Installed ✓</span>
                  ) : (
                    <PearlButton
                      cost={fmt(cost)}
                      canAfford={pearls >= cost}
                      onClick={() => buyEquipment(biome, e.slot)}
                      ariaLabel={`Buy ${equipmentName(biome, e.slot)} for ${fmt(cost)} pearls`}
                      className="shrink-0"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Style */}
        {LISTS.map(({ kind, title, items }) => {
          const previewing = preview?.kind === kind ? preview.id : null;
          const shown = previewing ?? current(kind);
          const item = styleItem(kind, shown);
          const cost = stylePrice(biome, kind, shown);
          return (
            <section key={kind}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <h3 className="font-black">{title}</h3>
                <span className="truncate text-sm font-bold text-ink-soft">{item?.name}</span>
              </div>
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label={title}>
                {items.map((it) => {
                  const isOwned = owned(kind, it.id);
                  const active = it.id === shown;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      role="option"
                      aria-selected={it.id === current(kind)}
                      onClick={() => pick(kind, it.id)}
                      title={it.name}
                      className={`flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-xl p-1.5 text-center ${active ? "bg-white ring-2 ring-ink" : "bg-white/60 hover:bg-white/80"}`}
                    >
                      <span className="h-9 w-12 rounded-lg ring-1 ring-black/10" style={{ background: SWATCH[`${kind}:${it.id}`] ?? "#ddd" }} aria-hidden />
                      <span className="line-clamp-2 text-[11px] leading-tight font-extrabold">{it.name}</span>
                      <span className="text-[11px] font-bold text-ink-soft">{it.id === current(kind) ? "On tank" : isOwned ? "Owned" : fmt(stylePrice(biome, kind, it.id))}</span>
                    </button>
                  );
                })}
              </div>
              {previewing && item && (
                <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-sky-50/90 p-2">
                  <p className="min-w-0 flex-1 text-sm font-semibold text-ink-soft">
                    <b className="text-ink">Previewing.</b> {item.blurb}
                  </p>
                  <PearlButton label="Buy" cost={fmt(cost)} canAfford={pearls >= cost} onClick={() => chooseStyle(biome, kind, shown)} ariaLabel={`Buy ${item.name} for ${fmt(cost)} pearls`} />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}
