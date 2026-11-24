// Registro de acontecimentos com auditoria. Funções puras: recebem a partida e devolvem nova partida.
// O placar é SEMPRE derivado dos eventos confirmados, então qualquer correção recalcula tudo.
import type { Correction, Match, SportEvent, TeamSide } from '../lib/types'
import { uid } from '../lib/util'

export const CONFIRMED: SportEvent['status'][] = ['confirmado_auto', 'confirmado_manual', 'corrigido']
export const isConfirmed = (e: SportEvent) => CONFIRMED.includes(e.status)

export function scoreOf(events: SportEvent[]): Record<TeamSide, number> {
  const s = { A: 0, B: 0 }
  for (const e of events) if (e.scoring && isConfirmed(e) && e.team && e.points) s[e.team] += e.points
  return s
}

export function scoreByPeriod(events: SportEvent[]): Record<number, Record<TeamSide, number>> {
  const out: Record<number, Record<TeamSide, number>> = {}
  for (const e of events) {
    if (!(e.scoring && isConfirmed(e) && e.team && e.points)) continue
    out[e.period] ??= { A: 0, B: 0 }
    out[e.period][e.team] += e.points
  }
  return out
}

function audit(m: Match, c: Omit<Correction, 'id' | 'at'>): Correction[] {
  return [...m.corrections, { ...c, id: uid(), at: Date.now() }]
}

/** Janela de deduplicação: evento do mesmo tipo/equipe muito próximo no tempo vira evidência extra. */
export function addCandidate(m: Match, ev: Omit<SportEvent, 'id' | 'matchId'>, dedupMs = 4000): { match: Match; event: SportEvent; merged: boolean } {
  const dup = m.events.find((e) => e.type === ev.type && e.team === ev.team && Math.abs(e.t - ev.t) < dedupMs && e.status !== 'rejeitado' && e.origin === ev.origin && ev.origin !== 'manual')
  if (dup) {
    const merged: SportEvent = { ...dup, evidences: [...dup.evidences, ...ev.evidences], confidence: Math.max(dup.confidence, ev.confidence) }
    return { match: { ...m, events: m.events.map((e) => (e.id === dup.id ? merged : e)) }, event: merged, merged: true }
  }
  const event: SportEvent = { ...ev, id: uid(), matchId: m.id }
  return { match: { ...m, events: [...m.events, event].sort((a, b) => a.t - b.t), corrections: audit(m, { eventId: event.id, by: ev.origin, action: 'criar', after: event }) }, event, merged: false }
}

export function setStatus(m: Match, id: string, status: SportEvent['status'], by = 'professor'): Match {
  const e = m.events.find((x) => x.id === id)
  if (!e) return m
  const action = status === 'rejeitado' ? 'rejeitar' : 'confirmar'
  return {
    ...m,
    events: m.events.map((x) => (x.id === id ? { ...x, status } : x)),
    corrections: audit(m, { eventId: id, by, action, before: { status: e.status }, after: { status } }),
  }
}

export function correctEvent(m: Match, id: string, patch: Partial<Pick<SportEvent, 'team' | 'playerId' | 'points' | 'type' | 'note'>>, by = 'professor'): Match {
  const e = m.events.find((x) => x.id === id)
  if (!e) return m
  const before: Partial<SportEvent> = {}
  for (const k of Object.keys(patch) as (keyof typeof patch)[]) (before as Record<string, unknown>)[k] = e[k]
  const onlyNote = Object.keys(patch).length === 1 && 'note' in patch
  return {
    ...m,
    events: m.events.map((x) => (x.id === id ? { ...x, ...patch, status: onlyNote ? x.status : 'corrigido' } : x)),
    corrections: audit(m, { eventId: id, by, action: onlyNote ? 'observacao' : 'corrigir', before, after: patch }),
  }
}

/** Evento manual (controle de emergência). Entra já confirmado manualmente. */
export function manualEvent(m: Match, type: string, opts: { team?: TeamSide; points?: number; scoring?: boolean; note?: string; playerId?: string; t?: number }): Match {
  return addCandidate(m, {
    type, t: opts.t ?? matchTime(m), period: m.period, team: opts.team, points: opts.points, playerId: opts.playerId,
    confidence: 1, status: 'confirmado_manual', origin: m.demo ? 'demo' : 'manual', evidences: [], note: opts.note, scoring: !!opts.scoring,
  }).match
}

export function matchTime(m: Match, now = Date.now()): number {
  return m.clockMs + (m.clockRunning && m.clockStartedAt ? now - m.clockStartedAt : 0)
}

/** Decide o estado inicial de um candidato da IA conforme modo e limites. */
export function initialStatus(scoring: boolean, confidence: number, mode: Match['scoringMode'], thresholds: { auto: number; min: number }, multiCamAgree: boolean): SportEvent['status'] {
  if (confidence < thresholds.min) return 'indeterminado'
  if (!scoring) return confidence >= thresholds.auto ? 'confirmado_auto' : 'detectado'
  // Eventos que mudam o placar: no modo assistido sempre aguardam o professor.
  if (mode === 'assistido') return 'aguardando'
  // Experimental: exige limite alto E concordância de pelo menos duas câmeras.
  return confidence >= thresholds.auto && multiCamAgree ? 'confirmado_auto' : 'aguardando'
}
