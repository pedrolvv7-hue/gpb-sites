// Estimativa de pose (MoveNet MultiPose Lightning, Apache-2.0) e classificação de movimentos
// a partir dos 17 pontos do corpo ao longo do tempo. Coordenadas normalizadas 0..1, y para baixo.
import type { Sport } from '../lib/types'

export const KP = ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'] as const
export type KPName = (typeof KP)[number]
export interface Keypoint { x: number; y: number; s: number }
export type Pose = Record<KPName, Keypoint>
export interface PoseObs { pose: Pose; score: number; box: { x: number; y: number; w: number; h: number } }

export const SKELETON: [KPName, KPName][] = [
  ['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'], ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'], ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
]

export interface PoseDetector { detect(src: HTMLVideoElement | HTMLCanvasElement): Promise<PoseObs[]>; name: string }
let cached: Promise<PoseDetector> | null = null

export function loadMoveNet(): Promise<PoseDetector> {
  if (cached) return cached
  cached = (async () => {
    await import('@tensorflow/tfjs')
    const pd = await import('@tensorflow-models/pose-detection')
    const det = await pd.createDetector(pd.SupportedModels.MoveNet, { modelType: pd.movenet.modelType.MULTIPOSE_LIGHTNING, enableTracking: false, minPoseScore: 0.2, modelUrl: '/models/movenet-multipose/movenet-multipose.json' })
    return {
      name: 'MoveNet MultiPose Lightning',
      async detect(src: HTMLVideoElement | HTMLCanvasElement) {
        const w = 'videoWidth' in src ? src.videoWidth : src.width, h = 'videoHeight' in src ? src.videoHeight : src.height
        if (!w || !h) return []
        const poses = await det.estimatePoses(src, { maxPoses: 6, flipHorizontal: false })
        return poses.map((p) => {
          const pose = {} as Pose
          p.keypoints.forEach((k, i) => { pose[(k.name ?? KP[i]) as KPName] = { x: k.x / w, y: k.y / h, s: k.score ?? 0 } })
          const vis = Object.values(pose).filter((k) => k.s > 0.3)
          const xs = vis.map((k) => k.x), ys = vis.map((k) => k.y)
          const box = vis.length ? { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) } : { x: 0, y: 0, w: 0, h: 0 }
          return { pose, score: p.score ?? 0, box }
        })
      },
    }
  })().catch((e) => { cached = null; throw e })
  return cached
}

// ---------------- geometria ----------------
const MIN = 0.3
const ok = (...k: Keypoint[]) => k.every((p) => p && p.s >= MIN)
const mid = (a: Keypoint, b: Keypoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, s: Math.min(a.s, b.s) })
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
export function angle(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y }
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1)
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}
function torso(p: Pose): number | null {
  if (!ok(p.left_shoulder, p.right_shoulder, p.left_hip, p.right_hip)) return null
  return dist(mid(p.left_shoulder, p.right_shoulder), mid(p.left_hip, p.right_hip)) || null
}

export type Movement =
  | 'salto' | 'bracos_levantados' | 'agachamento' | 'chute' | 'queda' | 'deslocamento_rapido'
  | 'arremesso' | 'drible' | 'bloqueio' | 'manchete' | 'toque' | 'golpe_por_cima' | 'cortada'

export const MOVEMENT_LABEL: Record<Movement, string> = {
  salto: 'Salto', bracos_levantados: 'Braços levantados', agachamento: 'Flexão de joelhos', chute: 'Chute', queda: 'Queda / jogador no chão',
  deslocamento_rapido: 'Deslocamento rápido', arremesso: 'Arremesso', drible: 'Drible', bloqueio: 'Bloqueio (salto com braços erguidos)',
  manchete: 'Manchete', toque: 'Toque / levantamento', golpe_por_cima: 'Golpe por cima (saque ou ataque)', cortada: 'Cortada (ataque em salto)',
}

export const SPORT_MOVEMENTS: Record<Sport, Movement[]> = {
  futsal: ['chute', 'salto', 'queda', 'agachamento', 'bracos_levantados', 'deslocamento_rapido'],
  basketball: ['arremesso', 'drible', 'salto', 'bloqueio', 'queda', 'deslocamento_rapido', 'agachamento'],
  volleyball: ['manchete', 'toque', 'cortada', 'golpe_por_cima', 'bloqueio', 'salto', 'queda', 'deslocamento_rapido', 'agachamento'],
}

interface Sample { t: number; p: Pose; T: number }

/**
 * Classificador temporal por pessoa. Recebe poses ao longo do tempo e devolve movimentos
 * com confiança heurística. São regras geométricas explícitas (auditáveis), não um modelo treinado:
 * podem errar e por isso entram como "detectado", nunca alteram o placar.
 */
export class MovementClassifier {
  private hist: Sample[] = []
  private last: Partial<Record<Movement, number>> = {}
  constructor(private allowed: Movement[], private cooldownMs = 1200) {}

  step(t: number, p: Pose): { m: Movement; conf: number; detail: string }[] {
    const T = torso(p)
    if (!T) return []
    this.hist.push({ t, p, T })
    this.hist = this.hist.filter((h) => t - h.t <= 2000)
    const out: { m: Movement; conf: number; detail: string }[] = []
    const emit = (m: Movement, conf: number, detail: string) => {
      if (!this.allowed.includes(m)) return
      if (t - (this.last[m] ?? -1e9) < this.cooldownMs) return
      this.last[m] = t
      out.push({ m, conf, detail })
    }
    const H = this.hist
    const hip = (s: Sample) => mid(s.p.left_hip, s.p.right_hip)
    const sh = mid(p.left_shoulder, p.right_shoulder), hp = hip(H[H.length - 1])
    const head = ok(p.nose) ? p.nose : { x: sh.x, y: sh.y - T * 0.35, s: 1 }
    // salto: subida RÁPIDA (200–700 ms) do quadril e dos dois tornozelos. Andar para longe da câmera
    // também "sobe" na imagem, mas devagar; com amostras muito espaçadas, não afirmamos salto.
    const ref = H.filter((h) => t - h.t >= 200 && t - h.t <= 700)[0]
    let airborne = false, rise = 0
    if (ref && ok(ref.p.left_ankle, ref.p.right_ankle, p.left_ankle, p.right_ankle)) {
      rise = hip(ref).y - hp.y
      const al = ref.p.left_ankle.y - p.left_ankle.y, ar = ref.p.right_ankle.y - p.right_ankle.y
      const sizeStable = Math.abs(ref.T - T) / T < 0.15
      airborne = rise > 0.22 * T && al > 0.6 * rise && ar > 0.6 * rise && sizeStable
    }
    const wristsUp = ok(p.left_wrist, p.right_wrist) && p.left_wrist.y < head.y && p.right_wrist.y < head.y
    const oneUp = ok(p.left_wrist) && p.left_wrist.y < head.y - 0.2 * T || ok(p.right_wrist) && p.right_wrist.y < head.y - 0.2 * T

    // salto / bloqueio / cortada
    if (airborne) {
      if (wristsUp) emit('bloqueio', 0.5, 'Quadril subiu acima da base recente com os dois punhos acima da cabeça.')
      const fastArm = this.wristSpeed(t) > 3 * T
      if (oneUp && !wristsUp && fastArm) emit('cortada', 0.45, 'Em salto, com um braço acima da cabeça em movimento rápido.')
      emit('salto', 0.55, `Quadril e pés subiram ${(rise / T).toFixed(2)} torsos em menos de 0,7 s.`)
    } else {
      if (wristsUp) emit('bracos_levantados', 0.5, 'Os dois punhos acima da cabeça.')
      if (oneUp && !wristsUp && this.wristSpeed(t) > 3 * T) emit('golpe_por_cima', 0.4, 'Um braço acima da cabeça em movimento rápido, sem salto.')
    }
    // queda: tronco próximo da horizontal
    const tilt = Math.abs(Math.atan2(sh.x - hp.x, hp.y - sh.y)) * 180 / Math.PI
    if (tilt > 60) emit('queda', 0.5, `Tronco inclinado ${tilt.toFixed(0)}° em relação à vertical.`)
    // agachamento / flexão de joelhos
    const kl = ok(p.left_hip, p.left_knee, p.left_ankle) ? angle(p.left_hip, p.left_knee, p.left_ankle) : 180
    const kr = ok(p.right_hip, p.right_knee, p.right_ankle) ? angle(p.right_hip, p.right_knee, p.right_ankle) : 180
    const kneesBent = kl < 125 && kr < 125
    if (kneesBent && !airborne) emit('agachamento', 0.45, `Joelhos a ${kl.toFixed(0)}° e ${kr.toFixed(0)}°.`)
    // manchete: punhos juntos, abaixo dos ombros, cotovelos estendidos
    if (ok(p.left_wrist, p.right_wrist, p.left_elbow, p.right_elbow)) {
      const together = dist(p.left_wrist, p.right_wrist) < 0.45 * T
      const low = p.left_wrist.y > sh.y && p.right_wrist.y > sh.y && p.left_wrist.y < hp.y + 0.6 * T
      const ext = angle(p.left_shoulder, p.left_elbow, p.left_wrist) > 145 && angle(p.right_shoulder, p.right_elbow, p.right_wrist) > 145
      const forward = Math.abs(((p.left_wrist.x + p.right_wrist.x) / 2) - sh.x) > 0.15 * T || ((p.left_wrist.y + p.right_wrist.y) / 2) < hp.y
      if (together && low && ext && forward) emit('manchete', 0.5, 'Punhos unidos à frente, abaixo dos ombros, com cotovelos estendidos.')
      // toque: punhos acima da testa, próximos, cotovelos flexionados
      const above = p.left_wrist.y < head.y && p.right_wrist.y < head.y
      const near = dist(p.left_wrist, p.right_wrist) < 0.9 * T
      const bent = angle(p.left_shoulder, p.left_elbow, p.left_wrist) < 150 && angle(p.right_shoulder, p.right_elbow, p.right_wrist) < 150
      if (above && near && bent && !airborne) emit('toque', 0.45, 'Mãos juntas acima da cabeça com cotovelos flexionados.')
    }
    // chute: tornozelo rápido e erguido acima do outro
    const ank = this.ankleKick(t, T)
    if (ank) emit('chute', 0.5, ank)
    // arremesso: punho passa acima da cabeça subindo rápido a partir da altura do peito
    const sh600 = H.filter((h) => t - h.t <= 600)
    if (sh600.length >= 2) {
      const first = sh600[0].p
      for (const w of ['left_wrist', 'right_wrist'] as const) {
        if (ok(first[w], p[w]) && first[w].y > first.left_shoulder.y - 0.1 * T && p[w].y < head.y - 0.15 * T && (first[w].y - p[w].y) > 0.9 * T) { emit('arremesso', 0.45, 'Punho saiu da altura do peito para acima da cabeça rapidamente.'); break }
      }
    }
    // drible: punho abaixo do quadril oscilando (2+ inversões verticais em 1 s)
    for (const w of ['left_wrist', 'right_wrist'] as const) {
      const s = H.filter((h) => t - h.t <= 1000 && ok(h.p[w]) && h.p[w].y > hip(h).y)
      if (s.length >= 5) {
        let flips = 0, prev = 0
        for (let i = 1; i < s.length; i++) { const d = Math.sign(s[i].p[w].y - s[i - 1].p[w].y); if (d && prev && d !== prev) flips++; if (d) prev = d }
        if (flips >= 2) { emit('drible', 0.4, `Punho abaixo do quadril com ${flips} inversões verticais em 1 s.`); break }
      }
    }
    // deslocamento rápido do quadril
    const h500 = H.find((h) => t - h.t >= 400 && t - h.t <= 700)
    if (h500) { const v = dist(hip(h500), hp) / ((t - h500.t) / 1000); if (v > 2.2 * T) emit('deslocamento_rapido', 0.4, `Quadril a ${(v / T).toFixed(1)} torsos/s.`) }
    return out
  }

  private wristSpeed(t: number): number {
    const a = this.hist.find((h) => t - h.t >= 150 && t - h.t <= 500), b = this.hist[this.hist.length - 1]
    if (!a) return 0
    const dt = (b.t - a.t) / 1000
    return Math.max(...(['left_wrist', 'right_wrist'] as const).map((w) => (ok(a.p[w], b.p[w]) ? dist(a.p[w], b.p[w]) / dt : 0)))
  }

  private ankleKick(t: number, T: number): string | null {
    const a = this.hist.find((h) => t - h.t >= 150 && t - h.t <= 500), b = this.hist[this.hist.length - 1]
    if (!a) return null
    const dt = (b.t - a.t) / 1000
    for (const [w, o] of [['left_ankle', 'right_ankle'], ['right_ankle', 'left_ankle']] as const) {
      if (!ok(a.p[w], b.p[w], b.p[o])) continue
      const v = dist(a.p[w], b.p[w]) / dt
      const raised = b.p[o].y - b.p[w].y > 0.3 * T
      if (v > 3 * T && raised) return `Tornozelo a ${(v / T).toFixed(1)} torsos/s e erguido acima do outro pé.`
    }
    return null
  }
}

/** Nome legível de qualquer tipo de acontecimento. */
export function eventLabel(type: string): string {
  if (type.startsWith('mov_')) return MOVEMENT_LABEL[type.slice(4) as Movement] ?? type
  return ({ gol: 'Gol', cesta: 'Cesta', ponto: 'Ponto', finalizacao: 'Finalização', passe: 'Passe', interceptacao: 'Interceptação', arremesso_errado: 'Arremesso errado', replay_manual: 'Jogada marcada' } as Record<string, string>)[type] ?? type.replace(/_/g, ' ')
}
