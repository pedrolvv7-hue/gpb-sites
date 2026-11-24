import { describe, it, expect } from 'vitest'
import { MovementClassifier, SPORT_MOVEMENTS, type Pose, type KPName } from '../vision/pose'

// pessoa em pé: torso = 0.2 (ombros y=0.4, quadril y=0.6)
function stand(o: Partial<Record<KPName, [number, number]>> = {}, dy = 0): Pose {
  const b: Record<KPName, [number, number]> = {
    nose: [0.5, 0.32], left_eye: [0.49, 0.31], right_eye: [0.51, 0.31], left_ear: [0.48, 0.32], right_ear: [0.52, 0.32],
    left_shoulder: [0.45, 0.4], right_shoulder: [0.55, 0.4], left_elbow: [0.44, 0.5], right_elbow: [0.56, 0.5], left_wrist: [0.44, 0.58], right_wrist: [0.56, 0.58],
    left_hip: [0.47, 0.6], right_hip: [0.53, 0.6], left_knee: [0.47, 0.72], right_knee: [0.53, 0.72], left_ankle: [0.47, 0.84], right_ankle: [0.53, 0.84],
  }
  const p = {} as Pose
  for (const k of Object.keys(b) as KPName[]) { const [x, y] = o[k] ?? b[k]; p[k] = { x, y: y + (o[k] ? 0 : dy), s: 0.9 } }
  return p
}
const all = (s: keyof typeof SPORT_MOVEMENTS) => new MovementClassifier(SPORT_MOVEMENTS[s], 0)
const run = (c: MovementClassifier, frames: [number, Pose][]) => frames.flatMap(([t, p]) => c.step(t, p).map((x) => x.m))

describe('movimentos por pose', () => {
  it('em pé parado não gera nada', () => {
    const c = all('volleyball')
    expect(run(c, [0, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((t) => [t, stand()]))).toEqual([])
  })
  it('salto: quadril sobe acima da base', () => {
    const c = all('futsal')
    const f: [number, Pose][] = [0, 100, 200, 300, 400, 500, 600, 700].map((t) => [t, stand()])
    f.push([800, stand({}, -0.06)])
    expect(run(c, f)).toContain('salto')
  })
  it('bloqueio: salto com os dois punhos acima da cabeça', () => {
    const c = all('volleyball')
    const f: [number, Pose][] = [0, 100, 200, 300, 400, 500, 600, 700].map((t) => [t, stand()])
    f.push([800, stand({ left_wrist: [0.46, 0.18], right_wrist: [0.54, 0.18], left_elbow: [0.45, 0.26], right_elbow: [0.55, 0.26] }, -0.06)])
    expect(run(c, f)).toContain('bloqueio')
  })
  it('manchete: punhos unidos à frente com braços estendidos', () => {
    const c = all('volleyball')
    const m = stand({ left_elbow: [0.48, 0.47], right_elbow: [0.52, 0.47], left_wrist: [0.5, 0.55], right_wrist: [0.51, 0.55] })
    // braços estendidos: ombro, cotovelo e punho alinhados
    m.left_elbow = { x: 0.475, y: 0.475, s: 0.9 }; m.right_elbow = { x: 0.53, y: 0.475, s: 0.9 }
    expect(run(c, [[0, m]])).toContain('manchete')
  })
  it('toque: mãos juntas acima da cabeça, cotovelos flexionados', () => {
    const c = all('volleyball')
    expect(run(c, [[0, stand({ left_wrist: [0.47, 0.24], right_wrist: [0.53, 0.24], left_elbow: [0.4, 0.3], right_elbow: [0.6, 0.3] })]])).toContain('toque')
  })
  it('chute: tornozelo rápido e erguido', () => {
    const c = all('futsal')
    expect(run(c, [[0, stand()], [200, stand({ right_ankle: [0.68, 0.7], right_knee: [0.6, 0.68] })]])).toContain('chute')
  })
  it('arremesso: punho do peito para acima da cabeça', () => {
    const c = all('basketball')
    expect(run(c, [[0, stand({ right_wrist: [0.55, 0.42] })], [400, stand({ right_wrist: [0.55, 0.14], right_elbow: [0.56, 0.26] })]])).toContain('arremesso')
  })
  it('queda: tronco na horizontal', () => {
    const c = all('futsal')
    const lying = stand({ left_shoulder: [0.3, 0.8], right_shoulder: [0.3, 0.82], left_hip: [0.5, 0.8], right_hip: [0.5, 0.82], nose: [0.2, 0.81] })
    expect(run(c, [[0, lying]])).toContain('queda')
  })
  it('drible: punho oscilando abaixo do quadril', () => {
    const c = all('basketball')
    const f: [number, Pose][] = [0, 150, 300, 450, 600, 750, 900].map((t, i) => [t, stand({ right_wrist: [0.58, i % 2 ? 0.75 : 0.66] })])
    expect(run(c, f)).toContain('drible')
  })
  it('andar se afastando da câmera (subida lenta) não é salto', () => {
    const c = all('futsal')
    const f: [number, Pose][] = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((t, i) => [t, stand({}, -0.006 * i)])
    expect(run(c, f)).not.toContain('salto')
  })
  it('amostras muito espaçadas (1,7 s) não afirmam salto', () => {
    const c = all('futsal')
    expect(run(c, [[0, stand()], [1700, stand({}, -0.06)]])).not.toContain('salto')
  })
  it('respeita movimentos permitidos por esporte (vôlei não detecta chute)', () => {
    const c = all('volleyball')
    expect(run(c, [[0, stand()], [200, stand({ right_ankle: [0.68, 0.7] })]])).not.toContain('chute')
  })
  it('pontos com baixa confiança são ignorados', () => {
    const c = all('futsal')
    const p = stand(); for (const k of Object.keys(p) as KPName[]) p[k].s = 0.1
    expect(c.step(0, p)).toEqual([])
  })
})
