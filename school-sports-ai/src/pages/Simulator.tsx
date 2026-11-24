import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Save, Trash2, Maximize, MousePointer, ArrowRight } from 'lucide-react'
import { Court, PlayerMarker } from '../components/Court'
import { Card, Tabs } from '../components/ui'
import type { Sport } from '../lib/types'

interface Tok { id: string; side: 'A' | 'B' | 'bola'; x: number; y: number }
interface Frame { toks: Tok[]; arrows: { x1: number; y1: number; x2: number; y2: number }[] }
const DIM: Record<Sport, [number, number, number]> = { futsal: [40, 20, 5], basketball: [28, 15, 5], volleyball: [18, 9, 6] }
const KEY = 'ssai-simulador'

function formation(sport: Sport): Tok[] {
  const [L, W, n] = DIM[sport]
  const t: Tok[] = []
  for (let i = 0; i < n; i++) { t.push({ id: `A${i + 1}`, side: 'A', x: L * 0.12 + (i % 3) * L * 0.12, y: (W / (n + 1)) * (i + 1) }); t.push({ id: `B${i + 1}`, side: 'B', x: L * 0.88 - (i % 3) * L * 0.12, y: (W / (n + 1)) * (i + 1) }) }
  t.push({ id: 'bola', side: 'bola', x: L / 2, y: W / 2 })
  return t
}

export default function Simulator() {
  const [sport, setSport] = useState<Sport>('futsal')
  const [frames, setFrames] = useState<Frame[]>([{ toks: formation('futsal'), arrows: [] }])
  const [cur, setCur] = useState(0)
  const [tool, setTool] = useState<'mover' | 'seta'>('mover')
  const [drag, setDrag] = useState<string | null>(null)
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [anim, setAnim] = useState<Tok[] | null>(null)
  const [saved, setSaved] = useState<{ name: string; sport: Sport; frames: Frame[] }[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } })
  const [name, setName] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const [L, W] = DIM[sport]
  useEffect(() => { setFrames([{ toks: formation(sport), arrows: [] }]); setCur(0) }, [sport])

  useEffect(() => {
    if (!playing || frames.length < 2) return
    let raf = 0, start = performance.now()
    const tick = (now: number) => {
      const p = ((now - start) / 1000) * speed
      const i = Math.floor(p), f = p - i
      if (i >= frames.length - 1) { setPlaying(false); setAnim(null); setCur(frames.length - 1); return }
      const a = frames[i].toks, b = frames[i + 1].toks
      setAnim(a.map((t) => { const u = b.find((x) => x.id === t.id) ?? t; return { ...t, x: t.x + (u.x - t.x) * f, y: t.y + (u.y - t.y) * f } }))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])

  const fr = frames[cur]
  const setFr = (f: Frame) => setFrames(frames.map((x, i) => (i === cur ? f : x)))
  const onPointer = (x: number, y: number, e: React.PointerEvent) => {
    if (playing) return
    if (tool === 'mover') {
      if (e.type === 'pointerdown') { const hit = fr.toks.find((t) => Math.hypot(t.x - x, t.y - y) < 0.9); setDrag(hit?.id ?? null) }
      else if (drag && e.buttons) setFr({ ...fr, toks: fr.toks.map((t) => (t.id === drag ? { ...t, x: Math.max(-0.5, Math.min(L + 0.5, x)), y: Math.max(-0.5, Math.min(W + 0.5, y)) } : t)) })
    } else if (e.type === 'pointerdown') {
      if (!arrowStart) setArrowStart({ x, y })
      else { setFr({ ...fr, arrows: [...fr.arrows, { x1: arrowStart.x, y1: arrowStart.y, x2: x, y2: y }] }); setArrowStart(null) }
    }
  }
  const toks = anim ?? fr.toks
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2"><h1 className="h1">Simulador tático</h1><Tabs value={sport} onChange={setSport} items={[{ id: 'futsal', label: 'Futsal' }, { id: 'basketball', label: 'Basquete' }, { id: 'volleyball', label: 'Vôlei' }]} /></div>
      <div className="grid gap-4 lg:grid-cols-4">
        <div ref={box} className="lg:col-span-3 touch-none" onPointerUp={() => setDrag(null)}>
          <Court sport={sport} L={L} W={W} onPointer={onPointer}>
            <defs><marker id="ah" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="#fde047" /></marker></defs>
            {fr.arrows.map((a, i) => <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#fde047" strokeWidth={0.15} markerEnd="url(#ah)" />)}
            {arrowStart && <circle cx={arrowStart.x} cy={arrowStart.y} r={0.3} fill="#fde047" />}
            {toks.map((t) => t.side === 'bola' ? <circle key={t.id} cx={t.x} cy={t.y} r={0.35} fill="#fde047" stroke="#000" strokeWidth={0.06} /> : <PlayerMarker key={t.id} x={t.x} y={t.y} color={t.side === 'A' ? '#ef4444' : '#3b82f6'} side={t.side} label={t.id} />)}
          </Court>
          <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
            {frames.map((_, i) => <button key={i} onClick={() => setCur(i)} className={`btn-sm rounded border px-2 ${i === cur ? 'border-blue' : 'border-line'}`}>Quadro {i + 1}</button>)}
            <button className="btn-ghost btn-sm" onClick={() => { setFrames([...frames, { toks: fr.toks.map((t) => ({ ...t })), arrows: [] }]); setCur(frames.length) }}>+ Quadro</button>
            {frames.length > 1 && <button className="btn-ghost btn-sm" onClick={() => { setFrames(frames.filter((_, i) => i !== cur)); setCur(Math.max(0, cur - 1)) }}>Remover quadro</button>}
          </div>
        </div>
        <Card title="Ferramentas">
          <div className="flex gap-1"><button className={`btn-sm flex-1 rounded border ${tool === 'mover' ? 'border-blue' : 'border-line'}`} onClick={() => setTool('mover')}><MousePointer size={14} />Arrastar</button><button className={`btn-sm flex-1 rounded border ${tool === 'seta' ? 'border-blue' : 'border-line'}`} onClick={() => setTool('seta')}><ArrowRight size={14} />Seta</button></div>
          <button className="btn-ghost btn-sm mt-2 w-full" onClick={() => setFr({ ...fr, arrows: [] })}>Limpar setas do quadro</button>
          <button className="btn-ghost btn-sm mt-1 w-full" onClick={() => { setFrames([{ toks: formation(sport), arrows: [] }]); setCur(0) }}>Formação inicial</button>
          <div className="mt-3 flex items-center gap-1"><button className="btn-primary btn-sm flex-1" disabled={frames.length < 2} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pausar' : 'Animar'}</button>
            <select className="input w-20" value={speed} onChange={(e) => setSpeed(+e.target.value)} aria-label="Velocidade">{[0.5, 1, 2].map((s) => <option key={s} value={s}>{s}x</option>)}</select></div>
          <button className="btn-ghost btn-sm mt-1 w-full" onClick={() => box.current?.requestFullscreen?.()}><Maximize size={14} />Apresentar em tela cheia</button>
          <h3 className="mt-4 text-sm font-semibold">Jogadas salvas</h3>
          <div className="mt-1 flex gap-1"><input className="input" placeholder="Nome da jogada" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome" /><button className="btn-ghost btn-sm" disabled={!name.trim()} onClick={() => { const n = [...saved.filter((s) => s.name !== name), { name, sport, frames }]; setSaved(n); try { localStorage.setItem(KEY, JSON.stringify(n)) } catch { /* armazenamento cheio */ } setName('') }}><Save size={14} /></button></div>
          <ul className="mt-2 space-y-1 text-sm">{saved.map((s) => <li key={s.name} className="flex items-center gap-1"><button className="flex-1 text-left text-blue" onClick={() => { setSport(s.sport); setTimeout(() => { setFrames(s.frames); setCur(0) }, 0) }}>{s.name}</button><span className="text-xs text-muted">{s.sport}</span><button aria-label="Excluir" onClick={() => { const n = saved.filter((x) => x.name !== s.name); setSaved(n); localStorage.setItem(KEY, JSON.stringify(n)) }}><Trash2 size={12} /></button></li>)}</ul>
          <p className="mt-3 text-xs text-muted">Converter uma jogada real em representação tática usa as posições calibradas registradas no relatório (amostragem de 1 s).</p>
        </Card>
      </div>
    </div>
  )
}
