// Detecção individual de recursos do navegador. Nunca presume suporte.
export interface Capabilities {
  camera: boolean
  webrtc: boolean
  webgl: boolean
  webgpu: boolean
  wasm: boolean
  workers: boolean
  offscreen: boolean
  mediaRecorder: boolean
  recorderMime: string | null
  webcodecs: boolean
  wakeLock: boolean
  secure: boolean
  cores: number | null
  memoryGb: number | null
}

export function detectCapabilities(): Capabilities {
  const n = navigator as Navigator & { gpu?: unknown; deviceMemory?: number }
  let webgl = false
  try { const c = document.createElement('canvas'); webgl = !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { /* sem webgl */ }
  const mimes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  const recorderMime = typeof MediaRecorder !== 'undefined' ? mimes.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? null : null
  return {
    camera: !!navigator.mediaDevices?.getUserMedia,
    webrtc: typeof RTCPeerConnection !== 'undefined',
    webgl,
    webgpu: !!n.gpu,
    wasm: typeof WebAssembly !== 'undefined',
    workers: typeof Worker !== 'undefined',
    offscreen: typeof OffscreenCanvas !== 'undefined',
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    recorderMime,
    webcodecs: typeof (globalThis as { VideoEncoder?: unknown }).VideoEncoder !== 'undefined',
    wakeLock: 'wakeLock' in navigator,
    secure: window.isSecureContext,
    cores: navigator.hardwareConcurrency || null,
    memoryGb: n.deviceMemory ?? null,
  }
}

/** Quantos fluxos simultâneos recomendar para inferência local (heurística conservadora). */
export function recommendedStreams(c: Capabilities): number {
  if (!c.webgl && !c.webgpu) return 1
  const cores = c.cores ?? 4
  return cores >= 8 ? 4 : cores >= 4 ? 2 : 1
}
