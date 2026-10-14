import { useEffect } from "react";
import { GOAL_BY_ID } from "../data/goals";
import { onGoalDone, useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { play } from "../utils/audio";
import { fmt } from "../utils/format";
import { Panel, PearlButton } from "./Panel";

/** Small "Today 1/3" button on the left edge; glows when a reward is waiting. */
export function GoalsButton() {
  const goals = useGame((s) => s.dailyGoals.goals);
  const panel = useUI((s) => s.panel);
  if (panel || !goals.length) return null;
  const done = goals.filter((g) => g.done).length;
  const claimable = goals.some((g) => g.done && !g.claimed);
  return (
    <div className="pointer-events-none fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-3 z-10 md:bottom-[110px]">
      <button
        type="button"
        onClick={() => useUI.getState().setPanel("goals")}
        className={`glass pointer-events-auto flex min-h-[52px] items-center gap-2 py-1.5 pr-4 pl-3 ${claimable ? "animate-shimmer" : ""}`}
        aria-label={`Today's goals: ${done} of ${goals.length} done${claimable ? ", a reward is waiting" : ""}`}
        title="Today's goals"
      >
        <span aria-hidden className="text-lg">
          {claimable ? "✦" : "✓"}
        </span>
        <span className="text-left leading-tight">
          <span className="block text-[15px] font-extrabold">Today</span>
          <span className="block text-sm font-bold text-ink-soft tabular-nums">
            {done}/{goals.length} goals
          </span>
        </span>
      </button>
    </div>
  );
}

export function GoalsPanel() {
  const goals = useGame((s) => s.dailyGoals.goals);
  const close = () => useUI.getState().setPanel(null);
  const claim = (i: number) => {
    const r = useGame.getState().claimGoal(i);
    if (r.ok) play("plink");
    else useUI.getState().toast(r.reason);
  };
  return (
    <Panel title="Today's goals" subtitle="New ones at midnight. No streaks, no pressure." onClose={close}>
      <div className="flex flex-col gap-2">
        {goals.map((g, i) => {
          const def = GOAL_BY_ID[g.id];
          return (
            <div key={g.id} className="rounded-2xl bg-white/60 p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className={`font-black ${g.claimed ? "text-ink-soft line-through" : ""}`}>{def?.text ?? g.id}</div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/8" role="progressbar" aria-valuenow={g.progress} aria-valuemax={g.target} aria-label="Progress">
                    <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.min(100, (g.progress / g.target) * 100)}%` }} />
                  </div>
                  <div className="mt-1 text-sm font-bold text-ink-soft tabular-nums">
                    {Math.min(g.progress, g.target)}/{g.target}
                  </div>
                </div>
                {g.claimed ? (
                  <span className="shrink-0 rounded-xl bg-black/5 px-3 py-2.5 text-sm font-extrabold text-ink-soft">Claimed</span>
                ) : (
                  <PearlButton
                    label={g.done ? "Claim" : undefined}
                    cost={fmt(g.reward)}
                    canAfford={g.done}
                    onClick={() => claim(i)}
                    className={`shrink-0 ${g.done ? "animate-shimmer" : ""}`}
                    ariaLabel={g.done ? `Claim ${fmt(g.reward)} pearls` : `Reward: ${fmt(g.reward)} pearls when done`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/** Toast + chime when a goal completes (wherever it happened). */
export function useGoalToasts() {
  useEffect(
    () =>
      onGoalDone((id) => {
        useUI.getState().toast(`Goal done: ${GOAL_BY_ID[id]?.text ?? "nice"}. Claim it under Today.`);
        play("chime");
      }),
    [],
  );
}
