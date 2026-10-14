export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  // Dev only: ?reducedmotion forces it on for testing.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("reducedmotion")) return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}

/** ?debug tools: development builds only. */
export const DEBUG = import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");
