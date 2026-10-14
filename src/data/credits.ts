// Third-party assets and their licenses. Every external model, sound or font
// must be listed here (CC0 or CC-BY only), and shows up in Settings → Credits.

export interface Credit {
  what: string;
  author: string;
  license: string;
  url?: string;
}

export const CREDITS: Credit[] = [
  {
    what: "Nunito typeface",
    author: "Vernon Adams, Cyreal, Jacques Le Bailly",
    license: "SIL Open Font License 1.1",
    url: "https://fonts.google.com/specimen/Nunito",
  },
  {
    what: "three.js, React Three Fiber, drei, @react-three/postprocessing",
    author: "three.js authors, Poimandres",
    license: "MIT",
  },
  {
    what: "postprocessing (bloom in the Deep Sea)",
    author: "Raoul van Rüschen",
    license: "Zlib",
    url: "https://github.com/pmndrs/postprocessing",
  },
  {
    what: "React, Zustand, Tailwind CSS, Vite",
    author: "Meta and contributors, Poimandres, Tailwind Labs, Vite team",
    license: "MIT",
  },
];

/** All creatures and decorations are procedural low poly models built in code. */
export const ALL_MODELS_PROCEDURAL = true;
