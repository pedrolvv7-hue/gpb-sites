// Simulação digital (NÃO é análise de vídeo). Usada apenas na página inicial e no modo demonstração,
// sempre com indicação visível.
import { useEffect, useRef, useState } from 'react'
import type { Sport } from '../lib/types'
import { Court, PlayerMarker } from './Court'

export interface SimPlayer { id: string; team: 'A' | 'B'; x: number; y: number; tx: number; ty: number }
export interface SimState { players: SimPlayer[]; ball: { x: number; y: number }; holder: number; trail: { x: number; y: number }[] }

const DIM: Record<Sport, [number, number, number]> = { futsal: [40, 20, 5], basketball: [28, 15, 5], volleyball: [18, 9, 6] }

export function initSim(sport: Sport, seed = 1): SimState {
  const [L, W, n] = DIM[sport]
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const players: SimPlayer[] = []
  for (const team of ['A', 'B'] as const) for (let i = 0; i < n; i++) {
    const half = team === 'A' ? 0 : L / 2
    const x = half + 1 + rnd() * (L / 2 - 2), y = 1 + rnd() * (W - 2)
    players.push({ id: `${team}${String(i + 1).padStart(2, '0')}`, team, x, y, tx: x, ty: y })
  }
  return { players, ball: { x: players[0].x, y: players[0].y }, holder: 0, trail: [] }
}

export function stepSim(st: SimState, sport: Sport, dt: number, rnd: () => number): { st: SimState; event?: { kind: 'passe' | 'interceptacao' | 'gol' | 'cesta' | 'ponto'; team: 'A' | 'B'; from: string; to?: string } } {
  const [L, W] = DIM[sport]
  let event
  const players = st.players.map((p) => {
    let { tx, ty } = p
    if (Math.hypot(tx - p.x, ty - p.y) < 0.3 || rnd() < 0.01) {
      const vb = sport === 'volleyball'
      const minX = vb ? (p.team === 'A' ? 0.5 : L / 2 + 0.5) : 0.5, maxX = vb ? (p.team === 'A' ? L / 2 - 0.5 : L - 0.5) : L - 0.5
      tx = minX + rnd() * (maxX - minX); ty = 0.5 + rnd() * (W - 1)
    }
    const d = Math.hypot(tx - p.x, ty - p.y) || 1, v = 3.5 * dt
    return { ...p, tx, ty, x: p.x + ((tx - p.x) / d) * Math.min(v, d), y: p.y + ((ty - p.y) / d) * Math.min(v, d) }
  })
  let { holder, ball } = st
  const h = players[holder]
  const target = { x: h.x, y: h.y }
  ball = { x: ball.x + (target.x - ball.x) * Math.min(1, dt * 6), y: ball.y + (target.y - ball.y) * Math.min(1, dt * 6) }
  if (rnd() < dt * 0.9) {
    const r = rnd()
    const mates = players.map((p, i) => ({ p, i })).filter((x) => x.i !== holder)
    const pick = mates[Math.floor(rnd() * mates.length)]
    if (r < 0.06) { event = { kind: sport === 'futsal' ? 'gol' : sport === 'basketball' ? 'cesta' : 'ponto', team: h.team, from: h.id } as const; holder = players.findIndex((p) => p.team !== h.team) }
    else { event = { kind: pick.p.team === h.team ? 'passe' : 'interceptacao', team: pick.p.team, from: h.id, to: pick.p.id } as const; holder = pick.i }
  }
  return { st: { players, ball, holder, trail: [...st.trail.slice(-25), ball] }, event }
}

export function DemoSimView({ sport, colors = { A: '#ef4444', B: '#3b82f6' }, running = true, onEvent, className }: { sport: Sport; colors?: { A: string; B: string }; running?: boolean; onEvent?: (e: NonNullable<ReturnType<typeof stepSim>['event']>) => void; className?: string }) {
  const [st, setSt] = useState(() => initSim(sport))
  const rndRef = useRef((() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647) })())
  const cb = useRef(onEvent); cb.current = onEvent
  useEffect(() => { setSt(initSim(sport)) }, [sport])
  useEffect(() => {
    if (!running) return
    let raf = 0, last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now
      setSt((s) => { const r = stepSim(s, sport, dt, rndRef.current); if (r.event) queueMicrotask(() => cb.current?.(r.event!)); return r.st })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, sport])
  const [L, W] = DIM[sport]
  return (
    <div className={`relative ${className ?? ''}`}>
      <Court sport={sport} L={L} W={W}>
        <polyline points={st.trail.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fde047" strokeWidth={0.12} opacity={0.7} />
        {st.players.map((p) => <PlayerMarker key={p.id} x={p.x} y={p.y} color={colors[p.team]} label={p.id} side={p.team} />)}
        <circle cx={st.ball.x} cy={st.ball.y} r={0.3} fill="#fde047" stroke="#000" strokeWidth={0.05} />
      </Court>
      <span className="chip absolute left-2 top-2 bg-pend text-black">Simulação ilustrativa</span>
    </div>
  )
}
