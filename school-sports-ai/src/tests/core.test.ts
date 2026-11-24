import { describe, it, expect } from 'vitest'
import { applyH, computeHomography, isValidQuad, reprojectionError, footPoint } from '../calibration/homography'
import { MultiTracker, BallTracker, iou } from '../tracking/tracker'
import { TeamClassifier, rgbToLab, hexToRgb, uniformsTooSimilar } from '../vision/color'
import { addCandidate, correctEvent, initialStatus, manualEvent, scoreOf, setStatus } from '../events/eventLog'
import { analyzeGoalLine, PossessionEstimator } from '../sports/futsal'
import { analyzeHoop, classifyShotValue } from '../sports/basketball'
import { computeSets, RallyMachine, volleyballRules } from '../sports/volleyball'
import { movementStats, heatGrid } from '../analytics/movement'
import { estimateOffset, fuseEvents, JitterBuffer, associateGlobal } from '../multicamera/sync'
import { newMatch } from '../store/matchFactory'
import type { SportEvent } from '../lib/types'

const corners = [{ x: 0.1, y: 0.8 }, { x: 0.9, y: 0.8 }, { x: 0.7, y: 0.3 }, { x: 0.3, y: 0.3 }]
const court = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }]

describe('homografia', () => {
  it('mapeia os 4 cantos exatamente', () => {
    const H = computeHomography(corners, court)!
    corners.forEach((c, i) => { const p = applyH(H, c); expect(p.x).toBeCloseTo(court[i].x, 6); expect(p.y).toBeCloseTo(court[i].y, 6) })
    expect(reprojectionError(H, corners, court)).toBeLessThan(1e-6)
  })
  it('perspectiva: ponto médio da imagem não é o meio da quadra', () => {
    const H = computeHomography(corners, court)!
    const mid = applyH(H, { x: 0.5, y: 0.55 })
    expect(mid.y).not.toBeCloseTo(10, 1) // longe da câmera os metros comprimem
  })
  it('rejeita quadriláteros cruzados e degenerados', () => {
    expect(isValidQuad(corners)).toBe(true)
    expect(isValidQuad([corners[0], corners[2], corners[1], corners[3]])).toBe(false)
    expect(isValidQuad([{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toBe(false)
  })
  it('usa os pés (base da caixa), não o centro', () => {
    expect(footPoint({ x: 0.2, y: 0.2, w: 0.1, h: 0.4 })).toEqual({ x: 0.25, y: 0.6000000000000001 })
  })
})

describe('rastreamento', () => {
  it('mantém o identificador quando o jogador se move', () => {
    const tr = new MultiTracker()
    for (let i = 0; i < 10; i++) tr.step([{ cls: 'person', score: 0.9, box: { x: 0.1 + i * 0.01, y: 0.3, w: 0.05, h: 0.15 } }], i)
    expect(tr.tracks.length).toBe(1)
    expect(tr.tracks[0].id).toBe(1)
    expect(tr.tracks[0].state).toBe('ativo')
  })
  it('dois jogadores cruzando mantêm identidades pela predição de velocidade', () => {
    const tr = new MultiTracker()
    for (let i = 0; i < 12; i++) tr.step([
      { cls: 'person', score: 0.9, box: { x: 0.1 + i * 0.03, y: 0.3, w: 0.05, h: 0.15 } },
      { cls: 'person', score: 0.9, box: { x: 0.5 - i * 0.03, y: 0.32, w: 0.05, h: 0.15 } },
    ], i)
    const t1 = tr.tracks.find((t) => t.id === 1)!
    expect(t1.vx).toBeGreaterThan(0)
  })
  it('perde e mantém rastro por algumas ausências', () => {
    const tr = new MultiTracker({ maxMisses: 3 })
    for (let i = 0; i < 5; i++) tr.step([{ cls: 'person', score: 0.9, box: { x: 0.1, y: 0.3, w: 0.05, h: 0.15 } }], i)
    tr.step([], 6); expect(tr.tracks[0].state).toBe('perdido')
    for (let i = 0; i < 4; i++) tr.step([], 7 + i)
    expect(tr.tracks.length).toBe(0)
  })
  it('associa objeto pequeno que se moveu mais que a própria caixa (baixa taxa de inferência)', () => {
    const tr = new MultiTracker()
    for (let i = 0; i < 4; i++) tr.step([{ cls: 'person', score: 0.9, box: { x: 0.1 + i * 0.05, y: 0.5, w: 0.02, h: 0.06 } }], i)
    expect(tr.tracks.length).toBe(1); expect(tr.tracks[0].state).toBe('ativo')
  })
  it('não associa pessoas distantes', () => {
    const tr = new MultiTracker()
    tr.step([{ cls: 'person', score: 0.9, box: { x: 0.1, y: 0.5, w: 0.02, h: 0.06 } }], 0)
    tr.step([{ cls: 'person', score: 0.9, box: { x: 0.6, y: 0.5, w: 0.02, h: 0.06 } }], 1)
    expect(tr.tracks.some((t) => t.hits > 1)).toBe(false)
  })
  it('iou', () => { expect(iou({ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 })).toBe(1) })
})

describe('bola', () => {
  const det = (x: number, y: number) => ({ cls: 'ball' as const, score: 0.8, box: { x: x - 0.01, y: y - 0.01, w: 0.02, h: 0.02 } })
  it('detectada -> estimada -> perdida, sem inventar posição indefinidamente', () => {
    const b = new BallTracker(0.0005, 0.0004, 3)
    for (let i = 0; i < 5; i++) b.step(i, [det(0.3 + i * 0.01, 0.5)])
    expect(b.state).toBe('detectada')
    b.step(5, []); expect(b.state).toBe('estimada')
    b.step(6, []); b.step(7, []); b.step(8, [])
    expect(b.state).toBe('perdida')
    expect(b.confidence).toBe(0)
  })
  it('ignora bola fora da área de jogo', () => {
    const b = new BallTracker()
    b.step(0, [det(0.05, 0.05)], (x, y) => x > 0.1 && y > 0.1)
    expect(b.state).toBe('perdida')
  })
  it('marca recuperação', () => {
    const b = new BallTracker(0.0005, 0.0004, 2)
    b.step(0, [det(0.5, 0.5)]); b.step(1, []); b.step(2, [det(0.5, 0.5)])
    expect(b.state).toBe('recuperada')
  })
})

describe('equipes por cor', () => {
  it('estabiliza a equipe só após vários votos e resiste a ruído momentâneo', () => {
    const tc = new TeamClassifier([{ team: 'A', colors: ['#d00000'] }, { team: 'B', colors: ['#0030d0'] }])
    const red = rgbToLab(...hexToRgb('#c81010')), blue = rgbToLab(...hexToRgb('#1030c0'))
    expect(tc.vote(1, red)).toBe('U')
    for (let i = 0; i < 8; i++) tc.vote(1, red)
    expect(tc.decide(1)).toBe('A')
    tc.vote(1, blue)
    expect(tc.decide(1)).toBe('A')
  })
  it('cor desconhecida fica indefinida', () => {
    const tc = new TeamClassifier([{ team: 'A', colors: ['#d00000'] }, { team: 'B', colors: ['#0030d0'] }])
    for (let i = 0; i < 10; i++) tc.vote(2, rgbToLab(30, 200, 30))
    expect(tc.decide(2)).toBe('U')
  })
  it('alerta uniformes semelhantes', () => {
    expect(uniformsTooSimilar('#d00000', '#c80505')).toBe(true)
    expect(uniformsTooSimilar('#d00000', '#0030d0')).toBe(false)
  })
})

const goal = { postL: { x: 0.9, y: 0.4 }, postR: { x: 0.9, y: 0.6 }, insideRef: { x: 1, y: 0.5 } }
const path = (pts: [number, number][]) => pts.map(([x, y], i) => ({ t: i * 33, x, y, observed: true }))

describe('futsal: gol', () => {
  it('gol verdadeiro: cruza entre os postes e permanece dentro', () => {
    expect(analyzeGoalLine(path([[0.8, 0.5], [0.85, 0.5], [0.89, 0.5], [0.92, 0.5], [0.94, 0.5], [0.95, 0.5]]), goal)).toBe('gol_possivel')
  })
  it('bola para fora (ao lado do poste)', () => {
    expect(analyzeGoalLine(path([[0.8, 0.7], [0.85, 0.7], [0.89, 0.72], [0.92, 0.73], [0.94, 0.74]]), goal)).toBe('fora')
  })
  it('bola na trave', () => {
    expect(analyzeGoalLine(path([[0.8, 0.405], [0.85, 0.405], [0.89, 0.405], [0.91, 0.405], [0.93, 0.405]]), goal)).toBe('na_trave')
  })
  it('defesa/retorno: cruza e volta imediatamente', () => {
    expect(analyzeGoalLine(path([[0.8, 0.5], [0.85, 0.5], [0.89, 0.5], [0.91, 0.5], [0.88, 0.5], [0.85, 0.5]]), goal)).toBe('retornou')
  })
  it('por cima do travessão (bar marcado)', () => {
    const g2 = { postL: { x: 0.9, y: 0.4 }, postR: { x: 0.95, y: 0.9 }, bar: { x: 0.92, y: 0.5 }, insideRef: { x: 1, y: 0.5 } }
    expect(analyzeGoalLine(path([[0.8, 0.45], [0.85, 0.45], [0.89, 0.45], [0.95, 0.46], [0.97, 0.46], [0.99, 0.46]]), g2)).not.toBe('gol_possivel')
  })
  it('pontos estimados não servem como prova', () => {
    const tr = path([[0.8, 0.5], [0.85, 0.5], [0.89, 0.5], [0.92, 0.5], [0.94, 0.5]]).map((p, i) => ({ ...p, observed: i < 3 }))
    expect(analyzeGoalLine(tr, goal)).toBe('sem_evidencia')
  })
})

describe('futsal: posse', () => {
  it('não distribui tempo indeterminado e detecta passe/interceptação', () => {
    const p = new PossessionEstimator(1, 300)
    const A1 = { label: 'A01', team: 'A' as const, x: 5, y: 5 }, A2 = { label: 'A02', team: 'A' as const, x: 15, y: 5 }, B1 = { label: 'B01', team: 'B' as const, x: 25, y: 5 }
    let t = 0
    for (; t <= 600; t += 100) p.step(t, 100, { x: 5.2, y: 5 }, [A1, A2, B1])
    for (let k = 0; k < 3; k++, t += 100) p.step(t, 100, { x: 10, y: 5 }, [A1, A2, B1])
    let transfer
    for (let k = 0; k < 6; k++, t += 100) { const r = p.step(t, 100, { x: 15.1, y: 5 }, [A1, A2, B1]); transfer ??= r.transfer }
    expect(transfer?.from.label).toBe('A01'); expect(transfer?.to.label).toBe('A02')
    for (let k = 0; k < 5; k++, t += 100) p.step(t, 100, null, [A1, A2, B1])
    expect(p.totals.unknown).toBe(500)
    expect(p.totals.B).toBe(0)
  })
  it('bola disputada não conta para ninguém', () => {
    const p = new PossessionEstimator(1, 0)
    p.step(0, 100, { x: 5, y: 5 }, [{ label: 'A01', team: 'A', x: 5.5, y: 5 }, { label: 'B01', team: 'B', x: 4.5, y: 5 }])
    expect(p.totals.contested).toBe(100); expect(p.totals.A).toBe(0)
  })
})

const hoop = { center: { x: 0.5, y: 0.3 }, radius: 0.03 }
describe('basquete', () => {
  it('cesta: acima do aro e depois abaixo, dentro da largura', () => {
    expect(analyzeHoop(path([[0.45, 0.2], [0.48, 0.25], [0.5, 0.28], [0.5, 0.31], [0.5, 0.33], [0.5, 0.36]]), hoop)).toBe('cesta_possivel')
  })
  it('bola no aro e saiu', () => {
    expect(analyzeHoop(path([[0.45, 0.2], [0.48, 0.26], [0.52, 0.29], [0.56, 0.28], [0.6, 0.3]]), hoop)).toBe('aro_saiu')
  })
  it('passagem só pela região 2D (subindo por baixo) não é cesta', () => {
    expect(analyzeHoop(path([[0.5, 0.45], [0.5, 0.38], [0.5, 0.3], [0.5, 0.25], [0.5, 0.2]]), hoop)).toBe('sem_evidencia')
  })
  it('valor pela posição dos pés; perto da linha exige confirmação', () => {
    const h = { x: 1.575, y: 7.5 }
    expect(classifyShotValue({ x: 1.575 + 8, y: 7.5 }, h).points).toBe(3)
    expect(classifyShotValue({ x: 1.575 + 4, y: 7.5 }, h).points).toBe(2)
    expect(classifyShotValue({ x: 1.575 + 6.8, y: 7.5 }, h).points).toBeNull()
    expect(classifyShotValue(undefined, h).points).toBeNull()
  })
})

const pt = (team: 'A' | 'B', t: number, note?: string): SportEvent => ({ id: String(t), matchId: 'm', type: 'ponto', t, period: 1, team, points: 1, confidence: 1, status: 'confirmado_manual', origin: 'manual', evidences: [], scoring: true, note })
describe('vôlei', () => {
  const r = { ...volleyballRules(), pointsPerSet: 5, decidingSetPoints: 3, sets: 3 }
  it('set exige diferença mínima de 2', () => {
    const ev = [...Array(4)].map((_, i) => pt('A', i)).concat([...Array(4)].map((_, i) => pt('B', 10 + i)), [pt('A', 20)])
    expect(computeSets(ev, r).setsWon.A).toBe(0)
    expect(computeSets([...ev, pt('A', 21)], r).setsWon.A).toBe(1)
  })
  it('ponto duplicado do mesmo rally não conta duas vezes', () => {
    const s = computeSets([pt('A', 1, 'rally:c1:1'), pt('A', 2, 'rally:c1:1')], r)
    expect(s.sets[0].A).toBe(1)
  })
  it('partida termina com 2 sets e set decisivo menor', () => {
    const ev: SportEvent[] = []
    let t = 0
    for (let i = 0; i < 5; i++) ev.push(pt('A', t++))
    for (let i = 0; i < 5; i++) ev.push(pt('B', t++))
    for (let i = 0; i < 3; i++) ev.push(pt('A', t++))
    const s = computeSets(ev, r)
    expect(s.matchOver).toBe(true); expect(s.winner).toBe('A')
  })
  it('rally não termina por perda momentânea da bola', () => {
    const m = new RallyMachine(0.5, 'esquerda', 2000, 1000)
    m.step(0, { x: 0.3, y: 0.5, vx: 0.01, vy: 0 })
    m.step(100, { x: 0.6, y: 0.5, vx: 0.01, vy: 0 })
    expect(m.crossings).toBe(1)
    expect(m.step(1500, null).ended).toBeUndefined()
    expect(m.step(2200, null).ended?.lastSide).toBe('B')
  })
})

describe('eventos e placar', () => {
  const m0 = newMatch('futsal', { name: 'Teste' })
  it('placar vem só de eventos confirmados e recalcula após correção', () => {
    let m = addCandidate(m0, { type: 'gol', t: 1000, period: 1, team: 'A', points: 1, scoring: true, confidence: 0.6, status: 'aguardando', origin: 'ia', evidences: [] }).match
    expect(scoreOf(m.events).A).toBe(0)
    const id = m.events[0].id
    m = setStatus(m, id, 'confirmado_manual'); expect(scoreOf(m.events).A).toBe(1)
    m = correctEvent(m, id, { team: 'B' }); expect(scoreOf(m.events)).toEqual({ A: 0, B: 1 })
    m = setStatus(m, id, 'rejeitado'); expect(scoreOf(m.events)).toEqual({ A: 0, B: 0 })
    expect(m.corrections.length).toBe(4) // criar, confirmar, corrigir, rejeitar: histórico preservado
  })
  it('deduplica candidatos da IA próximos no tempo', () => {
    let m = addCandidate(m0, { type: 'gol', t: 1000, period: 1, team: 'A', points: 1, scoring: true, confidence: 0.5, status: 'aguardando', origin: 'ia', evidences: [{ cameraId: 'c1', t: 1000, kind: 'x', detail: '', confidence: 0.5 }] }).match
    const r = addCandidate(m, { type: 'gol', t: 2500, period: 1, team: 'A', points: 1, scoring: true, confidence: 0.7, status: 'aguardando', origin: 'ia', evidences: [{ cameraId: 'c2', t: 2500, kind: 'x', detail: '', confidence: 0.7 }] })
    expect(r.merged).toBe(true); expect(r.match.events.length).toBe(1); expect(r.match.events[0].evidences.length).toBe(2)
  })
  it('evento manual de emergência altera o placar', () => {
    const m = manualEvent(m0, 'gol', { team: 'B', points: 1, scoring: true })
    expect(scoreOf(m.events).B).toBe(1)
  })
  it('modo assistido nunca confirma pontuação sozinho', () => {
    expect(initialStatus(true, 0.99, 'assistido', { auto: 0.8, min: 0.2 }, true)).toBe('aguardando')
    expect(initialStatus(true, 0.99, 'automatico_experimental', { auto: 0.8, min: 0.2 }, false)).toBe('aguardando')
    expect(initialStatus(true, 0.99, 'automatico_experimental', { auto: 0.8, min: 0.2 }, true)).toBe('confirmado_auto')
    expect(initialStatus(true, 0.1, 'assistido', { auto: 0.8, min: 0.2 }, true)).toBe('indeterminado')
  })
})

describe('movimento', () => {
  it('descarta saltos impossíveis (troca de identidade)', () => {
    const s = [0, 1, 2, 3, 4, 5].map((i) => ({ t: i * 1000, trackId: 'A01', team: 'A' as const, x: i, y: 0, estimated: false }))
    s.push({ t: 6000, trackId: 'A01', team: 'A', x: 30, y: 0, estimated: false })
    const r = movementStats(s)
    expect(r.distanceM).toBeLessThan(8)
    expect(r.discardedJumps).toBeGreaterThan(0)
  })
  it('mapa de calor normalizado', () => {
    const h = heatGrid([{ t: 0, trackId: 'a', team: 'A', x: 1, y: 1, estimated: false }, { t: 1, trackId: 'a', team: 'A', x: 39, y: 19, estimated: false }], 40, 20)
    expect(h.grid.flat().reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })
})

describe('multicâmera', () => {
  it('estima offset de relógio', () => {
    const off = 500
    const s = [10, 30, 12].map((lat, i) => ({ t0: i * 1000, t1: i * 1000 + lat + off, t2: i * 1000 + lat + off + 1, t3: i * 1000 + 2 * lat + 1 }))
    expect(estimateOffset(s)!.offsetMs).toBeCloseTo(500, 0)
  })
  it('funde gol visto por duas câmeras em um único evento; conflito vai para revisão', () => {
    const base = { type: 'gol', period: 1, points: 1, scoring: true, status: 'aguardando' as const, origin: 'ia' as const }
    const f = fuseEvents([{ ...base, t: 1000, team: 'A', confidence: 0.5, evidences: [{ cameraId: 'c1', t: 1000, kind: '', detail: '', confidence: 0.5 }] }, { ...base, t: 1200, team: 'A', confidence: 0.5, evidences: [{ cameraId: 'c2', t: 1200, kind: '', detail: '', confidence: 0.5 }] }])
    expect(f.length).toBe(1); expect(f[0].cameras).toEqual(['c1', 'c2']); expect(f[0].confidence).toBeCloseTo(0.75)
    const g = fuseEvents([{ ...base, t: 1000, team: 'A', confidence: 0.5, evidences: [] }, { ...base, t: 1100, team: 'B', confidence: 0.6, evidences: [] }])
    expect(g[0].conflict).toBe(true); expect(g[0].team).toBeUndefined()
  })
  it('buffer temporal ordena e descarta atrasados', () => {
    const b = new JitterBuffer<{ ts: number }>(100)
    b.push({ ts: 50 }, 100); b.push({ ts: 20 }, 100); b.push({ ts: 0 }, 1000)
    expect(b.dropped).toBe(1)
    expect(b.pop(200).map((x) => x.ts)).toEqual([20, 50])
  })
  it('associa o mesmo jogador entre câmeras', () => {
    const g = associateGlobal([{ cameraId: 'c1', label: 'A01', team: 'A', court: { x: 5, y: 5 } }, { cameraId: 'c2', label: 'A03', team: 'A', court: { x: 5.4, y: 5.2 } }, { cameraId: 'c2', label: 'B01', team: 'B', court: { x: 5.2, y: 5 } }])
    expect(g.length).toBe(2)
  })
})
