// Soft bloom so bioluminescent parts glow in the Deep Sea. High quality only.
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export default function DeepBloom() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur intensity={1.6} luminanceThreshold={0.35} luminanceSmoothing={0.3} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}
