// Gentle orbit around the diorama, clamped so you never flip under it.
// Tapping a creature follows it until you drag or tap elsewhere.
// Decorate mode glides to a top-down view.
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { BIOMES, type BiomeId } from "../data/biomes";
import type { Dims } from "../data/habitatGeometry";
import { useUI } from "../state/uiStore";
import { prefersReducedMotion } from "../utils/motion";
import { creatureLengths, creaturePositions } from "./registry";

const LIMITS = {
  normal: { minPolar: 0.45, maxPolar: 1.42, minAz: -1.1, maxAz: 1.1 },
  decorate: { minPolar: 0.05, maxPolar: 0.75, minAz: -0.6, maxAz: 0.6 },
};

function spherePos(target: THREE.Vector3, dist: number, polar: number, az: number) {
  return new THREE.Vector3(
    target.x + dist * Math.sin(polar) * Math.sin(az),
    target.y + dist * Math.cos(polar),
    target.z + dist * Math.sin(polar) * Math.cos(az),
  );
}

function applyLimits(c: OrbitControlsImpl | null, mode: "normal" | "decorate" | "free") {
  if (!c) return;
  if (mode === "free") {
    c.minPolarAngle = 0;
    c.maxPolarAngle = Math.PI / 2;
    c.minAzimuthAngle = -Infinity;
    c.maxAzimuthAngle = Infinity;
    return;
  }
  const l = LIMITS[mode];
  c.minPolarAngle = l.minPolar;
  c.maxPolarAngle = l.maxPolar;
  c.minAzimuthAngle = l.minAz;
  c.maxAzimuthAngle = l.maxAz;
}

/** `dims` is the size to frame: the current habitat, or the next size while previewing an expansion. */
export function CameraRig({ biome, decorating, dims }: { biome: BiomeId; decorating: boolean; dims: Dims }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const cfg = BIOMES[biome];
  const home = useMemo(() => new THREE.Vector3(0, dims.h * 0.4, 0), [dims.h]);
  const reduced = useMemo(prefersReducedMotion, []);
  const anim = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const following = useRef(false);
  const dragging = useRef(false);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const delta = useMemo(() => new THREE.Vector3(), []);
  const size = useThree((s) => s.size);

  // Distance that fits the whole diorama on screen (portrait phones need more).
  const fit = useMemo(() => {
    const { w, h, d, soil } = dims;
    const vHalf = THREE.MathUtils.degToRad(cfg.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * (size.width / Math.max(1, size.height)));
    // Bounding sphere of the whole diorama, so perspective never clips a corner.
    const r = Math.hypot(w / 2, (h + soil) / 2, d / 2);
    return Math.max(cfg.camera.distance, (r * 1.12) / Math.sin(vHalf), (r * 1.02) / Math.sin(hHalf));
  }, [cfg, dims, size.width, size.height]);

  // Top-down framing for decorate mode that keeps the diorama clear of the panel:
  // a bottom sheet on phones (diorama sits in the top half), a right panel on desktop.
  const decoFrame = useMemo(() => {
    const { w, d } = dims;
    const tanV = Math.tan(THREE.MathUtils.degToRad(cfg.camera.fov / 2));
    const side = size.width >= 768;
    const topBar = 84;
    const visW = side ? size.width - 420 : size.width - 24;
    const visH = side ? size.height - topBar - 110 : size.height * 0.47 - topBar;
    const pxPerUnitAt1 = size.height / (2 * tanV);
    const dist = Math.max(((w * 1.24) * pxPerUnitAt1) / Math.max(120, visW), ((d * 1.3) * pxPerUnitAt1) / Math.max(120, visH));
    const unitsPerPx = (2 * dist * tanV) / size.height;
    const target = new THREE.Vector3(0, 0.3, 0);
    if (side) target.x += 210 * unitsPerPx;
    else target.z += (size.height / 2 - (topBar + visH / 2)) * unitsPerPx;
    return { dist, target };
  }, [cfg, dims, size.width, size.height]);

  useLayoutEffect(() => {
    camera.fov = cfg.camera.fov;
    camera.updateProjectionMatrix();
    camera.position.copy(spherePos(home, fit, 1.2, 0.42));
    controls.current?.target.copy(home);
    controls.current?.update();
  }, [biome, camera, cfg, home]); // fit is read once per biome; resizes glide below

  // Entering/leaving decorate mode glides to a fixed angle. A size change (expansion,
  // preview, window resize) keeps the current angle and just dollies in or out.
  const wasDecorating = useRef(decorating);
  useEffect(() => {
    const toggled = wasDecorating.current !== decorating;
    wasDecorating.current = decorating;
    const target = decorating ? decoFrame.target.clone() : home.clone();
    const dist = decorating ? decoFrame.dist : fit;
    let pos: THREE.Vector3;
    if (decorating) pos = spherePos(target, dist, 0.12, 0);
    else if (toggled || !controls.current) pos = spherePos(target, dist, 1.2, 0.42);
    else pos = target.clone().add(camera.position.clone().sub(controls.current.target).setLength(dist));
    anim.current = { target, pos };
    applyLimits(controls.current, "free");
    if (decorating) useUI.getState().select(null);
  }, [decorating, home, fit, decoFrame, camera]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const onEnd = () => {
      dragging.current = false;
    };
    const onStart = () => {
      dragging.current = true;
      // Any drag (or a tap on empty space) ends follow mode.
      if (anim.current) {
        anim.current = null;
        applyLimits(controls.current, decorating ? "decorate" : "normal");
      }
      if (useUI.getState().selectedUid) useUI.getState().select(null);
    };
    c.addEventListener("start", onStart);
    c.addEventListener("end", onEnd);
    return () => {
      c.removeEventListener("start", onStart);
      c.removeEventListener("end", onEnd);
    };
  }, [decorating]);

  useFrame((_s, dtRaw) => {
    const c = controls.current;
    if (!c) return;
    const dt = Math.min(dtRaw, 0.1);
    const rate = reduced ? 1.2 : 2.6;
    const k = 1 - Math.exp(-dt * rate);
    const sel = useUI.getState().selectedUid;
    const getPos = sel ? creaturePositions.get(sel) : undefined;

    if (anim.current) {
      camera.position.lerp(anim.current.pos, k);
      c.target.lerp(anim.current.target, k);
      if (camera.position.distanceTo(anim.current.pos) < 0.05) {
        anim.current = null;
        applyLimits(controls.current, decorating ? "decorate" : "normal");
      }
    } else if (getPos && !decorating) {
      getPos(tmp);
      delta.copy(c.target).lerp(tmp, k).sub(c.target);
      c.target.add(delta);
      camera.position.add(delta);
      // Ease in close enough that even a guppy is easy to see, however big the habitat.
      const len = (sel && creatureLengths.get(sel)) || 0.5;
      const want = THREE.MathUtils.clamp(len * 9 + 1.5, c.minDistance, fit * 0.6);
      const dist = camera.position.distanceTo(c.target);
      if (dist > want + 0.01) {
        tmp.copy(camera.position).sub(c.target).setLength(THREE.MathUtils.lerp(dist, want, k * 0.5));
        camera.position.copy(c.target).add(tmp);
      }
      following.current = true;
    } else if (!decorating && following.current && !dragging.current) {
      // Follow ended: glide back to the habitat overview from the current angle.
      following.current = false;
      tmp.copy(camera.position).sub(c.target).setLength(fit);
      anim.current = { target: home.clone(), pos: home.clone().add(tmp) };
    }
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={reduced ? 0.4 : 0.6}
      zoomSpeed={0.6}
      minDistance={Math.min(cfg.camera.min, fit * 0.6)}
      maxDistance={Math.max(cfg.camera.max, fit * 1.35, decoFrame.dist * 1.2)}
      minPolarAngle={LIMITS.normal.minPolar}
      maxPolarAngle={LIMITS.normal.maxPolar}
      minAzimuthAngle={LIMITS.normal.minAz}
      maxAzimuthAngle={LIMITS.normal.maxAz}
    />
  );
}
