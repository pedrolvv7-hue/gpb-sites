import type { Match, PositionSample } from '../lib/types'
import { heatGrid } from '../analytics/movement'
import { Court } from './Court'

export function Heatmap({ match, samples, cols = 20, rows = 10 }: { match: Match; samples: PositionSample[]; cols?: number; rows?: number }) {
  const L = match.rules.courtLength, W = match.rules.courtWidth
  const { grid, n } = heatGrid(samples, L, W, cols, rows)
  const max = Math.max(...grid.flat(), 1e-9)
  return <div>
    <Court sport={match.sport} L={L} W={W}>
      {grid.map((row, r) => row.map((v, c) => v > 0 && <rect key={`${r}-${c}`} x={(c / cols) * L} y={(r / rows) * W} width={L / cols} height={W / rows} fill={`rgba(239,68,68,${(v / max) * 0.75})`} />))}
    </Court>
    <p className="mt-1 text-xs text-muted">{n ? `${n} amostras (1 por segundo de rastreamento), normalizadas por tempo observado.` : 'Sem posições calibradas registradas: informação indisponível.'}</p>
  </div>
}
