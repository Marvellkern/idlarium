// Transient UI state. Never persisted.
import { create } from "zustand";
import type { BiomeId } from "../data/biomes";
import type { AwaySummary } from "./gameStore";

export type Panel = "shop" | "decorate" | "codex" | "biomes" | "settings" | "goals" | "credits" | null;

export interface ActiveVisitor {
  id: string;
  speciesId: string;
  biome: BiomeId;
  startedAt: number;
  expiresAt: number;
  /** "asking" = the player tapped it but there's no room; it waits for a decision. */
  state: "swimming" | "asking";
}

/** A habitat growing one size level (drives the 2 s animation; tap skips). */
export interface Expansion {
  biome: BiomeId;
  from: number;
  to: number;
  startedAt: number;
  skipped: boolean;
}

export interface Toast {
  id: number;
  text: string;
}

interface UIState {
  panel: Panel;
  selectedUid: string | null;
  visitor: ActiveVisitor | null;
  nextVisitorAt: number;
  away: AwaySummary | null;
  toasts: Toast[];
  feedingAt: { biome: BiomeId; at: number } | null;
  decoSlot: string | null;
  shopTab: "creatures" | "habitat";
  /** Show the ghost outline of the next size (while the Expand card is open). */
  expandPreview: boolean;
  expansion: Expansion | null;
  codexBiome: BiomeId | null;
  codexCard: string | null;
  sceneReady: boolean;
  hidden: boolean;
  /** Bumped when the (debug) clock override changes, so time-based UI refreshes. */
  clockTick: number;
  bumpClock(): void;
  setPanel(p: Panel): void;
  togglePanel(p: Exclude<Panel, null>): void;
  select(uid: string | null): void;
  setVisitor(v: ActiveVisitor | null): void;
  setNextVisitorAt(t: number): void;
  setAway(a: AwaySummary | null): void;
  toast(text: string): void;
  dismissToast(id: number): void;
  startFeeding(biome: BiomeId): void;
  setDecoSlot(slot: string | null): void;
  setShopTab(tab: "creatures" | "habitat"): void;
  openExpand(): void;
  setExpandPreview(on: boolean): void;
  startExpansion(e: Omit<Expansion, "startedAt" | "skipped">): void;
  skipExpansion(): void;
  endExpansion(): void;
  openCodex(biome?: BiomeId, card?: string | null): void;
  setCodexCard(id: string | null): void;
  setCodexBiome(b: BiomeId): void;
  setSceneReady(): void;
  setHidden(h: boolean): void;
}

let toastId = 1;

export const useUI = create<UIState>()((set, get) => ({
  panel: null,
  selectedUid: null,
  visitor: null,
  nextVisitorAt: 0,
  away: null,
  toasts: [],
  feedingAt: null,
  decoSlot: null,
  shopTab: "creatures",
  expandPreview: false,
  expansion: null,
  codexBiome: null,
  codexCard: null,
  sceneReady: false,
  hidden: false,
  clockTick: 0,
  bumpClock: () => set({ clockTick: get().clockTick + 1 }),
  setPanel: (panel) => set({ panel, decoSlot: null }),
  togglePanel: (p) => set({ panel: get().panel === p ? null : p, decoSlot: null }),
  select: (selectedUid) => set({ selectedUid }),
  setVisitor: (visitor) => set({ visitor }),
  setNextVisitorAt: (nextVisitorAt) => set({ nextVisitorAt }),
  setAway: (away) => set({ away }),
  toast: (text) => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-2), { id, text }] });
    setTimeout(() => get().dismissToast(id), 3600);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  startFeeding: (biome) => set({ feedingAt: { biome, at: performance.now() } }),
  setDecoSlot: (decoSlot) => set({ decoSlot }),
  setShopTab: (shopTab) => set({ shopTab }),
  openExpand: () => set({ panel: "shop", shopTab: "habitat", decoSlot: null }),
  setExpandPreview: (expandPreview) => set({ expandPreview }),
  startExpansion: (e) => set({ expansion: { ...e, startedAt: performance.now(), skipped: false }, expandPreview: false, selectedUid: null }),
  skipExpansion: () => {
    const e = get().expansion;
    if (e && !e.skipped) set({ expansion: { ...e, skipped: true } });
  },
  endExpansion: () => set({ expansion: null }),
  openCodex: (biome, card = null) => set({ panel: "codex", codexBiome: biome ?? get().codexBiome, codexCard: card }),
  setCodexCard: (codexCard) => set({ codexCard }),
  setCodexBiome: (codexBiome) => set({ codexBiome, codexCard: null }),
  setSceneReady: () => set({ sceneReady: true }),
  setHidden: (hidden) => set({ hidden }),
}));
