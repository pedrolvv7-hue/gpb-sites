// Buffer circular de vídeo. Fragmentos WebM não são decodificáveis isoladamente, então usamos
// dois gravadores alternados: cada segmento é um arquivo completo. Um clipe = segmento anterior
// completo + segmento atual (finalizado na hora). Cobre entre N e 2N segundos antes do evento.
export interface Clip { id: string; blob: Blob; url: string; mime: string; createdAt: number; seconds: number; cameraId: string }

export class RingRecorder {
  private rec: MediaRecorder | null = null
  private chunks: Blob[] = []
  private prev: Blob | null = null
  private timer: number | null = null
  private segStart = 0
  stopped = false
  constructor(private stream: MediaStream, private mime: string, private segmentSec = 20, public cameraId = 'local') {}

  start() { this.stopped = false; this.begin() }

  private begin() {
    if (this.stopped) return
    const rec = new MediaRecorder(this.stream, { mimeType: this.mime, videoBitsPerSecond: 2_500_000 })
    this.chunks = []
    rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data) }
    rec.start(1000)
    this.rec = rec
    this.segStart = Date.now()
    this.timer = window.setTimeout(() => this.rotate(), this.segmentSec * 1000)
  }

  private rotate(): Promise<Blob | null> {
    return new Promise((res) => {
      const rec = this.rec
      if (!rec || rec.state === 'inactive') return res(null)
      if (this.timer) clearTimeout(this.timer)
      rec.onstop = () => {
        const b = new Blob(this.chunks, { type: this.mime })
        this.prev = b
        this.begin()
        res(b)
      }
      rec.stop()
    })
  }

  /** Gera clipe com o vídeo disponível até agora. Retorna null se não houver dados. */
  async clip(): Promise<Clip[]> {
    const older = this.prev
    const curSec = (Date.now() - this.segStart) / 1000
    const cur = await this.rotate()
    const out: Clip[] = []
    for (const [b, s] of [[older, this.segmentSec], [cur, curSec]] as const) {
      if (b && b.size > 0) out.push({ id: crypto.randomUUID(), blob: b, url: URL.createObjectURL(b), mime: this.mime, createdAt: Date.now(), seconds: Math.round(s as number), cameraId: this.cameraId })
    }
    return out
  }

  stop() {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop()
    this.prev = null
  }
}

/** Armazém de clipes em memória (Blobs não vão para localStorage). */
export const clipStore = new Map<string, Clip[]>()
