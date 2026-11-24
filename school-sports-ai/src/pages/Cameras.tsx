import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { Camera, FileVideo, QrCode, Trash2, Check, X, Maximize2, Wifi, Crosshair, Copy } from 'lucide-react'
import { useMatch } from '../store/store'
import { useSession } from '../multicamera/session'
import { Card, Empty, Notice } from '../components/ui'
import { VideoSource } from '../components/VideoSource'
import { signalingAvailable } from '../streaming/signaling'
import { syncLevel } from '../multicamera/sync'
import { calibrationQuality } from '../calibration/homography'

const ROLES = ['principal', 'lateral', 'lateral oposta', 'gol A', 'gol B', 'cesta A', 'cesta B', 'fundo A', 'fundo B', 'rede', 'auxiliar']

export default function Cameras() {
  const { id } = useParams()
  const m = useMatch(id)
  const s = useSession()
  const [qr, setQr] = useState<string | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  useEffect(() => { if (id) s.ensure(id) }, [id])
  useEffect(() => { navigator.mediaDevices?.enumerateDevices().then((d) => setDevices(d.filter((x) => x.kind === 'videoinput'))).catch(() => {}) }, [s.locals.length])
  const link = s.room && s.token ? `${location.origin}/camera/${s.room}?t=${s.token}&p=${encodeURIComponent(m?.name ?? '')}&s=${m?.sport ?? ''}` : ''
  useEffect(() => { if (s.host && link) QRCode.toDataURL(link, { width: 260, margin: 1 }).then(setQr) }, [s.host, link])
  if (!m) return <Empty title="Partida não encontrada"><Link to="/painel" className="text-blue">Voltar ao painel</Link></Empty>
  const remotes = s.host ? [...s.host.cams.values()] : []
  const all = s.sources()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="h1">Central de câmeras</h1><p className="text-sm text-muted">{m.name} · {m.cameraCount} câmera(s) planejada(s)</p></div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/posicionamento/${m.sport}`} className="btn-ghost btn-sm">Guia de posicionamento</Link>
          <Link to={`/partida/${m.id}/calibrar`} className="btn-ghost btn-sm" aria-disabled={!all.length}><Crosshair size={14} />Calibrar</Link>
          <Link to={`/partida/${m.id}/ao-vivo`} className="btn-primary btn-sm">Ir para análise ao vivo</Link>
        </div>
      </div>
      {s.error && <Notice kind="error">{s.error}</Notice>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Adicionar fonte">
          <div className="space-y-2">
            <button className="btn-ghost w-full" onClick={() => s.addWebcam()}><Camera size={16} />Câmera deste dispositivo</button>
            {devices.length > 1 && <select className="input" defaultValue="" onChange={(e) => e.target.value && s.addWebcam(e.target.value)} aria-label="Escolher câmera"><option value="">Escolher outra câmera…</option>{devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Câmera ${i + 1}`}</option>)}</select>}
            <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()}><FileVideo size={16} />Analisar vídeo gravado</button>
            <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) s.addFile(f); e.target.value = '' }} />
            <button className="btn-primary w-full" disabled={!signalingAvailable || !!s.host} onClick={() => s.startRemote()}><QrCode size={16} />Conectar celulares por QR Code</button>
            {!signalingAvailable && <p className="text-xs text-muted">Celulares remotos exigem sinalização (Supabase) configurada. Neste ambiente ela não está configurada, então essa opção fica desativada.</p>}
          </div>
          {s.host && <div className="mt-4 text-center">
            <p className="text-xs text-muted">Sinalização: <b>{s.host.signal.status}</b> · Sala <span className="font-mono">{s.room}</span></p>
            {qr && <img src={qr} alt="QR Code para conectar câmera" className="mx-auto mt-2 rounded bg-white p-2" width={220} height={220} />}
            <button className="btn-ghost btn-sm mt-2" onClick={() => navigator.clipboard?.writeText(link)}><Copy size={12} />Copiar link</button>
            <p className="mt-1 text-[11px] text-muted">O link contém um token desta sessão. Compartilhe só com quem vai operar câmeras.</p>
          </div>}
        </Card>

        <div className="space-y-3 lg:col-span-2">
          {remotes.filter((c) => c.state === 'pendente').map((c) => (
            <div key={c.camId} className="card flex items-center justify-between border-pend p-3">
              <span><b>{c.name}</b> quer conectar ({c.role}) <span className="text-xs text-muted">{c.ua.slice(0, 40)}</span></span>
              <span className="flex gap-2"><button className="btn-primary btn-sm" onClick={() => s.host!.approve(c.camId)}><Check size={14} />Aprovar</button><button className="btn-ghost btn-sm" onClick={() => s.host!.deny(c.camId)}><X size={14} />Recusar</button></span>
            </div>
          ))}
          {!all.length && !remotes.length && <Empty title="Nenhuma câmera conectada">Adicione a câmera deste dispositivo, um vídeo gravado ou conecte celulares.</Empty>}
          <div className="grid gap-3 sm:grid-cols-2">
            {all.map((src) => {
              const r = remotes.find((c) => c.camId === src.id)
              const cal = m.calibrations[src.id]
              const stale = r?.lastFrameAt ? Date.now() - r.lastFrameAt > 5000 : false
              return (
                <div key={src.id} className={`card overflow-hidden ${src.active ? '' : 'opacity-60'}`}>
                  <div className="relative aspect-video bg-black">
                    <VideoSource src={src} className="h-full w-full object-contain" />
                    <span className={`chip absolute left-2 top-2 ${stale ? 'bg-pend text-black' : 'bg-live text-white'}`}>{stale ? 'SEM QUADROS' : src.kind === 'arquivo' ? 'ARQUIVO' : 'AO VIVO'}</span>
                    <button className="btn-ghost btn-sm absolute right-2 top-2" aria-label="Ampliar" onClick={() => setZoom(src.id)}><Maximize2 size={12} /></button>
                  </div>
                  <div className="space-y-2 p-3 text-xs">
                    <div className="flex gap-2">
                      <input aria-label="Nome da câmera" className="input" value={src.name} onChange={(e) => s.rename(src.id, e.target.value, src.role)} />
                      <select aria-label="Função" className="input w-36" value={src.role} onChange={(e) => s.rename(src.id, src.name, e.target.value)}>{ROLES.map((x) => <option key={x}>{x}</option>)}</select>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-muted">
                      <span>ID: <span className="font-mono">{src.id.slice(0, 10)}</span></span>
                      <span>Tipo: {src.kind}</span>
                      {r ? <>
                        <span>Resolução: {r.w ? `${r.w}×${r.h}` : 'Informação indisponível'}</span>
                        <span>FPS: {r.fps ?? 'Informação indisponível'}</span>
                        <span><Wifi size={10} className="inline" /> RTT: {r.rtt != null ? `${r.rtt.toFixed(0)} ms` : 'indisponível'}</span>
                        <span>Perda: {r.lossPct != null ? `${r.lossPct.toFixed(1)}%` : 'indisponível'}</span>
                        <span>Sincronização: {syncLevel(r.jitterMs)}</span>
                        <span>Último quadro: {r.lastFrameAt ? new Date(r.lastFrameAt).toLocaleTimeString() : '—'}</span>
                        {r.hidden && <span className="col-span-2 text-pend">O celular está com o navegador em segundo plano.</span>}
                      </> : <span className="col-span-2">Métricas de rede não se aplicam a fontes locais.</span>}
                      <span className="col-span-2">Calibração: {calibrationQuality(cal?.H, cal?.imagePts.length ?? 0, cal?.reprojErrorM)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => s.toggle(src.id)}>{src.active ? 'Excluir da análise' : 'Incluir na análise'}</button>
                      <Link className="btn-ghost btn-sm" to={`/partida/${m.id}/calibrar?cam=${src.id}`}>Calibração</Link>
                      {r && <button className="btn-ghost btn-sm" onClick={() => s.host!.approve(src.id)}>Reconectar</button>}
                      <button className="btn-ghost btn-sm text-live" onClick={() => s.remove(src.id)}><Trash2 size={12} />Desconectar</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {remotes.filter((c) => c.state === 'desconectada' || c.state === 'conectando').map((c) => <Notice key={c.camId} kind="warn">{c.name}: {c.state === 'conectando' ? 'negociando conexão…' : 'desconectada. A análise continua com as demais câmeras; o celular pode reconectar pelo mesmo link.'}</Notice>)}
        </div>
      </div>
      {zoom && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(null)} role="dialog" aria-label="Câmera ampliada">
        {all.find((x) => x.id === zoom) && <VideoSource src={all.find((x) => x.id === zoom)!} className="max-h-full max-w-full" />}
      </div>}
    </div>
  )
}
