import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getCreatureModel } from "../scene/models/creatureModels";
import { createSwimMaterial } from "../scene/swimShader";

function Spinner({ speciesId, variantId }: { speciesId: string; variantId?: string }) {
  const model = useMemo(() => getCreatureModel(speciesId, variantId), [speciesId, variantId]);
  const mat = useMemo(() => createSwimMaterial({ amp: model.swim.amp, freq: model.swim.freq, mode: model.swim.mode, rim: 0.4 }), [model]);
  useEffect(() => () => mat.dispose(), [mat]);
  const ref = useRef<THREE.Group>(null);
  const extent = useMemo(() => {
    const bb = model.geometry.boundingBox ?? new THREE.Box3().setFromBufferAttribute(model.geometry.attributes.position as THREE.BufferAttribute);
    const size = bb.getSize(new THREE.Vector3());
    return Math.max(size.x, size.y, size.z);
  }, [model]);
  useFrame((s, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.6;
    mat.userData.swim.uPhase.value = s.clock.elapsedTime * 4;
  });
  return (
    <group ref={ref}>
      <mesh geometry={model.geometry} material={mat} scale={1.6 / extent} />
    </group>
  );
}

export default function CodexTurntable({ speciesId, variantId }: { speciesId: string; variantId?: string }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [1.6, 0.6, 1.6], fov: 40 }}
      gl={{ alpha: true, antialias: true, toneMapping: THREE.NeutralToneMapping }}
      aria-label="3D preview"
    >
      <hemisphereLight args={["#ffffff", "#8a9a80", 1.3]} />
      <directionalLight position={[2, 3, 2]} intensity={1.6} />
      <Spinner speciesId={speciesId} variantId={variantId} />
    </Canvas>
  );
}
