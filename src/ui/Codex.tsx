import { lazy, Suspense, useState } from "react";
import { BIOME_ORDER, BIOMES, type BiomeId } from "../data/biomes";
import { canBreed, RARITY_LABEL, SPECIES_BY_ID, speciesForBiome, VARIANT_BY_ID, type Species } from "../data/creatures";
import { CODEX_TIERS, codexProgress } from "../state/economy";
import { useGame } from "../state/gameStore";
import { useUI } from "../state/uiStore";
import { play } from "../utils/audio";
import { fmt, fmtRate } from "../utils/format";
import { CreatureGlyph } from "./CreatureGlyph";
import { HeartIcon } from "./icons";
import { Modal, PearlButton } from "./Panel";

const CodexTurntable = lazy(() => import("./CodexTurntable"));

const NONE: number[] = [];
const SIZE_WORD = { S: "Small", M: "Medium", L: "Large", XL: "Giant" } as const;
const ACTIVITY_WORD = { day: "Active by day", night: "Active at night", always: "Active day and night" } as const;

export function Codex() {
  const active = useGame((s) => s.activeBiome);
  const biome = useUI((s) => s.codexBiome) ?? active;
  const card = useUI((s) => s.codexCard);
  const sanctuaryCount = useGame((s) => s.sanctuary.length);
  const [sanctuary, setSanctuary] = useState(false);
  const close = () => useUI.getState().setPanel(null);

  return (
    <Modal title="Codex" onClose={close} wide>
      {card ? (
        <SpeciesCard id={card} />
      ) : (
        <>
          <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1" role="tablist">
            {BIOME_ORDER.map((b) => {
              const cfg = BIOMES[b];
              return (
                <button
                  key={b}
                  role="tab"
                  aria-selected={!sanctuary && b === biome}
                  disabled={!cfg.playable}
                  onClick={() => {
                    setSanctuary(false);
                    useUI.getState().setCodexBiome(b);
                  }}
                  className={`min-h-11 shrink-0 rounded-xl px-3 text-[15px] font-extrabold ${
                    !sanctuary && b === biome ? "bg-ink text-white" : cfg.playable ? "bg-white/60" : "bg-white/30 text-ink-soft"
                  }`}
                >
                  {cfg.name}
                  {!cfg.playable && <span className="ml-1 text-sm font-bold">(soon)</span>}
                </button>
              );
            })}
            <button
              role="tab"
              aria-selected={sanctuary}
              onClick={() => setSanctuary(true)}
              className={`flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-3 text-[15px] font-extrabold ${sanctuary ? "bg-ink text-white" : "bg-white/60"}`}
            >
              <HeartIcon size={16} /> Sanctuary{sanctuaryCount ? ` (${sanctuaryCount})` : ""}
            </button>
          </div>
          {sanctuary ? <Sanctuary /> : <BiomeCodex biome={biome} />}
        </>
      )}
    </Modal>
  );
}

function BiomeCodex({ biome }: { biome: BiomeId }) {
  const codex = useGame((s) => s.codex);
  const claimed = useGame((s) => s.codexRewardsClaimed[biome]) ?? NONE;
  const prog = codexProgress(biome, codex);
  const rewards = BIOMES[biome].codexRewards;
  const list = speciesForBiome(biome);

  const claim = (tier: number) => {
    const r = useGame.getState().claimCodexReward(biome, tier);
    if (r.ok) {
      play("plink");
      useUI.getState().toast(`Codex reward: +${fmt(rewards[tier])} pearls.`);
    } else useUI.getState().toast(r.reason);
  };

  return (
    <>
      <div className="mb-3 rounded-2xl bg-white/60 p-3">
        <div className="flex items-baseline justify-between">
          <span className="font-black">{Math.round(prog.pct * 100)}% discovered</span>
          <span className="text-sm font-bold text-ink-soft">
            {prog.owned} owned · {prog.spotted} spotted · {prog.total} total
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/8" role="progressbar" aria-valuenow={Math.round(prog.pct * 100)} aria-valuemax={100} aria-label="Codex completion">
          <div className="h-full rounded-full bg-leaf" style={{ width: `${prog.pct * 100}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CODEX_TIERS.map((t, i) => {
            const done = claimed.includes(i);
            const ready = prog.pct + 1e-9 >= t;
            return (
              <PearlButton
                key={i}
                label={done ? `${t * 100}% ✓` : `${t * 100}%`}
                cost={done ? undefined : fmt(rewards[i])}
                canAfford={ready && !done}
                onClick={() => claim(i)}
                className={ready && !done ? "animate-shimmer" : ""}
              />
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {list.flatMap((s) => [
          <Tile key={s.id} sp={s} state={codex[s.id]} />,
          ...(s.variants ?? []).map((v) => <Tile key={v.id} sp={s} variantId={v.id} state={codex[v.id]} />),
        ])}
      </div>
    </>
  );
}

/** Rare friends you've released, newest first. Some come back to visit. */
function Sanctuary() {
  const list = useGame((s) => s.sanctuary);
  if (!list.length)
    return (
      <p className="rounded-2xl bg-white/60 px-4 py-6 text-center font-semibold text-ink-soft">
        Rare and legendary friends you release are listed here. Now and then one swims back to visit.
      </p>
    );
  return (
    <>
      <p className="mb-3 text-sm font-semibold text-ink-soft">
        Rare and legendary friends you've released. Now and then one swims back to visit, marked with a heart.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {[...list].reverse().map((e, i) => {
          const sp = SPECIES_BY_ID[e.speciesId];
          if (!sp) return null;
          const name = (e.variantId && VARIANT_BY_ID[e.variantId]?.name) || sp.name;
          const r = RARITY_LABEL[sp.rarity];
          return (
            <li key={e.releasedAt + e.speciesId + i}>
              <button
                type="button"
                onClick={() => useUI.getState().setCodexCard(e.variantId ?? sp.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white/60 p-2 text-left hover:bg-white/80"
              >
                <div className="grid h-14 w-16 shrink-0 place-items-center rounded-xl bg-white/70">
                  <CreatureGlyph speciesId={sp.id} variantId={e.variantId} size={52} />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-black">{name}</div>
                  <div className="text-sm font-bold text-ink-soft">
                    <span aria-hidden>{r.icon}</span> {r.label} · {BIOMES[e.biome].name}
                  </div>
                  <div className="text-sm font-semibold text-ink-soft">
                    Left on {new Date(e.releasedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Tile({ sp, variantId, state }: { sp: Species; variantId?: string; state?: "spotted" | "owned" }) {
  const r = RARITY_LABEL[sp.rarity];
  const v = variantId ? VARIANT_BY_ID[variantId] : undefined;
  const name = v?.name ?? sp.name;
  const label = state ? name : v ? "Rare color" : "???";
  return (
    <button
      type="button"
      onClick={() => useUI.getState().setCodexCard(variantId ?? sp.id)}
      className={`flex min-h-[112px] flex-col items-center justify-center gap-1 rounded-2xl p-2 text-center hover:bg-white/80 ${v ? "bg-amber-50/70" : "bg-white/60"}`}
    >
      <CreatureGlyph speciesId={sp.id} variantId={variantId} mode={state ?? "unknown"} size={60} />
      <span className="line-clamp-2 text-sm leading-tight font-extrabold">{label}</span>
      <span className="text-sm font-bold text-ink-soft">
        {v ? (
          <>
            <span aria-hidden>✦</span> Variant
          </>
        ) : (
          <>
            <span aria-hidden>{r.icon}</span> {state === "spotted" ? "Spotted" : r.label}
          </>
        )}
      </span>
    </button>
  );
}

function SpeciesCard({ id }: { id: string }) {
  const variant = VARIANT_BY_ID[id];
  const sp = SPECIES_BY_ID[variant?.speciesId ?? id];
  const state = useGame((s) => s.codex[id]);
  const back = () => useUI.getState().setCodexCard(null);
  if (!sp) return null;
  const r = RARITY_LABEL[sp.rarity];
  const how = variant
    ? `A rare color morph. About 1 in 10 ${sp.name.toLowerCase()} eggs hatches a different color.`
    : sp.obtain === "shop"
      ? "Available in the shop."
      : sp.baseCost !== undefined
        ? "Arrives as a visitor. Once befriended, it also appears in the shop."
        : "Only arrives as a visitor.";

  return (
    <div>
      <button type="button" onClick={back} className="mb-3 min-h-11 rounded-xl bg-white/60 px-3 font-extrabold hover:bg-white/80">
        ← Back
      </button>
      {state === "owned" ? (
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div className="h-[200px] rounded-2xl bg-white/50 sm:h-[220px]">
            <Suspense
              fallback={
                <div className="grid h-full place-items-center">
                  <CreatureGlyph speciesId={sp.id} variantId={variant?.id} size={90} />
                </div>
              }
            >
              <CodexTurntable speciesId={sp.id} variantId={variant?.id} />
            </Suspense>
          </div>
          <div>
            <h3 className="text-2xl font-black">{variant?.name ?? sp.name}</h3>
            {variant && <div className="text-sm font-bold text-amber-700">✦ Color variant of the {sp.name.toLowerCase()}</div>}
            {sp.scientific && <div className="text-sm font-bold text-ink-soft italic">{sp.scientific}</div>}
            <div className="mt-1 text-sm font-bold text-ink-soft">
              <span aria-hidden>{r.icon}</span> {r.label} · {SIZE_WORD[sp.size]} · +{fmtRate(sp.pearlsPerSec)} pearls/s
            </div>
            <dl className="mt-3 space-y-2 text-[15px]">
              <div>
                <dt className="text-sm font-extrabold text-ink-soft">Real size</dt>
                <dd className="font-semibold">{sp.realSize}</dd>
              </div>
              <div>
                <dt className="text-sm font-extrabold text-ink-soft">Lives in</dt>
                <dd className="font-semibold">{sp.habitat}</dd>
              </div>
              <div>
                <dt className="text-sm font-extrabold text-ink-soft">Activity</dt>
                <dd className="font-semibold">{ACTIVITY_WORD[sp.activity]}</dd>
              </div>
              <div>
                <dt className="text-sm font-extrabold text-ink-soft">Fun fact</dt>
                <dd className="font-semibold">{sp.fact}</dd>
              </div>
              <div>
                <dt className="text-sm font-extrabold text-ink-soft">Eggs</dt>
                <dd className="font-semibold">
                  {canBreed(sp)
                    ? `Two or more in one habitat sometimes lay eggs.${sp.variants?.length ? " Watch for rare colors." : ""}`
                    : "Giants don't breed here. Each one is special."}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CreatureGlyph speciesId={sp.id} variantId={variant?.id} mode={state ?? "unknown"} size={120} />
          <h3 className="text-xl font-black">{state === "spotted" ? sp.name : variant ? "Undiscovered color" : "Not discovered yet"}</h3>
          <p className="max-w-sm font-semibold text-ink-soft">
            {state === "spotted" ? "You've spotted one passing through. Befriend one to learn more. " : variant ? "" : `${r.icon} ${r.label}. `}
            {how}
          </p>
        </div>
      )}
    </div>
  );
}
