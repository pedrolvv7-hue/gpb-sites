// Quadra 2D em metros (viewBox), específica por esporte. Usada no mapa tático, mapas de calor e simulador.
import type { ReactNode } from 'react'
import type { Sport } from '../lib/types'

export function Court({ sport, L, W, children, className = '', onPointer }: { sport: Sport; L: number; W: number; children?: ReactNode; className?: string; onPointer?: (x: number, y: number, e: React.PointerEvent<SVGSVGElement>) => void }) {
  const s = { stroke: 'rgba(255,255,255,.75)', strokeWidth: 0.1, fill: 'none' }
  const handle = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!onPointer) return
    const svg = e.currentTarget, pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    onPointer(p.x, p.y, e)
  }
  return (
    <svg viewBox={`-1 -1 ${L + 2} ${W + 2}`} className={`w-full select-none ${className}`} role="img" aria-label={`Quadra de ${sport}`} onPointerDown={handle} onPointerMove={onPointer ? handle : undefined}>
      <rect x={-1} y={-1} width={L + 2} height={W + 2} fill={sport === 'volleyball' ? '#1d3a5c' : sport === 'basketball' ? '#5a3a1f' : '#14532d'} rx={0.4} />
      <rect x={0} y={0} width={L} height={W} {...s} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={W} {...s} />
      {sport === 'futsal' && <>
        <circle cx={L / 2} cy={W / 2} r={3} {...s} />
        {[0, L].map((x) => <g key={x}>
          <path d={x === 0 ? `M0 ${W / 2 - 7.58} A6 6 0 0 1 6 ${W / 2 - 1.58} L6 ${W / 2 + 1.58} A6 6 0 0 1 0 ${W / 2 + 7.58}` : `M${L} ${W / 2 - 7.58} A6 6 0 0 0 ${L - 6} ${W / 2 - 1.58} L${L - 6} ${W / 2 + 1.58} A6 6 0 0 0 ${L} ${W / 2 + 7.58}`} {...s} />
          <rect x={x === 0 ? -0.8 : L} y={W / 2 - 1.5} width={0.8} height={3} fill="rgba(255,255,255,.3)" stroke="#fff" strokeWidth={0.08} />
        </g>)}
      </>}
      {sport === 'basketball' && <>
        <circle cx={L / 2} cy={W / 2} r={1.8} {...s} />
        {[0, L].map((x) => { const d = x === 0 ? 1 : -1, hx = x + d * 1.575; return <g key={x}>
          <rect x={x === 0 ? 0 : L - 5.8} y={W / 2 - 2.45} width={5.8} height={4.9} {...s} />
          <circle cx={x + d * 5.8} cy={W / 2} r={1.8} {...s} />
          <path d={`M${x} 0.9 L${x + d * 2.99} 0.9 A6.75 6.75 0 0 ${x === 0 ? 1 : 0} ${x + d * 2.99} ${W - 0.9} L${x} ${W - 0.9}`} {...s} />
          <circle cx={hx} cy={W / 2} r={0.23} stroke="#f97316" strokeWidth={0.08} fill="none" />
        </g> })}
      </>}
      {sport === 'volleyball' && <>
        <line x1={L / 2} y1={-0.8} x2={L / 2} y2={W + 0.8} stroke="#fff" strokeWidth={0.25} strokeDasharray="0.2 0.15" />
        <line x1={L / 2 - 3} y1={0} x2={L / 2 - 3} y2={W} {...s} />
        <line x1={L / 2 + 3} y1={0} x2={L / 2 + 3} y2={W} {...s} />
        <circle cx={L / 2} cy={0} r={0.15} fill="#ef4444" /><circle cx={L / 2} cy={W} r={0.15} fill="#ef4444" />
      </>}
      {children}
    </svg>
  )
}

export function PlayerMarker({ x, y, color, label, estimated, highlight, side, onClick }: { x: number; y: number; color: string; label: string; estimated?: boolean; highlight?: boolean; side: 'A' | 'B' | 'U'; onClick?: () => void }) {
  return (
    <g transform={`translate(${x} ${y})`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      {side === 'B' ? <rect x={-0.45} y={-0.45} width={0.9} height={0.9} fill={color} stroke={highlight ? '#fde047' : '#fff'} strokeWidth={0.08} strokeDasharray={estimated ? '0.15 0.1' : undefined} opacity={estimated ? 0.6 : 1} />
        : <circle r={0.5} fill={side === 'U' ? '#64748b' : color} stroke={highlight ? '#fde047' : '#fff'} strokeWidth={0.08} strokeDasharray={estimated ? '0.15 0.1' : undefined} opacity={estimated ? 0.6 : 1} />}
      <text y={1.25} textAnchor="middle" fontSize={0.7} fill="#fff" fontWeight={700}>{label}</text>
    </g>
  )
}
