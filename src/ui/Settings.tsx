import { useState } from "react";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { play } from "../utils/audio";
import { Modal } from "./Panel";

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2">
      <span>
        <span className="block font-extrabold">{label}</span>
        {hint && <span className="block text-sm font-semibold text-ink-soft">{hint}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-black/15 transition peer-checked:bg-leaf peer-focus-visible:ring-3 peer-focus-visible:ring-sun after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
    </label>
  );
}

export function Settings() {
  const settings = useGame((s) => s.settings);
  const set = useGame((s) => s.setSetting);
  const [exported, setExported] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [resetStep, setResetStep] = useState(0);
  const close = () => useUI.getState().setPanel(null);
  const toast = useUI((s) => s.toast);

  const doExport = async () => {
    const s = useGame.getState().exportSave();
    setExported(s);
    try {
      await navigator.clipboard.writeText(s);
      toast("Save copied to your clipboard.");
    } catch {
      toast("Copy the text below to keep your save.");
    }
  };

  const doImport = () => {
    const r = useGame.getState().importSave(importText);
    if (r.ok) {
      toast("Save loaded. Welcome back.");
      setImportText("");
      setShowImport(false);
      close();
    } else toast(r.reason);
  };

  const doReset = () => {
    if (resetStep < 2) {
      setResetStep(resetStep + 1);
      return;
    }
    useGame.getState().resetSave();
    setResetStep(0);
    close();
    toast("Fresh start. The swamp is waiting.");
  };

  return (
    <Modal title="Settings" onClose={close}>
      <div className="flex flex-col gap-2">
        <Toggle
          label="Sound"
          hint="Soft UI sounds and ambience"
          checked={settings.sound}
          onChange={(v) => {
            set("sound", v);
            if (v) setTimeout(() => play("plink"), 50);
          }}
        />
        <Toggle label="Music" hint="Lo-fi loop (plays once a music file is added)" checked={settings.music} onChange={(v) => set("music", v)} />
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2">
          <span>
            <span className="block font-extrabold">Graphics</span>
            <span className="block text-sm font-semibold text-ink-soft">Low turns off shadows, caustics and sun rays</span>
          </span>
          <div className="flex shrink-0 gap-1 rounded-xl bg-black/5 p-1" role="radiogroup" aria-label="Graphics quality">
            {(["low", "high"] as const).map((q) => (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={settings.quality === q}
                onClick={() => set("quality", q)}
                className={`min-h-10 min-w-14 rounded-lg px-2 text-sm font-extrabold capitalize ${settings.quality === q ? "bg-white shadow-sm" : "text-ink-soft"}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <h3 className="mt-3 font-black">Your save</h3>
        <p className="text-sm font-semibold text-ink-soft">Progress saves on this device automatically. Use export and import to move it to another one.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={doExport} className="min-h-11 rounded-xl bg-white/80 font-extrabold hover:bg-white">
            Export save
          </button>
          <button type="button" onClick={() => setShowImport((v) => !v)} className="min-h-11 rounded-xl bg-white/80 font-extrabold hover:bg-white">
            Import save
          </button>
        </div>
        {exported && (
          <textarea
            readOnly
            value={exported}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Exported save"
            className="h-24 w-full rounded-xl bg-white/80 p-2 font-mono text-xs select-text"
          />
        )}
        {showImport && (
          <div className="flex flex-col gap-2">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste your save text here"
              aria-label="Save to import"
              className="h-24 w-full rounded-xl bg-white/80 p-2 font-mono text-xs select-text"
            />
            <button
              type="button"
              onClick={doImport}
              disabled={!importText.trim()}
              className="min-h-11 rounded-xl bg-ink font-extrabold text-white disabled:opacity-50"
            >
              Load this save
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={doReset}
          onBlur={() => setResetStep(0)}
          className={`min-h-11 rounded-xl font-extrabold ${resetStep === 0 ? "bg-white/60 text-ink-soft" : "bg-coral text-white"}`}
        >
          {resetStep === 0 ? "Reset save…" : resetStep === 1 ? "Erase all progress? Tap again" : "Really erase everything? Last tap"}
        </button>

        <button
          type="button"
          onClick={() => useUI.getState().setPanel("credits")}
          className="mt-2 min-h-11 rounded-xl bg-white/60 font-extrabold hover:bg-white/80"
        >
          Credits and licenses
        </button>
      </div>
    </Modal>
  );
}
