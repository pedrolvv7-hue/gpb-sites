// Central de acontecimentos + School VAR (revisão com câmera lenta, quadro a quadro e zoom).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { Check, X, Film, StepBack, StepForward, ZoomIn, ZoomOut, Download } from 'lucide-react'
import { useMatch, useStore, useDemo } from '../store/store'
import { Card, Empty, Notice, StatusChip, TeamDot, DemoBanner } from '../components/ui'
import { correctEvent, setStatus } from '../events/eventLog'
import { clipStore } from '../replay/ringRecorder'
import { fmtClock, download } from '../lib/util'
import type { EventStatus, Match, SportEvent, TeamSide } from '../lib/types'

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2]

export default function Events() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const m = useMatch(id)
  const save = useStore((s) => s.saveMatch)
  const [type, setType] = useState(''), [team, setTeam] = useState(''), [status, setStatusF] = useState(''), [minConf, setMinConf] = useState(0)
  const [sel, setSel] = useState<string | null>(sp.get('ev'))
  const [note, setNote] = useState('')
  if (!m) return <Empty title="Partida não encontrada" />
  const get = () => useStore.getState().matches[m.id] ?? useDemo.getState().matches[m.id]
  const upd = (f: (x: Match) => Match) => save(f(get()!))
  const list = m.events.filter((e) => (!type || e.type === type) && (!team || e.team === team) && (!status || e.status === status) && e.confidence >= minConf)
  const types = [...new Set(m.events.map((e) => e.type))]
  const ev = m.events.find((e) => e.id === sel)

  return (
    <div className="space-y-4">
      {m.demo && <DemoBanner />}
      <div className="flex flex-wrap items-end justify-between gap-2"><div><h1 className="h1">Central de acontecimentos</h1><p className="text-sm text-muted">{m.name}</p></div><Link className="btn-ghost btn-sm" to={`/partida/${m.id}/ao-vivo`}>Voltar ao vivo</Link></div>
      <div className="card flex flex-wrap gap-2 p-3">
        <select className="input w-40" value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option>{types.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="input w-40" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Equipe"><option value="">Todas as equipes</option><option value="A">{m.teams.A.name}</option><option value="B">{m.teams.B.name}</option></select>
        <select className="input w-48" value={status} onChange={(e) => setStatusF(e.target.value)} aria-label="Estado"><option value="">Todos os estados</option>{(['aguardando', 'detectado', 'confirmado_auto', 'confirmado_manual', 'corrigido', 'rejeitado', 'indeterminado'] as EventStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <label className="flex items-center gap-2 text-xs">Confiança mín. <input type="range" min={0} max={1} step={0.05} value={minConf} onChange={(e) => setMinConf(+e.target.value)} />{Math.round(minConf * 100)}%</label>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-1 lg:col-span-2">
          {!list.length && <Empty title="Nenhum acontecimento com estes filtros" />}
          {list.map((e) => (
            <button key={e.id} onClick={() => { setSel(e.id); setNote(e.note ?? '') }} className={`card flex w-full items-center gap-2 p-2 text-left text-sm ${sel === e.id ? 'border-blue' : ''}`}>
              <span className="font-mono text-xs text-muted">{fmtClock(e.t)}</span><span className="text-xs text-muted">P{e.period}</span>
              {e.team && <TeamDot side={e.team} color={m.teams[e.team].primaryColor} />}
              <span className="flex-1">{e.type}{e.scoring && e.points ? ` (+${e.points})` : ''}{e.playerId ? ` · ${e.playerId}` : ''}</span>
              {e.clipId && <Film size={12} className="text-blue" />}
              <StatusChip s={e.status} />
            </button>
          ))}
        </div>
        <div className="lg:col-span-3">
          {!ev ? <Empty title="Selecione um acontecimento para revisar" /> : <Card title={<>School VAR · {ev.type}</>}>
            <Notice kind="warn">Ferramenta de apoio. Linhas exibidas são aproximações da calibração; não é tecnologia oficial certificada de arbitragem.</Notice>
            <div className="mt-3"><ReplayViewer ev={ev} /></div>
            <dl className="mt-3 grid grid-cols-2 gap-1 text-xs">
              <dt className="text-muted">Horário</dt><dd>{fmtClock(ev.t)} · período {ev.period}</dd>
              <dt className="text-muted">Origem</dt><dd>{ev.origin}</dd>
              <dt className="text-muted">Confiança interna</dt><dd>{(ev.confidence * 100).toFixed(0)}% (não é precisão garantida)</dd>
              <dt className="text-muted">Câmeras</dt><dd>{[...new Set(ev.evidences.map((x) => x.cameraId))].join(', ') || 'nenhuma (manual)'}</dd>
            </dl>
            {ev.evidences.length > 0 && <ul className="mt-2 space-y-1 text-xs text-muted">{ev.evidences.map((x, i) => <li key={i}>• [{x.cameraId}] {x.kind}: {x.detail}</li>)}</ul>}
            <div className="mt-3 flex flex-wrap gap-2">
              <select className="input w-36" value={ev.team ?? ''} onChange={(e) => upd((x) => correctEvent(x, ev.id, { team: e.target.value as TeamSide }))} aria-label="Alterar equipe"><option value="">Sem equipe</option><option value="A">{m.teams.A.name}</option><option value="B">{m.teams.B.name}</option></select>
              {ev.scoring && <select className="input w-28" value={ev.points ?? 1} onChange={(e) => upd((x) => correctEvent(x, ev.id, { points: +e.target.value }))} aria-label="Pontuação">{[1, 2, 3].map((p) => <option key={p} value={p}>{p} pt</option>)}</select>}
              <input className="input w-36" placeholder="Jogador (ex.: A07)" defaultValue={ev.playerId} onBlur={(e) => e.target.value !== (ev.playerId ?? '') && upd((x) => correctEvent(x, ev.id, { playerId: e.target.value }))} aria-label="Alterar jogador" />
              <button className="btn-primary btn-sm" disabled={ev.scoring && !ev.team} onClick={() => upd((x) => setStatus(x, ev.id, 'confirmado_manual'))}><Check size={14} />Confirmar</button>
              <button className="btn-ghost btn-sm" onClick={() => upd((x) => setStatus(x, ev.id, 'rejeitado'))}><X size={14} />Rejeitar</button>
            </div>
            <div className="mt-2 flex gap-2"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação" aria-label="Observação" /><button className="btn-ghost btn-sm" onClick={() => upd((x) => correctEvent(x, ev.id, { note }))}>Salvar observação</button></div>
            <h3 className="mb-1 mt-4 text-sm font-semibold">Histórico de decisões</h3>
            <ul className="space-y-0.5 text-xs text-muted">{m.corrections.filter((c) => c.eventId === ev.id).map((c) => <li key={c.id}>{new Date(c.at).toLocaleTimeString()} · {c.by} · {c.action} {c.after ? JSON.stringify(c.after).slice(0, 80) : ''}</li>)}</ul>
          </Card>}
        </div>
      </div>
    </div>
  )
}

function ReplayViewer({ ev }: { ev: SportEvent }) {
  const clips = ev.clipId ? clipStore.get(ev.clipId) : undefined
  const [idx, setIdx] = useState(0)
  const [rate, setRate] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [sync, setSync] = useState(false)
  const refs = useRef<(HTMLVideoElement | null)[]>([])
  useEffect(() => { refs.current.forEach((v) => v && (v.playbackRate = rate)) }, [rate, idx])
  const step = (d: number) => refs.current.forEach((v) => { if (v) { v.pause(); v.currentTime = Math.max(0, v.currentTime + d / 30) } })
  if (!ev.clipId) return <Notice kind="info">Sem replay para este acontecimento (gravação desativada, navegador sem suporte ou evento manual).</Notice>
  if (!clips?.length) return <Notice kind="warn">O replay deste acontecimento não está disponível: clipes ficam apenas na memória da sessão em que foram gravados.</Notice>
  const shown = sync ? clips : [clips[idx]]
  return <div>
    <div className={`grid gap-2 ${sync ? 'sm:grid-cols-2' : ''}`}>
      {shown.map((c, i) => <div key={c.id} className="overflow-hidden rounded bg-black"><video ref={(v) => { refs.current[i] = v }} src={c.url} controls className="w-full origin-center" style={{ transform: `scale(${zoom})` }} /></div>)}
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
      {clips.length > 1 && <><button className="btn-ghost btn-sm" onClick={() => setIdx((idx + 1) % clips.length)}>Segmento {idx + 1}/{clips.length}</button><label className="flex items-center gap-1"><input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} />Lado a lado</label></>}
      <button className="btn-ghost btn-sm" onClick={() => step(-1)} aria-label="Quadro anterior"><StepBack size={14} /></button>
      <button className="btn-ghost btn-sm" onClick={() => step(1)} aria-label="Próximo quadro"><StepForward size={14} /></button>
      {SPEEDS.map((s) => <button key={s} onClick={() => setRate(s)} className={`btn-sm rounded border px-2 ${rate === s ? 'border-blue' : 'border-line'}`}>{String(s).replace('.', ',')}x</button>)}
      <button className="btn-ghost btn-sm" onClick={() => setZoom(Math.min(4, zoom + 0.5))} aria-label="Aproximar"><ZoomIn size={14} /></button>
      <button className="btn-ghost btn-sm" onClick={() => setZoom(Math.max(1, zoom - 0.5))} aria-label="Afastar"><ZoomOut size={14} /></button>
      <button className="btn-ghost btn-sm" onClick={() => download(`replay-${ev.type}-${ev.id.slice(0, 6)}.webm`, clips[idx].blob)}><Download size={14} />Exportar clipe</button>
    </div>
  </div>
}
