// Motor de vôlei: máquina de estados de rally, travessias da rede e lógica de sets.
import type { Match, RulesProfile, SportEvent, TeamSide } from '../../lib/types'
import type { Candidate, Detector, FrameContext, SportEngine } from '../engine'
import { countEv } from '../engine'
import { isConfirmed } from '../../events/eventLog'

export function volleyballRules(): RulesProfile {
  return { id: 'volei-escolar', version: 1, sport: 'volleyball', name: 'Vôlei escolar (editável)', periods: 1, periodMinutes: 0, breakMinutes: 3, overtime: false, playersOnCourt: 6, sets: 3, pointsPerSet: 25, decidingSetPoints: 15, minLead: 2, courtLength: 18, courtWidth: 9 }
}

export interface SetState { sets: { A: number; B: number }[]; current: number; setsWon: { A: number; B: number }; matchOver: boolean; winner?: TeamSide; server?: TeamSide }

/** Calcula sets a partir dos pontos confirmados, em ordem temporal. Nunca conta um rally duas vezes. */
export function computeSets(events: SportEvent[], r: RulesProfile, firstServer: TeamSide = 'A'): SetState {
  const total = r.sets ?? 3
  const need = Math.ceil(total / 2)
  const st: SetState = { sets: [{ A: 0, B: 0 }], current: 0, setsWon: { A: 0, B: 0 }, matchOver: false, server: firstServer }
  const seenRally = new Set<string>()
  const pts = events.filter((e) => e.type === 'ponto' && isConfirmed(e) && e.team).sort((a, b) => a.t - b.t)
  for (const e of pts) {
    if (st.matchOver) break
    const rk = e.note?.startsWith('rally:') ? e.note : undefined
    if (rk) { if (seenRally.has(rk)) continue; seenRally.add(rk) }
    const s = st.sets[st.current]
    s[e.team!] += e.points ?? 1
    st.server = e.team
    const deciding = st.current === total - 1
    const target = deciding ? (r.decidingSetPoints ?? 15) : (r.pointsPerSet ?? 25)
    const lead = r.minLead ?? 2
    const w: TeamSide | null = s.A >= target && s.A - s.B >= lead ? 'A' : s.B >= target && s.B - s.A >= lead ? 'B' : null
    if (w) {
      st.setsWon[w]++
      if (st.setsWon[w] >= need) { st.matchOver = true; st.winner = w }
      else { st.sets.push({ A: 0, B: 0 }); st.current++ }
    }
  }
  return st
}

export type RallyState = 'aguardando_saque' | 'rally' | 'bola_nao_detectada' | 'possivel_fim' | 'aguardando_confirmacao'

/**
 * Máquina de estados de rally para câmera lateral com a rede marcada (net.left.x..net.right.x é
 * a extensão horizontal da rede; o lado é dado por x em relação ao centro da rede).
 * Ausência temporária da bola NÃO encerra o rally: apenas após `lostMs` sem bola ou bola parada.
 */
export class RallyMachine {
  state: RallyState = 'aguardando_saque'
  startT = 0
  crossings = 0
  side: TeamSide | null = null
  lastSeenT = 0
  rallyId = 0
  private stillSince = -1
  constructor(private netX: number, private sideOfA: 'esquerda' | 'direita', private lostMs = 2500, private stillMs = 1200) {}

  private sideAt(x: number): TeamSide {
    const left = x < this.netX
    return (left ? this.sideOfA === 'esquerda' : this.sideOfA === 'direita') ? 'A' : 'B'
  }

  step(t: number, ball: { x: number; y: number; vx: number; vy: number } | null): { ended?: { rallyId: number; lastSide: TeamSide | null; durationMs: number; crossings: number; reason: string } } {
    if (this.state === 'aguardando_confirmacao') return {}
    if (ball) {
      const s = this.sideAt(ball.x)
      const moving = Math.hypot(ball.vx, ball.vy) > 0.004
      if (this.state === 'aguardando_saque') {
        if (moving) { this.state = 'rally'; this.startT = t; this.crossings = 0; this.side = s; this.rallyId++ }
      } else {
        if (this.side && s !== this.side) this.crossings++
        this.side = s
        this.state = 'rally'
        if (!moving) { if (this.stillSince < 0) this.stillSince = t } else this.stillSince = -1
        if (this.stillSince >= 0 && t - this.stillSince > this.stillMs) return this.end(t, 'bola parada')
      }
      this.lastSeenT = t
    } else if (this.state === 'rally' || this.state === 'bola_nao_detectada') {
      this.state = 'bola_nao_detectada'
      if (t - this.lastSeenT > this.lostMs) return this.end(t, 'bola não detectada por tempo prolongado')
    }
    return {}
  }

  private end(t: number, reason: string) {
    this.state = 'aguardando_confirmacao'
    this.stillSince = -1
    return { ended: { rallyId: this.rallyId, lastSide: this.side, durationMs: t - this.startT, crossings: this.crossings, reason } }
  }

  /** Professor confirmou ou rejeitou: volta a aguardar saque. */
  resolve() { this.state = 'aguardando_saque' }
}

export const volleyball: SportEngine = {
  sport: 'volleyball',
  name: 'Vôlei',
  defaultRules: volleyballRules,
  eventTypes: [
    { type: 'ponto', label: 'Ponto', scoring: true, points: 1 },
    { type: 'fim_rally', label: 'Fim de rally', scoring: false },
  ],
  manualActions: [
    { type: 'ponto', label: 'Ponto', scoring: true, points: 1, needsTeam: true },
    { type: 'saque', label: 'Saque', scoring: false, needsTeam: true },
    { type: 'ace', label: 'Saque direto', scoring: false, needsTeam: true },
    { type: 'erro_saque', label: 'Erro de saque', scoring: false, needsTeam: true },
    { type: 'recepcao', label: 'Recepção', scoring: false, needsTeam: true },
    { type: 'levantamento', label: 'Levantamento', scoring: false, needsTeam: true },
    { type: 'ataque', label: 'Ataque', scoring: false, needsTeam: true },
    { type: 'ataque_ponto', label: 'Ataque convertido', scoring: false, needsTeam: true },
    { type: 'bloqueio', label: 'Bloqueio', scoring: false, needsTeam: true },
    { type: 'defesa', label: 'Defesa', scoring: false, needsTeam: true },
    { type: 'toque_rede', label: 'Toque na rede', scoring: false, needsTeam: true },
    { type: 'invasao', label: 'Invasão', scoring: false, needsTeam: true },
    { type: 'erro_rodizio', label: 'Erro de rodízio', scoring: false, needsTeam: true },
    { type: 'pedido_tempo', label: 'Pedido de tempo', scoring: false, needsTeam: true },
    { type: 'substituicao', label: 'Substituição', scoring: false, needsTeam: true },
  ],
  createDetector(): Detector {
    let machine: RallyMachine | null = null
    return (ctx: FrameContext): Candidate[] => {
      const net = ctx.calibration?.net
      if (!net) return []
      machine ??= new RallyMachine((net.left.x + net.right.x) / 2, 'esquerda')
      const obs = ctx.ball.filter((b) => b.observed)
      const last = obs[obs.length - 1], prev = obs[obs.length - 2]
      const ball = last && last.t === ctx.t ? { x: last.x, y: last.y, vx: prev ? last.x - prev.x : 0, vy: prev ? last.y - prev.y : 0 } : null
      const r = machine.step(ctx.t, ball)
      if (!r.ended) return []
      const e = r.ended
      // Sugestão fraca: a bola terminou do lado X => ponto do adversário. Sempre requer confirmação.
      const team: TeamSide | undefined = e.lastSide ? (e.lastSide === 'A' ? 'B' : 'A') : undefined
      machine.resolve() // o ponto fica aguardando o professor; o próximo saque inicia novo rally
      return [{ type: 'ponto', t: ctx.t, period: ctx.period, team, points: 1, scoring: true, confidence: 0.3, note: `rally:${ctx.cameraId}:${e.rallyId}`,
        evidences: [{ cameraId: ctx.cameraId, t: ctx.t, kind: 'fim_rally', detail: `Rally de ${(e.durationMs / 1000).toFixed(1)} s, ${e.crossings} travessia(s) da rede. Encerrado por: ${e.reason}. Equipe sugerida pelo último lado observado; contato com o chão NÃO foi verificado.`, confidence: 0.3 }] }]
    }
  },
  periodLabel: (m) => `Set ${computeSets(m.events, m.rules).current + 1}`,
  extraScore(m) { return computeSets(m.events, m.rules).sets.map((s, i) => ({ label: `Set ${i + 1}`, A: s.A, B: s.B })) },
  teamStats(m: Match) {
    const s = computeSets(m.events, m.rules)
    const c = (type: string, t: TeamSide) => countEv(m, type, t)
    return [
      { label: 'Sets vencidos', A: s.setsWon.A, B: s.setsWon.B },
      { label: 'Pontos no set atual', A: s.sets[s.current].A, B: s.sets[s.current].B },
      { label: 'Pontos aguardando confirmação', A: countEv(m, 'ponto', 'A', (e) => e.status === 'aguardando'), B: countEv(m, 'ponto', 'B', (e) => e.status === 'aguardando') },
      { label: 'Saques diretos', A: c('ace', 'A'), B: c('ace', 'B') },
      { label: 'Erros de saque', A: c('erro_saque', 'A'), B: c('erro_saque', 'B') },
      { label: 'Recepções', A: c('recepcao', 'A'), B: c('recepcao', 'B') },
      { label: 'Levantamentos', A: c('levantamento', 'A'), B: c('levantamento', 'B') },
      { label: 'Ataques', A: c('ataque', 'A') + c('ataque_ponto', 'A'), B: c('ataque', 'B') + c('ataque_ponto', 'B') },
      { label: 'Ataques convertidos', A: c('ataque_ponto', 'A'), B: c('ataque_ponto', 'B') },
      { label: 'Bloqueios', A: c('bloqueio', 'A'), B: c('bloqueio', 'B') },
      { label: 'Defesas', A: c('defesa', 'A'), B: c('defesa', 'B') },
    ]
  },
}
