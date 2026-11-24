// Interface leve do celular-câmera. Microfone nunca é ativado.
import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { SwitchCamera, Square, RefreshCw } from 'lucide-react'
import { Signal, iceServers, signalingAvailable } from '../streaming/signaling'
import { Logo, Notice, Field } from '../components/ui'
import { fmtClock, uid } from '../lib/util'

const QUALITY = {
  economia: { w: 640, h: 360, fps: 15, br: 500_000, label: 'Economia de bateria' },
  baixa: { w: 854, h: 480, fps: 24, br: 900_000, label: 'Baixa' },
  equilibrada: { w: 1280, h: 720, fps: 30, br: 2_000_000, label: 'Equilibrada (720p)' },
  alta: { w: 1920, h: 1080, fps: 30, br: 4_000_000, label: 'Alta (1080p)' },
  maxima: { w: 3840, h: 2160, fps: 30, br: 8_000_000, label: 'Máxima disponível' },
} as const
type Q = keyof typeof QUALITY
const RECOMMEND: Record<string, string> = { principal: 'Lateral, no meio da quadra, o mais alto possível, enquadrando a quadra inteira.', 'gol A': 'Atrás/ao lado do gol A, alinhado com a linha do gol.', 'gol B': 'Atrás/ao lado do gol B, alinhado com a linha do gol.', 'cesta A': 'Lateral à cesta A, na altura do aro ou acima.', 'cesta B': 'Lateral à cesta B, na altura do aro ou acima.', rede: 'Lateral, alinhada com a rede, elevada.' }

export default function CameraMode() {
  const { room: roomParam } = useParams()
  const [sp] = useSearchParams()
  const [room, setRoom] = useState(roomParam ?? '')
  const [token, setToken] = useState(sp.get('t') ?? '')
  const [name, setName] = useState('Celular ' + Math.floor(Math.random() * 90 + 10))
  const [role, setRole] = useState('principal')
  const [quality, setQuality] = useState<Q>('equilibrada')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [phase, setPhase] = useState<'form' | 'aguardando' | 'transmitindo' | 'recusado' | 'erro'>('form')
  const [msg, setMsg] = useState('')
  const [info, setInfo] = useState({ w: 0, h: 0, fps: 0 })
  const [hidden, setHidden] = useState(false)
  const [start, setStart] = useState(0), [now, setNow] = useState(0)
  const [caps, setCaps] = useState<{ zoom?: { min: number; max: number; step: number }; torch?: boolean; focus?: string[]; exposure?: { min: number; max: number; step: number } }>({})
  const [zoom, setZoom] = useState(1)
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const pc = useRef<RTCPeerConnection | null>(null)
  const sig = useRef<Signal | null>(null)
  const camId = useRef(sessionStorage.getItem('ssai-camid') ?? (() => { const i = 'cam-' + uid().slice(0, 8); sessionStorage.setItem('ssai-camid', i); return i })())
  const wake = useRef<WakeLockSentinel | null>(null)

  async function openCamera(q: Q = quality, f = facing) {
    stream.current?.getTracks().forEach((t) => t.stop())
    const c = QUALITY[q]
    const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: f, width: { ideal: c.w }, height: { ideal: c.h }, frameRate: { ideal: c.fps } } })
    stream.current = s
    if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}) }
    const tr = s.getVideoTracks()[0]
    const st = tr.getSettings()
    setInfo({ w: st.width ?? 0, h: st.height ?? 0, fps: Math.round(st.frameRate ?? 0) })
    const cp = (tr.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { zoom?: { min: number; max: number; step: number }; torch?: boolean; focusMode?: string[]; exposureCompensation?: { min: number; max: number; step: number } }
    setCaps({ zoom: cp.zoom, torch: cp.torch, focus: cp.focusMode, exposure: cp.exposureCompensation })
    const sender = pc.current?.getSenders().find((x) => x.track?.kind === 'video')
    if (sender) { await sender.replaceTrack(tr); const p = sender.getParameters(); p.encodings = [{ ...(p.encodings?.[0] ?? {}), maxBitrate: c.br }]; await sender.setParameters(p).catch(() => {}) }
    return s
  }

  async function negotiate() {
    pc.current?.close()
    const p = new RTCPeerConnection({ iceServers: iceServers() })
    pc.current = p
    stream.current!.getTracks().forEach((t) => p.addTrack(t, stream.current!))
    p.onicecandidate = (e) => { if (e.candidate) sig.current?.send({ kind: 'ice', camId: camId.current, from: 'cam', cand: e.candidate.toJSON() }) }
    p.onconnectionstatechange = () => {
      if (p.connectionState === 'connected') { setPhase('transmitindo'); setStart((x) => x || Date.now()) }
      if (p.connectionState === 'failed' || p.connectionState === 'disconnected') { setMsg('Conexão perdida. Tentando reconectar…'); setTimeout(() => join(true), 2000) }
    }
    const offer = await p.createOffer()
    await p.setLocalDescription(offer)
    sig.current?.send({ kind: 'offer', camId: camId.current, sdp: offer })
  }

  async function join(reconnect = false) {
    try {
      if (!reconnect) await openCamera()
      if (!sig.current) {
        const s = new Signal(room.toUpperCase())
        sig.current = s
        s.on(async (m) => {
          if (!('camId' in m) || m.camId !== camId.current) return
          if (m.kind === 'approve') await negotiate()
          if (m.kind === 'deny') { setPhase('recusado'); setMsg(m.reason); pc.current?.close() }
          if (m.kind === 'answer') await pc.current?.setRemoteDescription(m.sdp)
          if (m.kind === 'ice' && m.from === 'host') await pc.current?.addIceCandidate(m.cand).catch(() => {})
          if (m.kind === 'ping') { const t1 = Date.now(); s.send({ kind: 'pong', camId: camId.current, t0: m.t0, t1, t2: Date.now() }) }
          if (m.kind === 'role') setRole(m.role)
        })
        await s.connect()
      }
      sig.current.send({ kind: 'join', camId: camId.current, name, role, token, ua: navigator.userAgent })
      setPhase('aguardando'); setMsg('Aguardando aprovação do professor…')
      if ('wakeLock' in navigator) wake.current = await navigator.wakeLock.request('screen').catch(() => null)
    } catch (e) {
      setPhase('erro')
      const n = (e as DOMException).name
      setMsg(n === 'NotAllowedError' ? 'Permissão da câmera negada.' : e instanceof Error ? e.message : 'Falha ao iniciar.')
    }
  }

  function stop() {
    sig.current?.send({ kind: 'bye', camId: camId.current })
    pc.current?.close(); stream.current?.getTracks().forEach((t) => t.stop()); wake.current?.release().catch(() => {})
    setPhase('form'); setStart(0)
  }

  useEffect(() => {
    const vis = () => {
      setHidden(document.hidden)
      sig.current?.send({ kind: 'stats', camId: camId.current, w: info.w, h: info.h, fps: info.fps, hidden: document.hidden })
      if (!document.hidden && phase === 'transmitindo' && 'wakeLock' in navigator) navigator.wakeLock.request('screen').then((w) => (wake.current = w)).catch(() => {})
    }
    document.addEventListener('visibilitychange', vis)
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => { document.removeEventListener('visibilitychange', vis); clearInterval(i) }
  }, [phase, info])
  useEffect(() => () => { pc.current?.close(); stream.current?.getTracks().forEach((t) => t.stop()); sig.current?.close() }, [])

  const applyConstraint = (c: Record<string, unknown>) => stream.current?.getVideoTracks()[0]?.applyConstraints({ advanced: [c as MediaTrackConstraintSet] }).catch(() => setMsg('O dispositivo recusou o ajuste.'))

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex items-center gap-2 border-b border-white/10 p-3"><Logo size={22} /><b className="text-sm">Modo câmera</b>
        {phase === 'transmitindo' && <span className="chip ml-auto bg-live"><span className="live-dot h-2 w-2 rounded-full bg-white" />TRANSMITINDO {fmtClock(now - start)}</span>}
      </div>
      {!signalingAvailable && <div className="p-3"><Notice kind="error">Este site não tem sinalização configurada (Supabase), então o celular não consegue se conectar ao computador. <Link to="/ajuda" className="underline">Saiba mais</Link></Notice></div>}
      {hidden && <div className="p-3"><Notice kind="warn">O navegador está em segundo plano: o sistema pode interromper a transmissão. Mantenha esta tela aberta.</Notice></div>}
      <div className="relative aspect-video w-full bg-black"><video ref={video} muted playsInline autoPlay className="h-full w-full object-contain" aria-label="Pré-visualização" />
        {phase !== 'form' && <div className="absolute bottom-2 left-2 space-x-1 text-[11px]"><span className="chip bg-black/70">{info.w}×{info.h}</span><span className="chip bg-black/70">{info.fps || '?'} fps</span><span className="chip bg-black/70">{name}</span><span className="chip bg-black/70">{camId.current}</span></div>}
      </div>
      <div className="space-y-3 p-4">
        {msg && <Notice kind={phase === 'erro' || phase === 'recusado' ? 'error' : 'info'}>{msg}</Notice>}
        {phase === 'form' ? <>
          <Field label="Código da sala"><input className="input font-mono uppercase" value={room} onChange={(e) => setRoom(e.target.value.toUpperCase().slice(0, 6))} placeholder="ABC123" /></Field>
          {!sp.get('t') && <Field label="Token (do link do professor)"><input className="input font-mono" value={token} onChange={(e) => setToken(e.target.value.trim())} /></Field>}
          <Field label="Nome desta câmera"><input className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 30))} /></Field>
          <Field label="Função"><select className="input" value={role} onChange={(e) => setRole(e.target.value)}>{['principal', 'lateral oposta', 'gol A', 'gol B', 'cesta A', 'cesta B', 'fundo A', 'fundo B', 'rede', 'auxiliar'].map((r) => <option key={r}>{r}</option>)}</select></Field>
          <p className="text-xs text-white/60">Posição recomendada: {RECOMMEND[role] ?? 'Fora da área de jogo, estável e com boa visão da quadra.'}</p>
          <Field label="Qualidade"><select className="input" value={quality} onChange={(e) => setQuality(e.target.value as Q)}>{Object.entries(QUALITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          <button className="btn-primary w-full" disabled={!signalingAvailable || room.length < 6 || !token} onClick={() => join()}>Permitir câmera e conectar</button>
          <p className="text-xs text-white/50">O microfone não é usado. O vídeo vai direto para o computador do professor (WebRTC criptografado).</p>
        </> : <>
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-ghost" onClick={() => { const f = facing === 'environment' ? 'user' : 'environment'; setFacing(f); openCamera(quality, f) }}><SwitchCamera size={16} />Virar</button>
            <button className="btn-ghost" onClick={() => join(true)}><RefreshCw size={16} />Reconectar</button>
            <button className="btn-danger" onClick={stop}><Square size={16} />Parar</button>
          </div>
          <Field label="Qualidade"><select className="input" value={quality} onChange={(e) => { const q = e.target.value as Q; setQuality(q); openCamera(q) }}>{Object.entries(QUALITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          {caps.zoom ? <Field label={`Zoom ${zoom.toFixed(1)}×`}><input type="range" className="w-full" min={caps.zoom.min} max={caps.zoom.max} step={caps.zoom.step || 0.1} value={zoom} onChange={(e) => { setZoom(+e.target.value); applyConstraint({ zoom: +e.target.value }) }} /></Field> : <p className="text-xs text-white/50">Zoom: não disponível neste dispositivo/navegador.</p>}
          {caps.focus?.length ? <Field label="Foco"><select className="input" onChange={(e) => applyConstraint({ focusMode: e.target.value })}>{caps.focus.map((f) => <option key={f}>{f}</option>)}</select></Field> : <p className="text-xs text-white/50">Controle de foco: não disponível.</p>}
          {caps.exposure ? <Field label="Exposição"><input type="range" className="w-full" min={caps.exposure.min} max={caps.exposure.max} step={caps.exposure.step} onChange={(e) => applyConstraint({ exposureCompensation: +e.target.value })} /></Field> : <p className="text-xs text-white/50">Exposição: não disponível.</p>}
          <p className="text-xs text-white/60">Estado: {phase}. Posição recomendada: {RECOMMEND[role] ?? '—'}</p>
        </>}
      </div>
    </div>
  )
}
