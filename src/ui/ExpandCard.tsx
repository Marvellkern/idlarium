// The Expand card: level now → next, space before → after, new decoration spots,
// the free terrain feature and the price. While it's open, the scene shows a
// ghost outline of the bigger habitat and the camera eases out to fit it.
import { useEffect } from "react";
import { SIZE_LEVELS } from "../data/expansion";
import { capacityOf, nextExpansion } from "../state/economy";
import { expandHabitat } from "../state/expandLogic";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { fmt } from "../utils/format";
import { PearlButton } from "./Panel";

function LevelDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: SIZE_LEVELS }, (_, i) => (
        <span key={i} className={`h-2.5 w-6 rounded-full ${i < level ? "bg-leaf" : "bg-black/10"}`} />
      ))}
    </div>
  );
}

export function ExpandCard() {
  const biome = useGame((s) => s.activeBiome);
  const h = useGame((s) => s.habitats[s.activeBiome]);
  const pearls = useGame((s) => s.pearls);
  const growing = useUI((s) => !!s.expansion);

  // Show the ghost outline only while this card is on screen (and not mid-growth).
  useEffect(() => {
    useUI.getState().setExpandPreview(!growing);
  }, [growing]);
  useEffect(() => () => useUI.getState().setExpandPreview(false), []);

  if (!h) return null;
  const next = nextExpansion(biome, h);

  if (!next) {
    return (
      <div className="rounded-2xl bg-white/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black">Habitat size</h3>
          <span className="rounded-full bg-sun px-3 py-1 text-sm font-black text-ink">★ Fully expanded</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <LevelDots level={h.sizeLevel} />
          <span className="text-sm font-bold text-ink-soft tabular-nums">{capacityOf(biome, h)} space</span>
        </div>
      </div>
    );
  }

  const short = Math.max(0, next.cost - pearls);
  return (
    <div className="rounded-2xl bg-white/70 p-3 ring-2 ring-sky-200/70">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-black">Expand the habitat</h3>
        <span className="text-sm font-bold text-ink-soft tabular-nums">
          Size {next.from} → {next.to} of {SIZE_LEVELS}
        </span>
      </div>
      <div className="mt-2">
        <LevelDots level={next.from} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-white/70 px-2.5 py-2">
          <dt className="font-bold text-ink-soft">Space</dt>
          <dd className="font-black tabular-nums">
            {next.spaceBefore} → {next.spaceAfter} <span className="text-leaf">(+{next.spaceAfter - next.spaceBefore})</span>
          </dd>
        </div>
        <div className="rounded-xl bg-white/70 px-2.5 py-2">
          <dt className="font-bold text-ink-soft">Decoration spots</dt>
          <dd className="font-black tabular-nums">+{next.newSlots}</dd>
        </div>
        {next.feature && (
          <div className="col-span-2 rounded-xl bg-white/70 px-2.5 py-2">
            <dt className="font-bold text-ink-soft">Free bonus</dt>
            <dd className="font-black">{next.feature}</dd>
          </div>
        )}
      </dl>
      <p className="mt-2 text-sm font-semibold text-ink-soft">The glowing outline shows the new size.</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold text-ink-soft" aria-live="polite">
          {short > 0 ? `Need ${fmt(short)} more pearls` : "Ready when you are"}
        </span>
        <PearlButton
          label="Expand"
          cost={fmt(next.cost)}
          canAfford={short === 0}
          disabled={growing}
          onClick={() => expandHabitat(biome)}
          ariaLabel={short > 0 ? `Expand for ${fmt(next.cost)} pearls. Need ${fmt(short)} more pearls` : `Expand to size ${next.to} for ${fmt(next.cost)} pearls`}
        />
      </div>
    </div>
  );
}
