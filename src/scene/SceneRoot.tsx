// The WebGL canvas. Loaded lazily so the UI shell paints fast.
import { PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import * as THREE from "three";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { isTouchDevice } from "../utils/motion";
import { HabitatScene } from "./HabitatScene";

/** Only ever auto-lower graphics once per session; the player can switch back in Settings. */
let autoLowered = false;

export default function SceneRoot() {
  const biome = useGame((s) => s.activeBiome);
  const quality = useGame((s) => s.settings.quality);
  const hidden = useUI((s) => s.hidden);
  // Phones cap pixel density at 1.5 (brief), desktops at 2. Adaptive quality can lower it.
  const deviceMax = quality === "low" ? 1 : isTouchDevice() ? 1.5 : 2;
  const [dprCap, setDprCap] = useState(deviceMax);
  const maxDpr = Math.min(deviceMax, dprCap);

  const onDecline = () => {
    if (maxDpr > 1) {
      setDprCap(1);
      return;
    }
    // Still slow at 1× pixels: switch to Low (no shadows, caustics, bloom) once.
    if (quality === "high" && !autoLowered) {
      autoLowered = true;
      useGame.getState().setSetting("quality", "low");
      useUI.getState().toast("Switched graphics to Low to keep things smooth. You can change it in Settings.");
    }
  };

  return (
    <Canvas
      shadows={quality === "high" ? "percentage" : false}
      dpr={[1, maxDpr]}
      frameloop={hidden ? "never" : "always"}
      camera={{ fov: 42, near: 0.1, far: 200, position: [0, 6, 12] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping }}
      onPointerMissed={() => useUI.getState().select(null)}
      onCreated={(state) => {
        useUI.getState().setSceneReady();
        // Dev-only handle for poking at the scene from the console.
        if (import.meta.env.DEV) (window as unknown as { __r3f: unknown }).__r3f = state.get;
      }}
      aria-label="Habitat view"
    >
      {/* Decline below ~30 fps, recover above ~50. */}
      <PerformanceMonitor bounds={() => [30, 50]} flipflops={4} onDecline={onDecline} onIncline={() => setDprCap(deviceMax)}>
        <HabitatScene key={biome} biome={biome} />
      </PerformanceMonitor>
    </Canvas>
  );
}
