// ?gallery — every procedural creature on a grid, for reviewing models.
// ?gallery=ocean (or swamp / reef / deep) shows just one habitat, bigger.
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SPECIES } from "../data/creatures";
import { getCreatureModel } from "../scene/models/creatureModels";
import { createSwimMaterial } from "../scene/swimShader";

function Item({ id, x, z }: { id: string; x: number; z: number }) {
  const model = useMemo(() => getCreatureModel(id), [id]);
  const mat = useMemo(() => createSwimMaterial({ amp: model.swim.amp, freq: model.swim.freq, mode: model.swim.mode }), [model]);
  const ref = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.4;
    mat.userData.swim.uPhase.value = s.clock.elapsedTime * 5;
  });
  return (
    <group position={[x, 0, z]} ref={ref}>
      <mesh geometry={model.geometry} material={mat} scale={1.4} />
    </group>
  );
}

export default function Gallery() {
  const only = new URLSearchParams(location.search).get("gallery");
  const list = SPECIES.filter((s) => !only || s.biome === only).map((s) => s.id);
  const cols = list.length > 20 ? 7 : 4;
  const rows = Math.ceil(list.length / cols);
  return (
    <div className="fixed inset-0">
      <Canvas camera={{ position: [0, rows * 2.2, rows * 2], fov: 50 }} gl={{ toneMapping: THREE.NeutralToneMapping }}>
        <color attach="background" args={["#dfe8d8"]} />
        <hemisphereLight args={["#ffffff", "#8a9a80", 1.2]} />
        <directionalLight position={[3, 6, 4]} intensity={1.8} />
        {list.map((id, i) => (
          <Item key={id} id={id} x={((i % cols) - (cols - 1) / 2) * 1.8} z={(Math.floor(i / cols) - (rows - 1) / 2) * 1.7} />
        ))}
        <OrbitControls />
      </Canvas>
      <div className="pointer-events-none fixed top-2 left-2 rounded-lg bg-white/80 px-2 py-1 text-sm font-bold">
        {list.join(" · ")}
      </div>
    </div>
  );
}
