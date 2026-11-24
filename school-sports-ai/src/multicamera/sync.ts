// Sincronização de relógios entre câmeras (estilo NTP) e fusão de eventos/observações.
import type { SportEvent, CourtPoint, TeamLabel } from '../lib/types'

/** Uma troca ping/pong: t0 envio (central), t1 recebido (câmera), t2 resposta (câmera), t3 recebido (central). */
export interface PingSample { t0: number; t1: number; t2: number; t3: number }

/** Estima offset (relógio da câmera - central) usando as amostras de menor RTT (mais confiáveis). */
export function estimateOffset(samples: PingSample[]): { offsetMs: number; rttMs: number; jitterMs: number } | null {
  if (!samples.length) return null
  const r = samples.map((s) => ({ off: ((s.t1 - s.t0) + (s.t2 - s.t3)) / 2, rtt: (s.t3 - s.t0) - (s.t2 - s.t1) })).sort((a, b) => a.rtt - b.rtt)
  const best = r.slice(0, Math.max(1, Math.ceil(r.length / 3)))
  const off = best.reduce((a, b) => a + b.off, 0) / best.length
  const rtts = r.map((x) => x.rtt)
  const mean = rtts.reduce((a, b) => a + b, 0) / rtts.length
  const jitter = Math.sqrt(rtts.reduce((a, b) => a + (b - mean) ** 2, 0) / rtts.length)
  return { offsetMs: off, rttMs: best[0].rtt, jitterMs: jitter }
}

/** Converte timestamp de captura da câmera para o relógio central. */
export const toCentral = (cameraTs: number, offsetMs: number) => cameraTs - offsetMs

export function syncLevel(jitterMs: number | undefined): 'bom' | 'regular' | 'ruim' | 'desconhecido' {
  if (jitterMs === undefined) return 'desconhecido'
  return jitterMs < 30 ? 'bom' : jitterMs < 100 ? 'regular' : 'ruim'
}

/** Buffer temporal: entrega quadros em ordem de captura, descartando os que chegam depois de `delayMs`. */
export class JitterBuffer<T extends { ts: number }> {
  private q: T[] = []
  dropped = 0
  constructor(private delayMs = 150) {}
  push(item: T, now: number) {
    if (now - item.ts > this.delayMs * 4) { this.dropped++; return }
    this.q.push(item); this.q.sort((a, b) => a.ts - b.ts)
  }
  pop(now: number): T[] {
    const ready = this.q.filter((x) => now - x.ts >= this.delayMs)
    this.q = this.q.filter((x) => now - x.ts < this.delayMs)
    return ready
  }
  get size() { return this.q.length }
}

/**
 * Funde eventos candidatos de várias câmeras: mesmo tipo dentro de `windowMs` vira um único
 * evento com múltiplas evidências. Se as câmeras discordarem da equipe, marca conflito
 * (precisa de revisão) em vez de escolher arbitrariamente.
 */
export function fuseEvents(cands: Omit<SportEvent, 'id' | 'matchId'>[], windowMs = 1500): (Omit<SportEvent, 'id' | 'matchId'> & { conflict: boolean; cameras: string[] })[] {
  const sorted = [...cands].sort((a, b) => a.t - b.t)
  const groups: (typeof sorted)[] = []
  for (const c of sorted) {
    const g = groups.find((g) => g[0].type === c.type && Math.abs(g[0].t - c.t) <= windowMs)
    if (g) g.push(c); else groups.push([c])
  }
  return groups.map((g) => {
    const teams = new Set(g.map((x) => x.team).filter(Boolean))
    const cameras = [...new Set(g.flatMap((x) => x.evidences.map((e) => e.cameraId)))]
    const conflict = teams.size > 1
    const conf = conflict ? Math.min(...g.map((x) => x.confidence)) : 1 - g.reduce((p, x) => p * (1 - x.confidence), 1)
    return { ...g[0], team: conflict ? undefined : g[0].team, confidence: conf, evidences: g.flatMap((x) => x.evidences), status: conflict ? 'aguardando' : g[0].status, conflict, cameras }
  })
}

/** Associação de jogadores entre câmeras por proximidade no plano da quadra e equipe. */
export function associateGlobal(obs: { cameraId: string; label: string; team: TeamLabel; court: CourtPoint }[], maxDistM = 1.2): { globalId: string; members: { cameraId: string; label: string }[]; court: CourtPoint; team: TeamLabel }[] {
  const out: { globalId: string; members: { cameraId: string; label: string }[]; court: CourtPoint; team: TeamLabel }[] = []
  for (const o of obs) {
    const g = out.find((g) => g.team === o.team && !g.members.some((m) => m.cameraId === o.cameraId) && Math.hypot(g.court.x - o.court.x, g.court.y - o.court.y) <= maxDistM)
    if (g) {
      const n = g.members.length
      g.court = { x: (g.court.x * n + o.court.x) / (n + 1), y: (g.court.y * n + o.court.y) / (n + 1) }
      g.members.push({ cameraId: o.cameraId, label: o.label })
    } else out.push({ globalId: `G${out.length + 1}`, members: [{ cameraId: o.cameraId, label: o.label }], court: o.court, team: o.team })
  }
  return out
}
