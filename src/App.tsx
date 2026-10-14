import { lazy, Suspense, useEffect } from "react";
import { useGameLoop } from "./state/useGameLoop";
import { useUI } from "./state/uiStore";
import { AwaySummary } from "./ui/AwaySummary";
import { BiomeSwitcher } from "./ui/BiomeSwitcher";
import { BottomNav } from "./ui/BottomNav";
import { Codex } from "./ui/Codex";
import { Credits } from "./ui/Credits";
import { GoalsButton, GoalsPanel, useGoalToasts } from "./ui/DailyGoals";
import { DecorateMode } from "./ui/DecorateMode";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { ExpansionOverlay } from "./ui/ExpansionOverlay";
import { HabitatActions } from "./ui/HabitatActions";
import { Manage } from "./ui/Manage";
import { TankPanel } from "./ui/TankPanel";
import { WipeOverlay } from "./ui/WipeOverlay";
import { MakeRoomPicker, PearlFloaters, ReleaseConfirmDialog } from "./ui/ReleaseUI";
import { Onboarding } from "./ui/Onboarding";
import { EmptyState, SelectedInfo, Toasts } from "./ui/Overlays";
import { Settings } from "./ui/Settings";
import { Shop } from "./ui/Shop";
import { TopBar } from "./ui/TopBar";
import { VisitorChip } from "./ui/VisitorChip";
import { DEBUG } from "./utils/motion";

// three.js is the heavy part; load it after the UI shell has painted.
const SceneRoot = lazy(() => import("./scene/SceneRoot"));
// The ?debug panel only exists in development builds; production never ships it.
const DebugPanel = import.meta.env.DEV ? lazy(() => import("./ui/DebugPanel")) : null;

function Loading() {
  return (
    <div className="fixed inset-0 grid place-items-center">
      <div className="text-center">
        <div className="text-[34px] font-black tracking-wide">Idlarium</div>
        <div className="font-semibold text-ink-soft">Filling the habitats…</div>
      </div>
    </div>
  );
}

export default function App() {
  useGameLoop();
  useGoalToasts();
  const panel = useUI((s) => s.panel);
  const ready = useUI((s) => s.sceneReady);

  // Escape closes whatever is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const ui = useUI.getState();
      if (ui.wipingSince !== null) ui.setWiping(false);
      else if (ui.releaseConfirm) ui.askRelease(null);
      else if (ui.makeRoom) ui.openMakeRoom(null);
      else if (ui.codexCard) ui.setCodexCard(null);
      else if (ui.panel) ui.setPanel(null);
      else if (ui.selectedUid) ui.select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="fixed inset-0">
        <ErrorBoundary fallback={null}>
          <Suspense fallback={<Loading />}>
            <SceneRoot />
          </Suspense>
        </ErrorBoundary>
      </div>
      {!ready && <Loading />}

      <div className="pointer-events-none fixed inset-0">
        <TopBar />
        <VisitorChip />
        <EmptyState />
        <HabitatActions />
        <GoalsButton />
        <SelectedInfo />
        <ErrorBoundary key={panel ?? "none"} onReset={() => useUI.getState().setPanel(null)}>
          {panel === "shop" && <Shop />}
          {panel === "decorate" && <DecorateMode />}
          {panel === "biomes" && <BiomeSwitcher />}
          {panel === "codex" && <Codex />}
          {panel === "settings" && <Settings />}
          {panel === "goals" && <GoalsPanel />}
          {panel === "credits" && <Credits />}
          {panel === "manage" && <Manage />}
          {panel === "tank" && <TankPanel />}
        </ErrorBoundary>
        <BottomNav />
        <AwaySummary />
        <MakeRoomPicker />
        <ReleaseConfirmDialog />
        <PearlFloaters />
        <WipeOverlay />
        <Onboarding />
        <Toasts />
        <ExpansionOverlay />
        {DEBUG && DebugPanel && (
          <Suspense fallback={null}>
            <DebugPanel />
          </Suspense>
        )}
      </div>
    </>
  );
}
