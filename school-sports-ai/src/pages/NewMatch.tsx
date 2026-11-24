import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import type { Match, MatchKind, Sport, TeamSide } from '../lib/types'
import { newMatch } from '../store/matchFactory'
import { useStore } from '../store/store'
import { ENGINES, SPORT_INFO } from '../sports'
import { Card, Field, Notice } from '../components/ui'
import { uniformsTooSimilar } from '../vision/color'
import { detectCapabilities, recommendedStreams } from '../lib/capabilities'

const STEPS = ['Esporte', 'Partida', 'Equipes', 'Câmeras', 'Resumo']
const info = z.object({ name: z.string().trim().min(2, 'Informe um nome (mín. 2 caracteres)').max(80), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida') })

const CAM_FEATURES: Record<Sport, string[]> = {
  futsal: ['1: jogadores, bola, equipes, mapa tático, posse e passes estimados', '2: + visão de um gol ou lateral oposta', '3: + câmera em cada gol (melhor para linha do gol)', '4+: ângulos extras e replays adicionais'],
  basketball: ['1: jogadores, bola, equipes, mapa tático', '2: + visão de uma cesta', '3: + câmera em cada cesta (passagem pelo aro)', '4+: lateral oposta, rebotes e replays'],
  volleyball: ['1: lateral na rede (rallies e travessias)', '2: + fundo ou lateral oposta', '3: + câmera atrás de cada fundo (bolas na linha)', '4+: contatos, bloqueios e replays'],
}

export default function NewMatch() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const save = useStore((s) => s.saveMatch)
  const initial = (sp.get('esporte') as Sport) || 'futsal'
  const [step, setStep] = useState(sp.get('esporte') ? 1 : 0)
  const [m, setM] = useState<Match>(() => newMatch(ENGINES[initial] ? initial : 'futsal'))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const caps = useMemo(() => detectCapabilities(), [])
  const maxCams = recommendedStreams(caps)
  const up = (p: Partial<Match>) => setM((x) => ({ ...x, ...p }))
  const upTeam = (t: TeamSide, p: Partial<Match['teams']['A']>) => setM((x) => ({ ...x, teams: { ...x.teams, [t]: { ...x.teams[t], ...p } } }))
  const upRules = (p: Partial<Match['rules']>) => setM((x) => ({ ...x, rules: { ...x.rules, ...p, version: x.rules.version + (x.rules.version === 1 ? 0 : 0) } }))

  function next() {
    if (step === 1) {
      const r = info.safeParse(m)
      if (!r.success) { setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))); return }
    }
    if (step === 2) {
      const e: Record<string, string> = {}
      if (!m.teams.A.name.trim()) e.A = 'Nome obrigatório'
      if (!m.teams.B.name.trim()) e.B = 'Nome obrigatório'
      for (const t of ['A', 'B'] as const) { const nums = m.teams[t].players.map((p) => p.number).filter(Boolean); if (new Set(nums).size !== nums.length) e[t] = 'Números de camisa repetidos' }
      if (Object.keys(e).length) { setErrors(e); return }
    }
    setErrors({}); setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }
  function create() { const final = { ...m, cameraCount: Math.max(1, m.cameraCount) }; save(final); nav(`/partida/${final.id}/cameras`) }
  const similar = uniformsTooSimilar(m.teams.A.primaryColor, m.teams.B.primaryColor)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="h1">Nova partida</h1>
      <ol className="flex gap-1 text-xs" aria-label="Etapas">{STEPS.map((s, i) => <li key={s} className={`flex-1 rounded-full px-2 py-1 text-center ${i === step ? 'bg-blue text-white' : i < step ? 'bg-neon/20 text-neon' : 'bg-card text-muted'}`} aria-current={i === step ? 'step' : undefined}>{i + 1}. {s}</li>)}</ol>

      {step === 0 && <div className="grid gap-3 sm:grid-cols-3">{(Object.keys(SPORT_INFO) as Sport[]).map((s) => (
        <button key={s} onClick={() => { setM(newMatch(s, { name: m.name })); setStep(1) }} className={`card p-5 text-left hover:border-blue ${m.sport === s ? 'border-blue' : ''}`}>
          <div className="text-3xl">{SPORT_INFO[s].emoji}</div><div className="mt-2 font-bold">{SPORT_INFO[s].name}</div><p className="text-xs text-muted">{SPORT_INFO[s].desc}</p>
        </button>))}</div>}

      {step === 1 && <Card title={`Informações · ${SPORT_INFO[m.sport].name}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome da partida" error={errors.name}><input className="input" value={m.name} onChange={(e) => up({ name: e.target.value })} /></Field>
          <Field label="Atividade"><input className="input" value={m.activity ?? ''} onChange={(e) => up({ activity: e.target.value })} /></Field>
          <Field label="Escola"><input className="input" value={m.school ?? ''} onChange={(e) => up({ school: e.target.value })} /></Field>
          <Field label="Turma"><input className="input" value={m.className ?? ''} onChange={(e) => up({ className: e.target.value })} /></Field>
          <Field label="Data" error={errors.date}><input type="date" className="input" value={m.date} onChange={(e) => up({ date: e.target.value })} /></Field>
          <Field label="Tipo"><select className="input" value={m.kind} onChange={(e) => up({ kind: e.target.value as MatchKind })}>
            <option value="amistoso">Amistoso</option><option value="campeonato">Campeonato</option><option value="treinamento">Treinamento</option><option value="aula">Aula de educação física</option><option value="avaliacao">Avaliação prática</option></select></Field>
        </div>
        <h3 className="mb-2 mt-5 font-semibold">Regras ({m.rules.name}, v{m.rules.version})</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {m.sport !== 'volleyball' ? <>
            <Field label="Períodos"><input type="number" min={1} max={8} className="input" value={m.rules.periods} onChange={(e) => upRules({ periods: +e.target.value || 1 })} /></Field>
            <Field label="Minutos por período"><input type="number" min={1} max={60} className="input" value={m.rules.periodMinutes} onChange={(e) => upRules({ periodMinutes: +e.target.value || 1 })} /></Field>
            <Field label="Intervalo (min)"><input type="number" min={0} max={30} className="input" value={m.rules.breakMinutes} onChange={(e) => upRules({ breakMinutes: +e.target.value })} /></Field>
          </> : <>
            <Field label="Sets (melhor de)"><select className="input" value={m.rules.sets} onChange={(e) => upRules({ sets: +e.target.value })}><option value={1}>1</option><option value={3}>3</option><option value={5}>5</option></select></Field>
            <Field label="Pontos por set"><input type="number" min={5} max={40} className="input" value={m.rules.pointsPerSet} onChange={(e) => upRules({ pointsPerSet: +e.target.value || 25 })} /></Field>
            <Field label="Set decisivo"><input type="number" min={5} max={30} className="input" value={m.rules.decidingSetPoints} onChange={(e) => upRules({ decidingSetPoints: +e.target.value || 15 })} /></Field>
            <Field label="Diferença mínima"><input type="number" min={1} max={5} className="input" value={m.rules.minLead} onChange={(e) => upRules({ minLead: +e.target.value || 2 })} /></Field>
          </>}
          <Field label="Jogadores em quadra"><input type="number" min={1} max={12} className="input" value={m.rules.playersOnCourt} onChange={(e) => upRules({ playersOnCourt: +e.target.value || 1 })} /></Field>
          <Field label="Comprimento (m)"><input type="number" step="0.1" min={5} max={60} className="input" value={m.rules.courtLength} onChange={(e) => upRules({ courtLength: +e.target.value || m.rules.courtLength })} /></Field>
          <Field label="Largura (m)"><input type="number" step="0.1" min={3} max={40} className="input" value={m.rules.courtWidth} onChange={(e) => upRules({ courtWidth: +e.target.value || m.rules.courtWidth })} /></Field>
          {m.sport === 'futsal' && <Field label="Faltas acumuladas (limite)"><input type="number" min={1} className="input" value={m.rules.teamFoulLimit} onChange={(e) => upRules({ teamFoulLimit: +e.target.value })} /></Field>}
          {m.sport === 'basketball' && <Field label="Limite de faltas pessoais"><input type="number" min={1} className="input" value={m.rules.personalFoulLimit} onChange={(e) => upRules({ personalFoulLimit: +e.target.value })} /></Field>}
          <Field label="Prorrogação"><select className="input" value={m.rules.overtime ? '1' : '0'} onChange={(e) => upRules({ overtime: e.target.value === '1' })}><option value="0">Não</option><option value="1">Sim</option></select></Field>
        </div>
        <Field label="Regras personalizadas (texto livre)"><textarea className="input mt-1" rows={2} value={m.rules.custom ?? ''} onChange={(e) => upRules({ custom: e.target.value })} /></Field>
      </Card>}

      {step === 2 && <>
        {similar && <Notice kind="warn">As cores principais das equipes são muito parecidas. A diferenciação automática ficará pouco confiável: use coletes de cores contrastantes ou classifique jogadores manualmente.</Notice>}
        {(['A', 'B'] as const).map((t) => (
          <Card key={t} title={`Equipe ${t}`}>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Nome" error={errors[t]}><input className="input" value={m.teams[t].name} onChange={(e) => upTeam(t, { name: e.target.value })} /></Field>
              <Field label="Cor do uniforme"><input type="color" className="input h-10 p-1" value={m.teams[t].primaryColor} onChange={(e) => upTeam(t, { primaryColor: e.target.value })} /></Field>
              <Field label="Cor secundária"><input type="color" className="input h-10 p-1" value={m.teams[t].secondaryColor ?? '#000000'} onChange={(e) => upTeam(t, { secondaryColor: e.target.value })} /></Field>
              {m.sport !== 'basketball' && <Field label={m.sport === 'futsal' ? 'Cor do goleiro' : 'Cor do líbero'}><input type="color" className="input h-10 p-1" value={m.teams[t].keeperColor ?? '#000000'} onChange={(e) => upTeam(t, { keeperColor: e.target.value })} /></Field>}
            </div>
            <p className="mt-2 text-xs text-muted">Dica: a cor também pode ser capturada clicando sobre a camisa de um jogador na tela de teste de reconhecimento.</p>
            <h3 className="mb-1 mt-3 text-sm font-semibold">Jogadores (opcional, sem nomes completos)</h3>
            {m.teams[t].players.map((p, i) => (
              <div key={i} className="mb-1 flex gap-2">
                <input aria-label="Número" className="input w-20" placeholder="Nº" value={p.number} maxLength={3} onChange={(e) => upTeam(t, { players: m.teams[t].players.map((x, j) => j === i ? { ...x, number: e.target.value.replace(/\D/g, '') } : x) })} />
                <input aria-label="Apelido" className="input" placeholder="Apelido (opcional)" value={p.nickname ?? ''} maxLength={20} onChange={(e) => upTeam(t, { players: m.teams[t].players.map((x, j) => j === i ? { ...x, nickname: e.target.value } : x) })} />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={p.starter} onChange={(e) => upTeam(t, { players: m.teams[t].players.map((x, j) => j === i ? { ...x, starter: e.target.checked } : x) })} />Titular</label>
                <button className="btn-ghost btn-sm" aria-label="Remover" onClick={() => upTeam(t, { players: m.teams[t].players.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="btn-ghost btn-sm" onClick={() => upTeam(t, { players: [...m.teams[t].players, { number: '', starter: m.teams[t].players.length < m.rules.playersOnCourt }] })}><Plus size={14} />Adicionar jogador</button>
          </Card>
        ))}
      </>}

      {step === 3 && <Card title="Câmeras">
        <div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5, 6].map((n) => <button key={n} onClick={() => up({ cameraCount: n })} className={`btn-sm rounded-lg border px-4 ${m.cameraCount === n ? 'border-blue bg-blue/20' : 'border-line'}`}>{n}</button>)}
          <input aria-label="Quantidade personalizada" type="number" min={1} max={12} className="input w-24" value={m.cameraCount} onChange={(e) => up({ cameraCount: Math.max(1, Math.min(12, +e.target.value || 1)) })} /></div>
        {m.cameraCount > maxCams && <div className="mt-3"><Notice kind="warn">Este computador deve analisar bem até {maxCams} câmera(s) simultâneas. As demais poderão ficar como ângulos de replay, ou a frequência de inferência será reduzida.</Notice></div>}
        <ul className="mt-3 space-y-1 text-sm text-muted">{CAM_FEATURES[m.sport].map((f) => <li key={f}>• {f}</li>)}</ul>
        <Link to={`/posicionamento/${m.sport}`} target="_blank" className="mt-2 inline-block text-sm text-blue">Ver guia de posicionamento ↗</Link>
        <h3 className="mb-1 mt-4 font-semibold">Modo de pontuação</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={`card cursor-pointer p-3 ${m.scoringMode === 'assistido' ? 'border-blue' : ''}`}><input type="radio" className="mr-2" checked={m.scoringMode === 'assistido'} onChange={() => up({ scoringMode: 'assistido' })} /><b>Assistido (recomendado)</b><p className="text-xs text-muted">A IA sugere; o professor confirma tudo que altera o placar.</p></label>
          <label className={`card cursor-pointer p-3 ${m.scoringMode !== 'assistido' ? 'border-blue' : ''}`}><input type="radio" className="mr-2" checked={m.scoringMode !== 'assistido'} onChange={() => up({ scoringMode: 'automatico_experimental' })} /><b>Automático experimental</b><p className="text-xs text-muted">Atualiza o placar só com confiança alta E concordância de 2+ câmeras. Não é arbitragem oficial.</p></label>
        </div>
      </Card>}

      {step === 4 && <Card title="Resumo">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">Esporte</dt><dd>{SPORT_INFO[m.sport].name}</dd>
          <dt className="text-muted">Partida</dt><dd>{m.name} ({m.date})</dd>
          <dt className="text-muted">Equipes</dt><dd>{m.teams.A.name} × {m.teams.B.name}</dd>
          <dt className="text-muted">Regras</dt><dd>{m.sport === 'volleyball' ? `Melhor de ${m.rules.sets}, ${m.rules.pointsPerSet} pts` : `${m.rules.periods} × ${m.rules.periodMinutes} min`}</dd>
          <dt className="text-muted">Câmeras</dt><dd>{m.cameraCount}</dd>
          <dt className="text-muted">Pontuação</dt><dd>{m.scoringMode === 'assistido' ? 'Assistida' : 'Automática experimental'}</dd>
        </dl>
        <p className="mt-3 text-sm text-muted">Próximos passos: conectar câmeras → calibrar → testar reconhecimento → iniciar análise ao vivo.</p>
      </Card>}

      <div className="flex justify-between">
        <button className="btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Voltar</button>
        {step < STEPS.length - 1 ? step > 0 && <button className="btn-primary" onClick={next}>Continuar</button> : <button className="btn-primary" onClick={create}>Criar partida e conectar câmeras</button>}
      </div>
    </div>
  )
}
