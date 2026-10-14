// Aquarium background posters, drawn procedurally on a small canvas in a flat,
// low-poly illustrated style. No image files; cached per id.
import * as THREE from "three";
import { rng } from "./models/geo";

const W = 512;
const H = 256;
const cache = new Map<string, THREE.CanvasTexture>();

type Ctx = CanvasRenderingContext2D;

function gradient(c: Ctx, stops: [number, string][]) {
  const g = c.createLinearGradient(0, 0, 0, H);
  for (const [t, col] of stops) g.addColorStop(t, col);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

function poly(c: Ctx, pts: [number, number][], fill: string) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) c.lineTo(x, y);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}

/** A jagged ridge of triangles across the canvas: low-poly rocks. */
function ridge(c: Ctx, r: () => number, base: number, height: number, colors: string[]) {
  let x = -20;
  while (x < W + 20) {
    const w = 30 + r() * 60;
    const top = base - height * (0.4 + r() * 0.6);
    poly(c, [[x, H], [x + w * (0.3 + r() * 0.4), top], [x + w, H]], colors[Math.floor(r() * colors.length)]);
    poly(c, [[x + w * 0.5, H], [x + w * (0.7 + r() * 0.3), top + height * 0.25], [x + w * 1.3, H]], colors[Math.floor(r() * colors.length)]);
    x += w * 0.8;
  }
}

function draw(id: string, c: Ctx) {
  const r = rng(id.length * 97 + id.charCodeAt(0));
  switch (id) {
    case "black":
      gradient(c, [[0, "#1a1d22"], [1, "#07080a"]]);
      break;
    case "blue":
      gradient(c, [[0, "#9adcff"], [0.55, "#2f86c8"], [1, "#0b2f55"]]);
      break;
    case "cliff":
      gradient(c, [[0, "#9fc4d2"], [1, "#4f7484"]]);
      ridge(c, r, H * 0.75, H * 0.75, ["#7a8890", "#8e9ca4", "#6a7880"]);
      ridge(c, r, H * 0.95, H * 0.55, ["#56646c", "#64727a", "#4a565e"]);
      break;
    case "jungle": {
      gradient(c, [[0, "#3e6e3a"], [1, "#1c3a20"]]);
      for (let i = 0; i < 160; i++) {
        const x = r() * W;
        const y = H * 0.15 + r() * H;
        c.save();
        c.translate(x, y);
        c.rotate((r() - 0.5) * 1.6);
        c.beginPath();
        c.ellipse(0, 0, 6 + r() * 6, 18 + r() * 22, 0, 0, Math.PI * 2);
        c.fillStyle = ["#5f9e4a", "#4a8a3a", "#7ab85a", "#3a7030"][Math.floor(r() * 4)];
        c.fill();
        c.restore();
      }
      break;
    }
    case "coral": {
      gradient(c, [[0, "#5fd0e0"], [1, "#1f7a8c"]]);
      const cols = ["#ff7b6b", "#ffb04a", "#c86ad8", "#ff9ab8", "#5fbf8f", "#ffd166"];
      for (let i = 0; i < 70; i++) {
        const x = r() * W;
        const y = H * 0.35 + r() * H * 0.75;
        const rad = 8 + r() * 22;
        c.beginPath();
        c.arc(x, y, rad, 0, Math.PI * 2);
        c.fillStyle = cols[Math.floor(r() * cols.length)];
        c.fill();
      }
      for (let i = 0; i < 30; i++) {
        const x = r() * W;
        c.strokeStyle = cols[Math.floor(r() * cols.length)];
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(x, H);
        c.lineTo(x + (r() - 0.5) * 30, H * 0.45 + r() * 50);
        c.stroke();
      }
      break;
    }
    case "ruins": {
      gradient(c, [[0, "#6ab8c4"], [1, "#24606e"]]);
      ridge(c, r, H, H * 0.25, ["#b8a888", "#a8987a"]);
      for (let i = 0; i < 7; i++) {
        const x = 30 + i * 70 + r() * 20;
        const tall = H * (0.35 + r() * 0.45);
        const broken = r() < 0.4;
        c.fillStyle = "#cfc2a2";
        c.fillRect(x, H - tall, 22, tall);
        c.fillStyle = "#a89a7a";
        for (let k = 0; k < 3; k++) c.fillRect(x + 4 + k * 6, H - tall + 6, 2, tall - 10);
        if (!broken) {
          c.fillStyle = "#d8ccae";
          c.fillRect(x - 6, H - tall - 8, 34, 9);
        } else poly(c, [[x, H - tall], [x + 22, H - tall], [x + 12, H - tall - 12]], "#cfc2a2");
      }
      c.strokeStyle = "#c2b494";
      c.lineWidth = 10;
      c.beginPath();
      c.arc(W * 0.62, H * 0.62, 60, Math.PI, 0);
      c.stroke();
      break;
    }
    case "stars": {
      gradient(c, [[0, "#0a1230"], [1, "#1c2a50"]]);
      for (let i = 0; i < 220; i++) {
        c.fillStyle = `rgba(255,255,${200 + Math.floor(r() * 55)},${0.4 + r() * 0.6})`;
        const s = r() < 0.06 ? 2.4 : 1.2;
        c.fillRect(r() * W, r() * H, s, s);
      }
      c.beginPath();
      c.arc(W * 0.8, H * 0.22, 16, 0, Math.PI * 2);
      c.fillStyle = "#fff6d8";
      c.fill();
      break;
    }
    case "driftwood": {
      gradient(c, [[0, "#a8ccc4"], [1, "#4f7a72"]]);
      for (let i = 0; i < 14; i++) {
        c.strokeStyle = ["#6e5232", "#5a4028", "#84643e"][Math.floor(r() * 3)];
        c.lineWidth = 4 + r() * 8;
        c.lineCap = "round";
        c.beginPath();
        const x = r() * W;
        c.moveTo(x, H + 10);
        c.bezierCurveTo(x + (r() - 0.5) * 120, H * 0.6, x + (r() - 0.5) * 160, H * 0.4, x + (r() - 0.5) * 200, H * (0.05 + r() * 0.3));
        c.stroke();
      }
      break;
    }
    case "abyss": {
      gradient(c, [[0, "#0a1830"], [1, "#010308"]]);
      for (let i = 0; i < 90; i++) {
        const x = r() * W;
        const y = r() * H;
        const g = c.createRadialGradient(x, y, 0, x, y, 5);
        const col = r() < 0.5 ? "61,245,208" : "143,211,255";
        g.addColorStop(0, `rgba(${col},0.95)`);
        g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g;
        c.fillRect(x - 5, y - 5, 10, 10);
      }
      break;
    }
    default:
      gradient(c, [[0, "#444"], [1, "#222"]]);
  }
}

export function backgroundTexture(id: string) {
  const hit = cache.get(id);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  draw(id, canvas.getContext("2d")!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  cache.set(id, tex);
  return tex;
}
