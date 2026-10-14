// Daily goals: 3 small, optional goals per local day. No streaks, nothing to lose.
// Rewards scale with your income so they stay meaningful later on.

export type GoalEvent = "feed" | "befriend" | "place-deco" | "buy" | "hatch" | "watch" | "visit" | "expand" | "wipe";

export interface GoalDef {
  id: string;
  text: string;
  event: GoalEvent;
  target: number;
  /** Count distinct keys (e.g. different habitats) instead of every event. */
  distinct?: boolean;
  /** Minutes of current income the reward is worth (with a floor below). */
  rewardMinutes: number;
  /** Only offered when this is true. */
  requires?: (ctx: GoalContext) => boolean;
}

export interface GoalContext {
  habitats: number;
  canBreed: boolean;
  canExpand: boolean;
}

export const GOAL_REWARD_FLOOR = 50;
export const GOALS_PER_DAY = 3;

export const GOALS: GoalDef[] = [
  { id: "feed-2", text: "Feed 2 different habitats", event: "feed", target: 2, distinct: true, rewardMinutes: 6, requires: (c) => c.habitats >= 2 },
  { id: "feed-1", text: "Give your creatures a snack", event: "feed", target: 1, rewardMinutes: 4, requires: (c) => c.habitats < 2 },
  { id: "befriend-1", text: "Befriend a visitor", event: "befriend", target: 1, rewardMinutes: 10 },
  { id: "deco-1", text: "Place a decoration", event: "place-deco", target: 1, rewardMinutes: 5 },
  { id: "buy-3", text: "Welcome 3 new creatures", event: "buy", target: 3, rewardMinutes: 6 },
  { id: "hatch-1", text: "Hatch an egg", event: "hatch", target: 1, rewardMinutes: 8, requires: (c) => c.canBreed },
  { id: "watch-1", text: "Tap a creature and watch it swim", event: "watch", target: 1, rewardMinutes: 3 },
  { id: "wipe-1", text: "Wipe the glass of a tank", event: "wipe", target: 1, rewardMinutes: 5 },
  { id: "expand-1", text: "Expand a habitat", event: "expand", target: 1, rewardMinutes: 8, requires: (c) => c.canExpand },
  { id: "visit-2", text: "Check on 2 different habitats", event: "visit", target: 2, distinct: true, rewardMinutes: 4, requires: (c) => c.habitats >= 2 },
];

export const GOAL_BY_ID: Record<string, GoalDef> = Object.fromEntries(GOALS.map((g) => [g.id, g]));
