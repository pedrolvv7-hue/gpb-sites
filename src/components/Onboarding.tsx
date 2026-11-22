import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useStore } from '../data/store'
import { buildDemo } from '../data/demo'
import { RecordForm } from './EntityManager'

const STEPS = ['Bem-vindo', 'Empresa', 'Unidades', 'Primeiros dados', 'Diagnóstico', 'Alertas', 'Automações', 'Painel', 'Tutoriais', 'Conclusão']

export function Onboarding({ onClose }: { onClose: () => void }) {
  const st = useStore()
  const s = st.settings
  const step = s.onboardingStep
  const go = (n: number) => st.setSettings({ onboardingStep: Math.max(0, Math.min(STEPS.length - 1, n)) })
  const finish = () => { st.setSettings({ onboardingDone: true }); onClose() }
  const counts = Object.entries(st.data).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.length}`)
  const body = [
    <><p>O RestauProfit Pro organiza vendas, custos, estoque, compras, equipe e clientes do seu restaurante.</p><p className="mt-2">Este assistente leva poucos minutos. Você pode fechar a qualquer momento e continuar depois pelo botão "Configuração inicial". Nenhuma função fica bloqueada.</p></>,
    <div className="space-y-2">{(['companyName', 'ownerName', 'ownerEmail'] as const).map((k) => <label key={k} className="block"><span className="label">{{ companyName: 'Nome da empresa', ownerName: 'Seu nome', ownerEmail: 'Seu e-mail' }[k]}</span><input className="input" value={s[k]} onChange={(e) => st.setSettings({ [k]: e.target.value })} /></label>)}</div>,
    <><p className="mb-2 text-sm">Cadastradas: {st.data.units.map((u) => u.name).join(', ') || 'nenhuma'}.</p><RecordForm entity="units" onCancel={() => {}} onSave={(r) => st.add('units', r)} /></>,
    <><p>Envie as planilhas de vendas, produtos, ingredientes e despesas em Importação Inteligente, ou experimente com dados fictícios.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Link className="btn-primary" to="/importacao" onClick={onClose}>Abrir Importação Inteligente</Link>
        {!s.demo && <button className="btn-ghost" onClick={() => (!Object.values(st.data).some((v) => v.length) || confirm('Substituir dados atuais pela demonstração?')) && st.replaceAll(buildDemo() as any, true)}>Usar dados de demonstração</button>}</div></>,
    <><p>Registros existentes:</p><ul className="mt-1 list-disc pl-5 text-sm">{counts.length ? counts.map((c) => <li key={c}>{c}</li>) : <li>Nenhum dado ainda.</li>}</ul>{!st.data.recipes.length && <p className="mt-2 text-sm text-amber-700">Sem fichas técnicas: custos e margens ficarão indisponíveis.</p>}</>,
    <div className="grid grid-cols-2 gap-2">{([['salesDropPct', 'Queda de vendas (%)'], ['minMarginPct', 'Margem mínima (%)'], ['expiryDays', 'Aviso de validade (dias)'], ['staleDays', 'Dados desatualizados (dias)']] as const).map(([k, l]) => <label key={k}><span className="label">{l}</span><input type="number" className="input" value={s.thresholds[k]} onChange={(e) => st.setSettings({ thresholds: { ...s.thresholds, [k]: Number(e.target.value) } })} /></label>)}</div>,
    <><p>Como o AutoPilot deve agir?</p>{(['automatico', 'aprovacao', 'monitoramento'] as const).map((m) => <label key={m} className="mt-2 flex items-center gap-2"><input type="radio" checked={s.autopilotMode === m} onChange={() => st.setSettings({ autopilotMode: m })} />{{ automatico: 'Automático (cálculos internos; compras só como rascunho)', aprovacao: 'Com aprovação (recomendado)', monitoramento: 'Somente monitorar' }[m]}</label>)}</>,
    <p>A Visão Geral mostra os principais indicadores. O sino no topo mostra os alertas. O seletor de unidade filtra todas as abas.</p>,
    <p>Cada aba tem o botão "Aprender a usar esta aba" (tour interativo) e um tutorial completo. A Central de Tutoriais reúne tudo, com guias de importação, finanças e estoque.</p>,
    <p>Tudo pronto. Você pode reabrir este assistente quando quiser enquanto ele não for concluído.</p>,
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 sm:items-center" role="dialog" aria-label="Configuração inicial">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 dark:bg-slate-900">
        <div className="flex items-center justify-between"><div className="text-xs text-slate-500">Etapa {step + 1} de {STEPS.length}</div><button onClick={onClose} aria-label="Fechar assistente"><X size={18} /></button></div>
        <h2 className="mt-1 text-xl font-bold">{STEPS[step]}</h2>
        <div className="mt-2 h-1.5 rounded bg-slate-200 dark:bg-slate-800"><div className="h-1.5 rounded bg-brand-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="mt-4 text-sm">{body[step]}</div>
        <div className="mt-5 flex justify-between">
          <button className="btn-ghost" disabled={!step} onClick={() => go(step - 1)}>Voltar</button>
          <div className="flex gap-2"><button className="btn-ghost" onClick={onClose}>Continuar depois</button>
            {step < STEPS.length - 1 ? <button className="btn-primary" onClick={() => go(step + 1)}>Avançar</button> : <button className="btn-primary" onClick={finish}>Concluir</button>}</div>
        </div>
      </div>
    </div>
  )
}
