// Interface comum dos motores esportivos. Cada esporte implementa suas próprias regras,
// detectores e estatísticas sem misturar lógica com os outros.
import type { CameraCalibration, CourtPoint, Match, RulesProfile, Sport, SportEvent, TeamLabel, TeamSide } from '../lib/types'

export interface BallObs { t: number; x: number; y: number; observed: boolean }
export interface PlayerObs { label: string; team: TeamLabel; foot: { x: number; y: number }; court?: CourtPoint }

export interface FrameContext {
  t: number // tempo de partida (ms)
  period: number
  cameraId: string
  ball: BallObs[] // histórico recente em coordenadas de imagem normalizadas
  ballCourt?: CourtPoint // posição projetada (apenas válida quando a bola está no chão)
  players: PlayerObs[]
  calibration?: CameraCalibration
}

export type Candidate = Omit<SportEvent, 'id' | 'matchId' | 'status' | 'origin'>

export type Detector = ((ctx: FrameContext) => Candidate[]) & { possession?: () => { A: number; B: number; contested: number; free: number; unknown: number } }

export interface StatRow { label: string; A: string | number; B: string | number; note?: string }

export interface SportEngine {
  sport: Sport
  name: string
  defaultRules(): RulesProfile
  eventTypes: { type: string; label: string; scoring: boolean; points?: number }[]
  /** Detectores: recebem o quadro e um estado mutável próprio do motor. */
  createDetector(): Detector
  teamStats(m: Match): StatRow[]
  periodLabel(m: Match): string
  /** Estado de sets/períodos derivado dos eventos (vôlei usa sets). */
  extraScore?(m: Match): { label: string; A: number; B: number }[]
  manualActions: { type: string; label: string; scoring: boolean; points?: number; needsTeam: boolean }[]
}

export const countEv = (m: Match, type: string, team: TeamSide, pred: (e: SportEvent) => boolean = () => true) =>
  m.events.filter((e) => e.type === type && e.team === team && e.status !== 'rejeitado' && e.status !== 'indeterminado' && pred(e)).length
