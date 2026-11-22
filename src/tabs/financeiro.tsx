import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts'
import { useData, useStore } from '../data/store'
import { Page, Kpi, Grid, Section, Empty, Notice, PeriodPicker, usePeriod, DataTable, ChartBox, Badge, CHART_COLORS, Help } from '../components/ui'
import { EntityManager } from '../components/EntityManager'
import {
  productProfit, money, pct, grossMargin, operatingResult, groupSum, inPeriod, previousPeriod, today, D, norm, recipeCosts, daysBetween,
} from '../lib/calc'

export function LucroPrato() {
  const data = useData()
  const [p, setP] = usePeriod()
  const rows = useMemo(() => productProfit(data, p), [data, p])
  if (!data.sales.length) return <Page><Empty action={{ to: '/importacao?tipo=sales', label: 'Importar vendas' }}>É preciso ter vendas e fichas técnicas.</Empty></Page>
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      {rows.some((r) => r.qty > 0 && !r.hasRecipe) && <Notice tone="warn">{rows.filter((r) => r.qty > 0 && !r.hasRecipe).length} produto(s) vendidos sem ficha técnica: custo e margem não calculados (n/d). Nada é estimado.</Notice>}
      <DataTable rows={rows} filename="lucro-por-prato" filters={[{ key: 'hasRecipe', label: 'Ficha técnica', options: ['true', 'false'] }]} cols={[
        { key: 'product', label: 'Produto' }, { key: 'qty', label: 'Vendidos', align: 'right' },
        { key: 'price', label: 'Preço', align: 'right', render: (r) => (r.price ? money(r.price) : 'n/d') },
        { key: 'unitCost', label: 'Custo/porção', align: 'right', render: (r) => (r.unitCost != null ? money(r.unitCost) : 'n/d') },
        { key: 'revenue', label: 'Receita', align: 'right', render: (r) => money(r.revenue) },
        { key: 'cmv', label: 'CMV', align: 'right', render: (r) => (r.cmv != null ? money(r.cmv) : 'n/d') },
        { key: 'contribution', label: 'Contribuição', align: 'right', render: (r) => (r.contribution != null ? money(r.contribution) : 'n/d') },
        { key: 'marginPct', label: 'Margem', align: 'right', render: (r) => (r.marginPct == null ? <Badge>sem ficha</Badge> : <Badge tone={r.marginPct < 55 ? 'red' : r.marginPct < 65 ? 'amber' : 'green'}>{pct(r.marginPct)}</Badge>) },
        { key: 'recipeComplete', label: 'Ficha', render: (r) => (!r.hasRecipe ? '-' : r.recipeComplete ? 'completa' : <Badge tone="amber">incompleta</Badge>) },
      ]} />
    </Page>
  )
}

export function MargemBruta() {
  const data = useData()
  const [p, setP] = usePeriod()
  const m = grossMargin(data, p), prev = grossMargin(data, previousPeriod(p))
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Grid cols={4}>
        <Kpi label="Receita líquida" value={money(m.revenue)} />
        <Kpi label="CMV" value={money(m.cmv)} help={{ title: 'CMV', what: 'Custo dos produtos vendidos.', how: 'Σ quantidade vendida x custo por porção (ficha técnica).', source: 'Vendas, fichas técnicas e custos dos ingredientes.' }} />
        <Kpi label="Margem bruta (%)" value={pct(m.grossPct)} sub={`Período anterior: ${pct(prev.grossPct)}`} help={{ title: 'Margem bruta', what: 'Quanto sobra da receita depois do custo dos produtos.', how: '(receita coberta - CMV) ÷ receita coberta.', read: 'Calculada somente sobre produtos com ficha técnica.' }} />
        <Kpi label="Cobertura" value={pct(m.coveragePct)} tone={m.coveragePct < 90 ? 'warn' : 'up'} sub={`${money(m.uncoveredRevenue)} de receita sem custo conhecido`} />
      </Grid>
      {m.coveragePct < 100 && <Notice tone="warn">A margem considera apenas a receita de produtos com ficha técnica. Produtos sem ficha ficam fora para não distorcer o cálculo.</Notice>}
    </Page>
  )
}

export function ResultadoOperacional() {
  const data = useData()
  const [p, setP] = usePeriod()
  const r = operatingResult(data, p)
  const lines = [
    { k: '(+) Faturamento líquido', v: r.revenue }, { k: '(-) CMV', v: -r.cmv }, { k: '(=) Lucro bruto', v: r.gross, b: true },
    { k: '(-) Despesas operacionais', v: -r.expenses }, { k: '(-) Custos de pessoal', v: -r.payroll }, { k: '(-) Taxas e comissões', v: -r.fees },
    { k: '(=) Resultado operacional estimado', v: r.result, b: true },
  ]
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Notice>Demonstrativo gerencial estimado. Impostos, depreciação e despesas não registradas não estão incluídos. Não substitui a contabilidade.</Notice>
      <div className="card max-w-xl" data-tour="table">
        {lines.map((l) => (
          <div key={l.k} className={`flex justify-between border-b py-2 text-sm last:border-0 dark:border-slate-800 ${l.b ? 'font-bold' : ''}`}>
            <span>{l.k}</span><span className={l.v < 0 ? 'text-red-600' : ''}>{money(l.v)}</span>
          </div>
        ))}
        <div className="mt-2 text-xs text-slate-500">CMV cobre {pct(r.cmvCoverage)} da receita. Margem operacional: {pct(r.revenue ? (r.result / r.revenue) * 100 : null)}.</div>
      </div>
    </Page>
  )
}

export function ControleDespesas() {
  const data = useData()
  return <Page><EntityManager entity="expenses" filters={[{ key: 'category', label: 'Categoria', options: [...new Set(data.expenses.map((e) => e.category).filter(Boolean))] }, { key: 'unit', label: 'Unidade', options: data.units.map((u) => u.code) }]} /></Page>
}

export function DespesasCategoria() {
  const data = useData()
  const [p, setP] = usePeriod()
  const cur = groupSum(data.expenses.filter((e) => inPeriod(e.date, p)), (e) => e.category || 'outros', (e) => Number(e.amount))
  const prev = groupSum(data.expenses.filter((e) => inPeriod(e.date, previousPeriod(p))), (e) => e.category || 'outros', (e) => Number(e.amount))
  const cats = [...new Set([...cur.keys(), ...prev.keys()])]
  const rows = cats.map((c) => ({ c, cur: cur.get(c) || 0, prev: prev.get(c) || 0 })).map((r) => ({ ...r, var: r.prev ? ((r.cur - r.prev) / r.prev) * 100 : null })).sort((a, b) => b.cur - a.cur)
  if (!data.expenses.length) return <Page><Empty action={{ to: '/importacao?tipo=expenses', label: 'Importar despesas' }}>Nenhuma despesa registrada.</Empty></Page>
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Distribuição no período"><ChartBox><ResponsiveContainer><PieChart><Pie data={rows.filter((r) => r.cur > 0)} dataKey="cur" nameKey="c" outerRadius={90} label={(e: any) => e.c}>{rows.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(v: any) => money(Number(v))} /></PieChart></ResponsiveContainer></ChartBox></Section>
        <Section title="Atual x anterior"><ChartBox><ResponsiveContainer><BarChart data={rows}><XAxis dataKey="c" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: any) => money(Number(v))} /><Legend /><Bar dataKey="prev" name="Anterior" fill="#94a3b8" /><Bar dataKey="cur" name="Atual" fill="#f97316" /></BarChart></ResponsiveContainer></ChartBox></Section>
      </div>
      <DataTable rows={rows} filename="despesas-categoria" cols={[{ key: 'c', label: 'Categoria' }, { key: 'cur', label: 'Atual', align: 'right', render: (r) => money(r.cur) }, { key: 'prev', label: 'Anterior', align: 'right', render: (r) => money(r.prev) }, { key: 'var', label: 'Variação', align: 'right', render: (r) => pct(r.var) }]} />
    </Page>
  )
}

export function FluxoCaixa() {
  const data = useData()
  const [p, setP] = usePeriod()
  const moves = [
    ...data.receivables.filter((r) => r.receivedDate).map((r) => ({ date: r.receivedDate, desc: `Recebimento: ${r.description}`, in: Number(r.amount), out: 0, src: 'Contas a receber' })),
    ...data.payables.filter((r) => r.paidDate).map((r) => ({ date: r.paidDate, desc: `Pagamento: ${r.description}`, in: 0, out: Number(r.amount), src: 'Contas a pagar' })),
    ...data.cashEntries.map((r) => ({ date: r.date, desc: r.description, in: r.type === 'entrada' ? Number(r.amount) : 0, out: r.type === 'saida' ? Number(r.amount) : 0, src: 'Lançamento manual' })),
  ].filter((m) => inPeriod(m.date, p)).sort((a, b) => a.date.localeCompare(b.date))
  let bal = 0
  const rows = moves.map((m) => ({ ...m, balance: (bal = D(bal).plus(m.in).minus(m.out).toNumber()) }))
  const proj = [
    ...data.receivables.filter((r) => !r.receivedDate && r.dueDate >= today()).map((r) => ({ date: r.dueDate, v: Number(r.amount) })),
    ...data.payables.filter((r) => !r.paidDate && r.dueDate >= today()).map((r) => ({ date: r.dueDate, v: -Number(r.amount) })),
  ]
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Notice>O fluxo de caixa mostra somente dinheiro que <b>efetivamente</b> entrou ou saiu (recebimentos e pagamentos com data, e lançamentos de caixa). Faturamento não é o mesmo que dinheiro recebido: vendas no cartão ou em plataformas entram depois.</Notice>
      <Grid cols={4}>
        <Kpi label="Entradas" value={money(rows.reduce((a, r) => a + r.in, 0))} tone="up" />
        <Kpi label="Saídas" value={money(rows.reduce((a, r) => a + r.out, 0))} tone="down" />
        <Kpi label="Saldo do período" value={money(bal)} />
        <Kpi label="Projeção (pendentes futuros)" value={money(proj.reduce((a, r) => a + r.v, 0))} sub={`${proj.length} lançamento(s) previstos`} />
      </Grid>
      {rows.length > 0 && <Section title="Saldo acumulado"><ChartBox height={200}><ResponsiveContainer><LineChart data={rows}><XAxis dataKey="date" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: any) => money(Number(v))} /><Line dataKey="balance" stroke="#10b981" dot={false} /></LineChart></ResponsiveContainer></ChartBox></Section>}
      <DataTable rows={rows} filename="fluxo-caixa" empty={<Empty>Nenhum pagamento ou recebimento com data no período.</Empty>} cols={[
        { key: 'date', label: 'Data' }, { key: 'desc', label: 'Descrição' }, { key: 'src', label: 'Origem' },
        { key: 'in', label: 'Entrada', align: 'right', render: (r) => (r.in ? money(r.in) : '') }, { key: 'out', label: 'Saída', align: 'right', render: (r) => (r.out ? money(r.out) : '') },
        { key: 'balance', label: 'Saldo', align: 'right', render: (r) => money(r.balance) },
      ]} />
      <EntityManager entity="cashEntries" title="Lançamentos manuais de caixa" />
    </Page>
  )
}

function statusBadge(due: string, done: string) {
  if (done) return <Badge tone="green">quitado {done}</Badge>
  const d = daysBetween(today(), due)
  return d < 0 ? <Badge tone="red">vencido há {-d}d</Badge> : d <= 7 ? <Badge tone="amber">vence em {d}d</Badge> : <Badge>em aberto</Badge>
}

export function ContasPagar() {
  const data = useData()
  const update = useStore((s) => s.update)
  const open = data.payables.filter((r) => !r.paidDate)
  return (
    <Page>
      <Grid cols={3}>
        <Kpi label="Em aberto" value={money(open.reduce((a, r) => a + Number(r.amount), 0))} />
        <Kpi label="Vencidas" value={money(open.filter((r) => r.dueDate < today()).reduce((a, r) => a + Number(r.amount), 0))} tone="down" />
        <Kpi label="Próximos 7 dias" value={money(open.filter((r) => r.dueDate >= today() && daysBetween(today(), r.dueDate) <= 7).reduce((a, r) => a + Number(r.amount), 0))} tone="warn" />
      </Grid>
      <Notice>O sistema não realiza pagamentos. "Registrar pagamento" apenas anota um pagamento que você já fez.</Notice>
      <EntityManager entity="payables" extraCols={[{ key: 'st', label: 'Situação', render: (r) => statusBadge(r.dueDate, r.paidDate) }]}
        rowActions={(r) => !r.paidDate && <button className="btn-ghost px-2 text-xs" data-tour="pay" onClick={() => { const d = prompt('Data em que o pagamento foi feito (AAAA-MM-DD):', today()); if (d) update('payables', r.id, { paidDate: d }) }}>Registrar pagamento</button>} />
    </Page>
  )
}

export function ContasReceber() {
  const data = useData()
  const update = useStore((s) => s.update)
  const open = data.receivables.filter((r) => !r.receivedDate)
  return (
    <Page>
      <Grid cols={3}>
        <Kpi label="A receber" value={money(open.reduce((a, r) => a + Number(r.amount), 0))} />
        <Kpi label="Atrasados" value={money(open.filter((r) => r.dueDate < today()).reduce((a, r) => a + Number(r.amount), 0))} tone="down" />
        <Kpi label="Recebido (total)" value={money(data.receivables.filter((r) => r.receivedDate).reduce((a, r) => a + Number(r.amount), 0))} tone="up" />
      </Grid>
      <EntityManager entity="receivables" extraCols={[{ key: 'st', label: 'Situação', render: (r) => statusBadge(r.dueDate, r.receivedDate) }]}
        rowActions={(r) => !r.receivedDate && <button className="btn-ghost px-2 text-xs" onClick={() => { const d = prompt('Data do recebimento (AAAA-MM-DD):', today()); if (d) update('receivables', r.id, { receivedDate: d }) }}>Registrar recebimento</button>} />
    </Page>
  )
}

/** Concilia extrato com recebimentos/pagamentos registrados: valor igual (tolerância) e data até ±3 dias. */
export function reconcile(data: ReturnType<typeof useData>, tolPct = 2) {
  const used = new Set<string>()
  const book = [
    ...data.receivables.map((r) => ({ id: r.id, date: r.receivedDate || r.dueDate, amount: Number(r.amount), desc: r.description, kind: 'Recebível' })),
    ...data.payables.map((r) => ({ id: r.id, date: r.paidDate || r.dueDate, amount: -Number(r.amount), desc: r.description, kind: 'Conta a pagar' })),
    ...data.cashEntries.map((r) => ({ id: r.id, date: r.date, amount: r.type === 'saida' ? -Number(r.amount) : Number(r.amount), desc: r.description, kind: 'Caixa' })),
  ]
  const rows = data.bankStatement.map((b) => {
    const cands = book.filter((x) => !used.has(x.id) && Math.sign(x.amount) === Math.sign(Number(b.amount)) && Math.abs(daysBetween(x.date, b.date)) <= 3)
    const exact = cands.find((x) => Math.abs(x.amount - Number(b.amount)) < 0.01)
    const near = exact || cands.find((x) => Math.abs(x.amount - Number(b.amount)) <= Math.abs(x.amount) * (tolPct / 100))
    if (near) used.add(near.id)
    return { ...b, match: near ? `${near.kind}: ${near.desc}` : '', diff: near ? Number(b.amount) - near.amount : null, status: exact ? 'conciliado' : near ? 'divergência de valor' : 'não encontrado' }
  })
  const unmatched = book.filter((x) => !used.has(x.id) && x.date <= today() && data.bankStatement.length && x.date >= (data.bankStatement.map((b) => b.date).sort()[0] || ''))
  return { rows, unmatched }
}

export function Conciliacao() {
  const data = useData()
  const { rows, unmatched } = useMemo(() => reconcile(data), [data])
  return (
    <Page>
      <Notice>Cruza o extrato bancário com recebimentos, pagamentos e lançamentos de caixa (mesmo sinal, data em até 3 dias). Divergências de valor até 2% são sinalizadas (ex.: taxa descontada no repasse). Confira cada uma.</Notice>
      <Grid cols={3}>
        <Kpi label="Conciliados" value={rows.filter((r) => r.status === 'conciliado').length} tone="up" />
        <Kpi label="Divergências" value={rows.filter((r) => r.status === 'divergência de valor').length} tone="warn" />
        <Kpi label="Não encontrados no extrato/registros" value={rows.filter((r) => r.status === 'não encontrado').length + unmatched.length} tone="down" />
      </Grid>
      <Section title="Lançamentos do extrato">
        <DataTable rows={rows} filename="conciliacao" filters={[{ key: 'status', label: 'Situação', options: ['conciliado', 'divergência de valor', 'não encontrado'] }]}
          empty={<Empty action={{ to: '/importacao?tipo=bankStatement', label: 'Importar extrato' }}>Importe o extrato bancário (CSV) para conciliar.</Empty>}
          cols={[{ key: 'date', label: 'Data' }, { key: 'description', label: 'Extrato' }, { key: 'amount', label: 'Valor', align: 'right', render: (r) => money(Number(r.amount)) }, { key: 'match', label: 'Registro correspondente' }, { key: 'diff', label: 'Diferença', align: 'right', render: (r) => (r.diff ? money(r.diff) : '') }, { key: 'status', label: 'Situação', render: (r) => <Badge tone={r.status === 'conciliado' ? 'green' : r.status === 'não encontrado' ? 'red' : 'amber'}>{r.status}</Badge> }]} />
      </Section>
      {unmatched.length > 0 && <Section title="Registros sem correspondência no extrato"><DataTable rows={unmatched} filename="sem-extrato" cols={[{ key: 'date', label: 'Data' }, { key: 'kind', label: 'Tipo' }, { key: 'desc', label: 'Descrição' }, { key: 'amount', label: 'Valor', align: 'right', render: (r) => money(r.amount) }]} /></Section>}
      <EntityManager entity="bankStatement" title="Extrato bancário" />
    </Page>
  )
}

export function SimuladorPrecos() {
  const data = useData()
  const rc = useMemo(() => recipeCosts(data), [data])
  const [prod, setProd] = useState(data.products[0]?.name || '')
  const base = data.products.find((x) => x.name === prod)
  const cost0 = rc.get(norm(prod))?.costPerPortion
  const [price, setPrice] = useState<number | ''>('')
  const [costAdj, setCostAdj] = useState(0)
  const [vol, setVol] = useState(0)
  const qty0 = data.sales.filter((s) => norm(s.product) === norm(prod) && (!s.status || s.status === 'concluida')).reduce((a, s) => a + Number(s.qty), 0)
  const P = price === '' ? Number(base?.price || 0) : price
  const C = cost0 != null ? cost0 * (1 + costAdj / 100) : null
  const Q = qty0 * (1 + vol / 100)
  return (
    <Page>
      <Notice>Simulação hipotética. Nenhum preço real é alterado.</Notice>
      {!data.products.length ? <Empty action={{ to: '/fichas-tecnicas', label: 'Cadastrar produtos' }}>Cadastre produtos para simular.</Empty> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Cenário">
            <div className="space-y-3" data-tour="form">
              <label className="block"><span className="label">Produto</span><select className="input" value={prod} onChange={(e) => { setProd(e.target.value); setPrice('') }}>{data.products.map((x) => <option key={x.id}>{x.name}</option>)}</select></label>
              <label className="block"><span className="label">Novo preço (atual {money(Number(base?.price || 0))})</span><input className="input" type="number" step="0.5" value={price} placeholder={String(base?.price || '')} onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))} /></label>
              <label className="block"><span className="label">Variação do custo: {costAdj}%</span><input type="range" min={-30} max={50} value={costAdj} onChange={(e) => setCostAdj(Number(e.target.value))} className="w-full" /></label>
              <label className="block"><span className="label">Variação do volume vendido: {vol}%</span><input type="range" min={-50} max={50} value={vol} onChange={(e) => setVol(Number(e.target.value))} className="w-full" /></label>
            </div>
          </Section>
          <Section title="Resultado">
            {C == null ? <Notice tone="warn">Este produto não tem ficha técnica com custo. Cadastre-a para simular a margem.</Notice> : (
              <Grid cols={2}>
                <Kpi label="Custo por porção" value={money(C)} sub={`original ${money(cost0!)}`} />
                <Kpi label="Margem unitária" value={pct(((P - C) / P) * 100)} sub={money(P - C)} />
                <Kpi label="Volume (base histórica)" value={Q.toFixed(0)} sub={`histórico: ${qty0}`} />
                <Kpi label="Contribuição total" value={money((P - C) * Q)} sub={`atual: ${money((Number(base?.price || 0) - cost0!) * qty0)}`} />
              </Grid>
            )}
          </Section>
        </div>
      )}
    </Page>
  )
}

export function Calculadora() {
  const [mode, setMode] = useState<'normal' | 'restaurante'>('normal')
  const [expr, setExpr] = useState('')
  const [out, setOut] = useState('')
  const calc = () => {
    try {
      const safe = expr.replace(/,/g, '.').replace(/(\d+(?:\.\d+)?)%/g, '($1/100)')
      if (!/^[\d+\-*/().\s]+$/.test(safe)) throw new Error()
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${safe})`)()
      setOut(Number.isFinite(v) ? String(+v.toFixed(6)).replace('.', ',') : 'Erro')
    } catch { setOut('Expressão inválida') }
  }
  const [f, setF] = useState({ cost: 10, price: 30, markup: 2.5, cmvPct: 30, recipe: 50, portions: 8, discount: 10, combo: 49, comboCost: 15, fixed: 30000, marginPct: 60 })
  const n = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: Number(e.target.value) })
  const field = (k: keyof typeof f, label: string) => <label className="block"><span className="label">{label}</span><input className="input" type="number" step="any" value={f[k]} onChange={n(k)} /></label>
  return (
    <Page>
      <div className="flex gap-2" data-tour="filter"><button className={mode === 'normal' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('normal')}>Modo normal</button><button className={mode === 'restaurante' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('restaurante')}>Modo restaurante</button></div>
      {mode === 'normal' ? (
        <div className="card max-w-sm space-y-2" data-tour="form">
          <input aria-label="Expressão" className="input text-right text-lg" value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && calc()} placeholder="Ex.: 150*10%" />
          <div className="text-right text-2xl font-bold" data-testid="calc-out">{out || '0'}</div>
          <div className="grid grid-cols-4 gap-1">
            {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', ',', '%', '+'].map((k) => <button key={k} className="btn-ghost justify-center py-3" onClick={() => setExpr(expr + k)}>{k}</button>)}
            <button className="btn-ghost col-span-2 justify-center" onClick={() => { setExpr(''); setOut('') }}>Limpar</button>
            <button className="btn-primary col-span-2 justify-center" onClick={calc}>=</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="form">
          <Section title="CMV e margem">{field('cost', 'Custo (R$)')}{field('price', 'Preço de venda (R$)')}
            <p className="mt-2 text-sm">CMV: <b>{pct((f.cost / f.price) * 100)}</b> · Margem: <b>{pct(((f.price - f.cost) / f.price) * 100)}</b> · Markup: <b>{(f.price / f.cost).toFixed(2)}x</b> <Help title="Margem x markup" what="Margem é o lucro sobre o preço; markup é o multiplicador sobre o custo." how="margem = (preço - custo) ÷ preço; markup = preço ÷ custo." /></p></Section>
          <Section title="Preço por markup">{field('cost', 'Custo (R$)')}{field('markup', 'Markup (multiplicador)')}<p className="mt-2 text-sm">Preço sugerido: <b>{money(f.cost * f.markup)}</b></p></Section>
          <Section title="Preço pelo CMV desejado">{field('cost', 'Custo (R$)')}{field('cmvPct', 'CMV desejado (%)')}<p className="mt-2 text-sm">Preço: <b>{money(f.cost / (f.cmvPct / 100))}</b></p></Section>
          <Section title="Custo por porção">{field('recipe', 'Custo total da receita (R$)')}{field('portions', 'Porções')}<p className="mt-2 text-sm">Por porção: <b>{money(f.recipe / f.portions)}</b></p></Section>
          <Section title="Desconto">{field('price', 'Preço (R$)')}{field('discount', 'Desconto (%)')}{field('cost', 'Custo (R$)')}<p className="mt-2 text-sm">Preço final {money(f.price * (1 - f.discount / 100))} · nova margem {pct(((f.price * (1 - f.discount / 100) - f.cost) / (f.price * (1 - f.discount / 100))) * 100)}</p></Section>
          <Section title="Combo">{field('combo', 'Preço do combo')}{field('comboCost', 'Custo dos itens')}<p className="mt-2 text-sm">Margem do combo: <b>{pct(((f.combo - f.comboCost) / f.combo) * 100)}</b> ({money(f.combo - f.comboCost)})</p></Section>
          <Section title="Ponto de equilíbrio">{field('fixed', 'Custos fixos mensais')}{field('marginPct', 'Margem de contribuição (%)')}<p className="mt-2 text-sm">Faturamento necessário: <b>{f.marginPct > 0 ? money(f.fixed / (f.marginPct / 100)) : 'n/d'}</b></p></Section>
        </div>
      )}
    </Page>
  )
}
