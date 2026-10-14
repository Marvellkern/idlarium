// First-time tips: pearls → buy a fish → feed → "come back later". Skippable.
// Steps 1 and 2 advance on their own when the player does the thing.
import { useEffect, useRef } from "react";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";

const STEPS = [
  {
    text: "These are pearls. Your creatures make them all the time, even while you're away.",
    place: "top-left",
    next: "Next",
  },
  { text: "Open the Shop and welcome your first guppy.", place: "bottom-left", next: null },
  { text: "Tap Feed every now and then. Happy creatures make more pearls.", place: "bottom-right", next: null },
  { text: "That's it. Come back later and they'll have made pearls for you.", place: "center", next: "Got it" },
] as const;

const PLACE: Record<(typeof STEPS)[number]["place"], string> = {
  "top-left": "top-[calc(76px+env(safe-area-inset-top))] left-3",
  "bottom-left": "bottom-[calc(92px+env(safe-area-inset-bottom))] left-3",
  "bottom-right": "bottom-[calc(160px+env(safe-area-inset-bottom))] right-3 md:bottom-[176px]",
  center: "top-[38%] left-1/2 -translate-x-1/2",
};

export function Onboarding() {
  const step = useGame((s) => s.tutorial);
  const hasCreatures = useGame((s) => Object.values(s.habitats).some((h) => (h?.creatures.length ?? 0) > 0));
  const swampFed = useGame((s) => s.habitats.swamp?.lastFed ?? 0);
  const panel = useUI((s) => s.panel);
  const away = useUI((s) => s.away);
  const set = useGame((s) => s.setTutorial);

  // Advance automatically when the player does what the tip says.
  useEffect(() => {
    if (step === 1 && hasCreatures) set(2);
  }, [step, hasCreatures, set]);
  // Step 2 finishes on the first feed after the tip appeared.
  const fedBaseline = useRef<number | null>(null);
  useEffect(() => {
    if (step !== 2) {
      fedBaseline.current = null;
      return;
    }
    if (fedBaseline.current === null) fedBaseline.current = swampFed;
    else if (swampFed > fedBaseline.current) set(3);
  }, [step, swampFed, set]);

  if (step < 0 || step >= STEPS.length || away) return null;
  // Let the shop be used without a tip on top of it.
  if (panel && !(step === 1 && panel === "shop")) return null;
  const s = STEPS[step];
  const inShop = step === 1 && panel === "shop";

  return (
    <div
      className={`pointer-events-none fixed z-40 ${inShop ? "top-[calc(76px+env(safe-area-inset-top))] left-1/2 -translate-x-1/2" : PLACE[s.place]} w-[min(320px,calc(100vw-24px))]`}
      role="dialog"
      aria-label="Tip"
    >
      <div className="glass-strong animate-pop-in pointer-events-auto p-3.5">
        <div className="mb-1 text-sm font-extrabold text-ink-soft">
          Tip {step + 1} of {STEPS.length}
        </div>
        <p className="text-[15px] font-bold">{inShop ? "Tap the guppy's price to buy one." : s.text}</p>
        <div className="mt-3 flex justify-between gap-2">
          <button type="button" onClick={() => set(-1)} className="min-h-11 rounded-xl px-3 text-sm font-extrabold text-ink-soft hover:bg-black/5">
            Skip tips
          </button>
          {s.next && (
            <button
              type="button"
              onClick={() => set(step + 1 >= STEPS.length ? -1 : step + 1)}
              className="min-h-11 rounded-xl bg-ink px-4 font-extrabold text-white hover:brightness-125"
            >
              {s.next}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
