// Tiny flat SVG portrait per body plan, tinted with the species colors.
// Used in shop and codex cards (the 3D turntable lives in the codex detail card).
import type { ReactNode } from "react";
import { SPECIES_BY_ID, VARIANT_BY_ID } from "../data/creatures";

type Plan =
  | "fish"
  | "tall"
  | "long"
  | "eel"
  | "frog"
  | "turtle"
  | "seahorse"
  | "octopus"
  | "puffer"
  | "shark"
  | "axolotl"
  | "catfish"
  | "dolphin"
  | "manta"
  | "whale"
  | "squid"
  | "isopod"
  | "angler";

const PLAN: Record<string, Plan> = {
  "neon-tetra": "fish",
  frog: "frog",
  catfish: "catfish",
  mudskipper: "fish",
  "painted-turtle": "turtle",
  axolotl: "axolotl",
  "electric-eel": "eel",
  "alligator-gar": "long",
  "blue-tang": "tall",
  damselfish: "tall",
  seahorse: "seahorse",
  pufferfish: "puffer",
  "moray-eel": "eel",
  octopus: "octopus",
  "sea-turtle": "turtle",
  "reef-shark": "shark",
  "mahi-mahi": "tall",
  sailfish: "long",
  dolphin: "dolphin",
  "manta-ray": "manta",
  hammerhead: "shark",
  "whale-shark": "shark",
  humpback: "whale",
  "blue-whale": "whale",
  "giant-isopod": "isopod",
  anglerfish: "angler",
  "gulper-eel": "eel",
  "dumbo-octopus": "octopus",
  "vampire-squid": "octopus",
  "giant-squid": "squid",
  "sperm-whale": "whale",
};

const EYE = "#1a1a1a";

export function CreatureGlyph({
  speciesId,
  variantId,
  mode = "owned",
  size = 56,
}: {
  speciesId: string;
  variantId?: string;
  mode?: "owned" | "spotted" | "unknown";
  size?: number;
}) {
  const sp = SPECIES_BY_ID[speciesId];
  const variantColors = variantId ? VARIANT_BY_ID[variantId]?.colors : undefined;
  const plan = PLAN[speciesId] ?? "fish";
  const sil = mode !== "owned";
  const [c0, c1, c2] = sil ? ["#2c3a33", "#2c3a33", "#2c3a33"] : (variantColors ?? sp?.colors ?? ["#999", "#ccc", "#fff"]);
  const eye = sil ? "#2c3a33" : EYE;
  const style = mode === "spotted" ? { filter: "blur(2.2px)", opacity: 0.75 } : mode === "unknown" ? { opacity: 0.35 } : undefined;

  let body: ReactNode;
  switch (plan) {
    case "tall":
      body = (
        <>
          <path d="M14 20 L4 9 L6 20 L4 31 Z" fill={c2} />
          <ellipse cx="33" cy="20" rx="20" ry="15" fill={c0} />
          <path d="M18 24 Q33 38 50 24 Q33 30 18 24Z" fill={c1} opacity=".6" />
          <circle cx="45" cy="16" r="2.6" fill={eye} />
        </>
      );
      break;
    case "long":
      body = (
        <>
          <path d="M8 20 L2 13 L3 20 L2 27 Z" fill={c0} />
          <ellipse cx="28" cy="20" rx="22" ry="6.5" fill={c0} />
          <path d="M48 18 L63 19.5 L48 22 Z" fill={c0} />
          <path d="M10 22 Q28 28 48 22Z" fill={c1} opacity=".8" />
          <circle cx="45" cy="18.5" r="1.6" fill={eye} />
        </>
      );
      break;
    case "eel":
      body = (
        <>
          <path d="M4 26 C14 12, 24 34, 36 20 S 52 14, 58 18" stroke={c0} strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M6 28 C16 16, 24 36, 36 23" stroke={c1} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".7" />
          <circle cx="55" cy="16.5" r="1.6" fill={eye} />
        </>
      );
      break;
    case "frog":
      body = (
        <>
          <ellipse cx="32" cy="24" rx="17" ry="11" fill={c0} />
          <ellipse cx="32" cy="29" rx="12" ry="5" fill={c1} />
          <circle cx="24" cy="14" r="5" fill={c0} />
          <circle cx="40" cy="14" r="5" fill={c0} />
          <circle cx="24" cy="13" r="2" fill={eye} />
          <circle cx="40" cy="13" r="2" fill={eye} />
          <path d="M14 30 Q8 34 12 37 L20 34Z M50 30 Q56 34 52 37 L44 34Z" fill={c2} />
        </>
      );
      break;
    case "turtle":
      body = (
        <>
          <path d="M12 26 Q32 2 52 26 Z" fill={c0} />
          <path d="M12 26 L52 26" stroke={c2} strokeWidth="3" />
          <circle cx="56" cy="23" r="5" fill={c1} />
          <path d="M18 27 L12 34 L22 30Z M44 27 L50 34 L40 30Z" fill={c1} />
          <circle cx="57.5" cy="21.5" r="1.3" fill={eye} />
        </>
      );
      break;
    case "seahorse":
      body = (
        <>
          <path d="M32 6 Q42 8 38 16 Q34 22 38 28 Q40 36 32 36 Q26 36 30 31" stroke={c0} strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M37 8 L48 11" stroke={c0} strokeWidth="4" strokeLinecap="round" />
          <path d="M33 4 L35 0 L37 4Z" fill={c2} />
          <circle cx="36" cy="9" r="1.5" fill={eye} />
        </>
      );
      break;
    case "octopus":
      body = (
        <>
          <ellipse cx="32" cy="14" rx="12" ry="11" fill={c0} />
          {[18, 25, 32, 39, 46].map((x, i) => (
            <path key={i} d={`M${x - 2} 22 Q${x - 6 + i} 32 ${x - 2 + (i % 2 ? 3 : -3)} 38`} stroke={c0} strokeWidth="4" fill="none" strokeLinecap="round" />
          ))}
          <circle cx="27" cy="16" r="2.2" fill={eye} />
          <circle cx="37" cy="16" r="2.2" fill={eye} />
        </>
      );
      break;
    case "puffer":
      body = (
        <>
          <path d="M14 20 L6 13 L7 20 L6 27 Z" fill={c0} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <line key={i} x1={33 + Math.cos(a) * 13} y1={20 + Math.sin(a) * 12} x2={33 + Math.cos(a) * 17} y2={20 + Math.sin(a) * 16} stroke={c2} strokeWidth="1.6" />;
          })}
          <circle cx="33" cy="20" r="14" fill={c0} />
          <path d="M20 25 Q33 36 46 25 Q33 30 20 25Z" fill={c1} />
          <circle cx="41" cy="16" r="3" fill={eye} />
        </>
      );
      break;
    case "shark":
      body = (
        <>
          <path d="M12 20 L2 6 L6 20 L3 30 Z" fill={c0} />
          <path d="M28 12 L34 2 L38 12Z" fill={c0} />
          <path d="M33 4 L34 2 L35 4Z" fill={c2} />
          <path d="M8 20 Q30 6 62 20 Q30 30 8 20Z" fill={c0} />
          <path d="M14 22 Q34 28 58 21 Q34 26 14 22Z" fill={c1} />
          <circle cx="52" cy="18" r="1.5" fill={eye} />
        </>
      );
      break;
    case "axolotl":
      body = (
        <>
          <path d="M6 22 Q18 12 30 20" stroke={c0} strokeWidth="5" fill="none" strokeLinecap="round" />
          <ellipse cx="36" cy="21" rx="11" ry="6" fill={c0} />
          <ellipse cx="50" cy="20" rx="8" ry="7" fill={c0} />
          {[-6, 0, 6].map((d, i) => (
            <path key={i} d={`M46 ${17 + d / 3} L40 ${10 + d}`} stroke={c2} strokeWidth="2.4" strokeLinecap="round" />
          ))}
          <circle cx="54" cy="18" r="1.5" fill={eye} />
          <path d="M30 26 L27 31 M42 26 L44 31" stroke={c0} strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
      break;
    case "catfish":
      body = (
        <>
          <path d="M10 20 L2 11 L4 20 L2 29 Z" fill={c0} />
          <ellipse cx="31" cy="21" rx="22" ry="9" fill={c0} />
          <path d="M12 23 Q31 32 52 23 Q31 28 12 23Z" fill={c1} />
          <path d="M52 22 Q58 26 62 30 M52 23 Q56 28 57 33" stroke={c2} strokeWidth="1.4" fill="none" />
          <circle cx="47" cy="18" r="1.8" fill={eye} />
        </>
      );
      break;
    case "dolphin":
      body = (
        <>
          <path d="M6 20 Q30 6 54 18 L62 20 L54 22 Q30 30 6 20Z" fill={c0} />
          <path d="M12 22 Q32 28 52 22Z" fill={c1} />
          <path d="M28 13 L34 4 L36 13Z" fill={c2} />
          <path d="M8 20 L1 14 L3 20 L1 26Z" fill={c0} />
          <circle cx="50" cy="18" r="1.5" fill={eye} />
        </>
      );
      break;
    case "manta":
      body = (
        <>
          <path d="M32 8 L62 22 L40 26 L32 34 L24 26 L2 22 Z" fill={c0} />
          <path d="M30 8 L28 3 M34 8 L36 3" stroke={c0} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M32 34 L32 40" stroke={c0} strokeWidth="1.5" />
          <path d="M20 23 L44 23" stroke={c1} strokeWidth="1.2" opacity=".6" />
        </>
      );
      break;
    case "whale":
      body = (
        <>
          <path d="M8 20 Q24 8 50 12 Q62 16 60 22 Q52 30 24 28 Q12 26 8 20Z" fill={c0} />
          <path d="M22 26 Q44 30 58 22 Q44 26 22 26Z" fill={c1} />
          <path d="M9 20 L1 14 L4 20 L1 26Z" fill={c0} />
          <path d="M38 26 L32 34 L42 28Z" fill={c2} />
          <circle cx="52" cy="18" r="1.3" fill={eye} />
        </>
      );
      break;
    case "squid":
      body = (
        <>
          <path d="M4 20 L22 13 L22 27Z" fill={c0} />
          <ellipse cx="30" cy="20" rx="12" ry="7" fill={c0} />
          {[-6, -3, 0, 3, 6].map((d, i) => (
            <path key={i} d={`M40 ${20 + d / 2} Q50 ${20 + d} 62 ${20 + d * 1.6}`} stroke={c0} strokeWidth="2" fill="none" strokeLinecap="round" />
          ))}
          <circle cx="38" cy="18" r="2.5" fill={c2} />
          <circle cx="38.5" cy="18" r="1.3" fill={eye} />
        </>
      );
      break;
    case "isopod":
      body = (
        <>
          <ellipse cx="32" cy="22" rx="22" ry="11" fill={c0} />
          {[16, 22, 28, 34, 40, 46].map((x) => (
            <path key={x} d={`M${x} 12 L${x} 32`} stroke={c1} strokeWidth="1.3" opacity=".7" />
          ))}
          <path d="M54 18 Q62 10 63 6 M54 24 Q62 26 63 30" stroke={c2} strokeWidth="1.2" fill="none" />
          <circle cx="51" cy="18" r="2" fill={eye} />
        </>
      );
      break;
    case "angler":
      body = (
        <>
          <circle cx="30" cy="24" r="14" fill={c0} />
          <path d="M36 27 Q44 22 46 30 Q40 34 34 31Z" fill={c1} />
          <path d="M38 26 L40 30 L42 26 L44 30" stroke="#e8e4d8" strokeWidth="1" fill="none" />
          <path d="M30 10 Q40 2 46 8" stroke={c0} strokeWidth="1.5" fill="none" />
          <circle cx="47" cy="9" r="3" fill={c2} />
          <path d="M16 24 L8 18 L10 24 L8 30Z" fill={c0} />
          <circle cx="36" cy="19" r="2" fill={eye} />
        </>
      );
      break;
    default:
      body = (
        <>
          <path d="M12 20 L2 9 L4 20 L2 31 Z" fill={c2} />
          <ellipse cx="32" cy="20" rx="21" ry="11" fill={c0} />
          <path d="M14 23 Q32 34 52 23 Q32 29 14 23Z" fill={c1} opacity=".7" />
          <circle cx="45" cy="17" r="2.4" fill={eye} />
        </>
      );
  }

  return (
    <svg width={size} height={(size * 40) / 64} viewBox="0 0 64 40" style={style} aria-hidden>
      {body}
    </svg>
  );
}
