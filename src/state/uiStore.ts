// Transient UI state. Never persisted.
import { create } from "zustand";
import type { BiomeId } from "../data/biomes";
import type { AwaySummary } from "./gameStore";
import type { Vec3 } from "./handoff";

export type Panel = "shop" | "decorate" | "codex" | "biomes" | "settings" | "goals" | "credits" | "manage" | null;

export interface ActiveVisitor {
  id: string;
  speciesId: string;
  biome: BiomeId;
  /** Returning friends keep their color. */
  variantId?: string;
  /** Set for an old friend from the Sanctuary: when it was released. */
  returning?: number;
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
  /** Optional button, e.g. Undo. */
  action?: { label: string; run: () => void };
}

/** Who the Make Room picker is clearing space for. */
export type MakeRoomFor = { kind: "visitor" } | { kind: "egg"; biome: BiomeId; index: number; at?: Vec3 };

/** A pending confirm dialog for releasing creatures. */
export interface ReleaseConfirm {
  biome: BiomeId;
  uids: string[];
  /** Runs after the release (e.g. welcome the visitor or hatch the egg). */
  then?: () => void;
  /** Button text override, e.g. "Release & Welcome Sea Turtle". */
  confirmLabel?: string;
}

/** A creature swimming off after a release (scene only, about 1.5 s). */
export interface Departing {
  key: string;
  speciesId: string;
  variantId?: string;
  biome: BiomeId;
  /** Where it was when released (null: start from the middle). */
  from: Vec3 | null;
  startedAt: number;
  /** Bulk releases animate a few; the rest just fade. */
  swim: boolean;
}

interface UIState {
  panel: Panel;
  selectedUid: string | null;
  visitor: ActiveVisitor | null;
  away: AwaySummary | null;
  toasts: Toast[];
  /** Small "+X pearls" pop-ups by the pearl counter. */
  floaters: { id: number; text: string }[];
  makeRoom: MakeRoomFor | null;
  releaseConfirm: ReleaseConfirm | null;
  departing: Departing[];
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
  setAway(a: AwaySummary | null): void;
  toast(text: string, opts?: { action?: Toast["action"]; ms?: number }): number;
  floatText(text: string): void;
  openMakeRoom(m: MakeRoomFor | null): void;
  askRelease(c: ReleaseConfirm | null): void;
  addDeparting(d: Departing[]): void;
  removeDeparting(keys: string[]): void;
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
  away: null,
  toasts: [],
  floaters: [],
  makeRoom: null,
  releaseConfirm: null,
  departing: [],
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
  setAway: (away) => set({ away }),
  toast: (text, opts = {}) => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-2), { id, text, ...(opts.action ? { action: opts.action } : {}) }] });
    setTimeout(() => get().dismissToast(id), opts.ms ?? 3600);
    return id;
  },
  floatText: (text) => {
    const id = toastId++;
    set({ floaters: [...get().floaters.slice(-3), { id, text }] });
    setTimeout(() => set({ floaters: get().floaters.filter((f) => f.id !== id) }), 1400);
  },
  openMakeRoom: (makeRoom) => set({ makeRoom }),
  askRelease: (releaseConfirm) => set({ releaseConfirm }),
  addDeparting: (d) => set({ departing: [...get().departing, ...d] }),
  removeDeparting: (keys) => set({ departing: get().departing.filter((d) => !keys.includes(d.key)) }),
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
