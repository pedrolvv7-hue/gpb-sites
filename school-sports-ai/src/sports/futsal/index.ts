// Motor de futsal: gols (cruzamento completo da linha entre os postes), posse, passes e estatísticas.
import type { Match, RulesProfile, TeamSide } from '../../lib/types'
import type { BallObs, Candidate, Detector, FrameContext, SportEngine } from '../engine'
import { countEv } from '../engine'
import { isConfirmed } from '../../events/eventLog'
import { pct } from '../../lib/util'

export function futsalRules(): RulesProfile {
  return { id: 'futsal-escolar', version: 1, sport: 'futsal', name: 'Futsal escolar (editável)', periods: 2, periodMinutes: 20, breakMinutes: 10, overtime: false, playersOnCourt: 5, teamFoulLimit: 5, penaltyShootout: true, courtLength: 40, courtWidth: 20 }
}

type Pt = { x: number; y: number }
const side = (a: Pt, b: Pt, p: Pt) => Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x))

/** Parâmetro t (0..1) da projeção do cruzamento entre segmento p0->p1 e linha a->b, e u ao longo de a->b. */
function intersect(a: Pt, b: Pt, p0: Pt, p1: Pt): { u: number; s: number } | null {
  const d = (b.x - a.x) * (p1.y - p0.y) - (b.y - a.y) * (p1.x - p0.x)
  if (Math.abs(d) < 1e-12) return null
  const u = ((p0.x - a.x) * (p1.y - p0.y) - (p0.y - a.y) * (p1.x - p0.x)) / d
  const s = ((p0.x - a.x) * (b.y - a.y) - (p0.y - a.y) * (b.x - a.x)) / d
  return { u, s }
}

export type GoalVerdict = 'gol_possivel' | 'na_trave' | 'fora' | 'por_cima' | 'retornou' | 'sem_evidencia'

/**
 * Analisa a trajetória observada (somente pontos VISTOS, nunca estimados) contra a linha do gol
 * marcada na câmera. Exige: cruzamento entre os postes, abaixo do travessão (se marcado),
 * no sentido de dentro do gol e permanência do lado de dentro por pelo menos `minInside` observações.
 * `insideRef` é um ponto qualquer dentro do gol (define o sentido).
 */
export function analyzeGoalLine(track: BallObs[], goal: { postL: Pt; postR: Pt; bar?: Pt; insideRef: Pt }, minInside = 2, postTol = 0.04): GoalVerdict {
  const obs = track.filter((p) => p.observed)
  if (obs.length < 3) return 'sem_evidencia'
  const inSide = side(goal.postL, goal.postR, goal.insideRef)
  for (let i = 1; i < obs.length; i++) {
    const p0 = obs[i - 1], p1 = obs[i]
    if (side(goal.postL, goal.postR, p0) === inSide || side(goal.postL, goal.postR, p1) !== inSide) continue
    const hit = intersect(goal.postL, goal.postR, p0, p1)
    if (!hit) continue
    // u: posição ao longo da linha (0 = poste esquerdo, 1 = direito)
    if (hit.u < -postTol || hit.u > 1 + postTol) return 'fora'
    if (hit.u < postTol || hit.u > 1 - postTol) return 'na_trave'
    if (goal.bar) {
      const cy = p0.y + (p1.y - p0.y) * hit.s
      if (cy < goal.bar.y) return 'por_cima'
    }
    const after = obs.slice(i)
    const inside = after.filter((p) => side(goal.postL, goal.postR, p) === inSide).length
    // Se voltou para fora logo em seguida sem acumular observações dentro, não há prova.
    if (inside < minInside) return 'retornou'
    return 'gol_possivel'
  }
  return 'sem_evidencia'
}

export type PossessionState = 'A' | 'B' | 'livre' | 'disputada' | 'nao_detectada'

/** Posse por tick, com histerese: só atribui controle após permanência contínua. */
export class PossessionEstimator {
  totals = { A: 0, B: 0, contested: 0, free: 0, unknown: 0 }
  holder: { label: string; team: TeamSide } | null = null
  private candidate: { label: string; team: TeamSide; since: number } | null = null
  lastHolder: { label: string; team: TeamSide; t: number } | null = null
  constructor(private radiusM = 1.0, private minHoldMs = 400) {}

  step(t: number, dt: number, ball: { x: number; y: number } | null, players: { label: string; team: 'A' | 'B' | 'U'; x: number; y: number }[]): { state: PossessionState; transfer?: { from: { label: string; team: TeamSide }; to: { label: string; team: TeamSide } } } {
    if (!ball) { this.totals.unknown += dt; return { state: 'nao_detectada' } }
    const near = players.filter((p) => p.team !== 'U' && Math.hypot(p.x - ball.x, p.y - ball.y) <= this.radiusM) as { label: string; team: TeamSide; x: number; y: number }[]
    const teams = new Set(near.map((p) => p.team))
    if (teams.size > 1) { this.totals.contested += dt; this.candidate = null; return { state: 'disputada' } }
    if (near.length === 0) {
      this.candidate = null
      if (this.holder) { this.lastHolder = { ...this.holder, t }; this.holder = null }
      this.totals.free += dt
      return { state: 'livre' }
    }
    const closest = near.reduce((a, b) => (Math.hypot(a.x - ball.x, a.y - ball.y) <= Math.hypot(b.x - ball.x, b.y - ball.y) ? a : b))
    if (!this.candidate || this.candidate.label !== closest.label) this.candidate = { label: closest.label, team: closest.team, since: t }
    let transfer
    if (t - this.candidate.since >= this.minHoldMs && (!this.holder || this.holder.label !== closest.label)) {
      const prev = this.holder ?? this.lastHolder
      this.holder = { label: closest.label, team: closest.team }
      if (prev && prev.label !== closest.label) transfer = { from: { label: prev.label, team: prev.team }, to: this.holder }
    }
    if (this.holder) { this.totals[this.holder.team] += dt; return { state: this.holder.team, transfer } }
    this.totals.free += dt
    return { state: 'livre', transfer }
  }
}

const GOAL_COOLDOWN = 6000

export const futsal: SportEngine = {
  sport: 'futsal',
  name: 'Futsal',
  defaultRules: futsalRules,
  eventTypes: [
    { type: 'gol', label: 'Gol', scoring: true, points: 1 },
    { type: 'finalizacao', label: 'Finalização', scoring: false },
    { type: 'passe', label: 'Passe', scoring: false },
    { type: 'interceptacao', label: 'Interceptação', scoring: false },
    { type: 'defesa', label: 'Defesa', scoring: false },
    { type: 'falta', label: 'Falta', scoring: false },
  ],
  manualActions: [
    { type: 'gol', label: 'Gol', scoring: true, points: 1, needsTeam: true },
    { type: 'falta', label: 'Falta', scoring: false, needsTeam: true },
    { type: 'cartao_amarelo', label: 'Cartão amarelo', scoring: false, needsTeam: true },
    { type: 'cartao_vermelho', label: 'Cartão vermelho', scoring: false, needsTeam: true },
    { type: 'escanteio', label: 'Escanteio', scoring: false, needsTeam: true },
    { type: 'lateral', label: 'Lateral', scoring: false, needsTeam: true },
    { type: 'finalizacao', label: 'Finalização', scoring: false, needsTeam: true },
    { type: 'defesa', label: 'Defesa', scoring: false, needsTeam: true },
    { type: 'penalti', label: 'Pênalti', scoring: false, needsTeam: true },
    { type: 'pedido_tempo', label: 'Pedido de tempo', scoring: false, needsTeam: true },
    { type: 'substituicao', label: 'Substituição', scoring: false, needsTeam: true },
  ],
  createDetector() {
    const lastGoalT: Record<string, number> = {}
    const poss = new PossessionEstimator()
    let lastT = -1
    const det: Detector = (ctx: FrameContext): Candidate[] => {
      const out: Candidate[] = []
      const goals = ctx.calibration?.goals ?? []
      const recent = ctx.ball.filter((b) => b.t >= ctx.t - 1500)
      for (const g of goals) {
        const key = `${ctx.cameraId}-${g.team}`
        if (ctx.t - (lastGoalT[key] ?? -1e9) < GOAL_COOLDOWN) continue
        // ponto de referência "dentro do gol": deslocado perpendicularmente para longe do centro da imagem
        const mx = (g.postL.x + g.postR.x) / 2, my = (g.postL.y + g.postR.y) / 2
        const nx = -(g.postR.y - g.postL.y), ny = g.postR.x - g.postL.x
        const dir = (mx - 0.5) * nx + (my - 0.5) * ny >= 0 ? 1 : -1
        const insideRef = { x: mx + nx * 0.2 * dir, y: my + ny * 0.2 * dir }
        const v = analyzeGoalLine(recent, { ...g, insideRef })
        if (v === 'gol_possivel') {
          lastGoalT[key] = ctx.t
          // a equipe marcada no gol é a DEFENSORA; o gol é da adversária
          const scorer: TeamSide = g.team === 'A' ? 'B' : 'A'
          out.push({ type: 'gol', t: ctx.t, period: ctx.period, team: scorer, points: 1, scoring: true, confidence: 0.6,
            evidences: [{ cameraId: ctx.cameraId, t: ctx.t, kind: 'cruzamento_linha', detail: 'Trajetória observada cruzou a linha entre os postes e permaneceu dentro do gol (análise 2D de uma câmera).', confidence: 0.6 }] })
        } else if (v === 'na_trave') {
          lastGoalT[key] = ctx.t
          out.push({ type: 'finalizacao', t: ctx.t, period: ctx.period, team: g.team === 'A' ? 'B' : 'A', scoring: false, confidence: 0.4, note: 'Possível bola na trave',
            evidences: [{ cameraId: ctx.cameraId, t: ctx.t, kind: 'proximo_poste', detail: 'Cruzamento muito próximo do poste.', confidence: 0.4 }] })
        }
      }
      // Posse e passes: requerem calibração (coordenadas no plano da quadra)
      if (ctx.calibration?.H) {
        const dt = lastT < 0 ? 0 : Math.min(1000, ctx.t - lastT)
        const ballOk = ctx.ball.length && ctx.ball[ctx.ball.length - 1].observed && ctx.ball[ctx.ball.length - 1].t === ctx.t
        const pl = ctx.players.filter((p) => p.court).map((p) => ({ label: p.label, team: p.team, x: p.court!.x, y: p.court!.y }))
        const r = poss.step(ctx.t, dt, ballOk && ctx.ballCourt ? ctx.ballCourt : null, pl)
        if (r.transfer) {
          const same = r.transfer.from.team === r.transfer.to.team
          out.push({ type: same ? 'passe' : 'interceptacao', t: ctx.t, period: ctx.period, team: same ? r.transfer.from.team : r.transfer.to.team, playerId: same ? r.transfer.from.label : r.transfer.to.label, scoring: false, confidence: 0.35,
            note: same ? `${r.transfer.from.label} → ${r.transfer.to.label} (estimado)` : `Interceptação de ${r.transfer.to.label} (estimado)`,
            evidences: [{ cameraId: ctx.cameraId, t: ctx.t, kind: 'mudanca_controle', detail: 'Mudança de jogador em controle após permanência mínima próxima à bola.', confidence: 0.35 }] })
        }
      }
      lastT = ctx.t
      return out
    }
    det.possession = () => ({ ...poss.totals })
    return det
  },
  periodLabel: (m) => `${m.period}º tempo`,
  teamStats(m: Match) {
    const c = (type: string, t: TeamSide, p?: (e: import('../../lib/types').SportEvent) => boolean) => countEv(m, type, t, p)
    const goals = (t: TeamSide) => m.events.filter((e) => e.type === 'gol' && e.team === t && isConfirmed(e)).length
    const passes = (t: TeamSide) => c('passe', t)
    const inter = (t: TeamSide) => c('interceptacao', t === 'A' ? 'B' : 'A')
    const p = m.possession
    const known = p ? p.A + p.B : 0
    return [
      { label: 'Gols confirmados', A: goals('A'), B: goals('B') },
      { label: 'Gols aguardando confirmação', A: c('gol', 'A', (e) => e.status === 'aguardando'), B: c('gol', 'B', (e) => e.status === 'aguardando') },
      { label: 'Posse (sobre tempo com posse conhecida)', A: p ? pct(p.A, known) : 'Informação indisponível', B: p ? pct(p.B, known) : 'Informação indisponível',
        note: p ? `Denominador: ${(known / 1000).toFixed(0)} s com posse atribuída. Disputada ${(p.contested / 1000).toFixed(0)} s, livre ${(p.free / 1000).toFixed(0)} s, não detectada ${(p.unknown / 1000).toFixed(0)} s (não redistribuídos).` : 'Requer calibração e bola detectada.' },
      { label: 'Passes estimados', A: passes('A'), B: passes('B') },
      { label: 'Passes interceptados pelo adversário', A: inter('A'), B: inter('B') },
      { label: 'Precisão de passe (estimada)', A: pct(passes('A'), passes('A') + inter('A')), B: pct(passes('B'), passes('B') + inter('B')) },
      { label: 'Finalizações', A: c('finalizacao', 'A'), B: c('finalizacao', 'B') },
      { label: 'Defesas', A: c('defesa', 'A'), B: c('defesa', 'B') },
      { label: 'Escanteios (registrados)', A: c('escanteio', 'A'), B: c('escanteio', 'B') },
      { label: 'Faltas (registradas)', A: c('falta', 'A'), B: c('falta', 'B'), note: m.rules.teamFoulLimit ? `Limite configurado: ${m.rules.teamFoulLimit} por período` : undefined },
      { label: 'Cartões amarelos', A: c('cartao_amarelo', 'A'), B: c('cartao_amarelo', 'B') },
      { label: 'Cartões vermelhos', A: c('cartao_vermelho', 'A'), B: c('cartao_vermelho', 'B') },
    ]
  },
}
