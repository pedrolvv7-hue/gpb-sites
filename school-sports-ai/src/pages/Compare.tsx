import { useState } from 'react'
import { useStore } from '../store/store'
import { Card, Empty, Notice } from '../components/ui'
import { ENGINES, SPORT_INFO } from '../sports'
import { fmtClock } from '../lib/util'
import type { Match } from '../lib/types'

export default function Compare() {
  const matches = Object.values(useStore((s) => s.matches))
  const [a, setA] = useState(''), [b, setB] = useState('')
  const A = matches.find((m) => m.id === a), B = matches.find((m) => m.id === b)
  const warn: string[] = []
  if (A && B) {
    if (A.sport !== B.sport) warn.push('Esportes diferentes: estatísticas não são comparáveis.')
    if (A.rules.periodMinutes !== B.rules.periodMinutes || A.rules.periods !== B.rules.periods) warn.push('Durações ou regras diferentes.')
    if (A.rules.playersOnCourt !== B.rules.playersOnCourt) warn.push('Quantidade de jogadores diferente.')
    const cov = (m: Match) => (m.coverage.analyzedMs ? m.coverage.ballSeenMs / m.coverage.analyzedMs : 0)
    if (Math.abs(cov(A) - cov(B)) > 0.2) warn.push('Cobertura de rastreamento muito diferente: mudanças podem refletir a qualidade da detecção, não o desempenho dos alunos.')
    if (Object.keys(A.calibrations).length !== Object.keys(B.calibrations).length) warn.push('Quantidade de câmeras calibradas diferente.')
  }
  const sel = (v: string, set: (s: string) => void, label: string) => <select className="input" value={v} onChange={(e) => set(e.target.value)} aria-label={label}><option value="">Selecione…</option>{matches.map((m) => <option key={m.id} value={m.id}>{SPORT_INFO[m.sport].emoji} {m.date} · {m.name}</option>)}</select>
  return (
    <div className="space-y-4">
      <h1 className="h1">Comparação entre partidas e treinamentos</h1>
      {matches.length < 2 ? <Empty title="São necessárias ao menos duas sessões salvas" /> : <>
        <div className="grid gap-2 sm:grid-cols-2">{sel(a, setA, 'Sessão 1')}{sel(b, setB, 'Sessão 2')}</div>
        {warn.map((w) => <Notice key={w} kind="warn">{w}</Notice>)}
        {A && B && A.sport === B.sport && <Card>
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted"><th className="p-2">Estatística</th><th className="p-2" colSpan={2}>{A.name}</th><th className="p-2" colSpan={2}>{B.name}</th></tr>
            <tr className="text-left text-xs text-muted"><th></th><th className="p-1">{A.teams.A.name}</th><th className="p-1">{A.teams.B.name}</th><th className="p-1">{B.teams.A.name}</th><th className="p-1">{B.teams.B.name}</th></tr></thead>
            <tbody>{ENGINES[A.sport].teamStats(A).map((r, i) => { const r2 = ENGINES[B.sport].teamStats(B)[i]; return <tr key={r.label} className="border-t border-line/50"><td className="p-2">{r.label}</td><td className="p-1 font-mono">{r.A}</td><td className="p-1 font-mono">{r.B}</td><td className="p-1 font-mono">{r2?.A}</td><td className="p-1 font-mono">{r2?.B}</td></tr> })}
              <tr className="border-t border-line/50 text-muted"><td className="p-2">Tempo analisado</td><td colSpan={2} className="p-1">{fmtClock(A.coverage.analyzedMs)}</td><td colSpan={2} className="p-1">{fmtClock(B.coverage.analyzedMs)}</td></tr></tbody></table>
        </Card>}
      </>}
    </div>
  )
}
