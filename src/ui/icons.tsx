import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 22) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function PearlIcon({ size = 22, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden {...p}>
      <defs>
        <radialGradient id="pearl-g" cx="38%" cy="34%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".45" stopColor="#fbe6ee" />
          <stop offset="1" stopColor="#d9b3c4" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="url(#pearl-g)" stroke="#c99aae" strokeWidth="2" />
      <ellipse cx="24" cy="22" rx="7" ry="4.5" fill="#fff" opacity=".9" transform="rotate(-30 24 22)" />
    </svg>
  );
}

export const ShopIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);

export const BrushIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 21c-4 0-6-2-6-5 0-4 6-6 6-13 0 7 6 9 6 13 0 3-2 5-6 5z" />
    <path d="M9 16c0 1.5 1.3 2.5 3 2.5" />
  </svg>
);

export const BookIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15z" />
    <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
  </svg>
);

export const GlobeIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="6" width="7" height="7" rx="2" />
    <rect x="14" y="6" width="7" height="7" rx="2" />
    <rect x="8.5" y="15" width="7" height="7" rx="2" />
  </svg>
);

export const GearIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const FoodIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M7 4h10l-1 4H8L7 4z" />
    <path d="M8 8c0 6 1 9 4 12 3-3 4-6 4-12" />
    <circle cx="10" cy="12" r=".6" fill="currentColor" />
    <circle cx="13.5" cy="14" r=".6" fill="currentColor" />
  </svg>
);

export const EggIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3c3.5 0 6.5 5.2 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8.2 8.5 3 12 3z" />
    <path d="M9 14l1.5-1.5L12 14l1.5-1.5L15 14" />
  </svg>
);

export const CloseIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const RotateIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </svg>
);

export const TrashIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

export const LockIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const SparkleIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
  </svg>
);

export const HeartIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </svg>
);

export const SpaceIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
  </svg>
);
