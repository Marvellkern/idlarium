// While a habitat grows: a full-screen tap target that skips straight to the end.
// With reduced motion there's no growth animation, just a quick fade over the switch
// (driven from JS, since the global reduced-motion CSS rule disables animations).
import { useEffect, useMemo, useRef } from "react";
import { REDUCED_FADE_MS } from "../data/expansion";
import { useUI } from "../state/uiStore";
import { prefersReducedMotion } from "../utils/motion";

export function ExpansionOverlay() {
  const expansion = useUI((s) => s.expansion);
  const reduced = useMemo(prefersReducedMotion, []);
  if (!expansion) return null;
  if (reduced) return <ReducedFade key={expansion.startedAt} />;
  return (
    <button
      type="button"
      onClick={() => useUI.getState().skipExpansion()}
      className="pointer-events-auto fixed inset-0 z-[45] cursor-pointer bg-transparent"
      aria-label="Skip the expansion animation"
    >
      <span className="glass absolute bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 px-4 py-2 text-sm font-extrabold text-ink-soft">
        Tap to skip
      </span>
    </button>
  );
}

function ReducedFade() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = (now - start) / REDUCED_FADE_MS;
      // Up to opaque over the first 40% (the size switches while covered), then back down.
      const o = t < 0.4 ? t / 0.4 : Math.max(0, 1 - (t - 0.4) / 0.6);
      if (ref.current) ref.current.style.opacity = String(o);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={ref} className="pointer-events-auto fixed inset-0 z-[45]" style={{ opacity: 0, background: "var(--bg-bottom)" }} aria-hidden />;
}
