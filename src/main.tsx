import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { useGame } from "./state/gameStore";
import { useUI } from "./state/uiStore";
import { initAbout } from "./ui/about";

if (import.meta.env.DEV) {
  // Console handles for testing in development only.
  Object.assign(window, { __game: useGame, __ui: useUI });
  // Same module instances the app uses (console imports can hit stale HMR copies).
  void Promise.all([import("./scene/registry"), import("./utils/time"), import("./state/economy"), import("./state/visitorLogic"), import("three")]).then(
    ([registry, time, economy, visitors, three]) => Object.assign(window, { __registry: registry, __time: time, __economy: economy, __visitors: visitors, __THREE: three }),
  );
}

const Gallery = import.meta.env.DEV ? lazy(() => import("./ui/Gallery")) : null;
// ?gallery (model review) is a development-only tool.
const showGallery = import.meta.env.DEV && new URLSearchParams(location.search).has("gallery");

// The static About text (in index.html) moves behind Settings → About once the game runs.
initAbout();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {showGallery && Gallery ? (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
