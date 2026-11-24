import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Play, Pause, SkipForward, Flag, Maximize, Monitor, Cpu, Film, Check, X, Eye, EyeOff } from 'lucide-react'
import { useMatch, useStore, useDemo } from '../store/store'
import { useSession, type Source } from '../multicamera/session'
import { Card, Empty, Notice, Spinner, StatusChip, Tabs, TeamDot, useNow, DemoBanner, ExperimentalTag } from '../components/ui'
import { VideoSource } from '../components/VideoSource'
import { Court, PlayerMarker } from '../components/Court'
import { loadCocoSsd, type ObjectDetector, type ModelStatus } from '../vision/detector'
import { loadMoveNet, SKELETON, MOVEMENT_LABEL, SPORT_MOVEMENTS, type PoseDetector } from '../vision/pose'
import { CameraPipeline, type FrameResult } from '../vision/pipeline'
import { ENGINES } from '../sports'
import { addCandidate, correctEvent, initialStatus, manualEvent, matchTime, scoreOf, setStatus } from '../events/eventLog'
import { eventLabel } from '../vision/pose'
import { fmtClock } from '../lib/util'
import { RingRecorder, clipStore } from '../replay/ringRecorder'
import { detectCapabilities } from '../lib/capabilities'
import type { Match, PositionSample, TeamSide } from '../lib/types'

type View = 'video' | 'stats' | 'multi' | 'mapa' | 'arbitragem'

export default function Live() {
  const { id } = useParams()
  const m = useMatch(id)
  const nav = useNavigate()
  const saveMatch = useStore((s) => s.saveMatch)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const sess = useSession()
  useEffect(() => { if (id) sess.ensure(id) }, [id])
  const sources = sess.sources().filter((s) => s.active)
  const [mainId, setMainId] = useState<string | null>(null)
  const [auto, setAuto] = useState(true)
  const main = sources.find((s) => s.id === mainId) ?? sources[0]
  const [view, setView] = useState<View>('video')
  const [modelStatus, setModelStatus] = useState<ModelStatus>('nao_carregado')
  const [modelErr, setModelErr] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState<Record<string, FrameResult>>({})
  const [selTrack, setSelTrack] = useState<string | null>(null)
  const [directorReason, setDirectorReason] = useState('')
  const [manualTeam, setManualTeam] = useState<TeamSide>('A')
  const [busyClip, setBusyClip] = useState(false)
  const now = useNow(250)
  const detector = useRef<ObjectDetector | null>(null)
  const poseDet = useRef<PoseDetector | null>(null)
  const [poseStatus, setPoseStatus] = useState<'carregando' | 'pronto' | 'erro'>('carregando')
  const userPaused = useRef(false)
  const fileIn = useRef<HTMLInputElement>(null)
  const pipes = useRef(new Map<string, CameraPipeline>())
  const videos = useRef(new Map<string, HTMLVideoElement>())
  const posBuf = useRef<PositionSample[]>([])
  const cov = useRef({ analyzedMs: 0, ballSeenMs: 0, lastT: 0 })
  const rec = useRef<RingRecorder | null>(null)
  const caps = useMemo(() => detectCapabilities(), [])
  const root = useRef<HTMLDivElement>(null)

  const get = useCallback((): Match | undefined => (id ? useStore.getState().matches[id] ?? useDemo.getState().matches[id] : undefined), [id])
  const update = useCallback((fn: (x: Match) => Match) => { const cur = get(); if (cur) saveMatch(fn(cur)) }, [get, saveMatch])

  // ---------- modelo ----------
  async function loadModel() {
    setModelStatus('carregando'); setModelErr('')
    try { detector.current = await loadCocoSsd(settings.aiProfile === 'avancado' ? 'mobilenet_v2' : 'lite_mobilenet_v2'); setModelStatus('pronto') }
    catch (e) { setModelStatus('erro'); setModelErr(e instanceof Error ? e.message : 'Falha ao carregar o modelo. Verifique a conexão no primeiro uso.'); return }
    // modelo de pose: se falhar, a análise continua sem movimentos do corpo
    try { poseDet.current = await loadMoveNet(); setPoseStatus('pronto') } catch (e) { setPoseStatus('erro'); console.warn('pose indisponível', e) }
  }
  // carrega a IA automaticamente quando houver câmera e inicia a análise assim que estiver pronta
  useEffect(() => { if (sources.length && modelStatus === 'nao_carregado') loadModel() }, [sources.length])
  useEffect(() => { if (modelStatus === 'pronto' && sources.length && !analyzing && !userPaused.current) startAnalysis() }, [modelStatus, sources.length])
  function startAnalysis() {
    userPaused.current = false
    const c = get()
    if (c && c.state === 'configurando') update((x) => ({ ...x, state: 'ao_vivo', clockRunning: true, clockStartedAt: Date.now() }))
    setAnalyzing(true)
  }

  // ---------- laço de análise (round-robin entre câmeras, frequência adaptativa) ----------
  useEffect(() => {
    if (!analyzing || !detector.current || !m) return
    let stop = false, idx = 0
    const loop = async () => {
      if (stop) return
      const cur = get(); if (!cur) return
      const list = sources.filter((s) => videos.current.get(s.id))
      if (list.length) {
        const src = list[idx++ % list.length]
        const v = videos.current.get(src.id)!
        let p = pipes.current.get(src.id)
        if (!p) { p = new CameraPipeline(src.id, detector.current!, cur, cur.calibrations[src.id]); pipes.current.set(src.id, p) }
        p.calib = cur.calibrations[src.id]
        p.pose = poseDet.current
        const t = matchTime(cur)
        try {
          const r = await p.process(v, cur, t, settings.detectScore)
          if (r && !stop) {
            setResults((x) => ({ ...x, [src.id]: r }))
            posBuf.current.push(...p.samplePositions(r, t))
            const dt = cov.current.lastT ? Math.min(2000, t - cov.current.lastT) : 0
            if (cur.clockRunning) { cov.current.analyzedMs += dt; if (r.ball) cov.current.ballSeenMs += dt }
            cov.current.lastT = t
            if (r.candidates.length && cur.clockRunning) handleCandidates(r.candidates)
          }
        } catch (e) { console.warn('inferência falhou', e) }
      }
      // frequência adaptativa: se a inferência demora mais que o intervalo, reduz
      const avg = [...pipes.current.values()].reduce((a, p) => Math.max(a, p.stats.avgInferMs), 0)
      const interval = Math.max(1000 / settings.inferFps / Math.max(1, list.length), avg * 1.2)
      setTimeout(loop, interval)
    }
    loop()
    const flush = setInterval(() => {
      const cur = get(); if (!cur) return
      const poss = [...pipes.current.values()].map((p) => p.possession()).find(Boolean)
      const positions = [...cur.positions, ...posBuf.current].slice(-20000)
      posBuf.current = []
      saveMatch({ ...cur, positions, coverage: { analyzedMs: cov.current.analyzedMs, ballSeenMs: cov.current.ballSeenMs }, possession: poss ?? cur.possession })
    }, 3000)
    return () => { stop = true; clearInterval(flush) }
  }, [analyzing, sources.map((s) => s.id).join(), settings.inferFps, settings.detectScore])

  useEffect(() => { const c = get(); if (c) cov.current = { ...c.coverage, lastT: 0 } }, [id])

  function handleCandidates(cands: FrameResult['candidates']) {
    let cur = get(); if (!cur) return
    for (const c of cands) {
      const cams = new Set(c.evidences.map((e) => e.cameraId))
      const status = initialStatus(c.scoring, c.confidence, cur.scoringMode, settings.thresholds, cams.size >= 2)
      const r = addCandidate(cur, { ...c, status, origin: cur.demo ? 'demo' : 'ia' }, c.type.startsWith('mov_') ? 0 : 4000)
      cur = r.match
      // fusão: se outra câmera já tinha o mesmo evento, reavaliar com concordância multicâmera
      if (r.merged && cur.scoringMode === 'automatico_experimental') {
        const nc = new Set(r.event.evidences.map((e) => e.cameraId)).size
        if (nc >= 2 && r.event.status === 'aguardando' && r.event.confidence >= settings.thresholds.auto) cur = setStatus(cur, r.event.id, 'confirmado_auto', 'ia')
      }
      if (c.scoring && !r.merged) saveClipFor(r.event.id)
    }
    saveMatch(cur)
  }

  // ---------- replay ----------
  useEffect(() => {
    rec.current?.stop(); rec.current = null
    if (!settings.recordingAllowed || !caps.recorderMime || !main) return
    const v = videos.current.get(main.id)
    const stream = main.stream ?? (v as HTMLVideoElement & { captureStream?: () => MediaStream })?.captureStream?.()
    if (!stream) return
    try { rec.current = new RingRecorder(stream, caps.recorderMime, Math.max(5, settings.replaySeconds / 2), main.id); rec.current.start() } catch { rec.current = null }
    return () => { rec.current?.stop() }
  }, [main?.id, settings.recordingAllowed, settings.replaySeconds])

  async function saveClipFor(eventId?: string) {
    if (!rec.current) return null
    setBusyClip(true)
    // espera alguns segundos para capturar também o "depois"
    await new Promise((r) => setTimeout(r, 2500))
    const clips = await rec.current.clip()
    setBusyClip(false)
    if (!clips.length) return null
    const cid = clips[0].id
    clipStore.set(cid, clips)
    if (eventId) update((x) => ({ ...x, events: x.events.map((e) => (e.id === eventId ? { ...e, clipId: cid } : e)) }))
    else update((x) => manualEvent(x, 'replay_manual', { note: 'Jogada marcada pelo professor' }))
    return cid
  }

  // ---------- diretor automático ----------
  useEffect(() => {
    if (!auto || sources.length < 2) return
    const sc = sources.map((s) => { const r = results[s.id]; return { s, score: (r?.ball ? 2 + r.ball.conf : 0) + (r ? r.tracks.length * 0.05 : 0) } }).sort((a, b) => b.score - a.score)
    const best = sc[0]
    if (best && best.s.id !== main?.id && best.score > 0) {
      const t = setTimeout(() => { setMainId(best.s.id); setDirectorReason(`${best.s.name}: ${results[best.s.id]?.ball ? 'bola visível' : 'mais jogadores visíveis'}`) }, 1500) // histerese contra trocas rápidas
      return () => clearTimeout(t)
    }
  }, [results, auto])

  // ---------- placar para espectadores ----------
  useEffect(() => {
    if (!sess.host || !m) return
    const i = setInterval(() => {
      const c = get(); if (!c) return
      const s = scoreOf(c.events)
      sess.host?.broadcastScoreboard({ name: c.name, sport: c.sport, A: { name: c.teams.A.name, color: c.teams.A.primaryColor, score: s.A }, B: { name: c.teams.B.name, color: c.teams.B.primaryColor, score: s.B }, clock: matchTime(c), period: ENGINES[c.sport].periodLabel(c), state: c.state, sets: ENGINES[c.sport].extraScore?.(c), recent: c.events.filter((e) => e.status === 'confirmado_manual' || e.status === 'confirmado_auto' || e.status === 'corrigido').slice(-5).map((e) => ({ type: e.type, team: e.team, t: e.t })) })
    }, 2000)
    return () => clearInterval(i)
  }, [sess.host, m?.id])

  if (!m) return <Empty title="Partida não encontrada"><Link to="/painel" className="text-blue">Voltar</Link></Empty>
  const engine = ENGINES[m.sport]
  const score = scoreOf(m.events)
  const t = matchTime(m, now)
  const pending = m.events.filter((e) => e.status === 'aguardando')
  const mainRes = main ? results[main.id] : undefined

  const clock = {
    start: () => update((x) => ({ ...x, state: 'ao_vivo', clockRunning: true, clockStartedAt: Date.now() })),
    pause: () => update((x) => ({ ...x, state: 'pausada', clockRunning: false, clockMs: matchTime(x), clockStartedAt: undefined })),
    reset: () => update((x) => ({ ...x, clockMs: 0, clockStartedAt: x.clockRunning ? Date.now() : undefined })),
    nextPeriod: () => update((x) => ({ ...x, period: x.period + 1, clockMs: 0, clockRunning: false, clockStartedAt: undefined, state: 'pausada' })),
  }
  function endMatch() {
    if (pending.length && !confirm(`Há ${pending.length} acontecimento(s) aguardando confirmação. Encerrar mesmo assim? Eles não entrarão no placar.`)) return
    setAnalyzing(false); rec.current?.stop()
    update((x) => ({ ...x, state: 'encerrada', clockRunning: false, clockMs: matchTime(x), endedAt: Date.now() }))
    nav(`/partida/${m!.id}/relatorio`)
  }
  const ov = settings.overlays
  const toggleOv = (k: keyof typeof ov) => setSettings({ overlays: { ...ov, [k]: !ov[k] } })

  return (
    <div ref={root} className="space-y-3 bg-bg">
      {m.demo && <DemoBanner />}
      {/* Placar */}
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <span className={`chip ${m.state === 'ao_vivo' ? 'bg-live text-white' : 'bg-line text-muted'}`}>{m.state === 'ao_vivo' && <span className="live-dot h-2 w-2 rounded-full bg-white" />}{m.state === 'ao_vivo' ? 'AO VIVO' : m.state.toUpperCase()}</span>
        <div className="flex items-center gap-3 font-mono text-2xl font-bold sm:text-3xl" aria-live="polite">
          <TeamDot color={m.teams.A.primaryColor} side="A" /><span className="text-base font-sans">{m.teams.A.name}</span><span>{score.A}</span><span className="text-muted">×</span><span>{score.B}</span><span className="text-base font-sans">{m.teams.B.name}</span><TeamDot color={m.teams.B.primaryColor} side="B" />
        </div>
        <div className="font-mono text-xl">{fmtClock(t)}</div>
        <div className="text-sm text-muted">{engine.periodLabel(m)}</div>
        {engine.extraScore && <div className="text-xs text-muted">{engine.extraScore(m).map((s) => `${s.label}: ${s.A}-${s.B}`).join(' · ')}</div>}
        <div className="ml-auto flex flex-wrap gap-1">
          {m.clockRunning ? <button className="btn-ghost btn-sm" onClick={clock.pause}><Pause size={14} />Pausar</button> : <button className="btn-primary btn-sm" onClick={clock.start}><Play size={14} />{m.state === 'configurando' ? 'Iniciar partida' : 'Retomar'}</button>}
          <button className="btn-ghost btn-sm" onClick={clock.reset}>Zerar relógio</button>
          <button className="btn-ghost btn-sm" onClick={clock.nextPeriod}><SkipForward size={14} />{m.sport === 'volleyball' ? 'Pausa' : 'Próximo período'}</button>
          <button className="btn-ghost btn-sm" onClick={() => root.current?.requestFullscreen?.()}><Maximize size={14} />Tela cheia</button>
          <Link className="btn-ghost btn-sm" to={`/assistir/${sess.room ?? ''}?local=${m.id}`} target="_blank"><Monitor size={14} />Telão</Link>
          <button className="btn-danger btn-sm" onClick={endMatch}><Flag size={14} />Encerrar</button>
        </div>
      </div>

      {/* IA */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Cpu size={14} />
        {modelStatus === 'nao_carregado' && <button className="btn-primary btn-sm" onClick={loadModel}>Carregar modelo de IA</button>}
        {modelStatus === 'carregando' && <Spinner label="Carregando COCO-SSD (TensorFlow.js)…" />}
        {modelStatus === 'erro' && <><span className="text-live">Modelo não carregado: {modelErr}</span><button className="btn-ghost btn-sm" onClick={loadModel}>Tentar novamente</button><span className="text-muted">O placar manual continua funcionando.</span></>}
        {modelStatus === 'pronto' && <>
          <span className="chip bg-neon/20 text-neon">{detector.current?.name} · {detector.current?.backend}</span>
          <button className={analyzing ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'} onClick={() => { if (analyzing) { userPaused.current = true; setAnalyzing(false) } else startAnalysis() }} disabled={!sources.length}>{analyzing ? 'Pausar análise' : 'Iniciar análise'}</button>
          <span className={`chip ${poseStatus === 'pronto' ? 'bg-neon/20 text-neon' : poseStatus === 'erro' ? 'bg-live/20 text-live' : 'bg-line text-muted'}`}>Pose: {poseStatus === 'pronto' ? 'MoveNet ativo' : poseStatus === 'erro' ? 'indisponível' : 'carregando…'}</span>
          {[...pipes.current.values()].map((p) => <span key={p.cameraId} className="text-muted">{sources.find((s) => s.id === p.cameraId)?.name ?? p.cameraId}: {p.stats.effectiveFps.toFixed(1)} inf/s · {p.stats.avgInferMs.toFixed(0)} ms</span>)}
        </>}
        <span className="ml-auto text-muted">Modo: {m.scoringMode === 'assistido' ? 'assistido' : 'automático experimental'}</span>
      </div>
      {!sources.length && <div className="card space-y-2 border-pend p-4">
        <p className="font-semibold">Escolha a imagem que a IA vai analisar</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => sess.addWebcam()}>Usar a câmera deste dispositivo</button>
          <button className="btn-ghost" onClick={() => fileIn.current?.click()}>Enviar vídeo gravado</button>
          <Link to={`/partida/${m.id}/cameras`} className="btn-ghost">Conectar celulares</Link>
        </div>
        <input ref={fileIn} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) sess.addFile(f); e.target.value = '' }} />
        {sess.error && <Notice kind="error">{sess.error}</Notice>}
        <p className="text-xs text-muted">A IA carrega e começa sozinha assim que houver imagem. O placar manual funciona mesmo sem câmera.</p>
      </div>}
      {analyzing && !m.clockRunning && <Notice kind="warn">A partida está pausada: a IA continua mostrando detecções, mas só registra acontecimentos com o relógio rodando. Toque em Retomar.</Notice>}
      {sources.length > 0 && !sources.some((s) => m.calibrations[s.id]?.H) && <Notice kind="info">Calibração necessária para mapa tático, posse, distâncias e velocidades. <Link to={`/partida/${m.id}/calibrar`} className="text-blue underline">Calibrar agora</Link></Notice>}

      <Tabs value={view} onChange={setView} items={[{ id: 'video', label: 'Vídeo em destaque' }, { id: 'multi', label: 'Multicâmeras' }, { id: 'stats', label: 'Estatísticas' }, { id: 'mapa', label: 'Mapa tático' }, { id: 'arbitragem', label: 'Arbitragem' }]} />

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {/* vídeos sempre montados (necessário para análise), visibilidade conforme a visão */}
          <div className={view === 'multi' ? 'grid gap-2 sm:grid-cols-2' : ''}>
            {sources.map((s) => (
              <div key={s.id} className={view === 'multi' || s.id === main?.id ? (view === 'stats' || view === 'mapa' ? 'hidden' : '') : 'hidden'}>
                <OverlayVideo src={s} res={results[s.id]} match={m} ov={ov} sel={selTrack} onSelect={setSelTrack} register={(v) => { if (v) videos.current.set(s.id, v); else videos.current.delete(s.id) }} />
              </div>
            ))}
          </div>
          {view === 'video' && sources.length > 1 && <div className="flex flex-wrap items-center gap-2 text-xs">
            {sources.map((s) => <button key={s.id} onClick={() => { setMainId(s.id); setAuto(false) }} className={`btn-sm rounded border px-2 ${s.id === main?.id ? 'border-blue' : 'border-line'}`}>{s.name}{results[s.id]?.ball ? ' ●' : ''}</button>)}
            <label className="ml-2 flex items-center gap-1"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />Diretor automático <ExperimentalTag /></label>
            {auto && directorReason && <span className="text-muted">Motivo: {directorReason}</span>}
          </div>}
          {(view === 'video' || view === 'multi') && <div className="flex flex-wrap gap-1 text-xs">
            {(Object.keys(ov) as (keyof typeof ov)[]).map((k) => <button key={k} onClick={() => toggleOv(k)} className={`btn-sm rounded border px-2 ${ov[k] ? 'border-blue text-fg' : 'border-line text-muted'}`}>{ov[k] ? <Eye size={12} /> : <EyeOff size={12} />}{{ boxes: 'Caixas', labels: 'IDs', teams: 'Cores', ball: 'Bola', trails: 'Trajetória', court: 'Linhas calibradas', confidence: 'Confiança', pose: 'Esqueleto' }[k]}</button>)}
          </div>}
          {view === 'mapa' && <Card title="Mapa tático">
            <TacticalMap match={m} results={results} sel={selTrack} onSel={setSelTrack} />
          </Card>}
          {view === 'stats' && <StatsTable match={m} />}
          {view === 'arbitragem' && <Card title="Arbitragem assistida">
            <p className="mb-2 text-sm text-muted">Sugestões complexas (faltas, andadas, toques) não são detectadas automaticamente nesta versão. Registre aqui; a decisão é do árbitro.</p>
            <ManualPanel match={m} team={manualTeam} setTeam={setManualTeam} onAct={(a) => update((x) => manualEvent(x, a.type, { team: manualTeam, points: a.points, scoring: a.scoring }))} filter={(a) => !a.scoring} />
          </Card>}
          {selTrack && <Card title={`Jogador ${selTrack}`} action={<button className="btn-ghost btn-sm" onClick={() => setSelTrack(null)}>Fechar</button>}>
            <TrackEditor label={selTrack} pipes={pipes.current} match={m} onDone={() => setSelTrack(null)} />
          </Card>}
        </div>

        <div className="space-y-3">
          <Card title={`Aguardando confirmação (${pending.length})`}>
            {!pending.length && <p className="text-sm text-muted">Nenhum acontecimento pendente.</p>}
            {pending.slice(-6).reverse().map((e) => (
              <div key={e.id} className="mb-2 rounded-lg border border-pend/40 bg-pend/5 p-2 text-sm">
                <div className="flex justify-between"><b>{eventLabel(e.type)}</b><span className="font-mono text-xs">{fmtClock(e.t)}</span></div>
                <p className="text-xs text-muted">{e.note ?? e.evidences[0]?.detail} · confiança interna {(e.confidence * 100).toFixed(0)}% · câmeras: {[...new Set(e.evidences.map((x) => x.cameraId))].length}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <select aria-label="Equipe" className="input w-28 py-1" value={e.team ?? ''} onChange={(ev) => update((x) => correctEvent(x, e.id, { team: ev.target.value as TeamSide }))}><option value="">Equipe?</option><option value="A">{m.teams.A.name}</option><option value="B">{m.teams.B.name}</option></select>
                  {m.sport === 'basketball' && <select aria-label="Pontos" className="input w-20 py-1" value={e.points} onChange={(ev) => update((x) => correctEvent(x, e.id, { points: +ev.target.value }))}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select>}
                  <button className="btn-primary btn-sm" disabled={!e.team} onClick={() => update((x) => setStatus(x, e.id, 'confirmado_manual'))}><Check size={12} />Confirmar</button>
                  <button className="btn-ghost btn-sm" onClick={() => update((x) => setStatus(x, e.id, 'rejeitado'))}><X size={12} />Rejeitar</button>
                  {e.clipId && <Link className="btn-ghost btn-sm" to={`/partida/${m.id}/eventos?ev=${e.id}`}><Film size={12} />Replay</Link>}
                </div>
              </div>
            ))}
          </Card>
          <Card title="Controle manual">
            <ManualPanel match={m} team={manualTeam} setTeam={setManualTeam} onAct={(a) => update((x) => manualEvent(x, a.type, { team: manualTeam, points: a.points, scoring: a.scoring }))} />
            <div className="mt-2 flex flex-wrap gap-1">
              <button className="btn-ghost btn-sm" onClick={() => { const last = [...m.events].reverse().find((e) => e.scoring && e.team === manualTeam && e.status !== 'rejeitado'); if (last) update((x) => setStatus(x, last.id, 'rejeitado')) }}>Remover último ponto da equipe {manualTeam}</button>
              <button className="btn-ghost btn-sm" disabled={!rec.current || busyClip} onClick={() => saveClipFor()}><Film size={12} />{busyClip ? 'Salvando…' : 'Salvar replay'}</button>
            </div>
            {!settings.recordingAllowed && <p className="mt-1 text-xs text-muted">Replay desligado. Ative em Privacidade (gravação autorizada).</p>}
            {settings.recordingAllowed && !caps.recorderMime && <p className="mt-1 text-xs text-muted">Este navegador não suporta gravação (MediaRecorder).</p>}
          </Card>
          <Card title="Linha do tempo" action={<Link className="text-xs text-blue" to={`/partida/${m.id}/eventos`}>Central de acontecimentos</Link>}>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
              {[...m.events].reverse().slice(0, 30).map((e) => <li key={e.id} className="flex items-center gap-2"><span className="font-mono text-muted">{fmtClock(e.t)}</span>{e.team && <TeamDot side={e.team} color={m.teams[e.team].primaryColor} />}<span>{eventLabel(e.type)}{e.playerId ? ` · ${e.playerId}` : ''}{e.points && e.scoring ? ` +${e.points}` : ''}</span><span className="ml-auto"><StatusChip s={e.status} /></span></li>)}
              {!m.events.length && <li className="text-muted">Sem acontecimentos.</li>}
            </ul>
          </Card>
          <Card title="Qualidade da análise">
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between"><dt className="text-muted">Tempo analisado</dt><dd>{fmtClock(m.coverage.analyzedMs)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Bola visível</dt><dd>{m.coverage.analyzedMs ? `${Math.round((m.coverage.ballSeenMs / m.coverage.analyzedMs) * 100)}% do tempo analisado` : 'Informação indisponível'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Jogadores (câmera principal)</dt><dd>{mainRes ? mainRes.tracks.length : 'Não detectado'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Bola (câmera principal)</dt><dd>{mainRes ? { detectada: 'Detectada', estimada: 'Estimada', perdida: 'Temporariamente perdida', fora_da_imagem: 'Fora da imagem', recuperada: 'Recuperada' }[mainRes.ballState] : 'Não detectado'}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}

function OverlayVideo({ src, res, match, ov, sel, onSelect, register }: { src: Source; res?: FrameResult; match: Match; ov: Record<string, boolean>; sel: string | null; onSelect: (l: string) => void; register: (v: HTMLVideoElement | null) => void }) {
  const cal = match.calibrations[src.id]
  const color = (t: string) => (t === 'A' ? match.teams.A.primaryColor : t === 'B' ? match.teams.B.primaryColor : '#94a3b8')
  return (
    <div className="relative overflow-hidden rounded-lg bg-black">
      <VideoSource src={src} ref={register as never} className="block w-full" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }}>
        {ov.court && cal?.imagePts.length === 4 || (ov.court && cal && cal.imagePts.length >= 4) ? <polygon points={cal!.imagePts.slice(0, 4).map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} fill="none" stroke="#3B82F6" strokeWidth={0.3} strokeDasharray="1 1" /> : null}
        {ov.court && cal?.goals?.map((g) => <line key={g.team} x1={g.postL.x * 100} y1={g.postL.y * 100} x2={g.postR.x * 100} y2={g.postR.y * 100} stroke="#F59E0B" strokeWidth={0.5} />)}
        {ov.court && cal?.hoops?.map((h) => <ellipse key={h.team} cx={h.center.x * 100} cy={h.center.y * 100} rx={h.radius * 100} ry={h.radius * 60} fill="none" stroke="#f97316" strokeWidth={0.4} />)}
        {ov.court && cal?.net && <line x1={cal.net.left.x * 100} y1={cal.net.left.y * 100} x2={cal.net.right.x * 100} y2={cal.net.right.y * 100} stroke="#fff" strokeWidth={0.5} />}
        {res?.tracks.map((t) => ov.boxes && <rect key={t.id} x={t.box.x * 100} y={t.box.y * 100} width={t.box.w * 100} height={t.box.h * 100} fill="transparent" stroke={ov.teams ? color(t.team) : '#fff'} strokeWidth={sel === t.label ? 3 : 1.5} vectorEffect="non-scaling-stroke" strokeDasharray={t.misses ? '4 3' : undefined} />)}
        {ov.trails && res && <polyline points={res.trail.filter((p) => p.observed).map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} fill="none" stroke="#fde047" strokeWidth={2} vectorEffect="non-scaling-stroke" opacity={0.8} />}
        {ov.pose && res?.poses.map((po, i) => <g key={'p' + i}>{SKELETON.map(([a, b]) => po.pose[a].s > 0.3 && po.pose[b].s > 0.3 && <line key={a + b} x1={po.pose[a].x * 100} y1={po.pose[a].y * 100} x2={po.pose[b].x * 100} y2={po.pose[b].y * 100} stroke="#22C55E" strokeWidth={2} vectorEffect="non-scaling-stroke" />)}</g>)}
        {ov.ball && res?.ball && <ellipse cx={res.ball.x * 100} cy={res.ball.y * 100} rx={1.4} ry={2.2} fill="none" stroke={res.ballState === 'estimada' ? '#F59E0B' : '#fde047'} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeDasharray={res.ballState === 'estimada' ? '4 3' : undefined} />}
      </svg>
      {res?.tracks.map((t) => (
        <button key={t.id} onClick={() => onSelect(t.label)} className="absolute -translate-y-full whitespace-nowrap rounded px-1 text-[10px] font-bold leading-4 text-white" style={{ left: `${t.box.x * 100}%`, top: `${t.box.y * 100}%`, background: ov.teams ? color(t.team) : '#000a', width: ov.labels ? undefined : `${t.box.w * 100}%`, height: ov.labels ? undefined : `${t.box.h * 100}%`, transform: ov.labels ? undefined : 'none', opacity: ov.labels ? 1 : 0 }} aria-label={`Jogador ${t.label}`}>
          {ov.labels && <>{t.label}{t.team === 'U' ? ' · equipe indefinida' : ''}</>}
        </button>
      ))}
      {ov.ball && ov.confidence && res?.ball && <span className="pointer-events-none absolute whitespace-nowrap text-[10px] font-bold text-yellow-300 [text-shadow:0_0_2px_#000]" style={{ left: `${res.ball.x * 100 + 1.5}%`, top: `${res.ball.y * 100}%` }}>{res.ballState === 'estimada' ? 'bola estimada' : `bola ${(res.ball.conf * 100).toFixed(0)}%`}</span>}
      <span className="chip absolute left-2 top-2 bg-black/70 text-white">{src.name}</span>
      {res && res.ballState === 'perdida' && ov.ball && <span className="chip absolute right-2 top-2 bg-black/70 text-pend">Bola não detectada</span>}
    </div>
  )
}

function TacticalMap({ match, results, sel, onSel }: { match: Match; results: Record<string, FrameResult>; sel: string | null; onSel: (l: string) => void }) {
  const [paused, setPaused] = useState(false)
  const snap = useRef(results)
  if (!paused) snap.current = results
  const players = Object.values(snap.current).flatMap((r) => r.courtPlayers)
  const trail = sel ? match.positions.filter((p) => p.trackId === sel).slice(-60) : []
  return <>
    {!players.length && <Notice kind="info">Sem posições calibradas: calibre ao menos uma câmera e inicie a análise.</Notice>}
    <Court sport={match.sport} L={match.rules.courtLength} W={match.rules.courtWidth}>
      {trail.length > 1 && <polyline points={trail.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fde047" strokeWidth={0.15} />}
      {players.map((p, i) => <PlayerMarker key={i} x={p.x} y={p.y} color={p.team === 'A' ? match.teams.A.primaryColor : match.teams.B.primaryColor} side={p.team as 'A'} label={p.label} estimated={p.estimated} highlight={sel === p.label} onClick={() => onSel(p.label)} />)}
    </Court>
    <div className="mt-2 flex items-center gap-2 text-xs text-muted"><button className="btn-ghost btn-sm" onClick={() => setPaused(!paused)}>{paused ? 'Retomar' : 'Pausar mapa'}</button>Contorno tracejado = posição estimada (jogador não visto no último quadro). Bola não é projetada quando pode estar no ar.</div>
  </>
}

export function StatsTable({ match }: { match: Match }) {
  const mv = (team?: 'A' | 'B') => (k: string) => match.events.filter((e) => e.type === 'mov_' + k && e.status !== 'rejeitado' && (team ? e.team === team : !e.team)).length
  const rows = [...ENGINES[match.sport].teamStats(match), ...SPORT_MOVEMENTS[match.sport].map((k) => ({ label: `${MOVEMENT_LABEL[k]} (IA de pose)`, A: mv('A')(k), B: mv('B')(k), note: mv()(k) ? `+${mv()(k)} de jogadores com equipe indefinida` : undefined }))]
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="p-2">Estatística</th><th className="p-2">{match.teams.A.name}</th><th className="p-2">{match.teams.B.name}</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.label} className="border-b border-line/50"><td className="p-2">{r.label}{r.note && <div className="text-[11px] text-muted">{r.note}</div>}</td><td className="p-2 font-mono">{r.A}</td><td className="p-2 font-mono">{r.B}</td></tr>)}</tbody>
      </table>
      <p className="p-2 text-[11px] text-muted">Contagens incluem eventos confirmados e detectados não rejeitados; placar só considera confirmados. Itens marcados como estimados vêm da IA e podem conter erros.</p>
    </div>
  )
}

function ManualPanel({ match, team, setTeam, onAct, filter }: { match: Match; team: TeamSide; setTeam: (t: TeamSide) => void; onAct: (a: { type: string; scoring: boolean; points?: number }) => void; filter?: (a: { scoring: boolean }) => boolean }) {
  const acts = ENGINES[match.sport].manualActions.filter(filter ?? (() => true))
  return <>
    <Tabs value={team} onChange={setTeam} items={[{ id: 'A', label: match.teams.A.name }, { id: 'B', label: match.teams.B.name }]} />
    <div className="mt-2 flex flex-wrap gap-1">{acts.map((a) => <button key={a.label} className={a.scoring ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'} onClick={() => onAct(a)}>{a.label}</button>)}</div>
  </>
}

function TrackEditor({ label, pipes, match, onDone }: { label: string; pipes: Map<string, CameraPipeline>; match: Match; onDone: () => void }) {
  const [name, setName] = useState(label)
  const [other, setOther] = useState('')
  const all = [...pipes.values()].flatMap((p) => p.tracker.tracks.map((t) => ({ p, t })))
  const me = all.find((x) => x.t.label === label)
  if (!me) return <p className="text-sm text-muted">Jogador não está mais rastreado.</p>
  return <div className="space-y-2 text-sm">
    <p className="text-muted">Correções manuais têm prioridade sobre a IA.</p>
    <div className="flex gap-2"><input className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 12))} aria-label="Novo identificador" placeholder="ex.: A07 ou camisa 7" /><button className="btn-primary btn-sm" onClick={() => { me.p.tracker.relabel(me.t.id, name); onDone() }}>Renomear</button></div>
    <div className="flex gap-1">{(['A', 'B'] as const).map((s) => <button key={s} className="btn-ghost btn-sm" onClick={() => { me.t.team = s; me.t.manualLabel ??= me.t.label; onDone() }}>Definir equipe {match.teams[s].name}</button>)}</div>
    <div className="flex gap-2"><select className="input" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Trocar com"><option value="">Trocar identidade com…</option>{all.filter((x) => x.p === me.p && x.t !== me.t).map((x) => <option key={x.t.id} value={x.t.id}>{x.t.label}</option>)}</select><button className="btn-ghost btn-sm" disabled={!other} onClick={() => { me.p.tracker.swap(me.t.id, +other); onDone() }}>Trocar</button></div>
  </div>
}
