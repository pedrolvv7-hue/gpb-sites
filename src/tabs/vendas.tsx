import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Area, ComposedChart, Legend } from 'recharts'
import { useData, useStore } from '../data/store'
import { Page, Kpi, Grid, Section, Empty, Notice, PeriodPicker, usePeriod, DataTable, ChartBox, Badge } from '../components/ui'
import { EntityManager } from '../components/EntityManager'
import {
  revenueBy, salesSummary, previousPeriod, money, pct, productRanking, hourly, byWeekday, byChannel, forecast, lineRevenue,
  validSales, num, Period, dailyRevenue,
} from '../lib/calc'

const noSales = () => <Empty action={{ to: '/importacao?tipo=sales', label: 'Importar vendas' }}>Nenhuma venda registrada. Importe um relatório de vendas.</Empty>

export function Faturamento() {
  const data = useData()
  const [p, setP] = usePeriod()
  const [g, setG] = useState<'dia' | 'semana' | 'mes' | 'ano'>('dia')
  const rows = useMemo(() => revenueBy(data, g, p), [data, g, p])
  const s = salesSummary(data, p)
  if (!data.sales.length) return <Page>{noSales()}</Page>
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Grid cols={4}>
        <Kpi label="Faturamento líquido" value={money(s.revenue)} help={{ title: 'Faturamento líquido', what: 'Vendas concluídas menos descontos.', how: 'Σ (qtd x preço) - descontos.', source: 'Vendas' }} />
        <Kpi label="Faturamento bruto" value={money(s.grossRevenue)} />
        <Kpi label="Descontos" value={money(s.discounts)} />
        <Kpi label="Linhas canceladas/devolvidas" value={s.cancelled} sub="Excluídas dos totais" />
      </Grid>
      <div className="flex gap-2" data-tour="filter">{(['dia', 'semana', 'mes', 'ano'] as const).map((x) => <button key={x} className={g === x ? 'btn-primary' : 'btn-ghost'} onClick={() => setG(x)}>{x === 'mes' ? 'mês' : x}</button>)}</div>
      <Section title={`Faturamento por ${g === 'mes' ? 'mês' : g}`}>
        <ChartBox><ResponsiveContainer><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="k" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => money(Number(v))} /><Bar dataKey="revenue" name="Faturamento" fill="#2563eb" /></BarChart></ResponsiveContainer></ChartBox>
      </Section>
      <DataTable rows={rows} filename={`faturamento-${g}`} cols={[{ key: 'k', label: 'Período' }, { key: 'revenue', label: 'Faturamento', align: 'right', render: (r) => money(r.revenue) }]} />
    </Page>
  )
}

export function HistoricoVendas() {
  const data = useData()
  return (
    <Page>
      <EntityManager entity="sales" extraCols={[{ key: 'total', label: 'Total linha', align: 'right', render: (r) => money(lineRevenue(r)), csv: (r) => lineRevenue(r) }]}
        filters={[
          { key: 'channel', label: 'Canal', options: [...new Set(data.sales.map((s) => s.channel).filter(Boolean))] },
          { key: 'status', label: 'Status', options: ['concluida', 'cancelada', 'devolvida'] },
          { key: 'unit', label: 'Unidade', options: data.units.map((u) => u.code) },
        ]} />
    </Page>
  )
}

function Ranking({ asc }: { asc: boolean }) {
  const data = useData()
  const [p, setP] = usePeriod()
  const [by, setBy] = useState<'qty' | 'revenue'>('qty')
  const rows = useMemo(() => productRanking(data, p).sort((a, b) => (asc ? a[by] - b[by] : b[by] - a[by])), [data, p, by, asc])
  if (!data.sales.length) return <Page>{noSales()}</Page>
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      {asc && <Notice>Produtos com baixa procura no período. Inclui itens do cadastro que não venderam. Venda baixa não significa, sozinha, que o item deve sair do cardápio: cruze com a margem em Engenharia de Cardápio.</Notice>}
      <div className="flex gap-2" data-tour="filter"><button className={by === 'qty' ? 'btn-primary' : 'btn-ghost'} onClick={() => setBy('qty')}>Por quantidade</button><button className={by === 'revenue' ? 'btn-primary' : 'btn-ghost'} onClick={() => setBy('revenue')}>Por receita</button></div>
      <Section title="Top 10">
        <ChartBox><ResponsiveContainer><BarChart data={rows.slice(0, 10)} layout="vertical" margin={{ left: 80 }}><XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="product" fontSize={11} width={140} /><Tooltip formatter={(v: any) => (by === 'revenue' ? money(Number(v)) : v)} /><Bar dataKey={by} fill={asc ? '#64748b' : '#2563eb'} /></BarChart></ResponsiveContainer></ChartBox>
      </Section>
      <DataTable rows={rows} filename={asc ? 'menos-vendidos' : 'mais-vendidos'} cols={[
        { key: 'product', label: 'Produto' }, { key: 'qty', label: 'Quantidade', align: 'right' },
        { key: 'revenue', label: 'Receita', align: 'right', render: (r) => money(r.revenue) }, { key: 'share', label: 'Participação', align: 'right', render: (r) => pct(r.share) },
        { key: 'lastSale', label: 'Última venda', render: (r) => r.lastSale || <Badge tone="red">sem venda</Badge> },
      ]} />
    </Page>
  )
}
export const MaisVendidos = () => <Ranking asc={false} />
export const MenosVendidos = () => <Ranking asc />

export function HorariosPico() {
  const data = useData()
  const [p, setP] = usePeriod()
  const h = useMemo(() => hourly(data, p), [data, p])
  if (!data.sales.length) return <Page>{noSales()}</Page>
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      {h.coverage < 1 && <Notice tone="warn">{pct(h.coverage * 100)} das vendas do período têm horário registrado. As demais não entram nesta análise.</Notice>}
      {!h.rows.length ? <Empty>As vendas importadas não contêm horário individual. Importe um relatório com a coluna "Hora".</Empty> : <>
        <Section title="Faturamento e pedidos por hora">
          <ChartBox><ResponsiveContainer><ComposedChart data={h.rows}><XAxis dataKey="hour" fontSize={11} /><YAxis yAxisId="a" fontSize={11} /><YAxis yAxisId="b" orientation="right" fontSize={11} /><Tooltip /><Legend /><Bar yAxisId="a" dataKey="revenue" name="Faturamento" fill="#2563eb" /><Line yAxisId="b" dataKey="orders" name="Pedidos" stroke="#14b8a6" /></ComposedChart></ResponsiveContainer></ChartBox>
        </Section>
        <DataTable rows={h.rows} filename="horarios" cols={[{ key: 'hour', label: 'Hora' }, { key: 'orders', label: 'Pedidos', align: 'right' }, { key: 'revenue', label: 'Faturamento', align: 'right', render: (r) => money(r.revenue) }]} />
      </>}
    </Page>
  )
}

export function DiasMovimentados() {
  const data = useData()
  const [p, setP] = usePeriod()
  const rows = useMemo(() => byWeekday(data, p), [data, p])
  if (!data.sales.length) return <Page>{noSales()}</Page>
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Notice>A média por dia evita distorção quando o período tem quantidades diferentes de cada dia da semana.</Notice>
      <Section title="Média de faturamento por dia da semana">
        <ChartBox><ResponsiveContainer><BarChart data={rows}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => money(Number(v))} /><Bar dataKey="avg" name="Média" fill="#2563eb" /></BarChart></ResponsiveContainer></ChartBox>
      </Section>
      <DataTable rows={rows} filename="dias-semana" cols={[{ key: 'name', label: 'Dia' }, { key: 'days', label: 'Dias com venda', align: 'right' }, { key: 'total', label: 'Total', align: 'right', render: (r) => money(r.total) }, { key: 'avg', label: 'Média', align: 'right', render: (r) => money(r.avg) }]} />
    </Page>
  )
}

export function TicketMedio() {
  const data = useData()
  const [p, setP] = usePeriod()
  const s = salesSummary(data, p)
  const ch = useMemo(() => byChannel(data, p), [data, p])
  const units = data.units.map((u) => {
    const d = { ...data, sales: data.sales.filter((x) => x.unit === u.code) }
    const ss = salesSummary(d, p)
    return { unit: u.name, revenue: ss.revenue, orders: ss.orders, ticket: ss.ticket }
  })
  if (!data.sales.length) return <Page>{noSales()}</Page>
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      {s.orders == null && <Notice tone="warn">As vendas não têm número de pedido. Sem ele, não é possível saber quantos pedidos existem e o ticket médio não é calculado.</Notice>}
      <Grid cols={3}>
        <Kpi label="Ticket médio" value={s.ticket ? money(s.ticket) : 'n/d'} help={{ title: 'Ticket médio', what: 'Valor médio gasto por pedido.', how: 'faturamento ÷ pedidos distintos (nº do pedido).' }} />
        <Kpi label="Pedidos" value={s.orders ?? 'n/d'} />
        <Kpi label="Itens por pedido" value={s.orders ? (s.items / s.orders).toFixed(2) : 'n/d'} />
      </Grid>
      <Section title="Por canal"><DataTable rows={ch} filename="ticket-canal" cols={[{ key: 'channel', label: 'Canal' }, { key: 'orders', label: 'Pedidos', align: 'right', render: (r) => r.orders ?? 'n/d' }, { key: 'revenue', label: 'Faturamento', align: 'right', render: (r) => money(r.revenue) }, { key: 'ticket', label: 'Ticket', align: 'right', render: (r) => (r.ticket ? money(r.ticket) : 'n/d') }]} /></Section>
      {units.length > 0 && <Section title="Por unidade"><DataTable rows={units} filename="ticket-unidade" cols={[{ key: 'unit', label: 'Unidade' }, { key: 'orders', label: 'Pedidos', align: 'right', render: (r) => r.orders ?? 'n/d' }, { key: 'ticket', label: 'Ticket', align: 'right', render: (r) => (r.ticket ? money(r.ticket) : 'n/d') }]} /></Section>}
    </Page>
  )
}

export function ComparacaoPeriodos() {
  const data = useData()
  const [a, setA] = usePeriod()
  const [b, setB] = useState<Period | null>(null)
  const pb = b || previousPeriod(a)
  const sa = salesSummary(data, a), sb = salesSummary(data, pb)
  const metrics = [
    { k: 'Faturamento', a: sa.revenue, b: sb.revenue, m: true }, { k: 'Pedidos', a: sa.orders ?? 0, b: sb.orders ?? 0 },
    { k: 'Itens vendidos', a: sa.items, b: sb.items }, { k: 'Ticket médio', a: sa.ticket ?? 0, b: sb.ticket ?? 0, m: true },
    { k: 'Descontos', a: sa.discounts, b: sb.discounts, m: true }, { k: 'Cancelamentos', a: sa.cancelled, b: sb.cancelled },
  ].map((x) => ({ ...x, diff: x.a - x.b, var: x.b ? ((x.a - x.b) / x.b) * 100 : null }))
  if (!data.sales.length) return <Page>{noSales()}</Page>
  return (
    <Page>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Período A"><PeriodPicker value={a} onChange={setA} /></Section>
        <Section title="Período B (padrão: anterior equivalente)"><PeriodPicker value={pb} onChange={setB} /></Section>
      </div>
      <DataTable rows={metrics} filename="comparacao" cols={[
        { key: 'k', label: 'Indicador' }, { key: 'a', label: 'A', align: 'right', render: (r) => (r.m ? money(r.a) : num(r.a, 2)) },
        { key: 'b', label: 'B', align: 'right', render: (r) => (r.m ? money(r.b) : num(r.b, 2)) },
        { key: 'var', label: 'Variação', align: 'right', render: (r) => <span className={r.var == null ? '' : r.var >= 0 ? 'text-emerald-600' : 'text-red-600'}>{pct(r.var)}</span> },
      ]} />
    </Page>
  )
}

export function Metas() {
  const data = useData()
  const goals = data.goals.map((g) => {
    const d = { ...data, sales: g.unit ? data.sales.filter((s) => s.unit === g.unit) : data.sales }
    const real = salesSummary(d, { from: `${g.month}-01`, to: `${g.month}-31` }).revenue
    const days = new Date(Number(g.month.slice(0, 4)), Number(g.month.slice(5, 7)), 0).getDate()
    const daysWithSales = new Set(validSales(d, { from: `${g.month}-01`, to: `${g.month}-31` }).map((s) => s.date)).size
    const projection = daysWithSales ? (real / daysWithSales) * days : 0
    return { ...g, real, pctDone: g.target ? (real / g.target) * 100 : 0, projection }
  })
  return (
    <Page>
      <Notice>O realizado é calculado automaticamente a partir das vendas. A projeção é linear (média diária x dias do mês) e é apenas uma referência.</Notice>
      {goals.map((g) => (
        <div key={g.id} className="card" data-tour="kpi">
          <div className="flex justify-between text-sm"><b>{g.month} · {g.unit || 'todas as unidades'}</b><span>{money(g.real)} de {money(g.target)} ({pct(g.pctDone)})</span></div>
          <div className="mt-2 h-3 rounded bg-slate-200 dark:bg-slate-800"><div className={`h-3 rounded ${g.pctDone >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, g.pctDone)}%` }} /></div>
          <div className="mt-1 text-xs text-slate-500">Projeção para o mês: {money(g.projection)} {g.projection < g.target && <Badge tone="amber">abaixo da meta</Badge>}</div>
        </div>
      ))}
      <EntityManager entity="goals" title="Cadastro de metas" />
    </Page>
  )
}

export function PrevisaoVendas() {
  const data = useData()
  const [h, setH] = useState(14)
  const f = useMemo(() => forecast(data, h), [data, h])
  if (!f.ok) return <Page><Empty action={{ to: '/importacao?tipo=sales', label: 'Importar mais vendas' }}>{f.reason}</Empty></Page>
  const chart = [...(f.history || []).slice(-30).map((d) => ({ date: d.date, real: d.revenue })), ...f.rows.map((r) => ({ date: r.date, forecast: r.forecast, band: [r.low, r.high] }))]
  return (
    <Page>
      <Notice tone="warn">Previsão estatística (tendência + padrão por dia da semana). Não é garantia. A faixa sombreada é o intervalo de incerteza de aproximadamente 95%.</Notice>
      <label className="block max-w-xs" data-tour="filter"><span className="label">Horizonte (dias)</span><select className="input" value={h} onChange={(e) => setH(Number(e.target.value))}>{[7, 14, 30].map((x) => <option key={x}>{x}</option>)}</select></label>
      <Grid cols={3}>
        <Kpi label={`Previsto (${h} dias)`} value={money(f.rows.reduce((a, r) => a + r.forecast, 0))} />
        <Kpi label="Faixa baixa" value={money(f.rows.reduce((a, r) => a + r.low, 0))} />
        <Kpi label="Tendência diária" value={money(f.slope!)} sub="variação média por dia" />
      </Grid>
      <Section title="Histórico e previsão">
        <ChartBox><ResponsiveContainer><ComposedChart data={chart}><XAxis dataKey="date" fontSize={10} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => (Array.isArray(v) ? v.map((x) => money(x)).join(' a ') : money(Number(v)))} /><Area dataKey="band" fill="#bfdbfe" stroke="none" name="Intervalo" /><Line dataKey="real" stroke="#14b8a6" dot={false} name="Real" /><Line dataKey="forecast" stroke="#2563eb" strokeDasharray="4 4" dot={false} name="Previsão" /></ComposedChart></ResponsiveContainer></ChartBox>
      </Section>
      <DataTable rows={f.rows} filename="previsao" cols={[{ key: 'date', label: 'Data' }, { key: 'forecast', label: 'Previsão', align: 'right', render: (r) => money(r.forecast) }, { key: 'low', label: 'Mínimo', align: 'right', render: (r) => money(r.low) }, { key: 'high', label: 'Máximo', align: 'right', render: (r) => money(r.high) }]} />
    </Page>
  )
}
