import { useEffect, useRef } from "react";
import { BIOMES } from "../data/biomes";
import { slotLayout } from "../data/habitatGeometry";
import { SPECIES_BY_ID } from "../data/creatures";
import { DECORATION_BY_ID, decorationsForBiome, type Decoration } from "../data/decorations";
import { decoHappiness } from "../state/economy";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { play } from "../utils/audio";
import { fmt } from "../utils/format";
import { RotateIcon, TrashIcon } from "./icons";
import { Panel, PearlButton } from "./Panel";

export function effectText(d: Decoration, codex: Record<string, string>) {
  const parts = [`+${d.happiness.toFixed(2)} happiness`];
  for (const [sid, mult] of Object.entries(d.visitorBoost ?? {})) {
    const known = codex[sid];
    const name = known ? SPECIES_BY_ID[sid]?.name : "a mystery visitor";
    parts.push(`${name} visits ${mult >= 2 ? "much " : ""}more often`);
  }
  return parts.join(" · ");
}

export function DecorateMode() {
  const biome = useGame((s) => s.activeBiome);
  const h = useGame((s) => s.habitats[s.activeBiome]);
  const codex = useGame((s) => s.codex);
  const pearls = useGame((s) => s.pearls);
  const slotKey = useUI((s) => s.decoSlot);
  const setSlot = useUI((s) => s.setDecoSlot);
  const close = () => useUI.getState().setPanel(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll only the panel body (scrollIntoView would also nudge the fixed page root).
    const el = optionsRef.current;
    const box = el?.closest<HTMLElement>(".overflow-y-auto");
    if (slotKey !== null && el && box) box.scrollTo({ top: el.offsetTop - box.offsetTop - 8, behavior: "smooth" });
  }, [slotKey]);
  if (!h) return null;

  const slots = slotLayout(biome, h.sizeLevel);
  const slot = slotKey !== null ? (slots.find((x) => x.key === slotKey) ?? null) : null;
  const placed = slot ? h.decorations.find((d) => d.slot === slot.key) : undefined;
  const placedDeco = placed ? DECORATION_BY_ID[placed.decoId] : undefined;
  const options = slot ? decorationsForBiome(biome).filter((d) => d.placement === slot.kind) : [];
  const kindsPlaced = new Set(h.decorations.map((d) => d.decoId));

  const place = (d: Decoration) => {
    if (!slot) return;
    const r = useGame.getState().placeDecoration(biome, slot.key, d.id);
    if (r.ok) {
      play("pop");
    } else useUI.getState().toast(r.reason);
  };

  return (
    <Panel
      title="Decorate"
      subtitle={`${BIOMES[biome].name} · decorations +${decoHappiness(h).toFixed(2)} happiness`}
      onClose={close}
      compact
      footer={
        <button type="button" onClick={close} className="min-h-11 w-full rounded-xl bg-ink font-extrabold text-white hover:brightness-125">
          Done
        </button>
      }
    >
      <p className="mb-2 text-sm font-semibold text-ink-soft">Tap a ring in the habitat, or pick a spot here.</p>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Decoration spots">
        {slots.map((s, i) => {
          const d = h.decorations.find((x) => x.slot === s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSlot(s.key)}
              aria-pressed={slotKey === s.key}
              title={d ? DECORATION_BY_ID[d.decoId]?.name : s.kind === "surface" ? "Empty surface spot" : "Empty floor spot"}
              className={`min-h-11 min-w-11 rounded-xl px-2 text-sm font-extrabold ${
                slotKey === s.key ? "bg-sun text-ink" : d ? "bg-white text-ink" : "bg-white/50 text-ink-soft"
              }`}
            >
              {s.kind === "surface" ? "≈" : ""}
              {i + 1}
            </button>
          );
        })}
      </div>

      {!slot && <p className="rounded-xl bg-white/50 px-3 py-3 text-sm font-semibold text-ink-soft">≈ marks spots on the water surface.</p>}

      <div ref={optionsRef} className="scroll-mt-2" />
      {slot && placed && placedDeco && (
        <div className="mb-3 rounded-2xl bg-white/70 p-3">
          <div className="font-black">{placedDeco.name}</div>
          <div className="text-sm font-semibold text-ink-soft">{effectText(placedDeco, codex)}</div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                useGame.getState().rotateDecoration(biome, slot.key);
                play("tap");
              }}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white font-extrabold hover:bg-white/80"
            >
              <RotateIcon size={18} /> Rotate
            </button>
            <button
              type="button"
              onClick={() => {
                useGame.getState().removeDecoration(biome, slot.key);
                play("tap");
              }}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white font-extrabold hover:bg-white/80"
              title="Removing gives back the full price"
            >
              <TrashIcon size={18} /> Remove (+{fmt(placedDeco.cost)})
            </button>
          </div>
        </div>
      )}

      {slot && (
        <>
          <h3 className="mb-2 font-black">{placed ? "Swap for" : slot.kind === "surface" ? "Surface decorations" : "Floor decorations"}</h3>
          <div className="flex flex-col gap-2">
            {options.map((d) => {
              const refund = placedDeco ? placedDeco.cost : 0;
              const isCurrent = placed?.decoId === d.id;
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-2xl bg-white/60 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-black">{d.name}</div>
                    <div className="text-sm font-semibold text-ink-soft">{d.blurb}</div>
                    <div className="text-sm font-extrabold text-leaf">{effectText(d, codex)}</div>
                    {kindsPlaced.has(d.id) && !isCurrent && (
                      <div className="text-sm font-semibold text-ink-soft">Already placed. Extra copies are just for looks.</div>
                    )}
                  </div>
                  <PearlButton
                    cost={isCurrent ? undefined : fmt(d.cost)}
                    label={isCurrent ? "Placed" : undefined}
                    disabled={isCurrent}
                    canAfford={pearls + refund >= d.cost}
                    onClick={() => place(d)}
                    className="shrink-0"
                    ariaLabel={isCurrent ? `${d.name} is placed here` : `Place ${d.name} for ${fmt(d.cost)} pearls`}
                  />
                </div>
              );
            })}
            {options.length === 0 && <p className="text-sm font-semibold text-ink-soft">Nothing fits this spot yet.</p>}
          </div>
        </>
      )}
    </Panel>
  );
}
