// Classificação de equipe por cor do uniforme (região do tronco), sem biometria.
import type { TeamLabel, TeamSide } from '../lib/types'

export type Lab = [number, number, number]

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const f = (c: number) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92 }
  const R = f(r), G = f(g), B = f(b)
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const g3 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = g3(X), fy = g3(Y), fz = g3(Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** Distância de cor com peso reduzido na luminância (tolerância a sombras e iluminação). */
export function colorDist(a: Lab, b: Lab, lWeight = 0.35): number {
  return Math.hypot((a[0] - b[0]) * lWeight, a[1] - b[1], a[2] - b[2])
}

export function uniformsTooSimilar(hexA: string, hexB: string): boolean {
  return colorDist(rgbToLab(...hexToRgb(hexA)), rgbToLab(...hexToRgb(hexB))) < 25
}

/** Cor mediana (por canal) dos pixels do tronco: 20%..55% da altura, 25%..75% da largura. */
export function torsoLab(data: Uint8ClampedArray, imgW: number, box: { x: number; y: number; w: number; h: number }): Lab | null {
  const x0 = Math.floor(box.x + box.w * 0.25), x1 = Math.floor(box.x + box.w * 0.75)
  const y0 = Math.floor(box.y + box.h * 0.2), y1 = Math.floor(box.y + box.h * 0.55)
  const L: number[] = [], A: number[] = [], B: number[] = []
  const step = Math.max(1, Math.floor((x1 - x0) / 12))
  for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
    const i = (y * imgW + x) * 4
    if (i < 0 || i + 2 >= data.length) continue
    const lab = rgbToLab(data[i], data[i + 1], data[i + 2])
    L.push(lab[0]); A.push(lab[1]); B.push(lab[2])
  }
  if (L.length < 4) return null
  const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1] }
  return [med(L), med(A), med(B)]
}

/**
 * Acumula votos por rastro e só define a equipe quando há maioria estável.
 * Uma mudança momentânea de iluminação não troca a equipe.
 */
export class TeamClassifier {
  private refs: { team: TeamSide; lab: Lab }[] = []
  private votes = new Map<number, { A: number; B: number; U: number }>()
  constructor(teams: { team: TeamSide; colors: string[] }[], private maxDist = 30, private minVotes = 5, private margin = 0.65) {
    for (const t of teams) for (const c of t.colors) if (c) this.refs.push({ team: t.team, lab: rgbToLab(...hexToRgb(c)) })
  }
  vote(trackId: number, lab: Lab | null): TeamLabel {
    const v = this.votes.get(trackId) ?? { A: 0, B: 0, U: 0 }
    if (lab) {
      let best: TeamLabel = 'U', bd = Infinity
      for (const r of this.refs) { const d = colorDist(lab, r.lab); if (d < bd) { bd = d; best = r.team } }
      v[bd <= this.maxDist ? best : 'U'] += 1
    }
    // decaimento leve para permitir correção a longo prazo
    v.A *= 0.98; v.B *= 0.98; v.U *= 0.98
    this.votes.set(trackId, v)
    return this.decide(trackId)
  }
  decide(trackId: number): TeamLabel {
    const v = this.votes.get(trackId)
    if (!v) return 'U'
    const total = v.A + v.B + v.U
    if (total < this.minVotes * 0.9) return 'U'
    if (v.A / total >= this.margin) return 'A'
    if (v.B / total >= this.margin) return 'B'
    return 'U'
  }
  forget(trackId: number) { this.votes.delete(trackId) }
}
