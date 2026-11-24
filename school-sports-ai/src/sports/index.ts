import type { Sport } from '../lib/types'
import type { SportEngine } from './engine'
import { futsal } from './futsal'
import { basketball } from './basketball'
import { volleyball } from './volleyball'

export const ENGINES: Record<Sport, SportEngine> = { futsal, basketball, volleyball }

export const SPORT_INFO: Record<Sport, { name: string; emoji: string; desc: string; cams: string; stats: string[] }> = {
  futsal: { name: 'Futsal', emoji: '⚽', desc: 'Gols por cruzamento de linha, posse estimada, passes e mapas táticos.', cams: '1 a 3 câmeras (central + uma por gol)', stats: ['Gols', 'Posse estimada', 'Passes', 'Finalizações', 'Faltas e cartões', 'Mapa de calor'] },
  basketball: { name: 'Basquete', emoji: '🏀', desc: 'Passagem da bola pelo aro, valor da cesta pela posição dos pés, rebotes e arremessos.', cams: '1 a 3 câmeras (central + uma por cesta)', stats: ['Pontos', 'Cestas de 1/2/3', 'Aproveitamento', 'Rebotes', 'Assistências', 'Mapa de arremessos'] },
  volleyball: { name: 'Vôlei', emoji: '🏐', desc: 'Máquina de rallies, travessias da rede, sets e fundamentos.', cams: '1 a 3 câmeras (lateral na rede + fundos)', stats: ['Pontos e sets', 'Saques', 'Recepções', 'Ataques', 'Bloqueios', 'Duração dos rallies'] },
}
