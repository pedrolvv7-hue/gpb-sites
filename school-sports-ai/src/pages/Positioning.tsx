import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Court } from '../components/Court'
import { Card, Tabs } from '../components/ui'
import type { Sport } from '../lib/types'
import { SPORT_INFO } from '../sports'

type Cam = { x: number; y: number; a: number; label: string }
const DIM: Record<Sport, [number, number]> = { futsal: [40, 20], basketball: [28, 15], volleyball: [18, 9] }
function layouts(s: Sport): Record<number, { cams: Cam[]; text: string }> {
  const [L, W] = DIM[s]
  const side: Cam = { x: L / 2, y: W + 2.2, a: -90, label: 'Principal (lateral, elevada)' }
  const opp: Cam = { x: L / 2, y: -2.2, a: 90, label: 'Lateral oposta' }
  const endA: Cam = { x: -2.2, y: W / 2 + 3, a: -20, label: s === 'futsal' ? 'Gol A (alinhada à linha)' : s === 'basketball' ? 'Cesta A' : 'Fundo A' }
  const endB: Cam = { x: L + 2.2, y: W / 2 + 3, a: 200, label: s === 'futsal' ? 'Gol B (alinhada à linha)' : s === 'basketball' ? 'Cesta B' : 'Fundo B' }
  const vNet: Cam = { x: L / 2 + 1, y: W + 2.2, a: -100, label: 'Lateral na rede (elevada)' }
  const main = s === 'volleyball' ? vNet : side
  return {
    1: { cams: [main], text: s === 'volleyball' ? 'Lateral elevada próxima ao centro, vendo os dois lados e a rede.' : 'Lateral, preferencialmente elevada, com visão ampla de toda a quadra. Jogadores, bola, equipes, mapa tático e eventos assistidos.' },
    2: { cams: [main, endA], text: 'Principal + uma auxiliar (um gol/cesta/fundo ou a lateral oposta, conforme a função escolhida).' },
    3: { cams: [main, endA, endB], text: s === 'futsal' ? 'Central + uma câmera em cada gol, com ângulo que permita ver a bola atravessando a linha.' : s === 'basketball' ? 'Central + uma câmera em cada cesta, facilitando ver a passagem pelo aro.' : 'Lateral na rede + uma atrás de cada linha de fundo (saques e bolas na linha).' },
    4: { cams: [main, endA, endB, opp], text: 'Adiciona a lateral oposta: menos oclusões e melhor fusão de observações.' },
    5: { cams: [main, endA, endB, opp, { x: L * 0.25, y: W + 2.2, a: -60, label: 'Extra (replays)' }], text: 'Ângulos alternativos para replays e análises adicionais, conforme a capacidade do computador.' },
  }
}

export default function Positioning() {
  const { sport: sp } = useParams()
  const [sport, setSport] = useState<Sport>((sp as Sport) in DIM ? (sp as Sport) : 'futsal')
  const [n, setN] = useState(1)
  const [L, W] = DIM[sport]
  const lay = layouts(sport)[n]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2"><h1 className="h1">Guia de posicionamento · {SPORT_INFO[sport].name}</h1><Tabs value={sport} onChange={setSport} items={[{ id: 'futsal', label: 'Futsal' }, { id: 'basketball', label: 'Basquete' }, { id: 'volleyball', label: 'Vôlei' }]} /></div>
      <div className="flex gap-1">{[1, 2, 3, 4, 5].map((k) => <button key={k} onClick={() => setN(k)} className={`btn-sm rounded border px-4 ${n === k ? 'border-blue bg-blue/20' : 'border-line'}`}>{k}{k === 5 ? '+' : ''} câmera{k > 1 ? 's' : ''}</button>)}</div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-3 lg:col-span-2">
          <svg viewBox={`-5 -5 ${L + 10} ${W + 10}`} className="w-full" role="img" aria-label="Diagrama de posicionamento">
            <foreignObject x={-1} y={-1} width={L + 2} height={W + 2}><Court sport={sport} L={L} W={W} /></foreignObject>
            {lay.cams.map((c, i) => <g key={i} transform={`translate(${c.x} ${c.y})`}>
              <path d="M0 0 L6 -2.5 L6 2.5 Z" transform={`rotate(${c.a})`} fill="rgba(59,130,246,.25)" />
              <rect x={-0.8} y={-0.5} width={1.6} height={1} rx={0.2} fill="#3B82F6" />
              <text y={c.y > W ? 2 : -1.2} textAnchor="middle" fontSize={0.9} fill="#F8FAFC">{i + 1}. {c.label}</text>
            </g>)}
          </svg>
        </div>
        <Card title="Recomendação">
          <p className="text-sm text-muted">{lay.text}</p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted">
            <li>Sempre fora da área de jogo, em local seguro e autorizado.</li>
            <li>Quanto mais alta, menos jogadores se escondem uns atrás dos outros.</li>
            <li>Câmera fixa: qualquer movimento exige recalibrar.</li>
            <li>Evite contraluz e reflexos no piso.</li>
          </ul>
          <Link to="/nova" className="btn-primary btn-sm mt-4">Nova partida</Link>
        </Card>
      </div>
    </div>
  )
}
