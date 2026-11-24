import { useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Printer, FileJson, FileSpreadsheet, Image, Trash2, Share2 } from 'lucide-react'
import { useMatch, useStore } from '../store/store'
import { Card, Empty, Notice, DemoBanner, StatusChip } from '../components/ui'
import { StatsTable } from './Live'
import { Heatmap } from '../components/Heatmap'
import { scoreOf, scoreByPeriod, isConfirmed } from '../events/eventLog'
import { ENGINES, SPORT_INFO } from '../sports'
import { movementStats } from '../analytics/movement'
import { download, fmtClock, toCSV } from '../lib/util'
import { clipStore } from '../replay/ringRecorder'

export default function Report() {
  const { id } = useParams()
  const m = useMatch(id)
  const nav = useNavigate()
  const save = useStore((s) => s.saveMatch)
  const del = useStore((s) => s.deleteMatch)
  const [notes, setNotes] = useState(m?.notes ?? '')
  const [heatSel, setHeatSel] = useState<'all' | 'A' | 'B' | string>('all')
  const players = useMemo(() => {
    if (!m) return []
    const ids = [...new Set(m.positions.map((p) => p.trackId))]
    return ids.map((tid) => { const s = m.positions.filter((p) => p.trackId === tid); return { id: tid, team: s[0]?.team, ...movementStats(s), events: m.events.filter((e) => e.playerId === tid && isConfirmed(e)).length } }).sort((a, b) => a.id.localeCompare(b.id))
  }, [m?.positions, m?.events])
  if (!m) return <Empty title="Partida não encontrada" />
  const score = scoreOf(m.events), byP = scoreByPeriod(m.events)
  const engine = ENGINES[m.sport]
  const hasCal = Object.values(m.calibrations).some((c) => c.H)
  const indet = m.events.filter((e) => e.status === 'indeterminado' || e.status === 'aguardando').length
  const heatSamples = m.positions.filter((p) => heatSel === 'all' || p.team === heatSel || p.trackId === heatSel)
  const clips = m.events.filter((e) => e.clipId && clipStore.has(e.clipId)).length

  const exportJSON = () => download(`${m.name}-relatorio.json`, JSON.stringify({ ...m, exportedAt: new Date().toISOString(), positions: m.positions.length > 5000 ? `${m.positions.length} amostras omitidas` : m.positions }, null, 2))
  const exportCSV = () => download(`${m.name}-eventos.csv`, toCSV(m.events.map((e) => ({ horario: fmtClock(e.t), periodo: e.period, tipo: e.type, equipe: e.team ? m.teams[e.team].name : '', jogador: e.playerId ?? '', pontos: e.scoring ? e.points ?? '' : '', estado: e.status, origem: e.origin, confianca: e.confidence.toFixed(2), observacao: e.note ?? '' }))), 'text/csv')
  const exportStatsCSV = () => download(`${m.name}-estatisticas.csv`, toCSV(engine.teamStats(m).map((r) => ({ estatistica: r.label, [m.teams.A.name]: r.A, [m.teams.B.name]: r.B, nota: r.note ?? '' }))), 'text/csv')
  function scoreImage() {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630
    const g = c.getContext('2d')!
    g.fillStyle = '#080B10'; g.fillRect(0, 0, 1200, 630)
    g.fillStyle = '#94A3B8'; g.font = '28px sans-serif'; g.textAlign = 'center'; g.fillText(`${SPORT_INFO[m!.sport].name} · ${m!.name} · ${m!.date}`, 600, 90)
    g.font = 'bold 160px sans-serif'; g.fillStyle = m!.teams.A.primaryColor; g.fillText(String(score.A), 380, 360); g.fillStyle = m!.teams.B.primaryColor; g.fillText(String(score.B), 820, 360)
    g.fillStyle = '#F8FAFC'; g.font = 'bold 40px sans-serif'; g.fillText(m!.teams.A.name, 380, 450); g.fillText(m!.teams.B.name, 820, 450); g.fillText('×', 600, 330)
    g.fillStyle = '#3B82F6'; g.font = '24px sans-serif'; g.fillText('School Sports AI', 600, 580)
    c.toBlob((b) => b && download(`${m!.name}-placar.png`, b))
  }
  const summary = `${m.name} (${m.date}) · ${m.teams.A.name} ${score.A} × ${score.B} ${m.teams.B.name}`

  return (
    <div className="space-y-4">
      {m.demo && <DemoBanner />}
      <div className="no-print flex flex-wrap items-end justify-between gap-2">
        <h1 className="h1">Relatório pós-partida</h1>
        <div className="flex flex-wrap gap-1">
          <button className="btn-ghost btn-sm" onClick={() => window.print()}><Printer size={14} />PDF (imprimir)</button>
          <button className="btn-ghost btn-sm" onClick={exportCSV}><FileSpreadsheet size={14} />CSV eventos</button>
          <button className="btn-ghost btn-sm" onClick={exportStatsCSV}><FileSpreadsheet size={14} />CSV estatísticas</button>
          <button className="btn-ghost btn-sm" onClick={exportJSON}><FileJson size={14} />JSON</button>
          <button className="btn-ghost btn-sm" onClick={scoreImage}><Image size={14} />Imagem do placar</button>
          <button className="btn-ghost btn-sm" onClick={() => navigator.share ? navigator.share({ text: summary }).catch(() => {}) : navigator.clipboard?.writeText(summary)}><Share2 size={14} />Resumo</button>
        </div>
      </div>
      <Card>
        <p className="text-sm text-muted">{SPORT_INFO[m.sport].name} · {m.kind} · {m.date}{m.school ? ` · ${m.school}` : ''}{m.className ? ` · ${m.className}` : ''}</p>
        <h2 className="mt-1 text-2xl font-bold">{m.name}</h2>
        <div className="mt-3 font-mono text-4xl font-bold">{m.teams.A.name} {score.A} × {score.B} {m.teams.B.name}</div>
        <p className="mt-1 text-sm text-muted">{m.sport === 'volleyball' ? engine.extraScore!(m).map((s) => `${s.label}: ${s.A}-${s.B}`).join(' · ') : Object.entries(byP).map(([p, s]) => `P${p}: ${s.A}-${s.B}`).join(' · ') || 'Sem pontos confirmados'}</p>
        <p className="mt-1 text-xs text-muted">Estado: {m.state} · Duração registrada: {fmtClock(m.clockMs)}</p>
      </Card>
      <StatsTable match={m} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Mapa de calor" action={<select className="input w-40" value={heatSel} onChange={(e) => setHeatSel(e.target.value)} aria-label="Filtro"><option value="all">Todos</option><option value="A">{m.teams.A.name}</option><option value="B">{m.teams.B.name}</option>{players.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}</select>}>
          <Heatmap match={m} samples={heatSamples} />
        </Card>
        <Card title="Jogadores rastreados (identificadores temporários)">
          {!hasCal ? <Notice kind="info">Sem calibração: distância e velocidade indisponíveis.</Notice> : !players.length ? <p className="text-sm text-muted">Nenhum jogador rastreado com posição calibrada.</p> :
            <div className="max-h-80 overflow-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted"><th>ID</th><th>Equipe</th><th>Distância est.</th><th>Vel. máx. est.</th><th>Tempo observado</th><th>Eventos</th></tr></thead>
              <tbody>{players.map((p) => <tr key={p.id} className="border-t border-line/50"><td className="py-1 font-mono">{p.id}</td><td>{p.team}</td><td>{p.distanceM.toFixed(0)} m</td><td>{p.maxSpeedMs != null ? `${(p.maxSpeedMs * 3.6).toFixed(1)} km/h` : 'Informação indisponível'}</td><td>{fmtClock(p.observedMs)}</td><td>{p.events}</td></tr>)}</tbody></table>
              <p className="mt-1 text-[11px] text-muted">Estimativas. Não usar para avaliação física definitiva ou diagnóstico. Identificadores podem ter sido trocados pelo rastreador.</p></div>}
        </Card>
      </div>
      <Card title="Acontecimentos importantes">
        <ul className="space-y-1 text-sm">{m.events.filter((e) => e.scoring || ['cartao_vermelho', 'penalti'].includes(e.type)).map((e) => <li key={e.id} className="flex gap-2"><span className="font-mono text-muted">{fmtClock(e.t)}</span>{e.type} {e.team ? m.teams[e.team].name : ''} {e.points && e.scoring ? `+${e.points}` : ''}<span className="ml-auto"><StatusChip s={e.status} /></span></li>)}</ul>
      </Card>
      <Card title="Cobertura, correções e limitações">
        <ul className="list-inside list-disc space-y-1 text-sm text-muted">
          <li>Tempo analisado pela IA: {fmtClock(m.coverage.analyzedMs)}; bola visível em {m.coverage.analyzedMs ? Math.round((m.coverage.ballSeenMs / m.coverage.analyzedMs) * 100) + '%' : 'informação indisponível'} desse tempo.</li>
          <li>Acontecimentos indeterminados ou não confirmados: {indet} (não entram no placar).</li>
          <li>Correções registradas: {m.corrections.filter((c) => c.action !== 'criar').length}.</li>
          <li>Câmeras calibradas: {Object.values(m.calibrations).filter((c) => c.H).length}.</li>
          <li>Replays disponíveis nesta sessão: {clips}.</li>
          <li>Detector genérico (COCO-SSD) tem revocação limitada para bolas pequenas e rápidas; eventos de pontuação com uma câmera são análises 2D.</li>
          <li>Este relatório não avalia personalidade, inteligência, disciplina ou valor de nenhum aluno.</li>
        </ul>
      </Card>
      <Card title="Observações do professor" className="no-print">
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="btn-ghost btn-sm mt-2" onClick={() => save({ ...m, notes })}>Salvar observações</button>
      </Card>
      {m.notes && <p className="hidden print:block">Observações: {m.notes}</p>}
      <div className="no-print flex flex-wrap gap-2">
        <Link to={`/partida/${m.id}/eventos`} className="btn-ghost">Revisar acontecimentos</Link>
        {m.state !== 'encerrada' && <Link to={`/partida/${m.id}/ao-vivo`} className="btn-ghost">Voltar à partida</Link>}
        <button className="btn-danger ml-auto" onClick={() => { if (confirm('Excluir esta partida e todos os seus dados deste dispositivo? Esta ação não pode ser desfeita.')) { del(m.id); nav('/historico') } }}><Trash2 size={14} />Excluir dados da partida</button>
      </div>
    </div>
  )
}
