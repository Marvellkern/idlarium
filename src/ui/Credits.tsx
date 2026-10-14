import { ALL_MODELS_PROCEDURAL, CREDITS } from "../data/credits";
import { useUI } from "../state/uiStore";
import { Modal } from "./Panel";

export function Credits() {
  const back = () => useUI.getState().setPanel("settings");
  return (
    <Modal title="Credits" onClose={back}>
      <div className="flex flex-col gap-3">
        <p className="font-semibold">
          <b>Idlarium</b> is a cozy idle game about water creatures, from swamp frogs to blue whales.
        </p>
        {ALL_MODELS_PROCEDURAL && (
          <p className="rounded-xl bg-white/60 px-3 py-2.5 text-sm font-semibold text-ink-soft">
            Every creature and decoration is a procedural low poly model built in code, so there are no third-party 3D models,
            textures or sounds. Any CC0 or CC-BY assets added later will be listed here.
          </p>
        )}
        <h3 className="font-black">Fonts and code</h3>
        <ul className="flex flex-col gap-2">
          {CREDITS.map((c) => (
            <li key={c.what} className="rounded-xl bg-white/60 px-3 py-2">
              <div className="font-extrabold">{c.what}</div>
              <div className="text-sm font-semibold text-ink-soft">
                {c.author} · {c.license}
                {c.url && (
                  <>
                    {" · "}
                    <a href={c.url} target="_blank" rel="noreferrer" className="underline">
                      source
                    </a>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm font-semibold text-ink-soft">
          Animal facts are kept general on purpose. Sizes and habitats are typical ranges, not records.
        </p>
        <button type="button" onClick={back} className="min-h-11 rounded-xl bg-ink font-extrabold text-white hover:brightness-125">
          Back to settings
        </button>
      </div>
    </Modal>
  );
}
