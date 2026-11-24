import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Camera, Cpu, QrCode, Activity, Film, School, Trophy, ChevronDown, ShieldCheck } from 'lucide-react'
import { Logo } from '../components/ui'
import { DemoSimView } from '../components/DemoSim'
import { SPORT_INFO } from '../sports'
import type { Sport } from '../lib/types'
import { FAQ } from '../lib/faq'

export default function Landing() {
  const [sport, setSport] = useState<Sport>('futsal')
  const [score, setScore] = useState({ A: 0, B: 0 })
  const [feed, setFeed] = useState<string[]>([])
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Logo /><span className="font-bold">School Sports <span className="text-blue">AI</span></span>
          <nav className="ml-auto flex items-center gap-2 text-sm">
            <a href="#como" className="hidden px-2 text-muted hover:text-fg sm:block">Como funciona</a>
            <a href="#faq" className="hidden px-2 text-muted hover:text-fg sm:block">Perguntas</a>
            <Link to="/entrar" className="btn-ghost btn-sm">Entrar</Link>
            <Link to="/painel" className="btn-primary btn-sm">Abrir painel</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-2 lg:py-20">
        <div className="flex flex-col justify-center">
          <span className="chip mb-4 w-fit bg-live/15 text-live"><span className="live-dot h-2 w-2 rounded-full bg-live" />Análise no navegador</span>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Inteligência esportiva<br /><span className="text-blue">em tempo real.</span></h1>
          <p className="mt-4 max-w-lg text-lg text-muted">Tecnologia profissional para o esporte escolar. Celulares viram câmeras, o computador detecta jogadores e bola, e o professor confirma cada ponto.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/nova" className="btn-primary">Iniciar análise</Link>
            <Link to="/demo" className="btn-ghost">Experimentar demonstração</Link>
            <a href="#como" className="btn-ghost">Como funciona</a>
          </div>
          <p className="mt-4 text-xs text-muted">Sem aplicativo, sem sensores, sem API paga. Os detectores rodam no seu dispositivo.</p>
        </div>
        <div className="card overflow-hidden p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex gap-1">{(Object.keys(SPORT_INFO) as Sport[]).map((s) => <button key={s} onClick={() => { setSport(s); setScore({ A: 0, B: 0 }); setFeed([]) }} className={`btn-sm rounded-md px-2 ${sport === s ? 'bg-blue text-white' : 'text-muted'}`}>{SPORT_INFO[s].emoji} {SPORT_INFO[s].name}</button>)}</div>
            <div className="whitespace-nowrap font-mono text-lg font-bold"><span className="text-[#ef4444]">A {score.A}</span> <span className="text-muted">×</span> <span className="text-[#3b82f6]">{score.B} B</span></div>
          </div>
          <DemoSimView sport={sport} onEvent={(e) => {
            if (e.kind === 'gol' || e.kind === 'cesta' || e.kind === 'ponto') setScore((s) => ({ ...s, [e.team]: s[e.team] + (e.kind === 'cesta' ? 2 : 1) }))
            setFeed((f) => [`${e.kind} · ${e.from}${e.to ? ' → ' + e.to : ''}`, ...f].slice(0, 3))
          }} />
          <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted" aria-live="polite">{feed.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      </section>

      <section id="como" className="border-y border-line bg-bg2 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="h1 mb-8">Como funciona</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [QrCode, 'Conecte celulares', 'O professor cria a partida e mostra um QR Code. Cada celular abre o link, permite a câmera e é aprovado.'],
              [Camera, 'Calibre a quadra', 'Marque os 4 cantos, os gols, as cestas ou a rede. A homografia converte pés dos jogadores em metros na quadra.'],
              [Cpu, 'IA no dispositivo', 'COCO-SSD (TensorFlow.js) detecta pessoas e bola; um rastreador mantém IDs; a cor do uniforme define a equipe.'],
              [Activity, 'Você confirma', 'Gols, cestas e pontos chegam como candidatos com evidências e confiança. No modo assistido, só entram no placar após sua confirmação.'],
            ].map(([I, t, d]) => { const Icon = I as typeof QrCode; return <div key={t as string} className="card p-5"><Icon className="mb-3 text-blue" /><h3 className="font-semibold">{t as string}</h3><p className="mt-1 text-sm text-muted">{d as string}</p></div> })}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [Activity, 'Estatísticas ao vivo', 'Placar, linha do tempo, mapa tático e de calor atualizam sem recarregar. Valores desconhecidos aparecem como "Informação indisponível".'],
              [Film, 'Revise lances', 'Buffer de replay grava os últimos segundos. O School VAR permite câmera lenta, quadro a quadro e zoom.'],
              [School, 'Nas aulas', 'Treinos de chute, arremesso e saque, editor de atividades e simulador tático para explicar jogadas.'],
              [Trophy, 'Campeonatos', 'Link privado de placar para espectadores, modo telão e relatório pós-partida em PDF, CSV e JSON.'],
            ].map(([I, t, d]) => { const Icon = I as typeof QrCode; return <div key={t as string} className="card p-5"><Icon className="mb-3 text-neon" /><h3 className="font-semibold">{t as string}</h3><p className="mt-1 text-sm text-muted">{d as string}</p></div> })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="h1 mb-8">Três motores esportivos</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {(Object.keys(SPORT_INFO) as Sport[]).map((s) => (
            <div key={s} className="card p-5">
              <div className="text-3xl">{SPORT_INFO[s].emoji}</div>
              <h3 className="mt-2 text-xl font-bold">{SPORT_INFO[s].name}</h3>
              <p className="mt-1 text-sm text-muted">{SPORT_INFO[s].desc}</p>
              <ul className="mt-3 flex flex-wrap gap-1">{SPORT_INFO[s].stats.map((x) => <li key={x} className="chip bg-bg2 text-muted">{x}</li>)}</ul>
              <p className="mt-3 text-xs text-muted">Câmeras: {SPORT_INFO[s].cams}</p>
              <div className="mt-4 flex gap-2"><Link to={`/nova?esporte=${s}`} className="btn-primary btn-sm">Nova partida</Link><Link to={`/posicionamento/${s}`} className="btn-ghost btn-sm">Posicionar câmeras</Link></div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-line p-4 text-sm text-muted"><ShieldCheck className="shrink-0 text-neon" size={18} />Sem reconhecimento facial. Jogadores recebem identificadores temporários (A01, B02). Vídeos ficam no dispositivo, gravação desligada por padrão.</div>
      </section>

      <section id="faq" className="border-t border-line bg-bg2 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="h1 mb-6">Perguntas frequentes</h2>
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-line py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">{q}<ChevronDown size={16} className="transition group-open:rotate-180" /></summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
      <footer className="border-t border-line py-8 text-center text-xs text-muted">School Sports AI · Não é tecnologia oficial de arbitragem. A decisão final é sempre do professor ou árbitro.</footer>
    </div>
  )
}
