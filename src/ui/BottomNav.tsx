import type { ReactNode } from "react";
import { useUI, type Panel } from "../state/uiStore";
import { play } from "../utils/audio";
import { BookIcon, BrushIcon, GlobeIcon, ShopIcon, TankIcon } from "./icons";

const ITEMS: { id: Exclude<Panel, null>; label: string; icon: ReactNode; hint: string }[] = [
  { id: "shop", label: "Shop", icon: <ShopIcon />, hint: "Buy creatures and more room" },
  { id: "decorate", label: "Decorate", icon: <BrushIcon />, hint: "Place decorations" },
  { id: "tank", label: "Tank", icon: <TankIcon />, hint: "Lamp, equipment and tank style" },
  { id: "codex", label: "Codex", icon: <BookIcon />, hint: "Your collection" },
  { id: "biomes", label: "Habitats", icon: <GlobeIcon />, hint: "Switch or unlock habitats" },
];

export function BottomNav() {
  const panel = useUI((s) => s.panel);
  const toggle = useUI((s) => s.togglePanel);
  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-[max(10px,env(safe-area-inset-bottom))]"
      aria-label="Main"
    >
      <div className="glass-strong pointer-events-auto grid w-full max-w-md grid-cols-5 gap-1 p-1.5">
        {ITEMS.map((it) => {
          const active = panel === it.id;
          return (
            <button
              key={it.id}
              type="button"
              title={it.hint}
              aria-pressed={active}
              onClick={() => {
                play("tap");
                toggle(it.id);
              }}
              className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-xl text-[13px] font-extrabold transition-colors ${
                active ? "bg-ink text-white" : "text-ink-soft hover:bg-white/60 hover:text-ink"
              }`}
            >
              {it.icon}
              <span>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
