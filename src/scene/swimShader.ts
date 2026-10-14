// One flat-shaded material type for everything alive (and things that sway).
// The vertex shader bends the mesh in its local space:
//   mode 0 FISH     sideways sine wave along the body, growing toward the tail (−z)
//   mode 1 TENTACLE sway below the body (y < 0), for octopus arms
//   mode 2 PLANT    sway that grows with height (y > 0), for reeds, kelp, anemones
//   mode 3 WAVE     gentle water-surface ripples
//   mode 4 FLUKE    up-and-down wave along the body (dolphins, whales: mammals swim vertically)
//   mode 5 FLAP     wingtips rise and fall (manta rays)
// Extras:
//   - soft rim light (toon-ish feel) and a tint uniform
//   - bioluminescence: a per-vertex `aGlow` attribute (0–1) lights parts up in the dark
//   - edge fade: fragments dissolve (dithered, no sorting issues) as they leave a box,
//     so giants can loop beyond the diorama walls without hard clipping.

import * as THREE from "three";

export const SwimMode = { FISH: 0, TENTACLE: 1, PLANT: 2, WAVE: 3, FLUKE: 4, FLAP: 5 } as const;

export interface SwimUniforms {
  uPhase: { value: number };
  uAmp: { value: number };
  uFreq: { value: number };
  uMode: { value: number };
  uTint: { value: THREE.Color };
  uRim: { value: number };
  uRimColor: { value: THREE.Color };
  uGlow: { value: number };
  /** Edge fade box in world space; uFade = fade width (0 disables). */
  uFadeMin: { value: THREE.Vector3 };
  uFadeMax: { value: THREE.Vector3 };
  uFade: { value: number };
}

export type SwimMaterial = THREE.MeshStandardMaterial & { userData: { swim: SwimUniforms } };

export interface SwimMaterialOpts {
  amp?: number;
  freq?: number;
  mode?: number;
  rim?: number;
  rimColor?: THREE.ColorRepresentation;
  instanced?: boolean;
  transparent?: boolean;
  opacity?: number;
  roughness?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  color?: THREE.ColorRepresentation;
  vertexColors?: boolean;
  side?: THREE.Side;
  glow?: number;
}

export function createSwimMaterial(o: SwimMaterialOpts = {}): SwimMaterial {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: o.vertexColors ?? true,
    flatShading: true,
    roughness: o.roughness ?? 0.85,
    metalness: 0,
    color: o.color ?? "#ffffff",
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
    emissive: o.emissive ?? "#000000",
    emissiveIntensity: o.emissiveIntensity ?? 1,
    side: o.side ?? THREE.FrontSide,
  }) as SwimMaterial;

  const u: SwimUniforms = {
    uPhase: { value: Math.random() * 10 },
    uAmp: { value: o.amp ?? 0.06 },
    uFreq: { value: o.freq ?? 6 },
    uMode: { value: o.mode ?? SwimMode.FISH },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uRim: { value: o.rim ?? 0.35 },
    uRimColor: { value: new THREE.Color(o.rimColor ?? "#ffffff") },
    uGlow: { value: o.glow ?? 1 },
    uFadeMin: { value: new THREE.Vector3(-1e4, -1e4, -1e4) },
    uFadeMax: { value: new THREE.Vector3(1e4, 1e4, 1e4) },
    uFade: { value: 0 },
  };
  m.userData.swim = u;
  const instanced = !!o.instanced;

  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uPhase; uniform float uAmp; uniform float uFreq; uniform float uMode;
        attribute float aGlow;
        varying float vGlow;
        varying vec3 vFadeWorld;
        ${instanced ? "attribute float aPhase;" : ""}`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vGlow = aGlow;
        float ph = uPhase${instanced ? " + aPhase" : ""};
        float tl = clamp(0.5 - position.z, 0.0, 1.2);
        if (uMode < 0.5) {
          transformed.x += sin(ph - position.z * uFreq) * uAmp * tl * tl;
        } else if (uMode < 1.5) {
          float d = clamp(-position.y, 0.0, 1.5);
          transformed.x += sin(ph + position.y * uFreq + position.z * 3.0) * uAmp * d * d;
          transformed.z += cos(ph * 0.8 + position.y * uFreq + position.x * 3.0) * uAmp * d * d;
        } else if (uMode < 2.5) {
          float d = max(position.y, 0.0);
          transformed.x += sin(ph + position.y * uFreq + position.z) * uAmp * d * d;
          transformed.z += cos(ph * 0.7 + position.y * uFreq + position.x) * uAmp * d * d * 0.6;
        } else if (uMode < 3.5) {
          transformed.y += (sin(position.x * uFreq + ph) + cos(position.z * uFreq * 1.3 + ph * 1.2)) * uAmp;
        } else if (uMode < 4.5) {
          transformed.y += sin(ph - position.z * uFreq) * uAmp * tl * tl;
        } else {
          float w = position.x * position.x * 4.0;
          transformed.y += sin(ph) * uAmp * w + sin(ph - position.z * uFreq) * uAmp * 0.15 * tl;
        }`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 fadeWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fadeWorld = instanceMatrix * fadeWorld;
        #endif
        vFadeWorld = (modelMatrix * fadeWorld).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uTint; uniform float uRim; uniform vec3 uRimColor; uniform float uGlow;
        uniform vec3 uFadeMin; uniform vec3 uFadeMax; uniform float uFade;
        varying float vGlow;
        varying vec3 vFadeWorld;`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        if (uFade > 0.0) {
          vec3 dmin = vFadeWorld - uFadeMin;
          vec3 dmax = uFadeMax - vFadeWorld;
          float edge = min(min(min(dmin.x, dmax.x), min(dmin.z, dmax.z)), min(dmin.y, dmax.y));
          float keep = clamp(edge / uFade, 0.0, 1.0);
          float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          if (keep < dither) discard;
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 glowBase = diffuseColor.rgb;
        diffuseColor.rgb *= uTint;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += uRimColor * pow(rimF, 2.5) * uRim;
        totalEmissiveRadiance += glowBase * vGlow * uGlow * 3.0;`,
      );
  };
  m.customProgramCacheKey = () => (instanced ? "swim-i" : "swim");
  return m;
}

/** Point the edge fade at a box (world space). Pass null to disable. */
export function setEdgeFade(m: SwimMaterial, box: { min: THREE.Vector3; max: THREE.Vector3 } | null, width = 0.8) {
  const u = m.userData.swim;
  if (!box) {
    u.uFade.value = 0;
    return;
  }
  u.uFadeMin.value.copy(box.min);
  u.uFadeMax.value.copy(box.max);
  u.uFade.value = width;
}
