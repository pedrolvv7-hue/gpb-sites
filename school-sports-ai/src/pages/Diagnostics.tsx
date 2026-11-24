import { useMemo, useState } from 'react'
import { detectCapabilities, recommendedStreams } from '../lib/capabilities'
import { loadCocoSsd } from '../vision/detector'
import { Card, Notice, Spinner } from '../components/ui'
import { useSession } from '../multicamera/session'

export default function Diagnostics() {
  const caps = useMemo(() => detectCapabilities(), [])
  const sess = useSession()
  const [bench, setBench] = useState<{ ms: number; backend: string } | null>(null)
  const [busy, setBusy] = useState(false), [err, setErr] = useState('')
  async function run() {
    setBusy(true); setErr('')
    try {
      const d = await loadCocoSsd()
      const c = document.createElement('canvas'); c.width = 640; c.height = 360
      const g = c.getContext('2d')!; g.fillStyle = '#333'; g.fillRect(0, 0, 640, 360)
      await d.detect(c, 0.5)
      const t0 = performance.now(); for (let i = 0; i < 5; i++) await d.detect(c, 0.5)
      setBench({ ms: (performance.now() - t0) / 5, backend: d.backend })
    } catch (e) { setErr(e instanceof Error ? e.message : 'Falha') } finally { setBusy(false) }
  }
  const recs: string[] = []
  if (!caps.secure) recs.push('Use HTTPS: navegadores bloqueiam câmera fora de conexão segura.')
  if (!caps.webgl && !caps.webgpu) recs.push('Sem aceleração gráfica: a IA rodará na CPU, muito mais lenta. Use um computador mais potente ou o perfil Leve.')
  if (bench && bench.ms > 150) recs.push('Inferência lenta: reduza a frequência de inferência, use o perfil Leve ou processe menos câmeras ao mesmo tempo.')
  if (!caps.recorderMime) recs.push('Gravação de replay indisponível neste navegador.')
  const remotes = sess.host ? [...sess.host.cams.values()] : []
  for (const r of remotes) { if ((r.lossPct ?? 0) > 5) recs.push(`${r.name}: perda de pacotes alta. Aproxime-se do roteador ou reduza a qualidade.`); if ((r.rtt ?? 0) > 300) recs.push(`${r.name}: latência alta. Pode ser necessário um servidor TURN mais próximo.`) }
  const row = (k: string, v: string | number | boolean | null) => <div className="flex justify-between border-b border-line/50 py-1 text-sm"><span className="text-muted">{k}</span><span>{v === null ? 'Informação indisponível' : typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : v}</span></div>
  return (
    <div className="space-y-4">
      <h1 className="h1">Diagnóstico de desempenho</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Dispositivo e navegador">
          {row('Câmera (getUserMedia)', caps.camera)}{row('HTTPS', caps.secure)}{row('WebRTC', caps.webrtc)}{row('WebGL', caps.webgl)}{row('WebGPU', caps.webgpu)}{row('WebAssembly', caps.wasm)}{row('Web Workers', caps.workers)}{row('OffscreenCanvas', caps.offscreen)}{row('MediaRecorder', caps.recorderMime ?? false)}{row('WebCodecs', caps.webcodecs)}{row('Screen Wake Lock', caps.wakeLock)}{row('Núcleos lógicos', caps.cores)}{row('Memória (aprox.)', caps.memoryGb ? `${caps.memoryGb} GB` : null)}{row('Câmeras analisadas recomendadas', recommendedStreams(caps))}
          <p className="mt-2 text-xs text-muted">Uso de CPU/GPU e temperatura não são acessíveis pelo navegador e por isso não são exibidos.</p>
        </Card>
        <Card title="Teste do modelo de IA">
          <button className="btn-primary" onClick={run} disabled={busy}>Medir tempo de inferência</button>
          {busy && <div className="mt-2"><Spinner label="Carregando modelo e medindo…" /></div>}
          {err && <div className="mt-2"><Notice kind="error">{err}</Notice></div>}
          {bench && <div className="mt-3">{row('Backend', bench.backend)}{row('Tempo médio por quadro', `${bench.ms.toFixed(0)} ms`)}{row('Inferências por segundo possíveis (1 câmera)', (1000 / bench.ms).toFixed(1))}</div>}
          <h3 className="mb-1 mt-4 text-sm font-semibold">Conexões</h3>
          {!remotes.length ? <p className="text-sm text-muted">Nenhuma câmera remota nesta sessão.</p> : remotes.map((r) => <div key={r.camId} className="text-xs">{r.name}: {r.state} · {r.fps ?? '?'} fps · RTT {r.rtt?.toFixed(0) ?? '?'} ms · perda {r.lossPct?.toFixed(1) ?? '?'}% · jitter de relógio {r.jitterMs?.toFixed(0) ?? '?'} ms</div>)}
        </Card>
      </div>
      <Card title="Recomendações">{recs.length ? <ul className="list-inside list-disc space-y-1 text-sm">{recs.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="text-sm text-muted">Nenhum problema identificado {bench ? '' : '(rode o teste do modelo para uma avaliação completa)'}.</p>}
        <p className="mt-2 text-xs text-muted">Dicas gerais: boa iluminação, câmera fixa e elevada, uniformes de cores contrastantes e recalibrar se a câmera for movida.</p>
      </Card>
    </div>
  )
}
