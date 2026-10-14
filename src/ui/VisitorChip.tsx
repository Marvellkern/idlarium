import { useMemo } from "react";
import { SPECIES_BY_ID } from "../data/creatures";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { letVisitorGo, makeRoom, roomInfo, tapVisitor } from "../state/visitorLogic";
import { fmt } from "../utils/format";
import { useNow } from "./hooks";
import { SparkleIcon } from "./icons";
import { Modal, PearlButton } from "./Panel";

const LINES = [
  (n: string) => `${art(n)} ${n} drifted in. Say hi?`,
  (n: string) => `${art(n)} ${n} is passing through.`,
  (n: string) => `Look, ${art(n).toLowerCase()} ${n} is visiting.`,
];
function art(n: string) {
  return /^[aeiou]/i.test(n) ? "An" : "A";
}

export function VisitorChip() {
  const v = useUI((s) => s.visitor);
  const pearls = useGame((s) => s.pearls);
  const now = useNow(250);
  const line = useMemo(() => LINES[Math.floor(Math.random() * LINES.length)], [v?.id]);
  if (!v) return null;
  const sp = SPECIES_BY_ID[v.speciesId];
  if (!sp) return null;
  const name = sp.name.toLowerCase();

  if (v.state === "asking") {
    const info = roomInfo();
    return (
      <Modal title={`No room for the ${name} yet`}>
        <div className="flex flex-col gap-3">
          <p className="font-semibold">
            It needs {info?.need ?? "?"} space and you have {Math.max(0, info?.free ?? 0)} free. It'll wait while you decide.
          </p>
          {info?.canUpgrade ? (
            <PearlButton
              label={`Make room (+${info.upgradeAdds} space)`}
              cost={fmt(info.upgradeCost)}
              canAfford={pearls >= info.upgradeCost}
              onClick={makeRoom}
            />
          ) : (
            <p className="text-sm font-semibold text-ink-soft">This habitat is as big as it gets.</p>
          )}
          <button type="button" onClick={letVisitorGo} className="min-h-11 rounded-xl bg-white/80 font-extrabold hover:bg-white">
            Let it go
          </button>
        </div>
      </Modal>
    );
  }

  const left = Math.max(0, (v.expiresAt - now) / (v.expiresAt - v.startedAt));
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(72px+env(safe-area-inset-top))] z-30 flex justify-center px-3">
      <div className="glass-strong animate-pop-in pointer-events-auto flex max-w-sm items-center gap-2 overflow-hidden py-1.5 pr-1.5 pl-3">
        <SparkleIcon size={20} className="shrink-0 text-amber-500" />
        <div className="min-w-0">
          <div className="text-[15px] leading-tight font-extrabold">Visitor</div>
          <div className="text-sm leading-tight font-semibold text-ink-soft">{line(name)}</div>
          <div className="mt-1 h-1 w-full rounded-full bg-black/8">
            <div className="h-full rounded-full bg-sun transition-[width] duration-300" style={{ width: `${left * 100}%` }} />
          </div>
        </div>
        <button type="button" onClick={tapVisitor} className="animate-shimmer min-h-11 shrink-0 rounded-xl bg-sun px-3 font-extrabold text-ink">
          Say hi
        </button>
      </div>
    </div>
  );
}
