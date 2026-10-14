// localStorage wrapper for zustand persist that only writes every AUTOSAVE_MS,
// plus immediately when the tab is hidden or closed. Pearls tick several times a
// second, so writing on every change would be wasteful.

import type { StateStorage } from "zustand/middleware";

export const AUTOSAVE_MS = 15_000;

const pending = new Map<string, string>();

function flush() {
  for (const [k, v] of pending) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage full or blocked: keep playing */
    }
  }
  pending.clear();
}

if (typeof window !== "undefined") {
  setInterval(flush, AUTOSAVE_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);
}

export const throttledStorage: StateStorage = {
  getItem(name) {
    if (pending.has(name)) return pending.get(name)!;
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    pending.set(name, value);
  },
  removeItem(name) {
    pending.delete(name);
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const flushSave = flush;
