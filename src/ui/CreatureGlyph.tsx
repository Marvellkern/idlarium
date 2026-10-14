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
  | "angler"
  | "crab"
  | "hermit"
  | "star"
  | "slug"
  | "seal"
  | "ray"
  | "otter"
  | "penguin"
  | "shrimp"
  | "angel";

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
  "hermit-crab": "hermit",
  "ochre-sea-star": "star",
  "shore-crab": "crab",
  nudibranch: "slug",
  "sea-hare": "slug",
  "harbor-seal": "seal",
  "giant-pacific-octopus": "octopus",
  "red-bellied-piranha": "tall",
  discus: "tall",
  "freshwater-angelfish": "tall",
  "silver-arowana": "long",
  "motoro-stingray": "ray",
  "redtail-catfish": "catfish",
  "mata-mata": "turtle",
  arapaima: "long",
  "giant-otter": "otter",
  "amazon-river-dolphin": "dolphin",
  garibaldi: "tall",
  "purple-sea-urchin": "puffer",
  "kelp-crab": "crab",
  "sunflower-sea-star": "star",
  "bat-ray": "manta",
  "leopard-shark": "shark",
  "california-sea-lion": "seal",
  "sea-otter": "otter",
  "gray-whale": "whale",
  "sea-angel": "angel",
  "antarctic-krill": "shrimp",
  "ringed-seal": "seal",
  "emperor-penguin": "penguin",
  walrus: "seal",
  beluga: "whale",
  "leopard-seal": "seal",
  narwhal: "whale",
  "greenland-shark": "shark",
  orca: "dolphin",
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
    case "crab":
      body = (
        <>
          {[-1, 1].map((sd) =>
            [0, 1, 2].map((i) => (
              <path key={`${sd}${i}`} d={`M${32 + sd * 12} ${22 + i * 2} L${32 + sd * (20 + i * 2)} ${18 + i * 3} L${32 + sd * (24 + i * 2)} ${30 + i * 2}`} stroke={c0} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            )),
          )}
          <path d="M22 18 L15 11 M42 18 L49 11" stroke={c0} strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="13" cy="9" rx="5" ry="4" fill={c0} />
          <ellipse cx="51" cy="9" rx="5" ry="4" fill={c0} />
          <ellipse cx="32" cy="22" rx="16" ry="9" fill={c0} />
          <path d="M18 25 Q32 32 46 25" stroke={c1} strokeWidth="2" fill="none" opacity=".7" />
          <path d="M28 14 L28 9 M36 14 L36 9" stroke={c0} strokeWidth="1.6" />
          <circle cx="28" cy="8.5" r="1.8" fill={eye} />
          <circle cx="36" cy="8.5" r="1.8" fill={eye} />
        </>
      );
      break;
    case "hermit":
      body = (
        <>
          <path d="M40 30 L36 36 M46 30 L46 36 M52 28 L56 34" stroke={c1} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="25" cy="20" r="14" fill={c0} />
          <path d="M25 20 m-8 0 a8 8 0 1 1 8 8 a5 5 0 1 1 -4 -6 a2.5 2.5 0 1 1 3 2" stroke={c2} strokeWidth="2" fill="none" />
          <ellipse cx="43" cy="25" rx="9" ry="6" fill={c1} />
          <ellipse cx="54" cy="23" rx="5" ry="4" fill={c1} />
          <path d="M44 19 L45 13" stroke={c1} strokeWidth="1.6" />
          <circle cx="45" cy="12.5" r="1.8" fill={eye} />
        </>
      );
      break;
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 7.5 : 18;
        return `${32 + Math.cos(a) * r},${21 + Math.sin(a) * r}`;
      }).join(" ");
      body = (
        <>
          <polygon points={pts} fill={c0} strokeLinejoin="round" stroke={c0} strokeWidth="2" />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
            return <circle key={i} cx={32 + Math.cos(a) * 9} cy={21 + Math.sin(a) * 9} r="1.6" fill={c2} />;
          })}
        </>
      );
      break;
    }
    case "slug":
      body = (
        <>
          <path d="M4 30 Q8 22 22 22 L46 20 Q58 20 60 30 Z" fill={c0} />
          {[14, 21, 28, 35, 42].map((x, i) => (
            <path key={x} d={`M${x - 3} 23 L${x} ${12 + (i % 2) * 3} L${x + 3} 23Z`} fill={c2} />
          ))}
          <path d="M8 29 L56 29" stroke={c1} strokeWidth="2" opacity=".8" />
          <path d="M50 21 L53 12 M54 22 L58 14" stroke={c2} strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
      break;
    case "seal":
      body = (
        <>
          <path d="M3 18 L10 22 L3 27Z" fill={c0} />
          <path d="M8 22 Q20 10 42 13 Q58 15 60 21 Q57 28 32 28 Q14 28 8 22Z" fill={c0} />
          <path d="M16 25 Q34 30 54 24 Q36 27 16 25Z" fill={c1} />
          <path d="M36 25 L30 33 L40 27Z" fill={c0} />
          <circle cx="52" cy="18" r="1.6" fill={eye} />
          <circle cx="59.5" cy="20.5" r="1.2" fill={eye} />
          {[20, 27, 34, 41].map((x) => (
            <circle key={x} cx={x} cy={17 + (x % 3)} r="1.1" fill={c2} opacity=".7" />
          ))}
        </>
      );
      break;
    case "ray":
      body = (
        <>
          <path d="M14 21 Q6 22 1 26" stroke={c0} strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="34" cy="20" rx="20" ry="14" fill={c0} />
          {[[26, 14], [36, 26], [42, 13], [24, 25], [33, 19]].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="2.2" fill={c2} />
          ))}
          <circle cx="46" cy="16" r="1.5" fill={eye} />
          <circle cx="46" cy="24" r="1.5" fill={eye} />
        </>
      );
      break;
    case "otter":
      body = (
        <>
          <path d="M12 23 Q4 22 1 27 Q8 28 14 26Z" fill={c0} />
          <path d="M10 24 Q22 13 42 15 Q56 16 60 21 Q55 28 34 28 Q18 28 10 24Z" fill={c0} />
          <path d="M44 23 Q52 27 58 22 Q52 25 44 23Z" fill={c1} />
          <path d="M26 27 L24 33 M38 27 L40 33" stroke={c2} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="15" r="2" fill={c0} />
          <circle cx="54" cy="18" r="1.4" fill={eye} />
          <circle cx="60" cy="20.5" r="1.2" fill={eye} />
        </>
      );
      break;
    case "penguin":
      body = (
        <>
          <path d="M6 22 Q16 12 36 13 Q50 14 56 19 Q50 27 32 28 Q14 28 6 22Z" fill={c0} />
          <path d="M12 24 Q30 31 52 23 Q32 27 12 24Z" fill={c1} />
          <path d="M55 18 L63 20 L55 21Z" fill="#e8743a" />
          <ellipse cx="47" cy="17" rx="3" ry="2" fill={c2} />
          <path d="M30 20 L22 30 L34 23Z" fill={c0} />
          <circle cx="51" cy="16.5" r="1.3" fill={eye} />
        </>
      );
      break;
    case "shrimp":
      body = (
        <>
          <path d="M8 22 Q20 12 40 16 Q52 18 56 22 Q44 26 26 26 Q14 26 8 22Z" fill={c0} />
          {[18, 24, 30, 36, 42].map((x) => (
            <path key={x} d={`M${x} 15 L${x} 26`} stroke={c1} strokeWidth="1.2" opacity=".7" />
          ))}
          {[22, 28, 34, 40].map((x) => (
            <path key={x} d={`M${x} 26 L${x + 1} 32`} stroke={c2} strokeWidth="1.2" />
          ))}
          <path d="M8 22 L1 17 L3 22 L1 27Z" fill={c0} />
          <path d="M54 20 Q60 12 63 8 M55 22 Q61 18 63 15" stroke={c2} strokeWidth="1" fill="none" />
          <circle cx="51" cy="19" r="2" fill={eye} />
        </>
      );
      break;
    case "angel":
      body = (
        <>
          <ellipse cx="32" cy="22" rx="7" ry="15" fill={c0} opacity=".85" />
          <ellipse cx="32" cy="26" rx="3.5" ry="6" fill={c1} />
          <path d="M26 14 Q12 6 10 14 Q14 20 26 18Z M38 14 Q52 6 54 14 Q50 20 38 18Z" fill={c2} opacity=".9" />
          <circle cx="32" cy="9" r="4" fill={c0} />
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
