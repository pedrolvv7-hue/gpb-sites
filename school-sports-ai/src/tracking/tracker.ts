// Rastreador multiobjeto inspirado no ByteTrack (associação em dois estágios por confiança),
// com predição de velocidade constante. Coordenadas em pixels normalizados (0..1).
import type { TeamLabel } from '../lib/types'

export interface Box { x: number; y: number; w: number; h: number }
export interface Detection { box: Box; score: number; cls: 'person' | 'ball' }

export interface Track {
  id: number
  label: string // A01, B02, U03...
  box: Box
  vx: number
  vy: number
  hits: number
  misses: number
  state: 'tentativo' | 'ativo' | 'perdido'
  team: TeamLabel
  manualLabel?: string
  lastSeen: number
}

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const u = a.w * a.h + b.w * b.h - inter
  return u <= 0 ? 0 : inter / u
}

export interface TrackerOptions { highThresh: number; lowThresh: number; matchIou: number; maxMisses: number; minHits: number; distGate: number }
const DEFAULTS: TrackerOptions = { highThresh: 0.5, lowThresh: 0.25, matchIou: 0.2, maxMisses: 30, minHits: 3, distGate: 2.5 }

export class MultiTracker {
  tracks: Track[] = []
  private nextId = 1
  private opt: TrackerOptions
  constructor(opt: Partial<TrackerOptions> = {}) { this.opt = { ...DEFAULTS, ...opt } }

  private predict(t: Track): Box { return { ...t.box, x: t.box.x + t.vx, y: t.box.y + t.vy } }

  private associate(tracks: Track[], dets: Detection[]): [Track, Detection][] {
    const pairs: { t: Track; d: Detection; s: number }[] = []
    for (const t of tracks) {
      const p = this.predict(t)
      for (const d of dets) {
        const s = iou(p, d.box)
        if (s >= this.opt.matchIou) { pairs.push({ t, d, s: 1 + s }); continue }
        // Reserva para baixa taxa de inferência: objetos pequenos podem se mover mais que a própria
        // caixa entre quadros. Aceita se o centro estiver perto (relativo à altura) e o tamanho for parecido.
        const dc = Math.hypot(p.x + p.w / 2 - (d.box.x + d.box.w / 2), p.y + p.h / 2 - (d.box.y + d.box.h / 2))
        const hr = Math.min(p.h, d.box.h) / Math.max(p.h, d.box.h)
        const gate = this.opt.distGate * Math.max(p.h, d.box.h)
        if (dc < gate && hr > 0.6) pairs.push({ t, d, s: 1 - dc / gate })
      }
    }
    pairs.sort((a, b) => b.s - a.s)
    const usedT = new Set<Track>(), usedD = new Set<Detection>(), out: [Track, Detection][] = []
    for (const p of pairs) {
      if (usedT.has(p.t) || usedD.has(p.d)) continue
      usedT.add(p.t); usedD.add(p.d); out.push([p.t, p.d])
    }
    return out
  }

  private update(t: Track, d: Detection, now: number) {
    const cx = d.box.x + d.box.w / 2, cy = d.box.y + d.box.h / 2
    const ox = t.box.x + t.box.w / 2, oy = t.box.y + t.box.h / 2
    t.vx = 0.6 * t.vx + 0.4 * (cx - ox)
    t.vy = 0.6 * t.vy + 0.4 * (cy - oy)
    t.box = d.box
    t.hits++
    t.misses = 0
    t.lastSeen = now
    if (t.state !== 'ativo' && t.hits >= this.opt.minHits) t.state = 'ativo'
  }

  step(dets: Detection[], now: number): Track[] {
    const persons = dets.filter((d) => d.cls === 'person')
    const high = persons.filter((d) => d.score >= this.opt.highThresh)
    const low = persons.filter((d) => d.score >= this.opt.lowThresh && d.score < this.opt.highThresh)
    const m1 = this.associate(this.tracks, high)
    m1.forEach(([t, d]) => this.update(t, d, now))
    const restT = this.tracks.filter((t) => !m1.some(([mt]) => mt === t))
    const m2 = this.associate(restT.filter((t) => t.state !== 'tentativo'), low)
    m2.forEach(([t, d]) => this.update(t, d, now))
    const matched = new Set([...m1, ...m2].map(([t]) => t))
    for (const t of this.tracks) {
      if (matched.has(t)) continue
      t.misses++
      t.box = this.predict(t)
      if (t.state === 'ativo') t.state = 'perdido'
    }
    this.tracks = this.tracks.filter((t) => (t.state === 'tentativo' ? t.misses < 2 : t.misses <= this.opt.maxMisses))
    const usedHigh = new Set(m1.map(([, d]) => d))
    for (const d of high) {
      if (usedHigh.has(d)) continue
      const id = this.nextId++
      this.tracks.push({ id, label: `U${String(id).padStart(2, '0')}`, box: d.box, vx: 0, vy: 0, hits: 1, misses: 0, state: 'tentativo', team: 'U', lastSeen: now })
    }
    return this.tracks
  }

  /** Correção manual de identificador (o professor renomeia um jogador). */
  relabel(id: number, label: string) { const t = this.tracks.find((x) => x.id === id); if (t) t.manualLabel = label }
  /** Troca o histórico de dois rastros que foram confundidos. */
  swap(a: number, b: number) {
    const ta = this.tracks.find((x) => x.id === a), tb = this.tracks.find((x) => x.id === b)
    if (!ta || !tb) return
    ;[ta.manualLabel, tb.manualLabel] = [tb.manualLabel ?? tb.label, ta.manualLabel ?? ta.label]
    ;[ta.team, tb.team] = [tb.team, ta.team]
  }
}

/** Reatribui rótulos A01/B01 conforme a equipe estabilizada, preservando ordem de criação. */
export function labelTracks(tracks: Track[]) {
  const count: Record<string, number> = { A: 0, B: 0, U: 0 }
  for (const t of [...tracks].sort((a, b) => a.id - b.id)) {
    count[t.team]++
    t.label = t.manualLabel ?? `${t.team}${String(count[t.team]).padStart(2, '0')}`
  }
}

// ---------------- Bola: filtro de Kalman 2D de velocidade constante ----------------

export type BallState = 'detectada' | 'estimada' | 'perdida' | 'fora_da_imagem' | 'recuperada'

export class BallTracker {
  x = 0; y = 0; vx = 0; vy = 0
  P = [1, 1, 1, 1] // variâncias diagonais simplificadas (x, y, vx, vy)
  initialized = false
  state: BallState = 'perdida'
  missed = 0
  lastSeenT = -1
  confidence = 0
  history: { t: number; x: number; y: number; observed: boolean }[] = []
  constructor(private q = 0.0005, private r = 0.0004, private maxPredict = 8) {}

  step(t: number, candidates: Detection[], inPlay?: (x: number, y: number) => boolean): BallState {
    const balls = candidates.filter((d) => d.cls === 'ball' && (!inPlay || inPlay(d.box.x + d.box.w / 2, d.box.y + d.box.h / 2)))
    // predição
    if (this.initialized) {
      this.x += this.vx; this.y += this.vy
      this.P = [this.P[0] + this.P[2] + this.q, this.P[1] + this.P[3] + this.q, this.P[2] + this.q, this.P[3] + this.q]
    }
    // escolha da observação: a mais próxima da predição (gating) ou a de maior score se não inicializado
    let obs: Detection | undefined
    if (balls.length) {
      if (!this.initialized) obs = balls.reduce((a, b) => (b.score > a.score ? b : a))
      else {
        const gate = 3 * Math.sqrt(this.P[0] + this.r) + 0.05
        let best = Infinity
        for (const b of balls) {
          const d = Math.hypot(b.box.x + b.box.w / 2 - this.x, b.box.y + b.box.h / 2 - this.y)
          if (d < gate && d < best) { best = d; obs = b }
        }
      }
    }
    const wasLost = this.state === 'perdida' || this.state === 'fora_da_imagem' || this.state === 'estimada'
    if (obs) {
      const ox = obs.box.x + obs.box.w / 2, oy = obs.box.y + obs.box.h / 2
      if (!this.initialized) { this.x = ox; this.y = oy; this.vx = 0; this.vy = 0; this.initialized = true; this.P = [this.r, this.r, 1, 1] }
      else {
        const kx = this.P[0] / (this.P[0] + this.r), ky = this.P[1] / (this.P[1] + this.r)
        const ix = ox - this.x, iy = oy - this.y
        this.x += kx * ix; this.y += ky * iy
        this.vx += 0.5 * kx * ix; this.vy += 0.5 * ky * iy
        this.P = [(1 - kx) * this.P[0], (1 - ky) * this.P[1], this.P[2] * 0.9, this.P[3] * 0.9]
      }
      this.missed = 0
      this.lastSeenT = t
      this.confidence = obs.score
      this.state = wasLost && this.history.length ? 'recuperada' : 'detectada'
      this.history.push({ t, x: this.x, y: this.y, observed: true })
    } else if (this.initialized) {
      this.missed++
      this.confidence *= 0.7
      if (this.x < 0 || this.x > 1 || this.y < 0 || this.y > 1) { this.state = 'fora_da_imagem'; this.initialized = false }
      else if (this.missed <= this.maxPredict) { this.state = 'estimada'; this.history.push({ t, x: this.x, y: this.y, observed: false }) }
      else { this.state = 'perdida'; this.initialized = false; this.confidence = 0 }
    } else this.state = 'perdida'
    if (this.history.length > 300) this.history.splice(0, this.history.length - 300)
    return this.state
  }

  /** Trajetória observada recente (apenas pontos realmente vistos). */
  observed(sinceT: number) { return this.history.filter((h) => h.observed && h.t >= sinceT) }
}
