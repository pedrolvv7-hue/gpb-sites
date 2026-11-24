import type { Match, Sport, TeamConfig } from '../lib/types'
import { ENGINES } from '../sports'
import { uid } from '../lib/util'

const team = (name: string, color: string): TeamConfig => ({ name, primaryColor: color, players: [] })

export function newMatch(sport: Sport, p: Partial<Match> = {}): Match {
  return {
    id: uid(), sport, name: 'Nova partida', date: new Date().toISOString().slice(0, 10), kind: 'aula',
    teams: { A: team('Equipe A', '#ef4444'), B: team('Equipe B', '#3b82f6') },
    rules: ENGINES[sport].defaultRules(), cameraCount: 1, scoringMode: 'assistido', createdAt: Date.now(), demo: false,
    state: 'configurando', period: 1, clockMs: 0, clockRunning: false, events: [], corrections: [], calibrations: {}, notes: '',
    positions: [], coverage: { analyzedMs: 0, ballSeenMs: 0 },
    ...p,
  }
}
