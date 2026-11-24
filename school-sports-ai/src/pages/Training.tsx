// Central de treinamentos e editor de atividades. Um treino é uma sessão com contadores
// (manuais ou vindos da análise) e métricas de aproveitamento reais, sem notas automáticas.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Plus, Trash2, Play } from 'lucide-react'
import { Card, Empty, Field, Notice, Tabs, ExperimentalTag } from '../components/ui'
import { newMatch } from '../store/matchFactory'
import { useStore } from '../store/store'
import type { Sport } from '../lib/types'
import { pct, uid } from '../lib/util'

const PRESETS: Record<Sport, { name: string; metrics: string[]; desc: string }[]> = {
  futsal: [
    { name: 'Treino de chutes', metrics: ['tentativa', 'no alvo', 'para fora', 'gol'], desc: 'Tentativas, chutes no alvo, para fora e gols.' },
    { name: 'Treino de passes', metrics: ['passe tentado', 'passe completo'], desc: 'Quantidade e precisão dos passes.' },
    { name: 'Condução em percurso', metrics: ['concluído', 'perda de controle'], desc: 'Tempo e conclusão do percurso.' },
    { name: 'Treino de goleiros', metrics: ['finalização recebida', 'defesa', 'gol sofrido'], desc: 'Defesas e gols sofridos.' },
  ],
  basketball: [
    { name: 'Arremessos', metrics: ['tentativa', 'cesta'], desc: 'Aproveitamento por região.' },
    { name: 'Lances livres', metrics: ['tentativa', 'cesta'], desc: 'Conversões e sequências.' },
    { name: 'Dribles', metrics: ['concluído', 'perda de controle'], desc: 'Percurso e continuidade.' },
    { name: 'Passes', metrics: ['passe tentado', 'recepção'], desc: 'Precisão e tempo de execução.' },
  ],
  volleyball: [
    { name: 'Saques', metrics: ['tentativa', 'válido', 'fora'], desc: 'Saques válidos e fora.' },
    { name: 'Manchetes', metrics: ['execução', 'bola no alvo'], desc: 'Execuções e direção.' },
    { name: 'Levantamentos', metrics: ['execução', 'bola no alvo'], desc: 'Precisão em relação ao alvo.' },
    { name: 'Ataques', metrics: ['tentativa', 'convertido'], desc: 'Aproximação, salto e resultado.' },
    { name: 'Bloqueios', metrics: ['salto', 'com contato'], desc: 'Saltos e contatos.' },
  ],
}

interface Activity { id: string; name: string; sport: Sport; goal: string; description: string; minutes: number; participants: number; metrics: string[]; rules: string; done: string }
interface Session { id: string; activityName: string; sport: Sport; date: string; counts: Record<string, number>; startedAt: number; endedAt?: number }
const AKEY = 'ssai-atividades', SKEY = 'ssai-treinos'
const load = <T,>(k: string): T[] => { try { return JSON.parse(localStorage.getItem(k) ?? '[]') } catch { return [] } }
const store = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* cheio */ } }
const schema = z.object({ name: z.string().trim().min(2, 'Nome obrigatório'), goal: z.string().trim().min(3, 'Descreva o objetivo pedagógico'), minutes: z.number().min(1).max(240), participants: z.number().min(1).max(60), metrics: z.array(z.string().min(1)).min(1, 'Ao menos uma métrica') })

export default function Training() {
  const [sport, setSport] = useState<Sport>('futsal')
  const [tab, setTab] = useState<'treinos' | 'editor' | 'historico'>('treinos')
  const [acts, setActs] = useState<Activity[]>(() => load(AKEY))
  const [sessions, setSessions] = useState<Session[]>(() => load(SKEY))
  const [active, setActive] = useState<Session | null>(null)
  const [draft, setDraft] = useState<Activity>({ id: '', name: '', sport, goal: '', description: '', minutes: 20, participants: 10, metrics: ['tentativa', 'acerto'], rules: '', done: '' })
  const [err, setErr] = useState<Record<string, string>>({})
  const nav = useNavigate()
  const save = useStore((s) => s.saveMatch)

  const start = (name: string, metrics: string[]) => setActive({ id: uid(), activityName: name, sport, date: new Date().toISOString().slice(0, 10), counts: Object.fromEntries(metrics.map((x) => [x, 0])), startedAt: Date.now() })
  const finish = () => { if (!active) return; const s = [...sessions, { ...active, endedAt: Date.now() }]; setSessions(s); store(SKEY, s); setActive(null); setTab('historico') }
  const withVideo = (name: string) => { const m = newMatch(sport, { name, kind: 'treinamento', activity: name }); save(m); nav(`/partida/${m.id}/cameras`) }
  const all = [...PRESETS[sport].map((p) => ({ ...p, custom: false as const })), ...acts.filter((a) => a.sport === sport).map((a) => ({ name: a.name, metrics: a.metrics, desc: a.goal, custom: true as const, id: a.id }))]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2"><h1 className="h1">Central de treinamentos</h1><Tabs value={sport} onChange={(s) => { setSport(s); setDraft({ ...draft, sport: s }) }} items={[{ id: 'futsal', label: 'Futsal' }, { id: 'basketball', label: 'Basquete' }, { id: 'volleyball', label: 'Vôlei' }]} /></div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'treinos', label: 'Treinos' }, { id: 'editor', label: 'Editor de atividades' }, { id: 'historico', label: 'Sessões anteriores' }]} />
      {active && <Card title={`Em andamento: ${active.activityName}`}>
        <p className="mb-2 text-xs text-muted">Toque para contar. Os contadores são o registro oficial do treino; a análise por vídeo (se usada) gera sugestões revisáveis.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(active.counts).map(([k, v]) => <div key={k} className="card p-3 text-center"><div className="text-xs text-muted">{k}</div><div className="font-mono text-3xl font-bold">{v}</div><div className="mt-1 flex justify-center gap-1"><button className="btn-ghost btn-sm" aria-label={`menos ${k}`} onClick={() => setActive({ ...active, counts: { ...active.counts, [k]: Math.max(0, v - 1) } })}>−</button><button className="btn-primary btn-sm" aria-label={`mais ${k}`} onClick={() => setActive({ ...active, counts: { ...active.counts, [k]: v + 1 } })}>+</button></div></div>)}</div>
        {(() => { const keys = Object.keys(active.counts); const base = keys[0]; return keys.slice(1).map((k) => <p key={k} className="mt-2 text-sm">{k} / {base}: <b>{pct(active.counts[k], active.counts[base])}</b></p>) })()}
        <button className="btn-primary mt-3" onClick={finish}>Encerrar e salvar treino</button>
      </Card>}
      {tab === 'treinos' && !active && <div className="grid gap-3 md:grid-cols-2">{all.map((p) => (
        <Card key={p.name}>
          <h3 className="font-semibold">{p.name} {p.custom && <span className="chip bg-blue/20 text-blue">personalizada</span>}</h3>
          <p className="text-sm text-muted">{p.desc}</p>
          <p className="mt-1 text-xs text-muted">Métricas: {p.metrics.join(', ')}</p>
          <div className="mt-3 flex flex-wrap gap-2"><button className="btn-primary btn-sm" onClick={() => start(p.name, p.metrics)}><Play size={14} />Iniciar com contadores</button><button className="btn-ghost btn-sm" onClick={() => withVideo(p.name)}>Com análise de vídeo <ExperimentalTag /></button>
            {p.custom && <button className="btn-ghost btn-sm" aria-label="Excluir atividade" onClick={() => { const n = acts.filter((a) => a.id !== (p as { id: string }).id); setActs(n); store(AKEY, n) }}><Trash2 size={14} /></button>}</div>
        </Card>))}</div>}
      {tab === 'editor' && <Card title="Nova atividade">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" error={err.name}><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Objetivo pedagógico" error={err.goal}><input className="input" value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} /></Field>
          <Field label="Duração (min)"><input type="number" className="input" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: +e.target.value })} /></Field>
          <Field label="Participantes"><input type="number" className="input" value={draft.participants} onChange={(e) => setDraft({ ...draft, participants: +e.target.value })} /></Field>
          <Field label="Descrição"><textarea className="input" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
          <Field label="Regras e critérios de conclusão"><textarea className="input" rows={2} value={draft.rules} onChange={(e) => setDraft({ ...draft, rules: e.target.value })} /></Field>
        </div>
        <span className="label mt-3">Métricas (a primeira é o denominador do aproveitamento)</span>
        {draft.metrics.map((x, i) => <div key={i} className="mb-1 flex gap-1"><input className="input" value={x} onChange={(e) => setDraft({ ...draft, metrics: draft.metrics.map((y, j) => (j === i ? e.target.value : y)) })} aria-label={`Métrica ${i + 1}`} /><button className="btn-ghost btn-sm" onClick={() => setDraft({ ...draft, metrics: draft.metrics.filter((_, j) => j !== i) })} aria-label="Remover"><Trash2 size={12} /></button></div>)}
        {err.metrics && <p className="text-xs text-live">{err.metrics}</p>}
        <button className="btn-ghost btn-sm" onClick={() => setDraft({ ...draft, metrics: [...draft.metrics, ''] })}><Plus size={12} />Métrica</button>
        <Notice kind="info">Regiões virtuais desenhadas na imagem (área-alvo, zona de arremesso) usam a calibração da câmera: após criar a atividade, inicie "com análise de vídeo" e calibre. A detecção automática de acontecimentos nessas regiões é experimental.</Notice>
        <button className="btn-primary mt-3" onClick={() => { const r = schema.safeParse(draft); if (!r.success) { setErr(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))); return } setErr({}); const n = [...acts, { ...draft, id: uid(), sport }]; setActs(n); store(AKEY, n); setTab('treinos') }}>Salvar atividade</button>
      </Card>}
      {tab === 'historico' && (sessions.filter((s) => s.sport === sport).length ? <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted"><th className="p-2">Data</th><th className="p-2">Atividade</th><th className="p-2">Contagens</th><th className="p-2">Duração</th><th></th></tr></thead>
        <tbody>{sessions.filter((s) => s.sport === sport).reverse().map((s) => <tr key={s.id} className="border-t border-line/50"><td className="p-2">{s.date}</td><td className="p-2">{s.activityName}</td><td className="p-2 text-xs">{Object.entries(s.counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}</td><td className="p-2">{s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) + ' min' : '—'}</td><td><button aria-label="Excluir" onClick={() => { const n = sessions.filter((x) => x.id !== s.id); setSessions(n); store(SKEY, n) }}><Trash2 size={12} /></button></td></tr>)}</tbody></table></div> : <Empty title="Nenhum treino registrado para este esporte" />)}
    </div>
  )
}
