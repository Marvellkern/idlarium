// The aquarium itself: frame rim, background poster, clip-on lamp, the algae film
// on the glass (and wiping it), and the equipment props. Only the active habitat
// renders this. Everything follows the tank's drawn size, so it grows with expansions.
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES, type BiomeId } from "../data/biomes";
import { BACKGROUNDS, FRAMES, LAMPS, SNAIL_HABITATS, TANK, type FrameDef, type LampDef } from "../data/equipment";
import { algaeLevel } from "../state/economy";
import { useGame } from "../state/gameStore";
import { finishWipe, toggleLamp } from "../state/tankLogic";
import { useUI } from "../state/uiStore";
import { play } from "../utils/audio";
import { daylight } from "../utils/time";
import { backgroundTexture } from "./backgrounds";
import { terrainHeight, type Dims } from "./layout";
import { glow, ico, paint, tube, type V3 } from "./models/geo";
import { airPumpModel, airStoneModel, feederModel, filterModel, LAMP_ANGLE, LAMP_HEAD, lampModel, scraperBotModel, snailModel } from "./models/tankModels";
import { habitatCtx, sceneTime, tankCtx } from "./registry";

/** Equipment scale: props grow a little with bigger tanks. */
const propScale = (d: Dims) => THREE.MathUtils.clamp(Math.sqrt(d.w / 6), 0.9, 1.8);

export function Tank({ biome, dims, high }: { biome: BiomeId; dims: Dims; high: boolean }) {
  const style = useGame((s) => s.habitats[biome]?.style);
  const equipment = useGame((s) => s.habitats[biome]?.equipment);
  const preview = useUI((s) => s.stylePreview);
  const propMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 }), []);
  useEffect(() => () => propMat.dispose(), [propMat]);
  if (!style || !equipment) return null;

  // A style item being previewed in the Tank panel shows on the tank right away.
  const lampId = preview?.kind === "lamp" ? preview.id : style.lampId;
  const backgroundId = preview?.kind === "background" ? preview.id : style.backgroundId;
  const frameId = preview?.kind === "frame" ? preview.id : style.frameId;
  const lamp = LAMPS.find((l) => l.id === lampId) ?? LAMPS[0];
  const frame = FRAMES.find((f) => f.id === frameId) ?? FRAMES[0];
  const floorless = !!BIOMES[biome].floorless;

  return (
    <group>
      <Rim frame={frame} floorless={floorless} />
      {backgroundId !== "none" && BACKGROUNDS.some((b) => b.id === backgroundId) && <Backdrop id={backgroundId} />}
      <Lamp key={lamp.id} biome={biome} lamp={lamp} dims={dims} high={high} forceOn={preview?.kind === "lamp"} />
      <Algae biome={biome} />
      {equipment.filter && <Filter dims={dims} mat={propMat} />}
      {equipment.airPump && <AirPump biome={biome} dims={dims} mat={propMat} high={high} />}
      {equipment.autoFeeder && <Feeder dims={dims} mat={propMat} />}
      {equipment.cleaner && (SNAIL_HABITATS.includes(biome) ? <Snail dims={dims} mat={propMat} /> : <ScraperBot dims={dims} mat={propMat} />)}
    </group>
  );
}

// ───────────── Frame rim ─────────────

const unitBox = new THREE.BoxGeometry(1, 1, 1);

function Rim({ frame, floorless }: { frame: FrameDef; floorless: boolean }) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: frame.color, metalness: frame.metalness, roughness: frame.roughness, flatShading: true }),
    [frame],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const { w, h, d, soil } = tankCtx;
    const t = 0.045 + Math.min(w, d) * 0.004;
    const tall = t * 1.6;
    const bottom = floorless ? 0 : -soil;
    // Top rim straddles the glass edge; the bottom rim wraps the base.
    [h, bottom + tall * 0.35].forEach((y, row) => {
      const parts: [number, number, number, number, number, number][] = [
        [0, y, d / 2 + t / 2, w + 2 * t, tall, t],
        [0, y, -d / 2 - t / 2, w + 2 * t, tall, t],
        [-w / 2 - t / 2, y, 0, t, tall, d],
        [w / 2 + t / 2, y, 0, t, tall, d],
      ];
      parts.forEach(([x, yy, z, sx, sy, sz], i) => {
        const m = refs.current[row * 4 + i];
        if (!m) return;
        m.position.set(x, yy, z);
        m.scale.set(sx, sy, sz);
      });
    });
  });
  if (frame.frameless) return null;
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
          geometry={unitBox}
          material={mat}
          receiveShadow
        />
      ))}
    </group>
  );
}

// ───────────── Background poster ─────────────

const unitPlane = new THREE.PlaneGeometry(1, 1);

function Backdrop({ id }: { id: string }) {
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ map: backgroundTexture(id) }), [id]);
  useEffect(() => () => mat.dispose(), [mat]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const { w, h, d } = tankCtx;
    // Stuck to the outside of the back glass, covering the water.
    m.position.set(0, h / 2, -d / 2 - 0.035);
    m.scale.set(w, h, 1);
  });
  return <mesh ref={ref} geometry={unitPlane} material={mat} renderOrder={0} />;
}

// ───────────── Lamp ─────────────

const beamVert = /* glsl */ `
  varying float vT;
  void main() {
    vT = -position.y; // 0 at the lamp, 1 at the far end
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const beamFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying float vT;
  void main() {
    float a = uStrength * pow(1.0 - clamp(vT, 0.0, 1.0), 1.6);
    gl_FragColor = vec4(uColor, a);
  }`;

const coneGeo = (() => {
  const g = new THREE.ConeGeometry(1, 1, 24, 1, true);
  g.translate(0, -0.5, 0); // apex at the origin, opening downward
  return g;
})();
const down = new THREE.Vector3(0, -1, 0);
const tmpV = new THREE.Vector3();
const tmpC = new THREE.Color();

/** Is the lamp on right now? (Schedule: on by day, off at night, on the real clock.) */
function lampIsOn(style: { lampOn: boolean; lampAuto: boolean }) {
  return style.lampAuto ? daylight() > 0.5 : style.lampOn;
}

function Lamp({ biome, lamp, dims, high, forceOn }: { biome: BiomeId; lamp: LampDef; dims: Dims; high: boolean; forceOn: boolean }) {
  const model = useMemo(() => lampModel(lamp.look, "#ffffff"), [lamp.look]);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.5, metalness: lamp.look === "brass" ? 0.4 : 0.1 }), [lamp.look]);
  const lensMat = useMemo(() => new THREE.MeshBasicMaterial({ color: lamp.color, toneMapped: false }), [lamp.color]);
  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(lamp.color) }, uStrength: { value: lamp.beam } },
        vertexShader: beamVert,
        fragmentShader: beamFrag,
      }),
    [lamp.color, lamp.beam],
  );
  // One real light per tank. It's always there (intensity 0 when off), so switching
  // never recompiles materials.
  const spot = useMemo(() => {
    const s = new THREE.SpotLight(lamp.color, 0, 0, LAMP_ANGLE[lamp.look], 0.7, 0);
    return s;
  }, [lamp.color, lamp.look]);
  useEffect(
    () => () => {
      [model.body, model.lens].forEach((g) => g.dispose());
      [bodyMat, lensMat, beamMat].forEach((m) => m.dispose());
      spot.dispose();
      tankCtx.lampOn = true;
      tankCtx.lampTint = 0;
    },
    [model, bodyMat, lensMat, beamMat, spot],
  );

  const group = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const h = useGame.getState().habitats[biome];
    const on = forceOn || (h ? lampIsOn(h.style) : true);
    const k = propScale(dims);
    const { w, h: top, d } = tankCtx;
    // Where it mounts and where the light comes from.
    const mount: V3 =
      lamp.look === "bar" ? [0, top, -d * 0.12] : lamp.look === "pendant" ? [0, top + 1.8 * k, 0] : [w * 0.22, top, -d / 2];
    const head = LAMP_HEAD[lamp.look];
    const hx = mount[0] + head[0] * k;
    const hy = mount[1] + head[1] * k;
    const hz = mount[2] + head[2] * k;
    const g = group.current;
    if (g) {
      g.position.set(mount[0], mount[1], mount[2]);
      if (lamp.look === "bar") g.scale.set(w + 0.1, k, k);
      else g.scale.setScalar(k);
    }
    // Party lamp: drift through the hues.
    if (lamp.cycle) tmpC.setHSL((sceneTime.value * 0.05) % 1, 0.8, 0.65);
    else tmpC.set(lamp.color);
    lensMat.color.copy(on ? tmpC : tmpC.clone().multiplyScalar(0.25));
    spot.color.copy(tmpC);
    spot.intensity = on ? lamp.intensity : 0;
    spot.position.set(hx, hy, hz);
    const tx = hx * 0.5;
    spot.target.position.set(tx, 0, lamp.look === "clip" || lamp.look === "hood" || lamp.look === "party" || lamp.look === "brass" ? hz * 0.3 : hz);
    spot.target.updateMatrixWorld();
    // Shared with lighting (tint, moody when off) and creatures (night owls come out).
    tankCtx.lampOn = on;
    tankCtx.lampColor.copy(tmpC);
    tankCtx.lampTint = on ? lamp.tint : 0;
    // The soft beam: a cone from the lamp to the floor.
    const b = beam.current;
    if (b) {
      b.visible = on && high;
      if (b.visible) {
        tmpV.set(tx - hx, -hy, spot.target.position.z - hz);
        const len = tmpV.length();
        b.position.set(hx, hy, hz);
        b.quaternion.setFromUnitVectors(down, tmpV.normalize());
        const r = len * Math.tan(LAMP_ANGLE[lamp.look]) * 0.75;
        b.scale.set(lamp.look === "bar" ? w * 0.5 : r, len, lamp.look === "bar" ? Math.max(r * 0.5, d * 0.25) : r);
        beamMat.uniforms.uColor.value.copy(tmpC);
        beamMat.uniforms.uStrength.value = lamp.beam * (0.6 + 0.4 * habitatCtx.daylight) * (1 - habitatCtx.rain * 0.4);
      }
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (useUI.getState().wipingSince !== null || forceOn) return;
    const h = useGame.getState().habitats[biome];
    if (!h) return;
    const next = !lampIsOn(h.style);
    toggleLamp(biome, next);
    useUI.getState().toast(next ? "Lamp on." : "Lamp off. The night owls are stirring.");
  };

  return (
    <group>
      <group ref={group} onClick={onClick}>
        <mesh geometry={model.body} material={bodyMat} />
        <mesh geometry={model.lens} material={lensMat} />
      </group>
      <primitive object={spot} />
      <primitive object={spot.target} />
      <mesh ref={beam} geometry={coneGeo} material={beamMat} renderOrder={6} visible={false} />
    </group>
  );
}

// ───────────── Algae on the glass, and wiping it ─────────────

const MASK = 128;
/** Edge pixels near the frame don't count toward "clean enough" (corners are fiddly to reach). */
const EDGE = Math.round(MASK * 0.05);
const INNER = (MASK - 2 * EDGE) * (MASK - 2 * EDGE);
const inner = (x: number, y: number) => x >= EDGE && x < MASK - EDGE && y >= EDGE && y < MASK - EDGE;
type PaneId = "front" | "back" | "left" | "right";
const PANES: PaneId[] = ["front", "back", "left", "right"];

const algaeVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const algaeFrag = /* glsl */ `
  uniform float uLevel;
  uniform sampler2D uMask;
  uniform vec2 uSize;
  uniform vec3 uColor;
  uniform float uSeed;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    vec2 p = vUv * uSize * 1.4;
    float n = noise(p) * 0.6 + noise(p * 3.1) * 0.3 + noise(p * 8.7) * 0.1;
    // Patches spread out as the level rises; a bit thicker toward the bottom; tiny specks.
    float patches = smoothstep(1.0 - uLevel * 1.2, 1.25 - uLevel * 1.2, n);
    float speck = step(0.86, noise(p * 13.0)) * 0.18;
    float a = uLevel * (0.22 + 0.45 * patches) * (1.0 + (1.0 - vUv.y) * 0.35) + speck * uLevel;
    a *= 1.0 - texture2D(uMask, vUv).r;
    gl_FragColor = vec4(uColor * (0.75 + 0.45 * n), clamp(a, 0.0, 0.6));
  }`;

interface Pane {
  id: PaneId;
  data: Uint8Array;
  tex: THREE.DataTexture;
  mat: THREE.ShaderMaterial;
  cleaned: number;
}

const noRaycast = () => {};

function Algae({ biome }: { biome: BiomeId }) {
  const wipingSince = useUI((s) => s.wipingSince);
  const wiping = wipingSince !== null;
  const lastCleaned = useGame((s) => s.habitats[biome]?.algae.lastCleanedAt ?? 0);
  const camera = useThree((s) => s.camera);
  const panes = useMemo<Pane[]>(
    () =>
      PANES.map((id, i) => {
        const data = new Uint8Array(MASK * MASK);
        const tex = new THREE.DataTexture(data, MASK, MASK, THREE.RedFormat, THREE.UnsignedByteType);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        const mat = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          uniforms: { uLevel: { value: 0 }, uMask: { value: tex }, uSize: { value: new THREE.Vector2(1, 1) }, uColor: { value: new THREE.Color("#7fa84a") }, uSeed: { value: i * 3.7 } },
          vertexShader: algaeVert,
          fragmentShader: algaeFrag,
        });
        return { id, data, tex, mat, cleaned: 0 };
      }),
    [],
  );
  useEffect(() => () => panes.forEach((p) => (p.tex.dispose(), p.mat.dispose())), [panes]);

  // A fresh clean (or a new habitat): start with an unwiped mask.
  useEffect(() => {
    for (const p of panes) {
      p.data.fill(0);
      p.cleaned = 0;
      p.tex.needsUpdate = true;
    }
  }, [lastCleaned, panes]);

  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const sizes = useRef(PANES.map(() => ({ w: 1, h: 1 })));
  const facing = useRef<boolean[]>([true, false, false, false]);
  const dragging = useRef(false);
  const lastSqueak = useRef(0);
  const done = useRef(false);
  const sparkles = useRef<Sparkles | null>(null);

  // Wipe mode: the glass catches pointer events (and blocks taps on creatures);
  // otherwise it's invisible to the pointer. Work out which panes face the camera.
  useEffect(() => {
    meshes.current.forEach((m) => {
      if (m) m.raycast = wiping ? THREE.Mesh.prototype.raycast : noRaycast;
    });
    done.current = false;
    if (!wiping) return;
    const { w, d } = tankCtx;
    const centers: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(0, 0, d / 2), new THREE.Vector3(0, 0, 1)],
      [new THREE.Vector3(0, 0, -d / 2), new THREE.Vector3(0, 0, -1)],
      [new THREE.Vector3(-w / 2, 0, 0), new THREE.Vector3(-1, 0, 0)],
      [new THREE.Vector3(w / 2, 0, 0), new THREE.Vector3(1, 0, 0)],
    ];
    facing.current = centers.map(([c, n]) => tmpV.copy(camera.position).sub(c).dot(n) > 0.3 * camera.position.distanceTo(c));
    if (!facing.current.some(Boolean)) facing.current[0] = true;
    const up = () => (dragging.current = false);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      dragging.current = false;
    };
  }, [wiping, camera]);

  useFrame(() => {
    const h = useGame.getState().habitats[biome];
    const level = h ? algaeLevel(h, Date.now()) : 0;
    const { w, h: top, d } = tankCtx;
    const off = 0.012;
    const place: [number, number, number, number, number][] = [
      [0, d / 2 + off, 0, w, 1],
      [0, -d / 2 - off, Math.PI, w, 1],
      [-w / 2 - off, 0, -Math.PI / 2, d, 0],
      [w / 2 + off, 0, Math.PI / 2, d, 0],
    ];
    panes.forEach((p, i) => {
      const m = meshes.current[i];
      const [a, b, rot, size, front] = place[i];
      if (m) {
        if (front) m.position.set(0, top / 2, a + b);
        else m.position.set(a, top / 2, 0);
        m.rotation.y = rot;
        m.scale.set(size, top, 1);
        m.visible = level > 0.01;
      }
      sizes.current[i] = { w: size, h: top };
      p.mat.uniforms.uLevel.value = level;
      p.mat.uniforms.uSize.value.set(size, top);
    });
  });

  /** One soft brush dab at mask coordinates (cx, cy). */
  const dab = (p: Pane, cx: number, cy: number, ru: number, rv: number) => {
    const x0 = Math.max(0, Math.floor(cx - ru));
    const x1 = Math.min(MASK - 1, Math.ceil(cx + ru));
    const y0 = Math.max(0, Math.floor(cy - rv));
    const y1 = Math.min(MASK - 1, Math.ceil(cy + rv));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dist = Math.hypot((x - cx) / ru, (y - cy) / rv);
        if (dist > 1) continue;
        const v = Math.round(255 * Math.min(1, (1 - dist) * 2.2));
        const idx = y * MASK + x;
        const old = p.data[idx];
        if (v > old) {
          if (old < 128 && v >= 128 && inner(x, y)) p.cleaned++;
          p.data[idx] = v;
        }
      }
  };

  const last = useRef<{ pane: number; x: number; y: number } | null>(null);

  const paint = (pane: number, uv: THREE.Vector2, point: THREE.Vector3) => {
    const p = panes[pane];
    const { w: pw, h: ph } = sizes.current[pane];
    const r = 0.55 * propScale({ w: tankCtx.w, h: tankCtx.h, d: tankCtx.d, soil: 0 });
    const ru = (r / pw) * MASK;
    const rv = (r / ph) * MASK;
    const cx = uv.x * MASK;
    const cy = uv.y * MASK;
    // Fill in the stroke between pointer events, so fast swipes leave a line, not dots.
    const prev = last.current;
    if (prev && prev.pane === pane) {
      const steps = Math.ceil(Math.hypot((cx - prev.x) / ru, (cy - prev.y) / rv) / 0.4);
      for (let i = 1; i < steps; i++) dab(p, prev.x + ((cx - prev.x) * i) / steps, prev.y + ((cy - prev.y) * i) / steps, ru, rv);
    }
    dab(p, cx, cy, ru, rv);
    last.current = { pane, x: cx, y: cy };
    p.tex.needsUpdate = true;
    sparkles.current?.spawn(point, 2);
    const now = performance.now();
    if (now - lastSqueak.current > 160) {
      lastSqueak.current = now;
      play("squeak");
    }
    // Done when ~90% of the glass facing the camera is clean (weighted by pane size).
    let clean = 0;
    let total = 0;
    panes.forEach((q, i) => {
      if (!facing.current[i]) return;
      const area = sizes.current[i].w * sizes.current[i].h;
      clean += (q.cleaned / INNER) * area;
      total += area;
    });
    if (!done.current && total > 0 && clean / total >= TANK.wipeDone) {
      done.current = true;
      finishWipe(biome);
    }
  };

  const handler = (i: number, start: boolean) => (e: ThreeEvent<PointerEvent>) => {
    if (useUI.getState().wipingSince === null) return;
    e.stopPropagation();
    if (start) {
      dragging.current = true;
      last.current = null;
    }
    if (!dragging.current || !e.uv) return;
    paint(i, e.uv, e.point);
  };

  return (
    <group>
      {panes.map((p, i) => (
        <mesh
          key={p.id}
          ref={(m) => {
            meshes.current[i] = m;
            if (m && !wiping) m.raycast = noRaycast;
          }}
          geometry={unitPlane}
          material={p.mat}
          renderOrder={7}
          onPointerDown={handler(i, true)}
          onPointerMove={handler(i, false)}
        />
      ))}
      <SparklePool api={sparkles} />
    </group>
  );
}

// ───────────── Sparkles (wiping, and the burst when the glass is clean) ─────────────

interface Sparkles {
  spawn(at: THREE.Vector3, n: number): void;
}

const SPARKS = 48;
const sparkGeo = glow(paint(ico(1, 0), "#ffffff"), 1);

function SparklePool({ api }: { api: React.RefObject<Sparkles | null> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#fffbe0", transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const pool = useMemo(() => Array.from({ length: SPARKS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 })), []);
  const next = useRef(0);
  const burstAt = useUI((s) => s.cleanBurstAt);
  useEffect(() => {
    api.current = {
      spawn(at, n) {
        for (let i = 0; i < n; i++) {
          const s = pool[next.current++ % SPARKS];
          s.p.copy(at).add(tmpV.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.05));
          s.v.set((Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.5, 0.2);
          s.life = 0.7;
        }
      },
    };
    return () => {
      api.current = null;
    };
  }, [api, pool]);
  // Clean glass: a sparkle burst all over the front pane.
  useEffect(() => {
    if (!burstAt) return;
    const { w, h, d } = tankCtx;
    for (let i = 0; i < SPARKS; i++) {
      const s = pool[i];
      s.p.set((Math.random() - 0.5) * w, Math.random() * h, d / 2 + 0.05);
      s.v.set((Math.random() - 0.5) * 0.3, 0.2 + Math.random() * 0.4, 0.15);
      s.life = 0.6 + Math.random() * 0.8;
    }
  }, [burstAt, pool]);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  useFrame((_s, dtRaw) => {
    const im = mesh.current;
    if (!im) return;
    const dt = Math.min(dtRaw, 0.1);
    const size = 0.05 * propScale({ w: tankCtx.w, h: tankCtx.h, d: tankCtx.d, soil: 0 });
    let any = false;
    pool.forEach((s, i) => {
      if (s.life > 0) {
        s.life -= dt;
        s.p.addScaledVector(s.v, dt);
        any = true;
      }
      sc.setScalar(s.life > 0 ? size * Math.min(1, s.life * 2) : 0);
      m4.compose(s.p, q, sc);
      im.setMatrixAt(i, m4);
    });
    im.visible = any;
    im.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[sparkGeo, mat, SPARKS]} frustumCulled={false} renderOrder={8} visible={false} />;
}

// ───────────── Equipment props ─────────────

function Filter({ dims, mat }: { dims: Dims; mat: THREE.Material }) {
  const geo = useMemo(filterModel, []);
  const fallMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uTime; varying vec2 vUv;
          void main(){ float s = 0.55 + 0.45 * sin(vUv.y * 30.0 + uTime * 9.0 + sin(vUv.x * 12.0) * 2.0);
          gl_FragColor = vec4(vec3(0.85, 0.95, 1.0), 0.45 * s * smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x)); }`,
      }),
    [],
  );
  useEffect(() => () => (geo.dispose(), fallMat.dispose()), [geo, fallMat]);
  const k = propScale(dims);
  const g = useRef<THREE.Group>(null);
  const fall = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const { w, h, d } = tankCtx;
    g.current?.position.set(-w * 0.28, h, -d / 2);
    fallMat.uniforms.uTime.value = sceneTime.value;
    const f = fall.current;
    if (f) {
      // The little waterfall from the filter lip down to the water.
      const lip = h + 0.17 * k;
      const water = h * habitatCtx.waterLevel;
      f.position.set(-w * 0.28, (lip + water) / 2, -d / 2 + 0.17 * k);
      f.scale.set(0.3 * k, Math.max(0.02, lip - water), 1);
    }
  });
  return (
    <group>
      <group ref={g} scale={k}>
        <mesh geometry={geo} material={mat} />
      </group>
      <mesh ref={fall} geometry={unitPlane} material={fallMat} renderOrder={5} />
    </group>
  );
}

function AirPump({ biome, dims, mat, high }: { biome: BiomeId; dims: Dims; mat: THREE.Material; high: boolean }) {
  const k = propScale(dims);
  const floorless = !!BIOMES[biome].floorless;
  const { w, h, d } = dims;
  const stoneLen = Math.min(d * 0.35, 1.6 * k);
  const stone = useMemo(() => {
    const x = -w / 2 + 0.35 * k;
    const z = -d / 2 + 0.35 * k + stoneLen / 2;
    return new THREE.Vector3(x, floorless ? 0.35 : terrainHeight(biome, x, z, dims) + 0.06, z);
  }, [w, d, k, stoneLen, floorless, biome, dims]);
  const pumpGeo = useMemo(airPumpModel, []);
  const stoneGeo = useMemo(() => airStoneModel(stoneLen), [stoneLen]);
  // The air tube: from the pump, up over the rim and down to the stone.
  const tubeGeo = useMemo(() => {
    const px = -w / 2 - 0.55 * k;
    const pts: V3[] = [
      [px + 0.16 * k, 0.24 * k + (floorless ? 0 : -dims.soil), stone.z],
      [-w / 2 - 0.2 * k, h * 0.6, stone.z],
      [-w / 2, h + 0.3 * k, stone.z],
      [-w / 2 + 0.2 * k, h * 0.7, stone.z],
      [stone.x, stone.y + 0.05, stone.z],
    ];
    return paint(tube(pts, 0.025 * k, 5), "#d8eef4");
  }, [w, h, k, stone, floorless, dims.soil]);
  useEffect(() => () => (pumpGeo.dispose(), stoneGeo.dispose(), tubeGeo.dispose()), [pumpGeo, stoneGeo, tubeGeo]);

  const count = high ? 36 : 18;
  const bubbles = useMemo(() => Array.from({ length: count }, () => ({ z: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8, w: Math.random() * 10 })), [count]);
  const bubbleGeo = useMemo(() => new THREE.IcosahedronGeometry(0.035 * k, 0), [k]);
  const bubbleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#eaf8ff", transparent: true, opacity: 0.6, roughness: 0.1 }), []);
  useEffect(() => () => (bubbleGeo.dispose(), bubbleMat.dispose()), [bubbleGeo, bubbleMat]);
  const inst = useRef<THREE.InstancedMesh>(null);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useFrame((_s, dtRaw) => {
    const im = inst.current;
    if (!im) return;
    const dt = Math.min(dtRaw, 0.1);
    const top = h * habitatCtx.waterLevel - 0.05;
    const span = Math.max(0.1, top - stone.y);
    bubbles.forEach((b, i) => {
      b.y += (dt * b.s * 0.9) / span;
      if (b.y > 1) b.y -= 1;
      tmpV.set(stone.x + Math.sin(sceneTime.value * 3 + b.w) * 0.05, stone.y + b.y * span, stone.z - stoneLen / 2 + b.z * stoneLen);
      m4.compose(tmpV, q, one);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <mesh geometry={pumpGeo} material={mat} position={[-w / 2 - 0.55 * k, floorless ? 0 : -dims.soil, stone.z]} scale={k} />
      <mesh geometry={tubeGeo} material={mat} />
      <mesh geometry={stoneGeo} material={mat} position={stone} />
      <instancedMesh ref={inst} args={[bubbleGeo, bubbleMat, count]} frustumCulled={false} />
    </group>
  );
}

const FLAKES = 14;

function Feeder({ dims, mat }: { dims: Dims; mat: THREE.Material }) {
  const k = propScale(dims);
  const geo = useMemo(feederModel, []);
  const flakeGeo = useMemo(() => new THREE.BoxGeometry(0.04 * k, 0.008, 0.04 * k), [k]);
  const flakeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8843a", roughness: 0.8 }), []);
  useEffect(() => () => (geo.clip.dispose(), geo.drum.dispose(), flakeGeo.dispose(), flakeMat.dispose()), [geo, flakeGeo, flakeMat]);
  const group = useRef<THREE.Group>(null);
  const drum = useRef<THREE.Mesh>(null);
  const inst = useRef<THREE.InstancedMesh>(null);
  const flakes = useMemo(() => Array.from({ length: FLAKES }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, spin: Math.random() * 6 })), []);
  const nextDrop = useRef(4);
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useFrame((_s, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const { w, h, d } = tankCtx;
    const x = -w * 0.3;
    group.current?.position.set(x, h, d / 2);
    // Every so often the drum turns once and a few flakes drift down.
    nextDrop.current -= dt;
    const turning = nextDrop.current < 1;
    if (drum.current) drum.current.rotation.x = turning ? (1 - Math.max(0, nextDrop.current)) * Math.PI * 2 : 0;
    if (nextDrop.current <= 0) {
      nextDrop.current = 22 + Math.random() * 10;
      flakes.forEach((f) => {
        f.p.set(x + (Math.random() - 0.5) * 0.3 * k, h * habitatCtx.waterLevel, d / 2 - 0.25 * k + (Math.random() - 0.5) * 0.2);
        f.v.set((Math.random() - 0.5) * 0.08, -0.12 - Math.random() * 0.1, -0.05 - Math.random() * 0.08);
        f.life = 9;
      });
    }
    const im = inst.current;
    if (!im) return;
    flakes.forEach((f, i) => {
      if (f.life > 0) {
        f.life -= dt;
        f.p.addScaledVector(f.v, dt);
        f.p.x += Math.sin(sceneTime.value * 2 + f.spin) * 0.05 * dt;
        if (f.p.y < 0.1) f.life = 0;
      }
      e.set(sceneTime.value + f.spin, f.spin, 0);
      q.setFromEuler(e);
      m4.compose(f.p, q, f.life > 0 ? one : tmpV.set(0, 0, 0));
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <group ref={group} scale={k}>
        <mesh geometry={geo.clip} material={mat} />
        <mesh ref={drum} geometry={geo.drum} material={mat} position={[0, 0.25, -0.12]} />
      </group>
      <instancedMesh ref={inst} args={[flakeGeo, flakeMat, FLAKES]} frustumCulled={false} />
    </group>
  );
}

function ScraperBot({ dims, mat }: { dims: Dims; mat: THREE.Material }) {
  const k = propScale(dims);
  const geo = useMemo(scraperBotModel, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const { w, h, d } = tankCtx;
    const t = sceneTime.value;
    // Glides slowly over the front glass.
    ref.current?.position.set(Math.sin(t * 0.11) * w * 0.38, h * (0.5 + Math.sin(t * 0.17 + 1) * 0.3), d / 2 + 0.06);
  });
  return <mesh ref={ref} geometry={geo} material={mat} scale={k} />;
}

function Snail({ dims, mat }: { dims: Dims; mat: THREE.Material }) {
  const k = propScale(dims);
  const geo = useMemo(snailModel, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const { w, h, d } = tankCtx;
    const t = sceneTime.value * 0.05;
    // Crawls slowly over the inside of the back glass, facing the way it's going.
    const x = Math.sin(t) * w * 0.35;
    const y = h * (0.45 + Math.sin(t * 1.6 + 1) * 0.25);
    const dx = Math.cos(t) * w * 0.35;
    const dy = Math.cos(t * 1.6 + 1) * 1.6 * h * 0.25;
    m.position.set(x, y, -d / 2 + 0.04);
    m.rotation.set(0, 0, Math.atan2(dy, dx) - Math.PI / 2);
  });
  return <mesh ref={ref} geometry={geo} material={mat} scale={k * 0.9} />;
}
