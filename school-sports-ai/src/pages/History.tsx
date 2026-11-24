import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/store'
import { Empty } from '../components/ui'
import { SPORT_INFO } from '../sports'
import { scoreOf } from '../events/eventLog'

export default function HistoryPage() {
  const matches = Object.values(useStore((s) => s.matches)).sort((a, b) => b.createdAt - a.createdAt)
  const [q, setQ] = useState(''), [sport, setSport] = useState('')
  const list = matches.filter((m) => (!sport || m.sport === sport) && (m.name + m.teams.A.name + m.teams.B.name + (m.className ?? '')).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-4">
      <h1 className="h1">Histórico de partidas</h1>
      <div className="flex flex-wrap gap-2"><input className="input max-w-xs" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /><select className="input w-40" value={sport} onChange={(e) => setSport(e.target.value)} aria-label="Esporte"><option value="">Todos</option>{Object.entries(SPORT_INFO).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></div>
      {!list.length ? <Empty title="Nenhuma partida"><Link className="text-blue" to="/nova">Criar partida</Link></Empty> :
        <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-xs text-muted"><th className="p-2">Data</th><th className="p-2">Esporte</th><th className="p-2">Partida</th><th className="p-2">Placar</th><th className="p-2">Estado</th><th className="p-2"></th></tr></thead>
          <tbody>{list.map((m) => { const s = scoreOf(m.events); return <tr key={m.id} className="border-b border-line/50"><td className="p-2">{m.date}</td><td className="p-2">{SPORT_INFO[m.sport].emoji} {SPORT_INFO[m.sport].name}</td><td className="p-2">{m.name}</td><td className="p-2 font-mono">{m.teams.A.name} {s.A} × {s.B} {m.teams.B.name}</td><td className="p-2">{m.state}</td><td className="p-2 text-right"><Link className="text-blue" to={m.state === 'encerrada' ? `/partida/${m.id}/relatorio` : `/partida/${m.id}/ao-vivo`}>Abrir</Link></td></tr> })}</tbody></table></div>}
    </div>
  )
}
