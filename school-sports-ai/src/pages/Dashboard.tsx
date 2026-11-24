import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { PlusCircle, Smartphone, FileVideo, Tv, GraduationCap, Cpu, CheckCircle2, XCircle } from 'lucide-react'
import { useStore } from '../store/store'
import { Card, Empty, Notice } from '../components/ui'
import { SPORT_INFO, ENGINES } from '../sports'
import { detectCapabilities, recommendedStreams } from '../lib/capabilities'
import { scoreOf } from '../events/eventLog'
import { backendEnabled } from '../lib/supabase'
import type { Sport } from '../lib/types'

export default function Dashboard() {
  const matches = useStore((s) => s.matches)
  const nav = useNavigate()
  const caps = useMemo(() => detectCapabilities(), [])
  const list = Object.values(matches).sort((a, b) => b.createdAt - a.createdAt)
  const live = list.filter((m) => m.state === 'ao_vivo' || m.state === 'pausada')
  const [modelCached, setModelCached] = useState<boolean | null>(null)
  useEffect(() => { indexedDB?.databases?.().then((d) => setModelCached(d.some((x) => x.name?.includes('tensorflowjs')))).catch(() => setModelCached(null)) }, [])
  const Ok = ({ v }: { v: boolean }) => v ? <CheckCircle2 size={14} className="text-neon" aria-label="disponível" /> : <XCircle size={14} className="text-live" aria-label="indisponível" />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="h1">Painel</h1><p className="text-sm text-muted">Comece uma atividade em poucos passos.</p></div>
        <div className="flex flex-wrap gap-2">
          <Link to="/nova" className="btn-primary"><PlusCircle size={18} />Nova partida</Link>
          <Link to="/camera" className="btn-ghost"><Smartphone size={18} />Entrar como câmera</Link>
          <button className="btn-ghost" onClick={() => nav('/nova?fonte=video')}><FileVideo size={18} />Analisar vídeo</button>
          <Link to="/assistir" className="btn-ghost"><Tv size={18} />Entrar em transmissão</Link>
        </div>
      </div>
      {!backendEnabled && <Notice kind="info">Modo local: dados salvos apenas neste navegador. Conectar celulares como câmeras e transmissões exigem o Supabase configurado (veja o README).</Notice>}

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(SPORT_INFO) as Sport[]).map((s) => (
          <Card key={s}>
            <div className="flex items-center gap-2 text-2xl">{SPORT_INFO[s].emoji}<span className="text-lg font-bold">{SPORT_INFO[s].name}</span></div>
            <p className="mt-1 text-sm text-muted">{SPORT_INFO[s].desc}</p>
            <p className="mt-2 text-xs text-muted">Recomendado: {SPORT_INFO[s].cams}</p>
            <p className="mt-1 text-xs text-muted">Estatísticas: {ENGINES[s].eventTypes.map((e) => e.label).join(', ')}…</p>
            <Link to={`/nova?esporte=${s}`} className="btn-primary btn-sm mt-3">Iniciar sessão</Link>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Partidas em andamento" className="lg:col-span-2">
          {live.length ? live.map((m) => { const s = scoreOf(m.events); return (
            <Link key={m.id} to={`/partida/${m.id}/ao-vivo`} className="mb-2 flex items-center justify-between rounded-lg border border-line p-3 hover:border-blue">
              <span><span className="chip mr-2 bg-live/20 text-live">{m.state === 'ao_vivo' ? 'AO VIVO' : 'PAUSADA'}</span>{m.name}</span><span className="font-mono">{m.teams.A.name} {s.A} × {s.B} {m.teams.B.name}</span>
            </Link>) }) : <Empty title="Nenhuma partida em andamento"><Link to="/nova" className="text-blue">Criar partida</Link></Empty>}
          <h3 className="mb-2 mt-4 text-sm font-semibold text-muted">Recentes</h3>
          {list.slice(0, 5).map((m) => <Link key={m.id} to={m.state === 'encerrada' ? `/partida/${m.id}/relatorio` : `/partida/${m.id}/cameras`} className="flex justify-between border-b border-line py-2 text-sm"><span>{SPORT_INFO[m.sport].emoji} {m.name}</span><span className="text-muted">{m.date} · {m.state}</span></Link>)}
          {!list.length && <p className="text-sm text-muted">Sem histórico ainda.</p>}
        </Card>
        <Card title="Este dispositivo">
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2"><Ok v={caps.camera} />Acesso à câmera</li>
            <li className="flex items-center gap-2"><Ok v={caps.secure} />Conexão segura (HTTPS)</li>
            <li className="flex items-center gap-2"><Ok v={caps.webgl} />WebGL (aceleração da IA)</li>
            <li className="flex items-center gap-2"><Ok v={caps.webgpu} />WebGPU</li>
            <li className="flex items-center gap-2"><Ok v={caps.webrtc} />WebRTC</li>
            <li className="flex items-center gap-2"><Ok v={!!caps.recorderMime} />Gravação de replay</li>
          </ul>
          <div className="mt-3 rounded-lg bg-bg2 p-3 text-sm">
            <div className="flex items-center gap-2"><Cpu size={16} />Capacidade local: <b>{recommendedStreams(caps)}</b> câmera(s) analisadas em paralelo</div>
            <p className="mt-1 text-xs text-muted">Núcleos: {caps.cores ?? 'Informação indisponível'} · Memória: {caps.memoryGb ? `${caps.memoryGb} GB (aprox.)` : 'Informação indisponível'}</p>
            <p className="mt-1 text-xs text-muted">Modelo de IA: {modelCached === null ? 'carregado sob demanda' : modelCached ? 'em cache neste navegador' : 'será baixado no primeiro uso (~5 MB)'}</p>
          </div>
          <Link to="/tutoriais" className="btn-ghost btn-sm mt-3 w-full"><GraduationCap size={14} />Tutoriais</Link>
        </Card>
      </div>
    </div>
  )
}
