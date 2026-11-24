// Homografia plana (DLT) imagem -> quadra. Válida apenas para pontos NO CHÃO.
// Não use para estimar a posição de uma bola no ar.
import type { CourtPoint, ImagePoint } from '../lib/types'

/** Resolve sistema linear Ax=b por eliminação de Gauss com pivoteamento parcial. */
export function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((r, i) => [...r, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (Math.abs(M[p][c]) < 1e-12) return null
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((r, i) => r[n] / r[i])
}

/** Calcula H (9 valores, h33=1) a partir de exatamente 4 correspondências (ou as 4 primeiras). */
export function computeHomography(src: ImagePoint[], dst: CourtPoint[]): number[] | null {
  if (src.length < 4 || dst.length < 4) return null
  // mínimos quadrados quando houver mais de 4 pontos: normal equations
  const rows: number[][] = []
  const rhs: number[] = []
  for (let i = 0; i < Math.min(src.length, dst.length); i++) {
    const { x, y } = src[i]
    const { x: u, y: v } = dst[i]
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); rhs.push(u)
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y]); rhs.push(v)
  }
  const AtA = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => rows.reduce((s, r) => s + r[i] * r[j], 0)))
  const Atb = Array.from({ length: 8 }, (_, i) => rows.reduce((s, r, k) => s + r[i] * rhs[k], 0))
  const h = solve(AtA, Atb)
  if (!h || h.some((v) => !Number.isFinite(v))) return null
  return [...h, 1]
}

export function applyH(H: number[], p: ImagePoint): CourtPoint {
  const w = H[6] * p.x + H[7] * p.y + H[8]
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w }
}

/** Erro médio de reprojeção em metros: mede se os pontos marcados são consistentes. */
export function reprojectionError(H: number[], src: ImagePoint[], dst: CourtPoint[]): number {
  const n = Math.min(src.length, dst.length)
  let s = 0
  for (let i = 0; i < n; i++) { const q = applyH(H, src[i]); s += Math.hypot(q.x - dst[i].x, q.y - dst[i].y) }
  return s / n
}

/** Qualidade qualitativa. Com 4 pontos o erro é ~0 por construção: exige-se 5+ para medir de fato. */
export function calibrationQuality(H: number[] | undefined, nPts: number, err?: number): 'ausente' | 'nao_verificada' | 'boa' | 'regular' | 'ruim' {
  if (!H) return 'ausente'
  if (nPts <= 4 || err === undefined) return 'nao_verificada'
  if (err < 0.3) return 'boa'
  if (err < 0.8) return 'regular'
  return 'ruim'
}

/** Quadrilátero convexo e não degenerado? Evita calibração com pontos cruzados. */
export function isValidQuad(p: ImagePoint[]): boolean {
  if (p.length !== 4) return false
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = p[i], b = p[(i + 1) % 4], c = p[(i + 2) % 4]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-6) return false
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

/** Ponto de contato com o chão de uma caixa de pessoa: centro da borda inferior (pés). */
export function footPoint(box: { x: number; y: number; w: number; h: number }): ImagePoint {
  return { x: box.x + box.w / 2, y: box.y + box.h }
}
