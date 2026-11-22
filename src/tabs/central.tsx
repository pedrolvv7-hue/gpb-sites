import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, ReferenceLine } from 'recharts'
import { Send, Printer, Download } from 'lucide-react'
import { useData, useStore } from '../data/store'
import { Page, Kpi, Grid, Section, Empty, Notice, PeriodPicker, usePeriod, DataTable, Badge, ChartBox } from '../components/ui'
import {
  dailyRevenue, salesSummary, previousPeriod, money, pct, grossMargin, operatingResult, stockPosition, revenueAnomalies,
  expenseAnomalies, healthScore, dataFreshness, daysBetween, today, productProfit, expensesTotal, num,
} from '../lib/calc'
import { computeAlerts, Alert } from '../lib/alerts'
import { ask, SUGGESTED, Answer } from '../lib/brain'
import { download, toCSV } from '../lib/importer'

const varPct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null)
const tone = (v: number | null) => (v == null ? undefined : v >= 0 ? 'up' : 'down') as any

export function useOpenAlerts() {
  const data = useData()
  const settings = useStore((s) => s.settings)
  const resolved = useStore((s) => s.resolvedAlerts)
  return useMemo(() => computeAlerts(data, settings).map((a) => ({ ...a, resolved: resolved[a.id] })), [data, settings, resolved])
}

// ------------------------------------------------------------------ 1 Visão geral
export function VisaoGeral() {
  const data = useData()
  const [p, setP] = usePeriod()
  const cur = useMemo(() => salesSummary(data, p), [data, p])
  const prev = useMemo(() => salesSummary(data, previousPeriod(p)), [data, p])
  const op = useMemo(() => operatingResult(data, p), [data, p])
  const gm = useMemo(() => grossMargin(data, p), [data, p])
  const stock = useMemo(() => stockPosition(data), [data])
  const alerts = useOpenAlerts().filter((a) => !a.resolved)
  const daily = useMemo(() => dailyRevenue(data, p), [data, p])
  if (!data.sales.length && !data.expenses.length)
    return <Page><Empty action={{ to: '/importacao', label: 'Importar dados' }}>Ainda não há vendas nem despesas. Importe suas planilhas ou carregue a demonstração em Configurações.</Empty></Page>
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Grid cols={4}>
        <Kpi label="Faturamento" value={money(cur.revenue)} sub={`${pct(varPct(cur.revenue, prev.revenue))} vs período anterior`} tone={tone(varPct(cur.revenue, prev.revenue))}
          help={{ title: 'Faturamento', what: 'Soma das vendas concluídas no período.', how: 'quantidade x preço unitário - descontos, excluindo canceladas e devolvidas.', source: 'Vendas importadas ou registradas.' }} />
        <Kpi label="Pedidos" value={cur.orders ?? 'n/d'} sub={cur.orders == null ? 'Sem nº de pedido nos dados' : `${pct(varPct(cur.orders, prev.orders || 0))} vs anterior`} />
        <Kpi label="Ticket médio" value={cur.ticket != null ? money(cur.ticket) : 'n/d'} help={{ title: 'Ticket médio', what: 'Valor médio por pedido.', how: 'faturamento ÷ número de pedidos distintos.', fix: 'Se aparecer n/d, suas vendas não têm número de pedido.' }} />
        <Kpi label="CMV" value={money(op.cmv)} sub={`Cobre ${pct(gm.coveragePct)} da receita`} tone={gm.coveragePct < 90 ? 'warn' : undefined}
          help={{ title: 'CMV', what: 'Custo da mercadoria vendida.', how: 'quantidade vendida x custo por porção da ficha técnica.', read: 'Produtos sem ficha técnica não entram; veja a cobertura.' }} />
        <Kpi label="Margem bruta" value={pct(gm.grossPct)} sub={money(gm.gross)} />
        <Kpi label="Despesas" value={money(op.expenses + op.payroll + op.fees)} sub={`Despesas ${money(op.expenses)} · pessoal ${money(op.payroll)} · taxas ${money(op.fees)}`} />
        <Kpi label="Resultado operacional estimado" value={money(op.result)} tone={op.result >= 0 ? 'up' : 'down'} sub="Estimativa, não substitui a contabilidade" />
        <Kpi label="Estoque (valor teórico)" value={money(stock.reduce((a, s) => a + s.value, 0))} sub={`${stock.filter((s) => s.minStock != null && s.current <= s.minStock).length} item(ns) no mínimo`} />
      </Grid>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Evolução do faturamento diário">
            <ChartBox><ResponsiveContainer><LineChart data={daily}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => money(Number(v))} /><Line dataKey="revenue" name="Faturamento" stroke="#2563eb" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></ChartBox>
          </Section>
        </div>
        <Section title={`Alertas abertos (${alerts.length})`} actions={<Link className="text-sm text-brand-600" to="/alertas">Ver todos</Link>}>
          <ul className="space-y-2 text-sm" data-tour="alerts">
            {alerts.slice(0, 6).map((a) => <li key={a.id}><Badge tone={a.severity === 'alta' ? 'red' : a.severity === 'media' ? 'amber' : 'slate'}>{a.severity}</Badge> <Link to={a.route} className="hover:underline">{a.title}</Link></li>)}
            {!alerts.length && <li className="text-slate-500">Nenhum alerta aberto.</li>}
          </ul>
        </Section>
      </div>
    </Page>
  )
}

// ------------------------------------------------------------------ 2 RestauBrain
export function RestauBrain() {
  const data = useData()
  const settings = useStore((s) => s.settings)
  const [q, setQ] = useState('')
  const [hist, setHist] = useState<{ q: string; a: Answer }[]>([])
  const go = (question: string) => {
    if (!question.trim()) return
    setHist((h) => [{ q: question, a: ask(question, data, settings) }, ...h])
    setQ('')
  }
  return (
    <Page>
      <Notice>Respostas calculadas diretamente sobre os seus registros (análise determinística, gratuita). A IA generativa é opcional e está {settings.generativeAI ? 'marcada como desejada em Configurações, mas nenhuma chave de API está configurada' : 'desativada'}.</Notice>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(q) }} data-tour="ask">
        <input className="input" placeholder="Pergunte sobre o seu restaurante..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary"><Send size={14} /> Perguntar</button>
      </form>
      <div className="flex flex-wrap gap-2" data-tour="suggestions">
        {SUGGESTED.map((s) => <button key={s} className="btn-ghost text-xs" onClick={() => go(s)}>{s}</button>)}
      </div>
      <div className="space-y-3">
        {hist.map((h, i) => (
          <div key={i} className="card" data-tour={i === 0 ? 'answer' : undefined}>
            <div className="text-sm font-semibold text-brand-600">{h.q}</div>
            <p className="mt-1">{h.a.text}</p>
            {h.a.bullets.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{h.a.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
            {h.a.sources.length > 0 && <div className="mt-2 text-xs text-slate-500">Fontes: {h.a.sources.join(' · ')}</div>}
          </div>
        ))}
      </div>
    </Page>
  )
}

// ------------------------------------------------------------------ 3 MorningBrain
export function MorningBrain() {
  const data = useData()
  const { settings, imports } = useStore()
  const since = settings.prevVisit
  const alerts = useOpenAlerts().filter((a) => !a.resolved)
  const newImports = imports.filter((i) => !i.undone && (!since || i.at > since))
  const newSales = data.sales.filter((s) => !since || s._createdAt > since)
  const salesDates = newSales.map((s) => s.date).sort()
  const fresh = dataFreshness(data)
  const p = { from: '0000-01-01', to: '9999-12-31' }
  const lastDays = dailyRevenue(data, p).slice(-14)
  const last7 = lastDays.slice(-7).reduce((a, d) => a + d.revenue, 0), prev7 = lastDays.slice(0, 7).reduce((a, d) => a + d.revenue, 0)
  const priceChanges = data.priceHistory.filter((h) => !since || h._createdAt > since)
  return (
    <Page>
      <Notice>Resumo desde o seu acesso anterior: <b>{since ? new Date(since).toLocaleString('pt-BR') : 'primeiro acesso'}</b>. A data de importação é diferente da data das vendas, e as duas são mostradas separadamente.</Notice>
      <Grid cols={4}>
        <Kpi label="Importações novas" value={newImports.length} sub={newImports.map((i) => i.fileName).slice(0, 2).join(', ')} />
        <Kpi label="Linhas de venda novas" value={num(newSales.length)} sub={salesDates.length ? `Vendas datadas de ${salesDates[0]} a ${salesDates[salesDates.length - 1]}` : 'Nenhuma'} />
        <Kpi label="Últimos 7 dias com dados" value={money(last7)} sub={`${pct(varPct(last7, prev7))} vs 7 dias anteriores`} tone={tone(varPct(last7, prev7))} />
        <Kpi label="Alertas prioritários" value={alerts.filter((a) => a.severity === 'alta').length} tone="warn" />
      </Grid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Problemas e alertas prioritários">
          <ul className="space-y-1 text-sm" data-tour="alerts">{alerts.filter((a) => a.severity !== 'baixa').slice(0, 10).map((a) => <li key={a.id}>• <Link className="hover:underline" to={a.route}>{a.title}</Link></li>)}{!alerts.length && <li>Nenhum.</li>}</ul>
        </Section>
        <Section title="Atualização dos dados">
          <ul className="space-y-1 text-sm" data-tour="freshness">
            {fresh.map((f) => (
              <li key={f.area} className="flex justify-between"><span>{f.area}</span>
                {f.last ? <Badge tone={daysBetween(f.last, today()) > settings.thresholds.staleDays ? 'amber' : 'green'}>{f.last}</Badge> : <Badge tone="red">sem dados</Badge>}</li>
            ))}
          </ul>
        </Section>
        <Section title="Mudanças de preço e custo registradas">
          <ul className="space-y-1 text-sm">{priceChanges.slice(-10).map((h) => <li key={h.id}>{h.kind === 'custo' ? 'Custo' : 'Preço'} de {h.item}: {money(h.value)} ({h.date})</li>)}{!priceChanges.length && <li>Nenhuma.</li>}</ul>
        </Section>
        <Section title="Recomendações de verificação">
          <ul className="list-disc space-y-1 pl-5 text-sm" data-tour="recs">
            {productProfit(data).filter((r) => r.qty > 0 && !r.hasRecipe).slice(0, 3).map((r) => <li key={r.product}>Cadastre a ficha técnica de <b>{r.product}</b> para calcular sua margem.</li>)}
            {fresh.filter((f) => !f.last).map((f) => <li key={f.area}>Não há dados de {f.area.toLowerCase()}. Importe para completar as análises.</li>)}
            {alerts.filter((a) => a.type === 'Aprovação pendente').length > 0 && <li>Há rascunhos de pedido de compra aguardando aprovação.</li>}
          </ul>
        </Section>
      </div>
    </Page>
  )
}

// ------------------------------------------------------------------ 4 Alertas
export function Alertas() {
  const alerts = useOpenAlerts()
  const { resolveAlert, reopenAlert } = useStore()
  const [show, setShow] = useState<'abertos' | 'resolvidos'>('abertos')
  const rows = alerts.filter((a) => (show === 'abertos' ? !a.resolved : a.resolved))
  return (
    <Page>
      <div className="flex gap-2" data-tour="filter">
        <button className={show === 'abertos' ? 'btn-primary' : 'btn-ghost'} onClick={() => setShow('abertos')}>Abertos ({alerts.filter((a) => !a.resolved).length})</button>
        <button className={show === 'resolvidos' ? 'btn-primary' : 'btn-ghost'} onClick={() => setShow('resolvidos')}>Resolvidos ({alerts.filter((a) => a.resolved).length})</button>
      </div>
      <DataTable rows={rows as any[]} filename="alertas" filters={[{ key: 'type', label: 'Tipo', options: [...new Set(alerts.map((a) => a.type))] }, { key: 'severity', label: 'Prioridade', options: ['alta', 'media', 'baixa'] }]}
        empty={<Empty>Nenhum alerta. Os alertas surgem automaticamente quando os dados atingem os limites de Configurações.</Empty>}
        cols={[
          { key: 'severity', label: 'Prioridade', render: (a) => <Badge tone={a.severity === 'alta' ? 'red' : a.severity === 'media' ? 'amber' : 'slate'}>{a.severity}</Badge> },
          { key: 'type', label: 'Tipo' },
          { key: 'title', label: 'Alerta', render: (a) => <Link className="hover:underline" to={a.route}>{a.title}</Link> },
          { key: 'detail', label: 'Evidência', render: (a) => <span className="whitespace-normal text-xs">{a.detail}</span> },
          { key: 'date', label: 'Data' },
          { key: 'act', label: 'Ação', csv: () => '', render: (a: Alert & { resolved?: any }) => a.resolved
            ? <button className="btn-ghost" onClick={() => reopenAlert(a.id)}>Reabrir</button>
            : <button className="btn-ghost" data-tour="resolve" onClick={() => { const n = prompt('Como foi resolvido? (opcional)'); if (n !== null) resolveAlert(a.id, n) }}>Resolver</button> },
        ]} />
    </Page>
  )
}

// ------------------------------------------------------------------ 5 Anomalias
export function Anomalias() {
  const data = useData()
  const z = useStore((s) => s.settings.thresholds.expenseZ)
  const [lim, setLim] = useState(z)
  const rows = useMemo(() => [...revenueAnomalies(data, lim), ...expenseAnomalies(data, lim)].sort((a, b) => b.date.localeCompare(a.date)), [data, lim])
  const daily = useMemo(() => dailyRevenue(data), [data])
  return (
    <Page>
      <Notice>Uma anomalia é um valor estatisticamente distante do padrão (z-score). Ela <b>não</b> indica, por si só, fraude ou erro: é um ponto a verificar.</Notice>
      <label className="block max-w-xs" data-tour="filter"><span className="label">Sensibilidade (desvios-padrão): {lim}</span>
        <input type="range" min={1.5} max={4} step={0.5} value={lim} onChange={(e) => setLim(Number(e.target.value))} className="w-full" /></label>
      <Section title="Faturamento diário com dias anômalos">
        <ChartBox><ResponsiveContainer><LineChart data={daily}><XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => money(Number(v))} />
          <Line dataKey="revenue" stroke="#14b8a6" dot={false} />{rows.filter((r) => r.id.startsWith('rev')).map((r) => <ReferenceLine key={r.id} x={r.date} stroke="#ef4444" strokeDasharray="3 3" />)}
        </LineChart></ResponsiveContainer></ChartBox>
      </Section>
      <DataTable rows={rows} filename="anomalias" empty={<Empty>Nenhuma anomalia. São necessárias ao menos 3 semanas de vendas ou 4 meses de despesas.</Empty>} cols={[
        { key: 'kind', label: 'Tipo' }, { key: 'date', label: 'Data/mês' },
        { key: 'value', label: 'Valor', align: 'right', render: (r) => money(r.value) }, { key: 'expected', label: 'Esperado', align: 'right', render: (r) => money(r.expected) },
        { key: 'z', label: 'Desvios', align: 'right', render: (r) => r.z.toFixed(1) }, { key: 'evidence', label: 'Evidência', render: (r) => <span className="whitespace-normal text-xs">{r.evidence}</span> },
      ]} />
    </Page>
  )
}

// ------------------------------------------------------------------ 6 Saúde
export function Saude() {
  const data = useData()
  const min = useStore((s) => s.settings.thresholds.minMarginPct)
  const h = useMemo(() => healthScore(data, min), [data, min])
  return (
    <Page>
      <Notice>A pontuação é um <b>indicador de apoio</b>, ponderado a partir dos componentes abaixo. Componentes sem dados são ignorados, não contados como zero. Não é uma medida absoluta da saúde do negócio.</Notice>
      <Grid cols={3}>
        <Kpi label="Pontuação geral" value={h.total == null ? 'n/d' : `${h.total.toFixed(0)}/100`} tone={h.total == null ? undefined : h.total >= 70 ? 'up' : h.total >= 45 ? 'warn' : 'down'}
          sub={`${h.comps.filter((c) => c.score != null).length} de ${h.comps.length} componentes com dados`}
          help={{ title: 'Saúde do negócio', what: 'Média ponderada dos componentes.', how: 'Soma(nota x peso) ÷ soma dos pesos com dados.', read: 'Use para ver onde agir, não como nota final.' }} />
      </Grid>
      <Section title="Componentes">
        <div className="space-y-3" data-tour="table">
          {h.comps.map((c) => (
            <div key={c.name}>
              <div className="flex justify-between text-sm"><span className="font-medium">{c.name} <span className="text-slate-400">(peso {c.weight})</span></span><span>{c.score == null ? 'sem dados' : c.score.toFixed(0)}</span></div>
              <div className="mt-1 h-2 rounded bg-slate-200 dark:bg-slate-800"><div className="h-2 rounded bg-brand-500" style={{ width: `${c.score ?? 0}%` }} /></div>
              <div className="text-xs text-slate-500">{c.why}</div>
            </div>
          ))}
        </div>
      </Section>
    </Page>
  )
}

// ------------------------------------------------------------------ 7 Relatórios
export function Relatorios() {
  const data = useData()
  const [p, setP] = usePeriod()
  const s = salesSummary(data, p), prev = salesSummary(data, previousPeriod(p))
  const op = operatingResult(data, p)
  const alerts = useOpenAlerts().filter((a) => !a.resolved)
  const fresh = dataFreshness(data)
  const pp = productProfit(data, p)
  const daily = dailyRevenue(data, p)
  const exportCSV = () => download(`relatorio-${p.from}-${p.to}.csv`, toCSV([
    { k: 'Período', v: `${p.from} a ${p.to}` }, { k: 'Faturamento', v: s.revenue.toFixed(2) }, { k: 'Faturamento período anterior', v: prev.revenue.toFixed(2) },
    { k: 'Pedidos', v: s.orders ?? 'n/d' }, { k: 'Ticket médio', v: s.ticket?.toFixed(2) ?? 'n/d' }, { k: 'CMV', v: op.cmv.toFixed(2) },
    { k: 'Cobertura do CMV (%)', v: op.cmvCoverage.toFixed(1) }, { k: 'Despesas', v: op.expenses.toFixed(2) }, { k: 'Pessoal', v: op.payroll.toFixed(2) },
    { k: 'Taxas', v: op.fees.toFixed(2) }, { k: 'Resultado operacional estimado', v: op.result.toFixed(2) }, { k: 'Alertas abertos', v: alerts.length },
  ], [{ key: 'k', label: 'Indicador' }, { key: 'v', label: 'Valor' }]))
  return (
    <Page actions={<>
      <PeriodPicker value={p} onChange={setP} />
      <button className="btn-primary" data-tour="pdf" onClick={() => window.print()}><Printer size={14} /> PDF (imprimir)</button>
      <button className="btn-ghost" data-tour="export" onClick={exportCSV}><Download size={14} /> CSV</button>
    </>}>
      <div className="card space-y-4" data-tour="report">
        <div><h2 className="text-xl font-bold">Relatório gerencial · {useStore.getState().settings.companyName || 'Restaurante'}</h2>
          <p className="text-sm text-slate-500">Período analisado: {p.from} a {p.to} · comparado com {previousPeriod(p).from} a {previousPeriod(p).to}</p></div>
        <Grid cols={4}>
          <Kpi label="Faturamento" value={money(s.revenue)} sub={`${pct(varPct(s.revenue, prev.revenue))} vs anterior`} />
          <Kpi label="Ticket médio" value={s.ticket ? money(s.ticket) : 'n/d'} />
          <Kpi label="CMV" value={money(op.cmv)} sub={`cobertura ${pct(op.cmvCoverage)}`} />
          <Kpi label="Resultado estimado" value={money(op.result)} />
        </Grid>
        <ChartBox height={200}><ResponsiveContainer><BarChart data={daily}><XAxis dataKey="date" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: any) => money(Number(v))} /><Bar dataKey="revenue" fill="#2563eb" /></BarChart></ResponsiveContainer></ChartBox>
        <div className="grid gap-4 md:grid-cols-2">
          <div><h4 className="font-semibold">Top 5 produtos por receita</h4><ol className="list-decimal pl-5 text-sm">{[...pp].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map((r) => <li key={r.product}>{r.product}: {money(r.revenue)}</li>)}</ol></div>
          <div><h4 className="font-semibold">Alertas abertos ({alerts.length})</h4><ul className="list-disc pl-5 text-sm">{alerts.slice(0, 6).map((a) => <li key={a.id}>{a.title}</li>)}</ul></div>
          <div><h4 className="font-semibold">Recomendações</h4><ul className="list-disc pl-5 text-sm">
            {op.cmvCoverage < 95 && <li>Complete fichas técnicas: o CMV cobre {pct(op.cmvCoverage)} da receita.</li>}
            {pp.filter((r) => r.marginPct != null && r.marginPct < 55 && r.qty > 0).slice(0, 3).map((r) => <li key={r.product}>Revisar preço ou receita de {r.product} (margem {pct(r.marginPct)}).</li>)}
            {expensesTotal(data, p) > s.revenue * 0.4 && <li>Despesas acima de 40% do faturamento.</li>}
          </ul></div>
          <div><h4 className="font-semibold">Dados faltantes ou desatualizados</h4><ul className="list-disc pl-5 text-sm">{fresh.filter((f) => !f.last || daysBetween(f.last, p.to) > 7).map((f) => <li key={f.area}>{f.area}: {f.last ? `último em ${f.last}` : 'sem dados'}</li>)}</ul></div>
        </div>
      </div>
    </Page>
  )
}
