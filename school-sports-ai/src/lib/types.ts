// Tipos centrais compartilhados por todos os motores esportivos.

export type Sport = 'futsal' | 'basketball' | 'volleyball'
export type TeamSide = 'A' | 'B'
export type TeamLabel = TeamSide | 'U' // U = equipe indefinida

export type MatchKind = 'amistoso' | 'campeonato' | 'treinamento' | 'aula' | 'avaliacao'
export type ScoringMode = 'assistido' | 'automatico_experimental'

export interface TeamConfig {
  name: string
  primaryColor: string // hex
  secondaryColor?: string
  keeperColor?: string // goleiro (futsal) ou líbero (vôlei)
  players: { number: string; nickname?: string; starter: boolean }[]
}

export interface RulesProfile {
  id: string
  version: number
  sport: Sport
  name: string
  periods: number
  periodMinutes: number
  breakMinutes: number
  overtime: boolean
  playersOnCourt: number
  // futsal
  teamFoulLimit?: number
  penaltyShootout?: boolean
  // basquete
  shotClockSeconds?: number | null
  personalFoulLimit?: number
  // vôlei
  sets?: number
  pointsPerSet?: number
  decidingSetPoints?: number
  minLead?: number
  courtLength: number // metros
  courtWidth: number
  custom?: string
}

export type EventStatus =
  | 'detectado'
  | 'estimado'
  | 'aguardando'
  | 'confirmado_auto'
  | 'confirmado_manual'
  | 'rejeitado'
  | 'corrigido'
  | 'indeterminado'

export type EventOrigin = 'ia' | 'manual' | 'demo'

export interface Evidence {
  cameraId: string
  t: number // ms na linha do tempo da partida
  kind: string // ex.: 'cruzamento_linha', 'passagem_aro'
  detail: string
  confidence: number // 0..1, pontuação interna, NÃO é precisão garantida
}

export interface SportEvent {
  id: string
  matchId: string
  type: string // 'gol', 'cesta', 'ponto', 'falta', 'finalizacao', ...
  t: number
  period: number
  team?: TeamSide
  playerId?: string
  points?: number // impacto no placar quando confirmado
  confidence: number
  status: EventStatus
  origin: EventOrigin
  evidences: Evidence[]
  note?: string
  clipId?: string
  scoring: boolean // altera placar?
}

export interface Correction {
  id: string
  eventId: string
  at: number // epoch
  by: string
  action: 'confirmar' | 'rejeitar' | 'corrigir' | 'criar' | 'invalidar' | 'observacao'
  before?: Partial<SportEvent>
  after?: Partial<SportEvent>
}

export interface CourtPoint { x: number; y: number } // metros no plano da quadra
export interface ImagePoint { x: number; y: number } // pixels normalizados 0..1

export interface CameraCalibration {
  cameraId: string
  imagePts: ImagePoint[] // 4 cantos (ou mais)
  courtPts: CourtPoint[]
  H?: number[] // homografia 3x3 imagem->quadra
  reprojErrorM?: number
  savedAt?: number
  // regiões específicas em coordenadas de imagem normalizadas
  goals?: { team: TeamSide; postL: ImagePoint; postR: ImagePoint; bar?: ImagePoint }[]
  hoops?: { team: TeamSide; center: ImagePoint; radius: number }[]
  net?: { left: ImagePoint; right: ImagePoint; topY: number }
}

export interface MatchConfig {
  id: string
  sport: Sport
  name: string
  activity?: string
  school?: string
  className?: string
  date: string
  kind: MatchKind
  teams: Record<TeamSide, TeamConfig>
  rules: RulesProfile
  cameraCount: number
  scoringMode: ScoringMode
  createdAt: number
  demo: boolean
}

export type MatchState = 'configurando' | 'ao_vivo' | 'pausada' | 'encerrada'

export interface Match extends MatchConfig {
  state: MatchState
  period: number
  clockMs: number // tempo de jogo decorrido no período
  clockRunning: boolean
  clockStartedAt?: number
  events: SportEvent[]
  corrections: Correction[]
  calibrations: Record<string, CameraCalibration>
  notes: string
  positions: PositionSample[] // amostragem agregada (1 Hz) para mapas de calor
  coverage: { analyzedMs: number; ballSeenMs: number }
  possession?: { A: number; B: number; contested: number; free: number; unknown: number }
  endedAt?: number
}

export interface PositionSample {
  t: number
  trackId: string
  team: TeamLabel
  x: number
  y: number
  estimated: boolean
}
