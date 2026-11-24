// Pipeline por câmera: detecção -> rastreamento -> equipes -> interpretação esportiva.
// A reprodução do vídeo é independente da frequência de inferência (adaptativa).
import type { CameraCalibration, Match, PositionSample, TeamSide } from '../lib/types'
import { MultiTracker, BallTracker, labelTracks, type Track, type Detection } from '../tracking/tracker'
import { TeamClassifier, torsoLab } from './color'
import type { ObjectDetector } from './detector'
import { applyH, footPoint } from '../calibration/homography'
import { ENGINES } from '../sports'
import type { Candidate, Detector } from '../sports/engine'
import { iou } from '../tracking/tracker'
import { MovementClassifier, SPORT_MOVEMENTS, MOVEMENT_LABEL, type PoseDetector, type PoseObs } from './pose'

export interface FrameResult {
  tracks: Track[]
  ballState: BallTracker['state']
  ball: { x: number; y: number; conf: number } | null
  trail: { x: number; y: number; observed: boolean }[]
  detections: Detection[]
  inferMs: number
  candidates: Candidate[]
  courtPlayers: { label: string; team: string; x: number; y: number; estimated: boolean }[]
  poses: PoseObs[]
  poseMs: number
}

export class CameraPipeline {
  tracker = new MultiTracker()
  ball = new BallTracker()
  teams: TeamClassifier
  sportDet: Detector
  private canvas = document.createElement('canvas')
  private ctx2d = this.canvas.getContext('2d', { willReadFrequently: true })!
  stats = { frames: 0, avgInferMs: 0, lastInferAt: 0, effectiveFps: 0 }
  private lastSampleT = -1e9
  pose: PoseDetector | null = null
  private moves = new Map<number, MovementClassifier>()
  private sport: Match['sport']

  constructor(public cameraId: string, private detector: ObjectDetector, match: Match, public calib?: CameraCalibration) {
    const tA = match.teams.A, tB = match.teams.B
    this.teams = new TeamClassifier([
      { team: 'A', colors: [tA.primaryColor, tA.secondaryColor ?? '', tA.keeperColor ?? ''] },
      { team: 'B', colors: [tB.primaryColor, tB.secondaryColor ?? '', tB.keeperColor ?? ''] },
    ])
    this.sportDet = ENGINES[match.sport].createDetector()
    this.sport = match.sport
  }

  /** Filtro de área de jogo: exige pés dentro da quadra calibrada (+1 m de margem). */
  private inCourt(match: Match, p: { x: number; y: number }) {
    if (!this.calib?.H) return true
    const q = applyH(this.calib.H, p)
    return q.x > -1 && q.y > -1 && q.x < match.rules.courtLength + 1 && q.y < match.rules.courtWidth + 1
  }

  async process(video: HTMLVideoElement, match: Match, t: number, minScore: number): Promise<FrameResult | null> {
    if (video.readyState < 2 || !video.videoWidth) return null
    const t0 = performance.now()
    const dets = await this.detector.detect(video, minScore)
    const inferMs = performance.now() - t0
    const persons = dets.filter((d) => d.cls === 'person' && this.inCourt(match, footPoint(d.box)))
    const tracks = this.tracker.step([...persons, ...dets.filter((d) => d.cls === 'ball')], t)
    // cor do tronco em resolução reduzida
    const W = 320, H = Math.round((video.videoHeight / video.videoWidth) * 320)
    this.canvas.width = W; this.canvas.height = H
    this.ctx2d.drawImage(video, 0, 0, W, H)
    const img = this.ctx2d.getImageData(0, 0, W, H).data
    for (const tr of tracks) {
      if (tr.misses > 0 || tr.manualLabel) continue
      const lab = torsoLab(img, W, { x: tr.box.x * W, y: tr.box.y * H, w: tr.box.w * W, h: tr.box.h * H })
      tr.team = this.teams.vote(tr.id, lab)
    }
    labelTracks(tracks)
    this.ball.step(t, dets, (x, y) => !this.calib?.H || this.inCourt(match, { x, y }))
    const visible = tracks.filter((x) => x.state !== 'tentativo')
    const courtPlayers = this.calib?.H ? visible.map((tr) => { const c = applyH(this.calib!.H!, footPoint(tr.box)); return { label: tr.label, team: tr.team, x: c.x, y: c.y, estimated: tr.misses > 0 } }) : []
    const ballImg = this.ball.state === 'detectada' || this.ball.state === 'recuperada' || this.ball.state === 'estimada' ? { x: this.ball.x, y: this.ball.y, conf: this.ball.confidence } : null
    const candidates = this.sportDet({
      t, period: match.period, cameraId: this.cameraId,
      ball: this.ball.history.filter((h) => h.t >= t - 3000),
      // projeção no chão: aproximação válida apenas com bola rasteira (futsal); documentado
      ballCourt: this.calib?.H && ballImg ? applyH(this.calib.H, ballImg) : undefined,
      players: visible.map((tr) => ({ label: tr.label, team: tr.team, foot: footPoint(tr.box), court: this.calib?.H ? applyH(this.calib.H, footPoint(tr.box)) : undefined })),
      calibration: this.calib,
    })
    // pose e movimentos (não dependem de bola nem de calibração)
    let poses: PoseObs[] = [], poseMs = 0
    if (this.pose) {
      const p0 = performance.now()
      try { poses = await this.pose.detect(video) } catch { poses = [] }
      poseMs = performance.now() - p0
      for (const po of poses) {
        if (po.box.w <= 0) continue
        let best: Track | null = null, bs = 0.05
        for (const tr of visible) { const s2 = iou(tr.box, po.box); if (s2 > bs) { bs = s2; best = tr } }
        if (!best) continue
        let mc = this.moves.get(best.id)
        if (!mc) { mc = new MovementClassifier(SPORT_MOVEMENTS[this.sport]); this.moves.set(best.id, mc) }
        for (const mv of mc.step(t, po.pose)) {
          candidates.push({ type: `mov_${mv.m}`, t, period: match.period, team: best.team === 'U' ? undefined : best.team, playerId: best.label, scoring: false, confidence: mv.conf * Math.min(1, po.score + 0.3),
            note: `${MOVEMENT_LABEL[mv.m]} · ${best.label}`, evidences: [{ cameraId: this.cameraId, t, kind: 'pose', detail: mv.detail, confidence: mv.conf }] })
        }
      }
      for (const id of this.moves.keys()) if (!this.tracker.tracks.some((x) => x.id === id)) this.moves.delete(id)
    }
    this.stats.frames++
    this.stats.avgInferMs = this.stats.avgInferMs * 0.9 + inferMs * 0.1
    const now = performance.now()
    if (this.stats.lastInferAt) this.stats.effectiveFps = this.stats.effectiveFps * 0.8 + (1000 / (now - this.stats.lastInferAt)) * 0.2
    this.stats.lastInferAt = now
    return { tracks: visible, ballState: this.ball.state, ball: ballImg, trail: this.ball.history.slice(-40), detections: dets, inferMs, candidates, courtPlayers, poses, poseMs }
  }

  /** Amostra posições a 1 Hz para mapas de calor (agregação; não salva quadros). */
  samplePositions(r: FrameResult, t: number): PositionSample[] {
    if (t - this.lastSampleT < 1000) return []
    this.lastSampleT = t
    return r.courtPlayers.map((p) => ({ t, trackId: p.label, team: p.team as TeamSide | 'U', x: +p.x.toFixed(2), y: +p.y.toFixed(2), estimated: p.estimated }))
  }

  possession() { return this.sportDet.possession?.() }
}
