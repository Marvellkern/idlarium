// Food flakes drift down from the surface; creatures gather around them for a few seconds.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BiomeId } from "../data/biomes";
import type { Dims } from "../data/habitatGeometry";
import { useUI } from "../state/uiStore";
import { habitatCtx } from "./registry";

const FLAKES = 28;
const DURATION = 8;
const GATHER = 6.5;

export function Feeding({ biome, dims }: { biome: BiomeId; dims: Dims }) {
  const feedingAt = useUI((s) => (s.feedingAt?.biome === biome ? s.feedingAt.at : null));
  const { w, h, d } = dims;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(0.035, 0), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8b46a", flatShading: true, roughness: 0.8 }), []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);

  const flakes = useMemo(() => {
    if (feedingAt === null) return null;
    const cx = (Math.random() - 0.5) * w * 0.4;
    const cz = (Math.random() - 0.5) * d * 0.3;
    return {
      center: new THREE.Vector3(cx, h * 0.62, cz),
      items: Array.from({ length: FLAKES }, () => ({
        x: cx + (Math.random() - 0.5) * 1.0,
        z: cz + (Math.random() - 0.5) * 0.8,
        speed: 0.18 + Math.random() * 0.2,
        delay: Math.random() * 1.2,
        spin: Math.random() * 6,
      })),
    };
  }, [feedingAt, w, h, d]);

  useEffect(() => {
    if (!flakes) return;
    habitatCtx.feed = flakes.center;
    const t = setTimeout(() => {
      if (habitatCtx.feed === flakes.center) habitatCtx.feed = null;
    }, GATHER * 1000);
    return () => {
      clearTimeout(t);
      if (habitatCtx.feed === flakes.center) habitatCtx.feed = null;
    };
  }, [flakes]);

  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const im = mesh.current;
    if (!im || !flakes || feedingAt === null) return;
    const t = (performance.now() - feedingAt) / 1000;
    flakes.items.forEach((f, i) => {
      const tt = Math.max(0, t - f.delay);
      const y = h - 0.02 - tt * f.speed;
      p.set(f.x + Math.sin(tt * 2 + f.spin) * 0.06, Math.max(0.3, y), f.z);
      e.set(tt * 2 + f.spin, tt + f.spin, 0);
      q.setFromEuler(e);
      const alive = t > f.delay && t < DURATION ? Math.min(1, (DURATION - t) / 1.5) : 0;
      s.setScalar(alive);
      m4.compose(p, q, s);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
  });

  if (!flakes) return null;
  return <instancedMesh key={feedingAt ?? 0} ref={mesh} args={[geo, mat, FLAKES]} frustumCulled={false} />;
}
