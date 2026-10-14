// A soft burst of bubbles when a habitat grows.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Dims } from "../data/habitatGeometry";

const COUNT = 70;
const LIFE = 2.6;

export function ExpansionBurst({ startedAt, dims }: { startedAt: number; dims: Dims }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#eaf8ff", transparent: true, opacity: 0.55, roughness: 0.1, flatShading: true }), []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  const bubbles = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * dims.w * 0.95,
        z: (Math.random() - 0.5) * dims.d * 0.95,
        size: 0.03 + Math.random() * 0.06,
        speed: 1.2 + Math.random() * 1.6,
        delay: Math.random() * 0.8,
        wobble: Math.random() * 10,
      })),
    // New bubbles for each expansion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startedAt],
  );
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const im = mesh.current;
    if (!im) return;
    const t = (performance.now() - startedAt) / 1000;
    bubbles.forEach((b, i) => {
      const tt = t - b.delay;
      const alive = tt > 0 && tt < LIFE;
      const y = 0.2 + tt * b.speed;
      p.set(b.x + Math.sin(tt * 4 + b.wobble) * 0.06, Math.min(y, dims.h), b.z);
      s.setScalar(alive && y < dims.h ? b.size : 0);
      m4.compose(p, q, s);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geo, mat, COUNT]} frustumCulled={false} renderOrder={5} />;
}
