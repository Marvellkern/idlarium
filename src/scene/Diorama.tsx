import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BIOMES, type BiomeId } from "../data/biomes";
import { habitatDims, lerpDims, terrainHeight, type Dims } from "../data/habitatGeometry";
import { mix, paint, rng } from "./models/geo";
import { expansionCtx, habitatCtx, sceneTime } from "./registry";
import { createSwimMaterial, SwimMode } from "./swimShader";

const causticUniforms = { uTime: sceneTime, uCaustic: { value: 0.5 }, uCausticColor: { value: new THREE.Color("#ffffff") } };

/** Ease-out used by the wall slide. */
export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/**
 * Flat-shaded terrain material with animated fake caustics added as light.
 * While a habitat grows, ground outside the old footprint rises in (uRise 0 → 1).
 */
function createTerrainMaterial(grow: { uRise: { value: number }; uOld: { value: THREE.Vector2 }; uCur: { value: THREE.Vector2 } }) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, causticUniforms, grow);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;\nuniform float uRise;\nuniform vec2 uOld;\nuniform vec2 uCur;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        if (abs(position.x) > uOld.x || abs(position.z) > uOld.y) transformed.y = mix(0.0, transformed.y, uRise);
        // Ground never pokes out past the sliding walls; it fills in behind them.
        transformed.x = clamp(transformed.x, -uCur.x, uCur.x);
        transformed.z = clamp(transformed.z, -uCur.y, uCur.y);`,
      )
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWorldPos;
        uniform float uTime; uniform float uCaustic; uniform vec3 uCausticColor;
        float causticAt(vec2 p, float t) {
          float v = sin(p.x * 3.1 + t * 0.9 + sin(p.y * 2.3 + t * 0.7));
          v += sin(p.y * 3.7 - t * 1.1 + sin(p.x * 2.9 - t * 0.5));
          v += sin((p.x + p.y) * 2.6 + t * 0.8);
          v /= 3.0;
          return pow(1.0 - abs(v), 6.0);
        }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        if (uCaustic > 0.0) {
          float c = causticAt(vWorldPos.xz * 1.4, uTime) * 0.7 + causticAt(vWorldPos.xz * 2.3 + 3.0, uTime * 1.3) * 0.5;
          totalEmissiveRadiance += uCausticColor * c * uCaustic * smoothstep(-0.2, 0.4, vWorldPos.y);
        }`,
      );
  };
  m.customProgramCacheKey = () => "terrain";
  return m;
}

interface Props {
  biome: BiomeId;
  quality: "low" | "high";
  /** Current (target) size level. */
  level: number;
  /** While growing: the level we're growing from. */
  fromLevel: number | null;
  /** Show the ghost outline of the next size. */
  preview: boolean;
}

export function Diorama({ biome, quality, level, fromLevel, preview }: Props) {
  const b = BIOMES[biome];
  const p = b.palette;
  const dims = useMemo(() => habitatDims(biome, level), [biome, level]);
  const fromDims = useMemo(() => (fromLevel ? habitatDims(biome, fromLevel) : null), [biome, fromLevel]);
  const nextDims = useMemo(() => (level < 5 ? habitatDims(biome, level + 1) : null), [biome, level]);
  const floorless = !!b.floorless;
  const { w, d, soil } = dims;

  // Terrain is built at the (new) full size; growth only animates the outer ring.
  const terrain = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, d, Math.round(w * 3), Math.round(d * 3));
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(biome, pos.getX(i), pos.getZ(i), dims));
    const r = rng(biome.length * 13);
    const tMax = b.terrainMax ?? 0.32;
    const painted = paint(g, (c) => {
      const k = r();
      if (biome === "swamp" && c.y > 0.22 && k < 0.5) return mix(p.floor, p.plant, 0.45);
      // Rocky habitats: the higher bumps are rock.
      if (p.rock && c.y > tMax * 0.55) return k < 0.3 ? mix(p.rock, "#000000", 0.12) : k < 0.45 ? mix(p.rock, "#ffffff", 0.1) : p.rock;
      if (p.rock && c.y > tMax * 0.4 && k < 0.5) return mix(p.floor, p.rock, 0.5);
      if (k < 0.25) return mix(p.floor, "#000000", 0.1);
      if (k < 0.4) return mix(p.floor, "#ffffff", 0.08);
      return p.floor;
    });
    painted.computeVertexNormals();
    return painted;
  }, [biome, w, d, dims, p.floor, p.plant, p.rock, b.terrainMax]);

  // Unit-sized parts that get scaled to the (animated) size every frame.
  const soilGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, soil, 1, 1, 3, 1);
    g.translate(0, -soil / 2, 0);
    return paint(g, (c) => {
      if (c.y > -soil * 0.34) return mix(p.soil, p.floor, 0.35);
      if (c.y > -soil * 0.67) return p.soil;
      return mix(p.soil, "#000000", 0.25);
    });
  }, [soil, p.soil, p.floor]);
  const unitBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const unitEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), []);
  const surfaceGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, d, Math.round(w * 2), Math.round(d * 2));
    g.rotateX(-Math.PI / 2);
    return g;
  }, [w, d]);

  const grow = useMemo(() => ({ uRise: { value: 1 }, uOld: { value: new THREE.Vector2(1e4, 1e4) }, uCur: { value: new THREE.Vector2(1e4, 1e4) } }), []);
  const terrainMat = useMemo(() => createTerrainMaterial(grow), [grow]);
  const soilMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), []);
  const waterMat = useMemo(
    () =>
      floorless
        ? createDepthWaterMaterial(p.water, p.deep)
        : new THREE.MeshStandardMaterial({ color: p.water, transparent: true, opacity: 0.2, roughness: 0.15, depthWrite: false, side: THREE.DoubleSide }),
    [p.water, p.deep, floorless],
  );
  const edgeMat = useMemo(() => new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35 }), []);
  const ghostEdgeMat = useMemo(() => new THREE.LineBasicMaterial({ color: "#bff3ff", transparent: true, opacity: 0.6, depthTest: false }), []);
  const ghostFillMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#bff3ff", transparent: true, opacity: 0.05, depthWrite: false, side: THREE.BackSide }),
    [],
  );
  const surfaceMat = useMemo(
    () =>
      createSwimMaterial({
        mode: SwimMode.WAVE,
        amp: 0.022,
        freq: 2.2,
        vertexColors: false,
        color: mix(p.water, "#ffffff", 0.35),
        transparent: true,
        opacity: 0.42,
        roughness: 0.2,
        rim: 0,
        side: THREE.DoubleSide,
      }),
    [p.water],
  );

  const shadowTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, "rgba(0,0,0,0.35)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);

  const causticBase = b.caustics && quality === "high" ? (biome === "swamp" ? 0.28 : 0.5) : 0;
  useEffect(() => {
    causticUniforms.uCausticColor.value.set(biome === "swamp" ? "#f2f7c0" : "#ffffff");
  }, [biome]);
  // Open Ocean Lv4 feature: a deeper blue below.
  useEffect(() => {
    const at = b.expansion.features.indexOf("deeper-blue") + 2;
    if (waterMat instanceof THREE.ShaderMaterial) waterMat.uniforms.uDeepen.value = at >= 2 && level >= at ? 1 : 0;
  }, [waterMat, level, b.expansion.features]);

  useEffect(
    () => () => {
      [terrain, soilGeo, unitBox, unitEdges, surfaceGeo].forEach((g) => g.dispose());
      [terrainMat, soilMat, waterMat, edgeMat, ghostEdgeMat, ghostFillMat, surfaceMat].forEach((m) => m.dispose());
      shadowTex.dispose();
    },
    [terrain, soilGeo, unitBox, unitEdges, surfaceGeo, terrainMat, soilMat, waterMat, edgeMat, ghostEdgeMat, ghostFillMat, surfaceMat, shadowTex],
  );

  const water = useRef<THREE.Mesh>(null);
  const surface = useRef<THREE.Mesh>(null);
  const soilMesh = useRef<THREE.Mesh>(null);
  const frame = useRef<THREE.LineSegments>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const ghost = useRef<THREE.Group>(null);
  const shown = useRef<Dims>(dims);

  useFrame(() => {
    surfaceMat.userData.swim.uPhase.value = sceneTime.value * 1.2;
    // Sunlight caustics dim to a faint moonlit shimmer at night.
    causticUniforms.uCaustic.value = causticBase * (0.12 + 0.88 * habitatCtx.daylight);

    // Size: animate from the old size while growing (walls ease out, new floor rises in).
    const t = fromDims ? expansionCtx.t : 1;
    const cur = fromDims ? lerpDims(fromDims, dims, easeOut(t)) : dims;
    shown.current = cur;
    grow.uRise.value = fromDims ? easeOut((t - 0.3) / 0.55) : 1;
    if (fromDims) {
      grow.uOld.value.set(fromDims.w / 2, fromDims.d / 2);
      grow.uCur.value.set(cur.w / 2, cur.d / 2);
    } else {
      grow.uOld.value.set(1e4, 1e4);
      grow.uCur.value.set(1e4, 1e4);
    }

    // Tides lower the water (the glass stays the same height).
    const wh = cur.h * habitatCtx.waterLevel;
    water.current?.scale.set(cur.w, wh, cur.d);
    water.current?.position.set(0, wh / 2, 0);
    surface.current?.scale.set(cur.w / dims.w, 1, cur.d / dims.d);
    surface.current?.position.set(0, wh, 0);
    soilMesh.current?.scale.set(cur.w, 1, cur.d);
    const frameH = floorless ? cur.h : cur.h + cur.soil;
    frame.current?.scale.set(cur.w, frameH, cur.d);
    frame.current?.position.set(0, floorless ? cur.h / 2 : (cur.h - cur.soil) / 2, 0);
    shadow.current?.scale.set(cur.w * 1.9, cur.d * 1.9, 1);

    // Ghost outline of the next size, gently pulsing.
    if (ghost.current) {
      ghost.current.visible = preview && !!nextDims && !fromDims;
      if (nextDims && ghost.current.visible) {
        const gh = floorless ? nextDims.h : nextDims.h + nextDims.soil;
        ghost.current.scale.set(nextDims.w, gh, nextDims.d);
        ghost.current.position.set(0, floorless ? nextDims.h / 2 : (nextDims.h - nextDims.soil) / 2, 0);
        ghostEdgeMat.opacity = 0.45 + Math.sin(sceneTime.value * 3) * 0.25;
      }
    }
  });

  return (
    <group>
      {!floorless && <mesh geometry={terrain} material={terrainMat} receiveShadow />}
      {!floorless && <mesh ref={soilMesh} geometry={soilGeo} material={soilMat} receiveShadow />}
      <mesh ref={water} geometry={unitBox} material={waterMat} renderOrder={2} />
      <mesh ref={surface} geometry={surfaceGeo} material={surfaceMat} renderOrder={3} />
      <lineSegments ref={frame} geometry={unitEdges} material={edgeMat} />
      <group ref={ghost} visible={false}>
        <lineSegments geometry={unitEdges} material={ghostEdgeMat} renderOrder={11} />
        <mesh geometry={unitBox} material={ghostFillMat} renderOrder={1} />
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, (floorless ? 0 : -soil) - 0.6, 0]} renderOrder={-1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Soft sun shafts for bright, shallow biomes. `count` grows with the Open Ocean's "more light" feature. */
export function LightShafts({ dims, count = 5 }: { dims: Dims; count?: number }) {
  const { w, h, d } = dims;
  const shafts = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: count }, () => ({
      x: (r() - 0.5) * w * 0.8,
      z: (r() - 0.5) * d * 0.6,
      width: 0.4 + r() * 0.6,
      tilt: (r() - 0.5) * 0.3,
      speed: 0.3 + r() * 0.4,
      offset: r() * 10,
    }));
  }, [w, d, count]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uOpacity: { value: 0.12 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec2 vUv; uniform float uOpacity;
          void main(){ float a = smoothstep(0.0, 1.0, vUv.y) * (1.0 - abs(vUv.x - 0.5) * 2.0);
          gl_FragColor = vec4(vec3(1.0, 0.98, 0.9), a * uOpacity); }`,
      }),
    [],
  );
  const geo = useMemo(() => new THREE.PlaneGeometry(1, h * 0.95), [h]);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  const refs = useMemo(() => shafts.map(() => ({ current: null as THREE.Mesh | null })), [shafts]);
  useFrame(({ camera }) => {
    mat.uniforms.uOpacity.value = 0.12 * habitatCtx.daylight * (1 - habitatCtx.rain * 0.7);
    refs.forEach((r, i) => {
      const m = r.current;
      if (!m) return;
      m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
      const s = shafts[i];
      m.scale.x = s.width * (0.8 + 0.2 * Math.sin(sceneTime.value * s.speed + s.offset));
      m.visible = habitatCtx.daylight > 0.05;
    });
  });
  return (
    <group>
      {shafts.map((s, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs[i].current = m;
          }}
          geometry={geo}
          material={mat}
          position={[s.x, h * 0.5, s.z]}
          rotation={[0, 0, s.tilt]}
          renderOrder={4}
        />
      ))}
    </group>
  );
}

/**
 * Open-water volume (drawn on a unit box): sunlit blue at the top fading to deep
 * blue and more opaque at the bottom, so the column reads as bottomless.
 */
function createDepthWaterMaterial(top: string, deep: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTop: { value: new THREE.Color(top) }, uDeep: { value: new THREE.Color(deep) }, uDeepen: { value: 0 } },
    ]),
    vertexShader: `
      varying float vY;
      #include <fog_pars_vertex>
      void main() {
        vY = position.y;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uDeep; uniform float uDeepen;
      varying float vY;
      #include <fog_pars_fragment>
      void main() {
        float t = clamp(vY + 0.5, 0.0, 1.0);
        vec3 col = mix(uDeep * mix(0.6, 0.35, uDeepen), uTop, pow(t, mix(1.3, 1.8, uDeepen)));
        float a = mix(mix(0.62, 0.74, uDeepen), 0.16, t);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}
