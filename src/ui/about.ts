// "About Idlarium" lives as plain HTML in index.html so search engines can read it.
// Before the game loads it sits on the loading screen; once the game runs it's
// tucked away and opened from Settings as an overlay (styles in index.html).

let wired = false;

function el() {
  return document.getElementById("about");
}

export function closeAbout() {
  el()?.classList.remove("open");
}

export function openAbout() {
  const about = el();
  if (!about) return;
  about.classList.add("open");
  about.setAttribute("aria-modal", "true");
  document.getElementById("about-close")?.focus();
}

/** Called once at startup: hide the About text from play and wire up closing it. */
export function initAbout() {
  document.documentElement.classList.add("app-ready");
  if (wired) return;
  wired = true;
  const about = el();
  about?.addEventListener("click", (e) => {
    if (e.target === about) closeAbout();
  });
  document.getElementById("about-close")?.addEventListener("click", closeAbout);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && about?.classList.contains("open")) {
      e.stopImmediatePropagation();
      closeAbout();
    }
  });
}
