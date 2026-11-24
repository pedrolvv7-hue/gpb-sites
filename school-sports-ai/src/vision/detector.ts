// Detector real de pessoas e bola: COCO-SSD (TensorFlow.js, licença Apache-2.0).
// Classes usadas: "person" e "sports ball". É um modelo GENÉRICO: detecta bola pequena/rápida
// com baixa revocação. A interface ObjectDetector permite trocar por um modelo especializado (ONNX).
import type { Detection } from '../tracking/tracker'

export interface ObjectDetector {
  id: string
  name: string
  license: string
  backend: string
  detect(src: HTMLVideoElement | HTMLCanvasElement, minScore: number): Promise<Detection[]>
}

export type ModelStatus = 'nao_carregado' | 'carregando' | 'pronto' | 'erro'

let cached: Promise<ObjectDetector> | null = null

export function loadCocoSsd(base: 'lite_mobilenet_v2' | 'mobilenet_v2' = 'lite_mobilenet_v2'): Promise<ObjectDetector> {
  if (cached) return cached
  cached = (async () => {
    const tf = await import('@tensorflow/tfjs')
    // WebGPU só se o backend estiver registrado; senão WebGL; por último CPU.
    for (const b of ['webgl', 'cpu']) { try { if (await tf.setBackend(b)) break } catch { /* tenta o próximo */ } }
    await tf.ready()
    const coco = await import('@tensorflow-models/coco-ssd')
    const model = await coco.load({ base })
    return {
      id: `coco-ssd-${base}`,
      name: `COCO-SSD (${base})`,
      license: 'Apache-2.0 (tfjs-models)',
      backend: tf.getBackend(),
      async detect(src: HTMLVideoElement | HTMLCanvasElement, minScore: number) {
        const w = 'videoWidth' in src ? src.videoWidth : src.width
        const h = 'videoHeight' in src ? src.videoHeight : src.height
        if (!w || !h) return []
        const preds = await model.detect(src, 40, Math.min(minScore, 0.2))
        const out: Detection[] = []
        for (const p of preds) {
          const cls = p.class === 'person' ? 'person' : p.class === 'sports ball' ? 'ball' : null
          if (!cls) continue
          // bola: aceita score menor (objeto pequeno); pessoa: limite configurado
          if (p.score < (cls === 'ball' ? Math.min(minScore, 0.25) : minScore)) continue
          const [x, y, bw, bh] = p.bbox
          out.push({ cls, score: p.score, box: { x: x / w, y: y / h, w: bw / w, h: bh / h } })
        }
        return out
      },
    }
  })().catch((e) => { cached = null; throw e })
  return cached
}
