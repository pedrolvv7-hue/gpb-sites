// Distância, velocidade e mapas de calor a partir de posições calibradas (metros).
import type { PositionSample } from '../lib/types'

export interface MovementStats { distanceM: number; maxSpeedMs: number | null; avgSpeedMs: number | null; observedMs: number; discardedJumps: number }

/**
 * Soma apenas deslocamentos plausíveis: velocidade acima de `maxHumanMs` é tratada como
 * troca de identidade / erro de rastreamento e descartada (não é somada).
 * Lacunas maiores que `maxGapMs` interrompem a soma.
 */
export function movementStats(samples: PositionSample[], maxHumanMs = 9.5, maxGapMs = 2500): MovementStats {
  const s = [...samples].filter((p) => !p.estimated).sort((a, b) => a.t - b.t)
  // 1) quebra em segmentos contínuos: lacuna longa ou salto impossível inicia novo segmento (salto não é somado)
  const segs: PositionSample[][] = []
  let discarded = 0
  for (const p of s) {
    const seg = segs[segs.length - 1]
    const q = seg?.[seg.length - 1]
    if (!q) { segs.push([p]); continue }
    const dt = p.t - q.t
    if (dt <= 0) continue
    const v = Math.hypot(p.x - q.x, p.y - q.y) / (dt / 1000)
    if (dt > maxGapMs) segs.push([p])
    else if (v > maxHumanMs) { discarded++; segs.push([p]) }
    else seg.push(p)
  }
  let dist = 0, observed = 0, maxV = 0
  for (const seg of segs) {
    // 2) suavização por média móvel de 3 pontos dentro do segmento
    const sm = seg.map((p, i) => { const w = seg.slice(Math.max(0, i - 1), i + 2); return { t: p.t, x: w.reduce((a, q) => a + q.x, 0) / w.length, y: w.reduce((a, q) => a + q.y, 0) / w.length } })
    for (let i = 1; i < sm.length; i++) {
      const dt = sm[i].t - sm[i - 1].t
      const d = Math.hypot(sm[i].x - sm[i - 1].x, sm[i].y - sm[i - 1].y)
      dist += d; observed += dt
      maxV = Math.max(maxV, d / (dt / 1000))
    }
  }
  return { distanceM: dist, maxSpeedMs: observed > 3000 ? maxV : null, avgSpeedMs: observed > 3000 ? dist / (observed / 1000) : null, observedMs: observed, discardedJumps: discarded }
}

/** Grade normalizada (soma 1) para que tempo rastreado maior não pareça "mais ativo". */
export function heatGrid(samples: PositionSample[], L: number, W: number, cols = 20, rows = 10): { grid: number[][]; n: number } {
  const g = Array.from({ length: rows }, () => Array(cols).fill(0))
  let n = 0
  for (const p of samples) {
    if (p.x < 0 || p.y < 0 || p.x > L || p.y > W) continue
    const c = Math.min(cols - 1, Math.floor((p.x / L) * cols)), r = Math.min(rows - 1, Math.floor((p.y / W) * rows))
    g[r][c]++; n++
  }
  if (n) for (const row of g) for (let i = 0; i < row.length; i++) row[i] /= n
  return { grid: g, n }
}
