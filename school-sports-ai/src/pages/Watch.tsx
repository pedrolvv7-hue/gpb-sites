// Página de espectador: somente leitura. Recebe o placar pela sinalização (sem vídeo nesta versão;
// vídeo para muitos espectadores exige um servidor SFU, documentado em docs/ARQUITETURA.md).
// Com ?local=<id> funciona como modo telão no mesmo computador do professor.
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Signal, signalingAvailable } from '../streaming/signaling'
import { useMatch } from '../store/store'
import { scoreOf, matchTime } from '../events/eventLog'
import { ENGINES } from '../sports'
import { fmtClock } from '../lib/util'
import { Logo, Notice, useNow } from '../components/ui'

interface Board { name: string; sport: string; A: { name: string; color: string; score: number }; B: { name: string; color: string; score: number }; clock: number; period: string; state: string; sets?: { label: string; A: number; B: number }[]; recent: { type: string; team?: string; t: number }[] }

export default function Watch() {
  const { room } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const local = useMatch(sp.get('local') ?? undefined)
  const [code, setCode] = useState('')
  const [board, setBoard] = useState<Board | null>(null)
  const [st, setSt] = useState('')
  const now = useNow(500)
  useEffect(() => {
    if (!room || local || !signalingAvailable) return
    const s = new Signal(room.toUpperCase())
    s.onStatus = setSt
    s.on((m) => { if (m.kind === 'scoreboard') setBoard(m.data as Board) })
    s.connect().catch(() => {})
    return () => s.close()
  }, [room, local])
  const b: Board | null = local ? (() => { const sc = scoreOf(local.events); return { name: local.name, sport: local.sport, A: { name: local.teams.A.name, color: local.teams.A.primaryColor, score: sc.A }, B: { name: local.teams.B.name, color: local.teams.B.primaryColor, score: sc.B }, clock: matchTime(local, now), period: ENGINES[local.sport].periodLabel(local), state: local.state, sets: ENGINES[local.sport].extraScore?.(local), recent: local.events.filter((e) => e.status.startsWith('confirmado') || e.status === 'corrigido').slice(-5).map((e) => ({ type: e.type, team: e.team, t: e.t })) } })() : board

  if (!room && !local) return (
    <div className="mx-auto max-w-sm space-y-3 p-6">
      <h1 className="h1">Assistir transmissão</h1>
      {!signalingAvailable && <Notice kind="warn">Transmissões remotas exigem a sinalização (Supabase) configurada neste site.</Notice>}
      <input className="input font-mono uppercase" placeholder="Código da sala" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} aria-label="Código" />
      <button className="btn-primary w-full" disabled={code.length < 6} onClick={() => nav(`/assistir/${code}`)}>Entrar</button>
      <p className="text-xs text-muted">Espectadores veem apenas placar e acontecimentos autorizados. Não podem alterar nada.</p>
    </div>
  )
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg p-6">
      <div className="flex items-center gap-2 text-muted"><Logo /><span>School Sports AI · {b?.name ?? 'Aguardando dados da partida…'}</span></div>
      {!b ? <p className="text-muted">{signalingAvailable ? `Conexão: ${st || 'conectando'}. O placar aparece quando o professor estiver na central ao vivo.` : 'Sinalização não configurada.'}</p> : <>
        <div className="flex items-center gap-8 font-mono font-extrabold" style={{ fontSize: 'clamp(3rem, 12vw, 10rem)' }}>
          <span style={{ color: b.A.color }}>{b.A.score}</span><span className="text-muted">×</span><span style={{ color: b.B.color }}>{b.B.score}</span>
        </div>
        <div className="flex gap-16 text-2xl font-bold sm:text-4xl"><span>{b.A.name}</span><span>{b.B.name}</span></div>
        <div className="font-mono text-3xl sm:text-5xl">{fmtClock(b.clock)} <span className="text-xl text-muted sm:text-2xl">{b.period}</span></div>
        {b.sets && <div className="text-lg text-muted">{b.sets.map((s) => `${s.label} ${s.A}-${s.B}`).join(' · ')}</div>}
        {b.state === 'ao_vivo' && <span className="chip bg-live text-white"><span className="live-dot h-2 w-2 rounded-full bg-white" />AO VIVO</span>}
        <ul className="text-center text-sm text-muted">{b.recent.slice().reverse().map((r, i) => <li key={i}>{fmtClock(r.t)} · {r.type} {r.team === 'A' ? b.A.name : r.team === 'B' ? b.B.name : ''}</li>)}</ul>
      </>}
    </div>
  )
}
