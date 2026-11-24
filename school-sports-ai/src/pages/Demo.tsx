// Modo demonstração: simulação digital claramente identificada, armazenada em memória separada.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { DemoBanner, Card, Tabs, StatusChip } from '../components/ui'
import { DemoSimView } from '../components/DemoSim'
import { useDemo } from '../store/store'
import { newMatch } from '../store/matchFactory'
import { addCandidate, manualEvent, scoreOf, setStatus, matchTime } from '../events/eventLog'
import { StatsTable } from './Live'
import { fmtClock } from '../lib/util'
import type { Sport } from '../lib/types'

export default function Demo() {
  const [sport, setSport] = useState<Sport>('futsal')
  const [running, setRunning] = useState(true)
  const [id, setId] = useState<string | null>(null)
  const m = useDemo((s) => (id ? s.matches[id] : undefined))
  const save = useDemo((s) => s.save)
  useEffect(() => {
    const d = newMatch(sport, { name: `Demonstração · ${sport}`, demo: true, state: 'ao_vivo', clockRunning: true, clockStartedAt: Date.now(), teams: { A: { name: 'Equipe Simulada A', primaryColor: '#ef4444', players: [] }, B: { name: 'Equipe Simulada B', primaryColor: '#3b82f6', players: [] } } })
    save(d); setId(d.id)
  }, [sport])
  if (!m) return null
  const score = scoreOf(m.events)
  const get = () => useDemo.getState().matches[m.id]
  const pending = m.events.filter((e) => e.status === 'aguardando')
  return (
    <div className="space-y-4">
      <DemoBanner />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="h1">Modo demonstração</h1><p className="text-sm text-muted">Simulação digital (não é vídeo real). Use para conhecer o fluxo de confirmação, placar, estatísticas e relatório.</p></div>
        <Tabs value={sport} onChange={setSport} items={[{ id: 'futsal', label: 'Futsal' }, { id: 'basketball', label: 'Basquete' }, { id: 'volleyball', label: 'Vôlei' }]} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <div className="card flex items-center gap-4 p-3 font-mono text-2xl font-bold"><span>{m.teams.A.name} {score.A}</span><span className="text-muted">×</span><span>{score.B} {m.teams.B.name}</span><span className="ml-auto text-base">{fmtClock(matchTime(m))}</span>
            <button className="btn-ghost btn-sm font-sans" onClick={() => setRunning(!running)}>{running ? 'Pausar' : 'Retomar'}</button></div>
          <DemoSimView sport={sport} running={running} colors={{ A: m.teams.A.primaryColor, B: m.teams.B.primaryColor }} onEvent={(e) => {
            const cur = get(); if (!cur) return
            const scoring = e.kind === 'gol' || e.kind === 'cesta' || e.kind === 'ponto'
            save(addCandidate(cur, { type: e.kind, t: matchTime(cur), period: 1, team: e.team, playerId: e.from, points: e.kind === 'cesta' ? 2 : 1, scoring, confidence: scoring ? 0.6 : 0.4, status: scoring ? 'aguardando' : 'detectado', origin: 'demo', note: e.to ? `${e.from} → ${e.to} (simulado)` : 'simulado', evidences: [{ cameraId: 'camera-simulada', t: matchTime(cur), kind: 'simulacao', detail: 'Evento gerado pela simulação de demonstração.', confidence: 0.6 }] }, 0).match)
          }} />
          <StatsTable match={m} />
        </div>
        <div className="space-y-3">
          <Card title={`Aguardando confirmação (${pending.length})`}>
            {pending.slice(-5).reverse().map((e) => <div key={e.id} className="mb-1 flex items-center gap-1 text-sm"><span className="font-mono text-xs">{fmtClock(e.t)}</span><span className="flex-1">{e.type} {m.teams[e.team!].name}</span>
              <button className="btn-primary btn-sm" onClick={() => save(setStatus(get(), e.id, 'confirmado_manual'))} aria-label="Confirmar"><Check size={12} /></button><button className="btn-ghost btn-sm" onClick={() => save(setStatus(get(), e.id, 'rejeitado'))} aria-label="Rejeitar"><X size={12} /></button></div>)}
            {!pending.length && <p className="text-sm text-muted">Nada pendente.</p>}
          </Card>
          <Card title="Testar o placar">
            <div className="flex flex-wrap gap-1">{(['A', 'B'] as const).map((t) => <button key={t} className="btn-ghost btn-sm" onClick={() => save(manualEvent(get(), sport === 'futsal' ? 'gol' : sport === 'basketball' ? 'cesta' : 'ponto', { team: t, points: sport === 'basketball' ? 2 : 1, scoring: true }))}>+ {m.teams[t].name}</button>)}</div>
          </Card>
          <Card title="Linha do tempo"><ul className="max-h-60 space-y-0.5 overflow-auto text-xs">{[...m.events].reverse().slice(0, 25).map((e) => <li key={e.id} className="flex gap-2"><span className="font-mono text-muted">{fmtClock(e.t)}</span>{e.type}<span className="ml-auto"><StatusChip s={e.status} /></span></li>)}</ul></Card>
          <div className="flex gap-2"><Link className="btn-ghost btn-sm" to={`/partida/${m.id}/eventos`}>Revisar acontecimentos</Link><Link className="btn-ghost btn-sm" to={`/partida/${m.id}/relatorio`}>Ver relatório</Link></div>
        </div>
      </div>
    </div>
  )
}
