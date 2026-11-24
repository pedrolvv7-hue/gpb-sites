import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { Undo2, Redo2, Save } from 'lucide-react'
import { useMatch, useStore } from '../store/store'
import { useSession } from '../multicamera/session'
import { Card, Empty, Notice, Tabs } from '../components/ui'
import { VideoSource } from '../components/VideoSource'
import { applyH, calibrationQuality, computeHomography, isValidQuad, reprojectionError } from '../calibration/homography'
import type { CameraCalibration, ImagePoint, TeamSide } from '../lib/types'

type Mode = 'quadra' | 'gols' | 'cestas' | 'rede'
interface Draft { court: ImagePoint[]; extra: ImagePoint[]; goals: CameraCalibration['goals']; hoops: CameraCalibration['hoops']; net?: CameraCalibration['net']; pending: ImagePoint[] }
const CORNER_NAMES = ['Canto 1 (perto, esquerda)', 'Canto 2 (perto, direita)', 'Canto 3 (longe, direita)', 'Canto 4 (longe, esquerda)']

export default function Calibration() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const m = useMatch(id)
  const save = useStore((s) => s.saveMatch)
  const sess = useSession()
  useEffect(() => { if (id) sess.ensure(id) }, [id])
  const sources = sess.sources()
  const [cam, setCam] = useState(sp.get('cam') ?? sources[0]?.id ?? '')
  const src = sources.find((s) => s.id === cam) ?? sources[0]
  const existing = m && src ? m.calibrations[src.id] : undefined
  const [mode, setMode] = useState<Mode>('quadra')
  const [team, setTeam] = useState<TeamSide>('A')
  const blank = (): Draft => ({ court: existing?.imagePts.slice(0, 4) ?? [], extra: existing?.imagePts.slice(4) ?? [], goals: existing?.goals ?? [], hoops: existing?.hoops ?? [], net: existing?.net, pending: [] })
  const [hist, setHist] = useState<Draft[]>([blank()])
  const [pos, setPos] = useState(0)
  const [hover, setHover] = useState<ImagePoint | null>(null)
  const [saved, setSaved] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { setHist([blank()]); setPos(0) }, [src?.id])
  const d = hist[pos]
  const push = (nd: Draft) => { setHist([...hist.slice(0, pos + 1), nd]); setPos(pos + 1); setSaved(false) }

  const L = m?.rules.courtLength ?? 40, W = m?.rules.courtWidth ?? 20
  const courtPts = [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: W }, { x: 0, y: W }]
  const extraCourt = [{ x: L / 2, y: 0 }, { x: L / 2, y: W }]
  const allImg = [...d.court, ...d.extra], allCourt = [...courtPts, ...extraCourt].slice(0, allImg.length)
  const H = useMemo(() => (d.court.length === 4 && isValidQuad(d.court) ? computeHomography(allImg, allCourt) : null), [d])
  const err = H && allImg.length > 4 ? reprojectionError(H, allImg, allCourt) : undefined

  if (!m) return <Empty title="Partida não encontrada" />
  if (!src) return <div className="space-y-3"><h1 className="h1">Calibração</h1><Empty title="Nenhuma câmera disponível"><Link className="text-blue" to={`/partida/${m.id}/cameras`}>Adicionar câmera</Link></Empty></div>

  function click(e: React.MouseEvent) {
    const r = box.current!.getBoundingClientRect()
    const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
    if (mode === 'quadra') {
      if (d.court.length < 4) push({ ...d, court: [...d.court, p] })
      else if (d.extra.length < 2) push({ ...d, extra: [...d.extra, p] })
      return
    }
    const pend = [...d.pending, p]
    if (mode === 'gols') {
      if (pend.length === 3 || (pend.length === 2 && e.shiftKey)) push({ ...d, pending: [], goals: [...(d.goals ?? []).filter((g) => g.team !== team), { team, postL: pend[0], postR: pend[1], bar: pend[2] }] })
      else push({ ...d, pending: pend })
    } else if (mode === 'cestas') {
      if (pend.length === 2) push({ ...d, pending: [], hoops: [...(d.hoops ?? []).filter((h) => h.team !== team), { team, center: pend[0], radius: Math.hypot(pend[1].x - pend[0].x, pend[1].y - pend[0].y) }] })
      else push({ ...d, pending: pend })
    } else if (mode === 'rede') {
      if (pend.length === 2) push({ ...d, pending: [], net: { left: pend[0], right: pend[1], topY: Math.min(pend[0].y, pend[1].y) } })
      else push({ ...d, pending: pend })
    }
  }

  function persist() {
    if (!m || !src) return
    const c: CameraCalibration = { cameraId: src.id, imagePts: allImg, courtPts: allCourt, H: H ?? undefined, reprojErrorM: err, savedAt: Date.now(), goals: d.goals, hoops: d.hoops, net: d.net }
    save({ ...m, calibrations: { ...m.calibrations, [src.id]: c } }); setSaved(true)
  }

  const instr = mode === 'quadra' ? (d.court.length < 4 ? `Clique no ${CORNER_NAMES[d.court.length]}.` : d.extra.length < 2 ? `Opcional: clique na ponta ${d.extra.length === 0 ? 'mais próxima' : 'mais distante'} da linha central (melhora e permite medir a precisão).` : 'Quadra marcada.')
    : mode === 'gols' ? ['Clique no poste esquerdo do gol', 'Clique no poste direito', 'Clique no meio do travessão (ou Shift+clique no poste direito para pular)'][d.pending.length]
    : mode === 'cestas' ? ['Clique no centro do aro', 'Clique na borda do aro'][d.pending.length]
    : ['Clique na ponta esquerda (topo) da rede', 'Clique na ponta direita (topo) da rede'][d.pending.length]
  const q = calibrationQuality(H ?? undefined, allImg.length, err)
  const P = ({ p, c, l }: { p: ImagePoint; c: string; l?: string }) => <g><circle cx={p.x * 100} cy={p.y * 100} r={1.2} fill={c} stroke="#000" strokeWidth={0.2} />{l && <text x={p.x * 100 + 1.5} y={p.y * 100 - 1} fontSize={2.6} fill="#fff" stroke="#000" strokeWidth={0.15}>{l}</text>}</g>
  // grade projetada (inversa aproximada desenhando linhas de quadra a partir da H inversa não é trivial; desenhamos o polígono marcado)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="h1">Calibração</h1><p className="text-sm text-muted">Independente por câmera. Quadra {L} × {W} m (alterável na configuração da partida).</p></div>
        <select className="input w-56" value={src.id} onChange={(e) => setCam(e.target.value)} aria-label="Câmera">{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      <Tabs value={mode} onChange={(v) => { setMode(v); push({ ...d, pending: [] }) }} items={[{ id: 'quadra', label: 'Quadra' }, ...(m.sport === 'futsal' ? [{ id: 'gols' as Mode, label: 'Gols' }] : []), ...(m.sport === 'basketball' ? [{ id: 'cestas' as Mode, label: 'Cestas' }] : []), ...(m.sport === 'volleyball' ? [{ id: 'rede' as Mode, label: 'Rede' }] : [])]} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Notice kind="info">{instr}</Notice>
          <div ref={box} className="relative mt-2 cursor-crosshair overflow-hidden rounded-lg bg-black" onClick={click} onMouseMove={(e) => { const r = box.current!.getBoundingClientRect(); setHover({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }) }} onMouseLeave={() => setHover(null)}>
            <VideoSource src={src} className="pointer-events-none block w-full" controls={false} />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
              {d.court.length > 1 && <polygon points={d.court.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} fill="rgba(59,130,246,.15)" stroke="#3B82F6" strokeWidth={0.4} />}
              {d.court.map((p, i) => <P key={i} p={p} c="#3B82F6" l={String(i + 1)} />)}
              {d.extra.map((p, i) => <P key={'e' + i} p={p} c="#22C55E" l="C" />)}
              {d.goals?.map((g) => <g key={g.team}><line x1={g.postL.x * 100} y1={g.postL.y * 100} x2={g.postR.x * 100} y2={g.postR.y * 100} stroke="#F59E0B" strokeWidth={0.6} /><P p={g.postL} c="#F59E0B" l={`Gol ${g.team}`} /><P p={g.postR} c="#F59E0B" />{g.bar && <P p={g.bar} c="#F59E0B" l="trav." />}</g>)}
              {d.hoops?.map((h) => <ellipse key={h.team} cx={h.center.x * 100} cy={h.center.y * 100} rx={h.radius * 100} ry={h.radius * 60} fill="none" stroke="#f97316" strokeWidth={0.5} />)}
              {d.net && <line x1={d.net.left.x * 100} y1={d.net.left.y * 100} x2={d.net.right.x * 100} y2={d.net.right.y * 100} stroke="#fff" strokeWidth={0.6} strokeDasharray="1 0.6" />}
              {d.pending.map((p, i) => <P key={'p' + i} p={p} c="#EF4444" />)}
            </svg>
            {hover && H && <span className="chip absolute bottom-2 left-2 bg-black/80 text-white">Chão: x={applyH(H, hover).x.toFixed(1)} m, y={applyH(H, hover).y.toFixed(1)} m (só válido para pontos no chão)</span>}
          </div>
        </div>
        <Card title="Estado">
          <div className="flex gap-2"><button className="btn-ghost btn-sm" disabled={pos === 0} onClick={() => setPos(pos - 1)}><Undo2 size={14} />Desfazer</button><button className="btn-ghost btn-sm" disabled={pos >= hist.length - 1} onClick={() => setPos(pos + 1)}><Redo2 size={14} />Refazer</button><button className="btn-ghost btn-sm" onClick={() => push({ court: [], extra: [], goals: [], hoops: [], net: undefined, pending: [] })}>Limpar</button></div>
          {(mode === 'gols' || mode === 'cestas') && <div className="mt-3"><span className="label">Pertence à equipe (que defende)</span><Tabs value={team} onChange={setTeam} items={[{ id: 'A', label: m.teams.A.name }, { id: 'B', label: m.teams.B.name }]} /></div>}
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Cantos</dt><dd>{d.court.length}/4 {d.court.length === 4 && !isValidQuad(d.court) && <span className="text-live">(inválido: pontos cruzados)</span>}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Pontos extras</dt><dd>{d.extra.length}/2</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Qualidade</dt><dd className={q === 'boa' ? 'text-neon' : q === 'ruim' ? 'text-live' : 'text-pend'}>{{ ausente: 'Calibração necessária', nao_verificada: 'Não verificada (marque a linha central)', boa: 'Boa', regular: 'Regular', ruim: 'Ruim: remarque' }[q]}</dd></div>
            {err !== undefined && <div className="flex justify-between"><dt className="text-muted">Erro de reprojeção</dt><dd>{err.toFixed(2)} m</dd></div>}
            {m.sport === 'futsal' && <div className="flex justify-between"><dt className="text-muted">Gols</dt><dd>{d.goals?.map((g) => g.team).join(', ') || 'nenhum'}</dd></div>}
            {m.sport === 'basketball' && <div className="flex justify-between"><dt className="text-muted">Cestas</dt><dd>{d.hoops?.map((g) => g.team).join(', ') || 'nenhuma'}</dd></div>}
            {m.sport === 'volleyball' && <div className="flex justify-between"><dt className="text-muted">Rede</dt><dd>{d.net ? 'marcada' : 'não marcada'}</dd></div>}
          </dl>
          <button className="btn-primary mt-4 w-full" onClick={persist} disabled={d.court.length > 0 && d.court.length < 4}><Save size={16} />Salvar calibração</button>
          {saved && <p className="mt-2 text-sm text-neon" role="status">Calibração salva para {src.name}.</p>}
          <p className="mt-3 text-xs text-muted">A homografia vale apenas para o plano do chão. A altura da bola no ar não é medida com uma câmera. Se a câmera for movida, recalibre.</p>
          <Link to={`/partida/${m.id}/ao-vivo`} className="btn-ghost btn-sm mt-3 w-full">Testar reconhecimento</Link>
        </Card>
      </div>
    </div>
  )
}
