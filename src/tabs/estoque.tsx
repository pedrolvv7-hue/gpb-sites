import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { useData, useStore } from '../data/store'
import { Page, Kpi, Grid, Section, Empty, Notice, DataTable, ChartBox, Badge, usePeriod, PeriodPicker } from '../components/ui'
import { EntityManager } from '../components/EntityManager'
import { stockPosition, replenishment, money, num, today, daysBetween, theoreticalConsumption, norm, inPeriod } from '../lib/calc'

const q = (v: number) => num(v, 2)

export function EstoqueGeral() {
  const data = useData()
  const rows = useMemo(() => stockPosition(data), [data])
  if (!data.ingredients.length) return <Page><Empty action={{ to: '/importacao?tipo=ingredients', label: 'Importar ingredientes' }}>Cadastre ou importe ingredientes para controlar o estoque.</Empty></Page>
  return (
    <Page>
      <Notice>Estoque teórico = última contagem física + entradas e compras - saídas - perdas ± ajustes - consumo pelas vendas (fichas técnicas). Itens sem contagem partem de zero e são marcados.</Notice>
      <Grid cols={3}>
        <Kpi label="Itens" value={rows.length} />
        <Kpi label="Valor teórico" value={money(rows.reduce((a, r) => a + r.value, 0))} />
        <Kpi label="Sem contagem física" value={rows.filter((r) => !r.lastCount).length} tone="warn" />
      </Grid>
      <DataTable rows={rows} filename="estoque" cols={[
        { key: 'ingredient', label: 'Ingrediente' }, { key: 'lastCount', label: 'Última contagem', render: (r) => (r.lastCount ? `${q(r.lastCount.qty)} em ${r.lastCount.date}` : <Badge tone="amber">nunca contado</Badge>), csv: (r) => r.lastCount?.qty },
        { key: 'entries', label: 'Entradas', align: 'right', render: (r) => q(r.entries) }, { key: 'consumption', label: 'Consumo teórico', align: 'right', render: (r) => q(r.consumption) },
        { key: 'losses', label: 'Perdas', align: 'right', render: (r) => q(r.losses) }, { key: 'exits', label: 'Saídas', align: 'right', render: (r) => q(r.exits) },
        { key: 'current', label: 'Estoque teórico', align: 'right', render: (r) => <b className={r.current < 0 ? 'text-red-600' : ''}>{q(r.current)} {r.measure}</b> },
        { key: 'value', label: 'Valor', align: 'right', render: (r) => money(r.value) },
      ]} />
      <EntityManager entity="stockMoves" title="Movimentações (entradas, saídas, ajustes, perdas)" filters={[{ key: 'type', label: 'Tipo', options: ['entrada', 'saida', 'ajuste', 'perda'] }]} />
    </Page>
  )
}

export function EstoqueMinimo() {
  const data = useData()
  const update = useStore((s) => s.update)
  const rows = useMemo(() => stockPosition(data), [data])
  const [edit, setEdit] = useState<Record<string, string>>({})
  return (
    <Page>
      <Notice>Defina o estoque mínimo de cada ingrediente. Quando o estoque teórico atingir o limite, um alerta é criado automaticamente.</Notice>
      <DataTable rows={rows} filename="estoque-minimo" filters={[]} empty={<Empty>Sem ingredientes.</Empty>} cols={[
        { key: 'ingredient', label: 'Ingrediente' }, { key: 'current', label: 'Estoque teórico', align: 'right', render: (r) => `${q(r.current)} ${r.measure}` },
        { key: 'minStock', label: 'Mínimo', render: (r) => {
          const ing = data.ingredients.find((i) => i.name === r.ingredient)!
          return <input aria-label={`Mínimo ${r.ingredient}`} className="input w-24" type="number" value={edit[ing.id] ?? r.minStock ?? ''} onChange={(e) => setEdit({ ...edit, [ing.id]: e.target.value })}
            onBlur={() => edit[ing.id] != null && update('ingredients', ing.id, { minStock: edit[ing.id] === '' ? '' : Number(edit[ing.id]) })} />
        } },
        { key: 'st', label: 'Situação', render: (r) => (r.minStock == null ? <Badge>sem limite</Badge> : r.current <= r.minStock ? <Badge tone="red">no mínimo</Badge> : <Badge tone="green">ok</Badge>) },
      ]} />
    </Page>
  )
}

export function PrevisaoReposicao() {
  const data = useData()
  const rows = useMemo(() => replenishment(data), [data])
  return (
    <Page>
      <Notice>Consumo médio diário dos últimos 30 dias de vendas x fichas técnicas. Dias restantes = estoque teórico ÷ consumo diário. Estimativa: depende da precisão das fichas e contagens.</Notice>
      <Section title="Dias de estoque restantes">
        <ChartBox><ResponsiveContainer><BarChart data={rows.filter((r) => r.daysLeft != null).sort((a, b) => a.daysLeft! - b.daysLeft!).slice(0, 15).map((r) => ({ ...r, d: Math.max(0, +r.daysLeft!.toFixed(1)) }))} layout="vertical" margin={{ left: 60 }}>
          <XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="ingredient" fontSize={11} width={130} /><Tooltip /><Bar dataKey="d" name="Dias" fill="#14b8a6" /></BarChart></ResponsiveContainer></ChartBox>
      </Section>
      <DataTable rows={rows} filename="previsao-reposicao" cols={[
        { key: 'ingredient', label: 'Ingrediente' }, { key: 'current', label: 'Estoque', align: 'right', render: (r) => `${q(r.current)} ${r.measure}` },
        { key: 'daily', label: 'Consumo/dia', align: 'right', render: (r) => q(r.daily) }, { key: 'daysLeft', label: 'Dias restantes', align: 'right', render: (r) => (r.daysLeft == null ? 'sem consumo' : <Badge tone={r.daysLeft <= r.lead ? 'red' : r.daysLeft <= r.lead + 3 ? 'amber' : 'green'}>{q(r.daysLeft)}</Badge>) },
        { key: 'lead', label: 'Prazo entrega', align: 'right' },
      ]} />
    </Page>
  )
}

export function Validades() {
  const data = useData()
  const days = useStore((s) => s.settings.thresholds.expiryDays)
  return (
    <Page>
      <Notice>As datas de validade vêm apenas de importação ou do preenchimento abaixo (pelo celular, lendo a embalagem). O sistema não inventa datas.</Notice>
      <Grid cols={3}>
        <Kpi label="Vencidos" value={data.lots.filter((l) => l.expiry < today()).length} tone="down" />
        <Kpi label={`Vencem em até ${days} dias`} value={data.lots.filter((l) => l.expiry >= today() && daysBetween(today(), l.expiry) <= days).length} tone="warn" />
        <Kpi label="Lotes registrados" value={data.lots.length} />
      </Grid>
      <EntityManager entity="lots" extraCols={[{ key: 'd', label: 'Situação', render: (r) => { const d = daysBetween(today(), r.expiry); return d < 0 ? <Badge tone="red">vencido</Badge> : d <= days ? <Badge tone="amber">{d} dia(s)</Badge> : <Badge tone="green">{d} dias</Badge> } }]} />
    </Page>
  )
}

export function Desperdicio() {
  const data = useData()
  const rows = useMemo(() => {
    // Compara contagens físicas consecutivas com o que era esperado entre elas.
    const out: any[] = []
    for (const ing of data.ingredients) {
      const c = data.counts.filter((x) => norm(x.ingredient) === norm(ing.name)).sort((a, b) => a.date.localeCompare(b.date))
      for (let i = 1; i < c.length; i++) {
        const a = c[i - 1], b = c[i]
        const between = (d: string) => d > a.date && d <= b.date
        const purchases = data.purchases.filter((p) => norm(p.ingredient) === norm(ing.name) && between(p.date)).reduce((s, p) => s + Number(p.qty), 0)
        const moves = data.stockMoves.filter((m) => norm(m.ingredient) === norm(ing.name) && between(m.date))
        const sum = (t: string) => moves.filter((m) => m.type === t).reduce((s, m) => s + Number(m.qty), 0)
        const cons = theoreticalConsumption({ ...data, sales: data.sales.filter((s) => between(s.date)) }).get(norm(ing.name)) || 0
        const expected = Number(a.qty) + purchases + sum('entrada') - sum('saida') - sum('perda') + sum('ajuste') - cons
        const diff = Number(b.qty) - expected
        out.push({ ingredient: ing.name, from: a.date, to: b.date, start: Number(a.qty), purchases, consumption: cons, losses: sum('perda'), expected, counted: Number(b.qty), diff, value: diff * Number(ing.cost), measure: ing.measure })
      }
    }
    return out
  }, [data])
  const losses = data.stockMoves.filter((m) => m.type === 'perda')
  return (
    <Page>
      <Notice>Divergência = contagem física - estoque esperado entre duas contagens. Uma diferença negativa pode ter várias causas (ficha técnica imprecisa, perda não registrada, erro de contagem, venda não lançada). O sistema não afirma a causa.</Notice>
      <Grid cols={3}>
        <Kpi label="Perdas registradas" value={money(losses.reduce((a, m) => a + Number(m.qty) * Number(data.ingredients.find((i) => norm(i.name) === norm(m.ingredient))?.cost || 0), 0))} />
        <Kpi label="Divergência não explicada" value={money(rows.filter((r) => r.diff < 0).reduce((a, r) => a + r.value, 0))} tone="down" />
        <Kpi label="Intervalos analisados" value={rows.length} />
      </Grid>
      <DataTable rows={rows} filename="desperdicio" empty={<Empty action={{ to: '/inventario', label: 'Fazer contagem' }}>São necessárias ao menos duas contagens físicas do mesmo ingrediente.</Empty>} cols={[
        { key: 'ingredient', label: 'Ingrediente' }, { key: 'from', label: 'De' }, { key: 'to', label: 'Até' },
        { key: 'expected', label: 'Esperado', align: 'right', render: (r) => q(r.expected) }, { key: 'counted', label: 'Contado', align: 'right', render: (r) => q(r.counted) },
        { key: 'diff', label: 'Diferença', align: 'right', render: (r) => <span className={r.diff < 0 ? 'text-red-600' : ''}>{q(r.diff)} {r.measure}</span> }, { key: 'value', label: 'Valor', align: 'right', render: (r) => money(r.value) },
      ]} />
      <Section title="Perdas registradas"><DataTable rows={losses} filename="perdas" cols={[{ key: 'date', label: 'Data' }, { key: 'ingredient', label: 'Ingrediente' }, { key: 'qty', label: 'Qtd', align: 'right' }, { key: 'note', label: 'Motivo' }]} /></Section>
    </Page>
  )
}

export function ConsumoIngredientes() {
  const data = useData()
  const [p, setP] = usePeriod()
  const c = useMemo(() => theoreticalConsumption(data, p), [data, p])
  const cancelled = data.sales.filter((s) => s.status && s.status !== 'concluida' && inPeriod(s.date, p)).length
  const rows = data.ingredients.map((i) => {
    const used = c.get(norm(i.name)) || 0
    const bought = data.purchases.filter((x) => norm(x.ingredient) === norm(i.name) && inPeriod(x.date, p)).reduce((a, x) => a + Number(x.qty), 0)
    return { ingredient: i.name, measure: i.measure, used, bought, cost: used * Number(i.cost) }
  }).sort((a, b) => b.cost - a.cost)
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Notice>Consumo teórico = pratos vendidos x ficha técnica. Vendas canceladas e devolvidas ({cancelled} linha(s) no período) não descontam ingredientes. Modificadores de pedido (ex.: "sem cebola") só são considerados quando importados como itens próprios.</Notice>
      <Section title="Consumo x compras no período"><ChartBox><ResponsiveContainer><BarChart data={rows.slice(0, 12)}><XAxis dataKey="ingredient" fontSize={10} interval={0} angle={-25} textAnchor="end" height={70} /><YAxis fontSize={10} /><Tooltip /><Legend /><Bar dataKey="used" name="Consumo" fill="#2563eb" /><Bar dataKey="bought" name="Compras" fill="#14b8a6" /></BarChart></ResponsiveContainer></ChartBox></Section>
      <DataTable rows={rows} filename="consumo" cols={[{ key: 'ingredient', label: 'Ingrediente' }, { key: 'used', label: 'Consumo', align: 'right', render: (r) => `${q(r.used)} ${r.measure}` }, { key: 'bought', label: 'Comprado', align: 'right', render: (r) => q(r.bought) }, { key: 'cost', label: 'Custo consumido', align: 'right', render: (r) => money(r.cost) }]} />
    </Page>
  )
}

export function Inventario() {
  const data = useData()
  const { add } = useStore()
  const st = useMemo(() => stockPosition(data), [data])
  const [who, setWho] = useState('')
  const [search, setSearch] = useState('')
  const [vals, setVals] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const list = st.filter((s) => !search || norm(s.ingredient).includes(norm(search)) || data.ingredients.find((i) => i.name === s.ingredient)?.barcode === search)
  const save = () => {
    if (!who.trim()) return setMsg('Informe quem fez a contagem.')
    const entries = Object.entries(vals).filter(([, v]) => v !== '')
    if (!entries.length) return setMsg('Nenhuma quantidade preenchida.')
    for (const [ing, v] of entries) add('counts', { date: today(), ingredient: ing, qty: Number(v.replace(',', '.')), countedBy: who, unit: useStore.getState().settings.unitFilter })
    setVals({}); setMsg(`${entries.length} contagem(ns) registradas por ${who}.`)
  }
  return (
    <Page>
      <Notice>Contagem física pelo celular: digite a quantidade que você <b>mediu</b>. Itens deixados em branco não são registrados. Para código de barras, use um leitor (que digita no campo de pesquisa) ou digite o número.</Notice>
      <div className="card space-y-3" data-tour="form">
        <div className="grid gap-2 sm:grid-cols-2">
          <label><span className="label">Responsável pela contagem *</span><input className="input" value={who} onChange={(e) => setWho(e.target.value)} /></label>
          <label><span className="label">Pesquisar ingrediente ou código de barras</span><input className="input" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        </div>
        <div className="divide-y dark:divide-slate-800">
          {list.map((s) => (
            <div key={s.ingredient} className="flex items-center gap-2 py-2">
              <div className="flex-1"><div className="font-medium">{s.ingredient}</div><div className="text-xs text-slate-500">Teórico: {q(s.current)} {s.measure}{s.lastCount && ` · última contagem ${s.lastCount.date}`}</div></div>
              <input aria-label={`Contagem ${s.ingredient}`} inputMode="decimal" className="input w-28 text-right" placeholder={s.measure} value={vals[s.ingredient] ?? ''} onChange={(e) => setVals({ ...vals, [s.ingredient]: e.target.value })} />
              {vals[s.ingredient] && <span className={`w-20 text-right text-xs ${Number(vals[s.ingredient]) - s.current < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{q(Number(vals[s.ingredient].replace(',', '.')) - s.current)}</span>}
            </div>
          ))}
          {!list.length && <Empty>Nenhum ingrediente encontrado.</Empty>}
        </div>
        <button className="btn-primary" data-tour="save" onClick={save}>Registrar contagem</button>
        {msg && <Notice tone="ok">{msg}</Notice>}
      </div>
      <EntityManager entity="counts" title="Histórico de contagens" canAdd={false} />
    </Page>
  )
}

export function ListaCompras() {
  const data = useData()
  const add = useStore((s) => s.add)
  const rows = useMemo(() => replenishment(data).filter((r) => r.suggested > 0), [data])
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const approve = () => {
    const chosen = rows.filter((r) => sel[r.ingredient])
    for (const r of chosen) add('purchaseOrders', { created: today(), supplier: r.supplier, ingredient: r.ingredient, qty: r.suggested, estCost: +(r.suggested * r.cost).toFixed(2), status: 'rascunho', origin: 'Lista de compras', expectedDate: '' })
    setSel({})
    alert(`${chosen.length} item(ns) enviados para Pedidos de Compra como rascunho. Nenhuma compra foi feita.`)
  }
  return (
    <Page>
      <Notice>Sugestão = (mínimo + consumo diário x (prazo de entrega + 7 dias)) - estoque teórico - pedidos já abertos. Selecione e aprove para gerar rascunhos de pedido.</Notice>
      <DataTable rows={rows} filename="lista-compras" empty={<Empty>Nenhum item precisa de reposição segundo os dados atuais.</Empty>} cols={[
        { key: 'sel', label: '', csv: () => '', render: (r) => <input type="checkbox" aria-label={`Selecionar ${r.ingredient}`} checked={!!sel[r.ingredient]} onChange={(e) => setSel({ ...sel, [r.ingredient]: e.target.checked })} /> },
        { key: 'ingredient', label: 'Ingrediente' }, { key: 'current', label: 'Estoque', align: 'right', render: (r) => q(r.current) }, { key: 'minStock', label: 'Mínimo', align: 'right' },
        { key: 'onOrder', label: 'Já pedido', align: 'right', render: (r) => q(r.onOrder) }, { key: 'suggested', label: 'Sugerido', align: 'right', render: (r) => <b>{q(r.suggested)} {r.measure}</b> },
        { key: 'supplier', label: 'Fornecedor' }, { key: 'est', label: 'Custo estimado', align: 'right', render: (r) => money(r.suggested * r.cost) },
      ]} />
      <button className="btn-primary" data-tour="approve" disabled={!Object.values(sel).some(Boolean)} onClick={approve}>Aprovar selecionados (gerar rascunhos)</button>
    </Page>
  )
}
