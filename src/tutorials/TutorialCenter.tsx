import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Circle, Search } from 'lucide-react'
import { useStore } from '../data/store'
import { TABS, CATEGORIES } from '../tabs/registry'
import { TUTORIALS } from './content'
import { GUIDES } from './guides'
import { ENTITIES } from '../data/schema'
import { startTour } from '../components/Tour'
import { Notice } from '../components/ui'

/** Verificações de documentação (usadas nos testes e exibidas na central). */
export function docChecks() {
  const missing = TABS.filter((t) => !TUTORIALS[t.id]).map((t) => t.name)
  const orphan = Object.keys(TUTORIALS).filter((k) => !TABS.some((t) => t.id === k))
  const badRoutes = TABS.filter((t) => !t.route.startsWith('/')).map((t) => t.name)
  return { missing, orphan, badRoutes, ok: !missing.length && !orphan.length && !badRoutes.length }
}

export function TutorialCenter() {
  const [q, setQ] = useState('')
  const done = useStore((s) => s.settings.tutorialsDone)
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const match = (s: string) => !q || n(s).includes(n(q))
  const checks = docChecks()
  const tabsDone = TABS.filter((t) => done.includes(t.id)).length
  return (
    <div className="space-y-5">
      {!checks.ok && <Notice tone="error">Documentação incompleta: {[...checks.missing, ...checks.orphan].join(', ')}</Notice>}
      <div className="flex flex-wrap items-center gap-4">
        <label className="relative min-w-[240px] flex-1" data-tour="tut-search"><Search size={14} className="absolute left-2 top-2.5 text-slate-400" /><input className="input pl-7" placeholder="Pesquisar tutoriais (ex.: margem, importar, validade)" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="card py-2" data-tour="tut-progress"><div className="text-xs text-slate-500">Progresso</div><b>{tabsDone} de {TABS.length} tours concluídos</b>
          <div className="mt-1 h-2 w-48 rounded bg-slate-200 dark:bg-slate-800"><div className="h-2 rounded bg-brand-500" style={{ width: `${(tabsDone / TABS.length) * 100}%` }} /></div></div>
      </div>
      <section data-tour="tut-guides">
        <h2 className="mb-2 text-lg font-semibold">Guias completos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GUIDES.filter((g) => match(g.title + g.sections.map((s) => s.h + s.p.join(' ')).join(' '))).map((g) => (
            <Link key={g.id} to={`/tutoriais/guia/${g.id}`} className="card hover:border-brand-400"><b>{g.title}</b><p className="text-xs text-slate-500">{g.audience} · {g.sections.length} seções</p></Link>
          ))}
        </div>
      </section>
      {[...CATEGORIES, 'Módulos adicionais'].map((c) => {
        const tabs = TABS.filter((t) => t.category === c && match(t.name + t.summary + JSON.stringify(TUTORIALS[t.id] || {})))
        if (!tabs.length) return null
        return (
          <section key={c}><h2 className="mb-2 text-lg font-semibold">{c}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tabs.map((t) => (
                <Link key={t.id} to={`/tutoriais/${t.id}`} className="card flex items-start gap-2 py-3 hover:border-brand-400">
                  {done.includes(t.id) ? <CheckCircle2 size={16} className="mt-0.5 text-emerald-500" /> : <Circle size={16} className="mt-0.5 text-slate-300" />}
                  <div><b className="text-sm">{t.num ? `${t.num}. ` : ''}{t.name}</b><p className="text-xs text-slate-500">{t.summary}</p></div>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

const useful = (s?: string) => s && s.trim() !== '-'

export function TutorialPage() {
  const { id } = useParams()
  const tab = TABS.find((t) => t.id === id)
  const tut = id ? TUTORIALS[id] : undefined
  if (!tab || !tut) return <Notice tone="error">Tutorial não encontrado. <Link className="underline" to="/tutorial">Voltar à Central</Link></Notice>
  const entity = tab.uses.find((u) => tab.tour.some((s) => s.target === 'add' || s.target === 'import')) || tab.uses[0]
  const fields = entity ? ENTITIES[entity].fields : []
  const has = (t: string) => tab.tour.some((s) => s.target === t)
  const sections: [string, React.ReactNode][] = [
    ['1. O que é', tab.summary],
    ['2. Para que serve', tut.decisions !== '-' ? tut.decisions : tab.summary],
    ['3. Quem deve utilizar', tut.who],
    ['4. Dados necessários', tut.data],
    ['5. Onde conseguir os dados', tut.where],
    ['6. Como importar', tab.uses.length ? <>Vá em <Link className="underline" to={`/importacao?tipo=${tab.uses[0]}`}>Importação Inteligente</Link> (o tipo "{ENTITIES[tab.uses[0]].label}" já vem selecionado), envie o arquivo, confira o mapeamento e confirme. Veja o <Link className="underline" to="/tutoriais/guia/importacao">guia de importação</Link>.</> : 'Esta aba não recebe importação própria; usa dados das outras abas.'],
    ['7. Como acessar', <>Menu lateral → <b>{tab.category}</b> → <b>{tab.name}</b>, ou endereço <code>{tab.route}</code>, ou pela busca do menu.</>],
    ['8. Significado de cada campo', fields.length ? <ul className="list-disc pl-5">{fields.map((f) => <li key={f.key}><b>{f.label}</b>{f.required ? ' (obrigatório)' : ''}: {f.type === 'money' ? 'valor em reais' : f.type === 'date' ? 'data (DD/MM/AAAA)' : f.type === 'time' ? 'hora (HH:MM)' : f.type === 'bool' ? 'sim ou não' : f.type === 'select' ? `uma das opções: ${f.options!.join(', ')}` : f.type === 'number' ? 'número' : 'texto'}{f.aliases?.length ? `. Na planilha pode se chamar: ${f.aliases.slice(0, 4).join(', ')}` : ''}.</li>)}</ul> : 'Esta aba não tem formulário de cadastro.'],
    ['9. Significado de cada botão', <ul className="list-disc pl-5">{tab.tour.filter((s) => !['title', 'updated'].includes(s.target)).map((s) => <li key={s.target}><b>{s.title}</b>: {s.text}</li>)}</ul>],
    ['10. Como usar os filtros', has('filter') || has('period') || has('search') ? 'Use o seletor de período (datas ou atalhos), a pesquisa e as listas de filtro acima da tabela. Filtros apenas escondem registros: não apagam nada. O seletor de unidade no topo filtra todas as abas.' : 'Esta aba não tem filtros próprios; o seletor de unidade no topo continua valendo.'],
    ['11. Como interpretar os gráficos', tut.charts || (has('chart') ? 'Passe o mouse ou toque nos elementos do gráfico para ver os valores exatos. O eixo horizontal mostra o tempo ou a categoria; o vertical, o valor.' : 'Esta aba não tem gráficos.')],
    ['12. Como realizar as operações', <ol className="list-decimal pl-5">{tut.steps.map((s) => <li key={s}>{s}</li>)}</ol>],
    ['13. Como salvar', has('form') || has('add') ? 'Preencha o formulário e clique em "Salvar". Tudo é gravado imediatamente neste navegador e todas as abas relacionadas são atualizadas na hora.' : 'Não há o que salvar: os números são recalculados automaticamente.'],
    ['14. Como corrigir erros', has('table') && fields.length ? 'Na tabela, clique no lápis para editar ou na lixeira para excluir. Se o erro veio de uma importação, use "Desfazer" no histórico da Importação Inteligente e importe o arquivo corrigido.' : 'Corrija os dados de origem nas abas de cadastro ou desfaça a importação incorreta.'],
    ['15. Como exportar', has('export') ? 'Clique em "Exportar CSV": o arquivo contém exatamente o que está filtrado e abre no Excel.' : 'Use os relatórios em Relatórios Inteligentes ou o backup em Configurações.'],
    ['16. Exemplo prático', useful(tut.example) ? tut.example : 'Carregue os dados de demonstração em Configurações e abra esta aba para ver um exemplo real.'],
    ['17. Perguntas frequentes', tut.faq.length ? <dl>{tut.faq.map(([q, a]) => <div key={q} className="mb-2"><dt className="font-medium">{q}</dt><dd className="text-slate-600 dark:text-slate-300">{a}</dd></div>)}</dl> : 'Consulte as perguntas frequentes gerais na Central de Tutoriais.'],
    ['18. Limitações', useful(tut.limits) ? tut.limits : 'Os resultados dependem da qualidade e da atualização dos dados registrados.'],
    ['19. Alertas importantes', tut.warnings || 'Nenhum resultado é inventado: quando faltam dados, a tela mostra o que falta.'],
    ['20. Como usar para decidir', useful(tut.decisions) ? tut.decisions : 'Compare com o período anterior e aja sobre o que mudou.'],
  ]
  return (
    <div className="space-y-4">
      <Link to="/tutorial" className="text-sm text-brand-600">← Central de Tutoriais</Link>
      <h1 className="text-2xl font-bold">Tutorial: {tab.name}</h1>
      <div className="flex gap-2"><Link className="btn-primary" to={tab.route} onClick={() => setTimeout(() => startTour(tab.id), 400)}>Abrir a aba e iniciar tour interativo</Link></div>
      {sections.map(([h, b]) => <section key={h} className="card"><h2 className="mb-1 font-semibold">{h}</h2><div className="text-sm leading-relaxed">{b}</div></section>)}
    </div>
  )
}

export function GuidePage() {
  const { id } = useParams()
  const g = GUIDES.find((x) => x.id === id)
  if (!g) return <Notice tone="error">Guia não encontrado.</Notice>
  return (
    <div className="space-y-4">
      <Link to="/tutorial" className="text-sm text-brand-600">← Central de Tutoriais</Link>
      <h1 className="text-2xl font-bold">{g.title}</h1><p className="text-sm text-slate-500">Para: {g.audience}</p>
      {g.sections.map((s) => <section key={s.h} className="card"><h2 className="mb-1 font-semibold">{s.h}</h2>{s.p.map((p) => <p key={p} className="mb-1 text-sm leading-relaxed">{p}</p>)}</section>)}
    </div>
  )
}
