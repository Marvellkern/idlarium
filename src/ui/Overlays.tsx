// Small floating bits: toasts, the selected-creature chip, and the empty-habitat prompt.
import { BIOMES } from "../data/biomes";
import { RARITY_LABEL, SPECIES_BY_ID, VARIANT_BY_ID } from "../data/creatures";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { fmtRate } from "../utils/format";
import { CloseIcon } from "./icons";

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(76px+env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-3"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div key={t.id} className="glass-strong animate-pop-in max-w-sm px-4 py-2.5 text-center text-[15px] font-bold">
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function SelectedInfo() {
  const uid = useUI((s) => s.selectedUid);
  const biome = useGame((s) => s.activeBiome);
  const c = useGame((s) => s.habitats[s.activeBiome]?.creatures.find((x) => x.uid === uid));
  const panel = useUI((s) => s.panel);
  if (!uid || !c || panel) return null;
  const sp = SPECIES_BY_ID[c.speciesId];
  if (!sp) return null;
  const r = RARITY_LABEL[sp.rarity];
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(170px+env(safe-area-inset-bottom))] z-10 flex justify-center px-3 md:bottom-[110px]">
      <div className="glass-strong animate-pop-in pointer-events-auto flex max-w-sm items-center gap-3 py-2 pr-2 pl-4">
        <div className="min-w-0">
          <div className="truncate font-black">{(c.variantId && VARIANT_BY_ID[c.variantId]?.name) || sp.name}</div>
          <div className="text-sm font-bold text-ink-soft">
            <span aria-hidden>{r.icon}</span> {r.label} · +{fmtRate(sp.pearlsPerSec)}/s · {BIOMES[biome].name}
          </div>
        </div>
        <button
          type="button"
          onClick={() => useUI.getState().openCodex(sp.biome, c.variantId ?? sp.id)}
          className="min-h-11 rounded-xl bg-white/80 px-3 text-sm font-extrabold hover:bg-white"
        >
          Codex
        </button>
        <button
          type="button"
          aria-label="Stop following"
          onClick={() => useUI.getState().select(null)}
          className="grid h-11 w-11 place-items-center rounded-xl text-ink-soft hover:bg-black/5"
        >
          <CloseIcon size={18} />
        </button>
      </div>
    </div>
  );
}

export function EmptyState() {
  const biome = useGame((s) => s.activeBiome);
  const empty = useGame((s) => (s.habitats[s.activeBiome]?.creatures.length ?? 0) === 0);
  const panel = useUI((s) => s.panel);
  const visitor = useUI((s) => s.visitor);
  const tutorial = useGame((s) => s.tutorial);
  // The first tips already point at the shop.
  if (!empty || panel || visitor || tutorial === 0 || tutorial === 1) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[38%] z-10 flex justify-center px-6">
      <div className="glass animate-pop-in pointer-events-auto max-w-xs px-5 py-4 text-center">
        <p className="text-[16px] font-extrabold">{BIOMES[biome].emptyPrompt}</p>
        <button
          type="button"
          onClick={() => useUI.getState().setPanel("shop")}
          className="mt-3 min-h-11 rounded-xl bg-ink px-4 font-extrabold text-white hover:brightness-125"
        >
          Open the shop
        </button>
      </div>
    </div>
  );
}
