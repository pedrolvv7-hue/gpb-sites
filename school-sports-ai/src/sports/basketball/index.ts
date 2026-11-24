// Motor de basquete: cesta = bola observada acima do aro e, em seguida, abaixo do aro dentro
// da largura do aro, com movimento descendente. Valor da cesta pela posição dos PÉS do arremessador.
import type { Match, RulesProfile, TeamSide, CourtPoint } from '../../lib/types'
import type { BallObs, Candidate, Detector, FrameContext, SportEngine } from '../engine'
import { countEv } from '../engine'
import { isConfirmed } from '../../events/eventLog'
import { pct } from '../../lib/util'

export function basketballRules(): RulesProfile {
  return { id: 'basquete-escolar', version: 1, sport: 'basketball', name: 'Basquete escolar (editável)', periods: 4, periodMinutes: 8, breakMinutes: 2, overtime: true, playersOnCourt: 5, shotClockSeconds: null, personalFoulLimit: 5, courtLength: 28, courtWidth: 15 }
}

export type BasketVerdict = 'cesta_possivel' | 'aro_saiu' | 'passou_ao_lado' | 'sem_evidencia'

/**
 * Sequência exigida (somente pontos observados):
 * 1) ponto acima do aro (y < cy - r*0.3) com |x-cx| < 2r;
 * 2) depois, ponto abaixo do aro (y > cy + r*0.6) com |x-cx| < r*0.9;
 * 3) entre eles, nenhum ponto muito fora lateralmente e deslocamento vertical descendente.
 */
export function analyzeHoop(track: BallObs[], hoop: { center: { x: number; y: number }; radius: number }, maxGapMs = 900): BasketVerdict {
  const obs = track.filter((p) => p.observed)
  const { center: c, radius: r } = hoop
  let above: BallObs | null = null
  let sawNear = false
  for (const p of obs) {
    const dx = Math.abs(p.x - c.x)
    if (p.y < c.y - r * 0.3 && dx < 2 * r) { above = p; continue }
    if (!above) continue
    if (dx < 2.5 * r && Math.abs(p.y - c.y) < r * 1.5) sawNear = true
    if (p.t - above.t > maxGapMs) { above = null; continue }
    if (p.y > c.y + r * 0.6) {
      if (dx < r * 0.9 && p.y > above.y) return 'cesta_possivel'
      if (dx < 3 * r) return 'passou_ao_lado'
    }
    if (dx > 2.5 * r && p.y > c.y - r && sawNear) return 'aro_saiu'
  }
  return 'sem_evidencia'
}

/** Valor da cesta pela posição do pé do arremessador (metros) e da cesta no plano da quadra. */
export function classifyShotValue(feet: CourtPoint | undefined, hoopCourt: CourtPoint | undefined, threeRadius = 6.75, margin = 0.35, cornerY?: { min: number; max: number; cornerDist: number }): { points: 2 | 3 | null; reason: string } {
  if (!feet || !hoopCourt) return { points: null, reason: 'Posição dos pés ou da cesta indisponível (calibração necessária).' }
  const d = Math.hypot(feet.x - hoopCourt.x, feet.y - hoopCourt.y)
  let limit = threeRadius
  if (cornerY && (feet.y < cornerY.min || feet.y > cornerY.max)) limit = cornerY.cornerDist
  if (d > limit + margin) return { points: 3, reason: `Pés a ${d.toFixed(2)} m da cesta (linha a ${limit} m).` }
  if (d < limit - margin) return { points: 2, reason: `Pés a ${d.toFixed(2)} m da cesta (linha a ${limit} m).` }
  return { points: null, reason: `Pés a ${d.toFixed(2)} m, muito próximos da linha de ${limit} m: confirmação necessária.` }
}

export const basketball: SportEngine = {
  sport: 'basketball',
  name: 'Basquete',
  defaultRules: basketballRules,
  eventTypes: [
    { type: 'cesta', label: 'Cesta', scoring: true },
    { type: 'arremesso_errado', label: 'Arremesso errado', scoring: false },
    { type: 'rebote_of', label: 'Rebote ofensivo', scoring: false },
    { type: 'rebote_def', label: 'Rebote defensivo', scoring: false },
  ],
  manualActions: [
    { type: 'cesta', label: '+1 lance livre', scoring: true, points: 1, needsTeam: true },
    { type: 'cesta', label: '+2 pontos', scoring: true, points: 2, needsTeam: true },
    { type: 'cesta', label: '+3 pontos', scoring: true, points: 3, needsTeam: true },
    { type: 'arremesso_errado', label: 'Arremesso errado', scoring: false, needsTeam: true },
    { type: 'rebote_of', label: 'Rebote ofensivo', scoring: false, needsTeam: true },
    { type: 'rebote_def', label: 'Rebote defensivo', scoring: false, needsTeam: true },
    { type: 'assistencia', label: 'Assistência', scoring: false, needsTeam: true },
    { type: 'roubo', label: 'Roubo de bola', scoring: false, needsTeam: true },
    { type: 'toco', label: 'Toco', scoring: false, needsTeam: true },
    { type: 'perda', label: 'Perda de bola', scoring: false, needsTeam: true },
    { type: 'falta', label: 'Falta pessoal', scoring: false, needsTeam: true },
    { type: 'falta_tecnica', label: 'Falta técnica', scoring: false, needsTeam: true },
    { type: 'violacao', label: 'Violação', scoring: false, needsTeam: true },
    { type: 'pedido_tempo', label: 'Pedido de tempo', scoring: false, needsTeam: true },
    { type: 'substituicao', label: 'Substituição', scoring: false, needsTeam: true },
  ],
  createDetector(): Detector {
    const last: Record<string, number> = {}
    return (ctx: FrameContext): Candidate[] => {
      const out: Candidate[] = []
      const recent = ctx.ball.filter((b) => b.t >= ctx.t - 2000)
      for (const h of ctx.calibration?.hoops ?? []) {
        const key = `${ctx.cameraId}-${h.team}`
        if (ctx.t - (last[key] ?? -1e9) < 3000) continue
        const v = analyzeHoop(recent, h)
        if (v === 'sem_evidencia') continue
        last[key] = ctx.t
        // a cesta marcada pertence à equipe que a DEFENDE
        const attacker: TeamSide = h.team === 'A' ? 'B' : 'A'
        if (v === 'cesta_possivel') {
          out.push({ type: 'cesta', t: ctx.t, period: ctx.period, team: attacker, points: 2, scoring: true, confidence: 0.55,
            note: 'Valor da cesta precisa ser confirmado (2 pontos sugerido; posição dos pés não verificada).',
            evidences: [{ cameraId: ctx.cameraId, t: ctx.t, kind: 'passagem_aro', detail: 'Bola observada acima do aro e depois abaixo, dentro da largura do aro, descendo.', confidence: 0.55 }] })
        } else {
          out.push({ type: 'arremesso_errado', t: ctx.t, period: ctx.period, team: attacker, scoring: false, confidence: 0.35, note: v === 'aro_saiu' ? 'Possível bola no aro que saiu' : 'Possível bola ao lado do aro',
            evidences: [{ cameraId: ctx.cameraId, t: ctx.t, kind: v, detail: 'Trajetória próxima ao aro sem passagem completa.', confidence: 0.35 }] })
        }
      }
      return out
    }
  },
  periodLabel: (m) => (m.period > m.rules.periods ? `Prorrogação ${m.period - m.rules.periods}` : `${m.period}º quarto`),
  teamStats(m: Match) {
    const made = (t: TeamSide, p: number) => m.events.filter((e) => e.type === 'cesta' && e.team === t && isConfirmed(e) && e.points === p).length
    const miss = (t: TeamSide) => countEv(m, 'arremesso_errado', t)
    const fga = (t: TeamSide) => made(t, 2) + made(t, 3) + miss(t)
    const c = (type: string, t: TeamSide) => countEv(m, type, t)
    return [
      { label: 'Lances livres convertidos', A: made('A', 1), B: made('B', 1) },
      { label: 'Cestas de 2', A: made('A', 2), B: made('B', 2) },
      { label: 'Cestas de 3', A: made('A', 3), B: made('B', 3) },
      { label: 'Arremessos de quadra (tentados)', A: fga('A'), B: fga('B'), note: 'Errados contam apenas os registrados/detectados.' },
      { label: 'Aproveitamento de quadra', A: pct(made('A', 2) + made('A', 3), fga('A')), B: pct(made('B', 2) + made('B', 3), fga('B')) },
      { label: 'Cestas aguardando confirmação', A: countEv(m, 'cesta', 'A', (e) => e.status === 'aguardando'), B: countEv(m, 'cesta', 'B', (e) => e.status === 'aguardando') },
      { label: 'Rebotes ofensivos', A: c('rebote_of', 'A'), B: c('rebote_of', 'B') },
      { label: 'Rebotes defensivos', A: c('rebote_def', 'A'), B: c('rebote_def', 'B') },
      { label: 'Assistências', A: c('assistencia', 'A'), B: c('assistencia', 'B') },
      { label: 'Roubos', A: c('roubo', 'A'), B: c('roubo', 'B') },
      { label: 'Tocos', A: c('toco', 'A'), B: c('toco', 'B') },
      { label: 'Perdas de bola', A: c('perda', 'A'), B: c('perda', 'B') },
      { label: 'Faltas', A: c('falta', 'A') + c('falta_tecnica', 'A'), B: c('falta', 'B') + c('falta_tecnica', 'B') },
    ]
  },
}
