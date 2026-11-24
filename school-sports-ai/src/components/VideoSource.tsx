import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { Source } from '../multicamera/session'

/** Elemento de vídeo para qualquer fonte (stream ao vivo ou arquivo). */
export const VideoSource = forwardRef<HTMLVideoElement, { src: Source; className?: string; controls?: boolean; loop?: boolean }>(function VideoSource({ src, className, controls, loop = true }, ref) {
  const v = useRef<HTMLVideoElement>(null)
  useImperativeHandle(ref, () => v.current!)
  useEffect(() => {
    const el = v.current; if (!el) return
    if (src.stream) { el.srcObject = src.stream; el.play().catch(() => {}) }
    else if (src.fileUrl) { el.srcObject = null; el.src = src.fileUrl }
  }, [src.stream, src.fileUrl])
  return <video ref={v} className={className} muted playsInline autoPlay controls={controls ?? src.kind === 'arquivo'} loop={loop} aria-label={`Vídeo: ${src.name}`} />
})
