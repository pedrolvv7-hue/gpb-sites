import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts'
import { useData, useStore } from '../data/store'
import { Page, Kpi, Grid, Section, Empty, Notice, DataTable, ChartBox, Badge, usePeriod, PeriodPicker, CHART_COLORS } from '../components/ui'
import { EntityManager } from '../components/EntityManager'
import { money, num, today, norm, inPeriod, byChannel, channelFees, groupSum, daysBetween, pct, salesSummary } from '../lib/calc'
import { download, toCSV } from '../lib/importer'

// ------------------------------------------------------------------ Compras e fornecedores
export function Fornecedores() {
  const data = useData()
  return (
    <Page>
      <EntityManager entity="suppliers" extraCols={[{ key: 'n', label: 'Itens cotados', align: 'right', render: (r) => data.supplierPrices.filter((p) => p.supplier === r.name).length }]} />
      <EntityManager entity="supplierPrices" title="Tabela de preços por fornecedor" filters={[{ key: 'supplier', label: 'Fornecedor', options: data.suppliers.map((s) => s.name) }]} />
    </Page>
  )
}

export function ComparadorFornecedores() {
  const data = useData()
  const ings = [...new Set(data.supplierPrices.map((p) => p.ingredient))]
  const [ing, setIng] = useState(ings[0] || '')
  const [qty, setQty] = useState(10)
  const rows = data.supplierPrices.filter((p) => p.ingredient === ing).map((p) => {
    const s = data.suppliers.find((x) => x.name === p.supplier)
    const subtotal = p.price * qty
    const purchases = data.purchases.filter((x) => x.supplier === p.supplier && norm(x.ingredient) === norm(ing))
    return { ...p, freight: Number(s?.freight || 0), leadDays: s?.leadDays ?? '', minOrder: Number(s?.minOrder || 0), total: subtotal + Number(s?.freight || 0), belowMin: s?.minOrder ? subtotal < Number(s.minOrder) : false, history: purchases.length }
  }).sort((a, b) => a.total - b.total)
  return (
    <Page>
      {!ings.length ? <Empty action={{ to: '/fornecedores', label: 'Cadastrar preços' }}>Registre preços de fornecedores para comparar.</Empty> : <>
        <div className="flex flex-wrap gap-3" data-tour="filter">
          <label><span className="label">Ingrediente</span><select className="input" value={ing} onChange={(e) => setIng(e.target.value)}>{ings.map((i) => <option key={i}>{i}</option>)}</select></label>
          <label><span className="label">Quantidade</span><input className="input" type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></label>
        </div>
        <Notice>Total = preço x quantidade + frete. Pedido mínimo é verificado só para este item (o pedido real pode incluir outros itens). Preços conforme a data da cotação.</Notice>
        <DataTable rows={rows} filename="comparador" cols={[
          { key: 'supplier', label: 'Fornecedor' }, { key: 'price', label: 'Preço', align: 'right', render: (r) => money(r.price) }, { key: 'date', label: 'Cotação' },
          { key: 'freight', label: 'Frete', align: 'right', render: (r) => money(r.freight) }, { key: 'leadDays', label: 'Prazo (dias)', align: 'right' },
          { key: 'minOrder', label: 'Mínimo', align: 'right', render: (r) => money(r.minOrder) }, { key: 'history', label: 'Compras anteriores', align: 'right' },
          { key: 'total', label: 'Total', align: 'right', render: (r) => <b>{money(r.total)}</b> }, { key: 'belowMin', label: '', render: (r) => r.belowMin && <Badge tone="amber">abaixo do mínimo</Badge> },
        ]} />
      </>}
    </Page>
  )
}

export function HistoricoCompras() {
  const data = useData()
  const [p, setP] = usePeriod()
  const rows = data.purchases.filter((x) => inPeriod(x.date, p))
  const bySup = [...groupSum(rows, (r) => r.supplier, (r) => Number(r.qty) * Number(r.unitCost)).entries()].map(([k, v]) => ({ k, v }))
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Grid cols={3}><Kpi label="Total comprado" value={money(bySup.reduce((a, r) => a + r.v, 0))} /><Kpi label="Compras" value={rows.length} /><Kpi label="Fornecedores" value={bySup.length} /></Grid>
      {bySup.length > 0 && <Section title="Por fornecedor"><ChartBox height={220}><ResponsiveContainer><BarChart data={bySup}><XAxis dataKey="k" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: any) => money(Number(v))} /><Bar dataKey="v" fill="#14b8a6" /></BarChart></ResponsiveContainer></ChartBox></Section>}
      <EntityManager entity="purchases" rows={rows} extraCols={[{ key: 't', label: 'Total', align: 'right', render: (r) => money(Number(r.qty) * Number(r.unitCost)) }]}
        filters={[{ key: 'supplier', label: 'Fornecedor', options: [...new Set(data.purchases.map((x) => x.supplier))] }, { key: 'unit', label: 'Unidade', options: data.units.map((u) => u.code) }]} />
    </Page>
  )
}

export function PedidosCompra() {
  const data = useData()
  const update = useStore((s) => s.update)
  const add = useStore((s) => s.add)
  const setStatus = (r: any, status: string) => {
    if (status === 'aprovado' && !confirm(`Aprovar pedido de ${r.qty} ${r.ingredient} (${money(Number(r.estCost || 0))})? Isso NÃO envia nem paga o pedido; apenas registra sua aprovação.`)) return
    update('purchaseOrders', r.id, { status })
    if (status === 'enviado') add('deliveries', { supplier: r.supplier, ingredient: r.ingredient, expectedDate: r.expectedDate || today(), expectedQty: r.qty, receivedDate: '', receivedQty: '', receivedBy: '' })
  }
  const exp = () => download('pedidos-aprovados.csv', toCSV(data.purchaseOrders.filter((p) => p.status === 'aprovado'), [{ key: 'supplier', label: 'Fornecedor' }, { key: 'ingredient', label: 'Item' }, { key: 'qty', label: 'Quantidade' }, { key: 'estCost', label: 'Custo estimado' }]))
  return (
    <Page actions={<button className="btn-ghost" onClick={exp}>Exportar aprovados para enviar ao fornecedor</button>}>
      <Notice>Fluxo: rascunho → aprovado (por você) → enviado (você marca após enviar por telefone, e-mail ou WhatsApp). Não há integração de envio automático com fornecedores configurada; nenhum gasto é feito pelo sistema.</Notice>
      <Grid cols={4}>{['rascunho', 'aprovado', 'enviado', 'cancelado'].map((s) => <Kpi key={s} label={s} value={data.purchaseOrders.filter((p) => p.status === s).length} />)}</Grid>
      <EntityManager entity="purchaseOrders" fixed={{ created: today(), status: 'rascunho', origin: 'Manual' }} filters={[{ key: 'status', label: 'Status', options: ['rascunho', 'aprovado', 'enviado', 'cancelado'] }]}
        rowActions={(r) => <>
          {r.status === 'rascunho' && <button className="btn-ghost px-2 text-xs text-emerald-700" data-tour="approve" onClick={() => setStatus(r, 'aprovado')}>Aprovar</button>}
          {r.status === 'aprovado' && <button className="btn-ghost px-2 text-xs" onClick={() => setStatus(r, 'enviado')}>Marcar enviado</button>}
          {r.status !== 'cancelado' && r.status !== 'enviado' && <button className="btn-ghost px-2 text-xs" onClick={() => setStatus(r, 'cancelado')}>Cancelar</button>}
        </>} />
    </Page>
  )
}

export function Entregas() {
  const data = useData()
  const update = useStore((s) => s.update)
  const add = useStore((s) => s.add)
  const receive = (r: any) => {
    const qty = prompt(`Quantidade recebida de ${r.ingredient} (esperado ${r.expectedQty}):`, String(r.expectedQty))
    if (qty == null) return
    const who = prompt('Quem conferiu o recebimento?')
    if (!who) return alert('É necessário informar quem conferiu.')
    update('deliveries', r.id, { receivedQty: Number(qty.replace(',', '.')), receivedDate: today(), receivedBy: who })
    add('stockMoves', { date: today(), ingredient: r.ingredient, type: 'entrada', qty: Number(qty.replace(',', '.')), note: `Recebimento de ${r.supplier} conferido por ${who}` })
  }
  const status = (r: any) => (!r.receivedDate ? (r.expectedDate < today() ? 'atrasada' : 'pendente') : Number(r.receivedQty) !== Number(r.expectedQty) ? 'divergente' : 'recebida')
  return (
    <Page>
      <Notice>Ao registrar um recebimento, a quantidade conferida entra no estoque como movimentação de entrada. O recebimento só é confirmado por uma pessoa.</Notice>
      <Grid cols={4}>{['pendente', 'atrasada', 'divergente', 'recebida'].map((s) => <Kpi key={s} label={s} value={data.deliveries.filter((d) => status(d) === s).length} />)}</Grid>
      <EntityManager entity="deliveries" extraCols={[{ key: 'st', label: 'Status', csv: status, render: (r) => { const s = status(r); return <Badge tone={s === 'recebida' ? 'green' : s === 'pendente' ? 'slate' : s === 'atrasada' ? 'red' : 'amber'}>{s}</Badge> } }]}
        rowActions={(r) => !r.receivedDate && <button className="btn-ghost px-2 text-xs" data-tour="receive" onClick={() => receive(r)}>Registrar recebimento</button>} />
    </Page>
  )
}

// ------------------------------------------------------------------ Delivery
const DELIVERY = ['delivery_proprio', 'ifood', 'outra_plataforma']

export function DeliveryAnalytics() {
  const data = useData()
  const [p, setP] = usePeriod()
  const dd = { ...data, sales: data.sales.filter((s) => DELIVERY.includes(s.channel)) }
  const s = salesSummary(dd, p), all = salesSummary(data, p)
  const ch = byChannel(dd, p)
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      {!dd.sales.length ? <Empty>Nenhuma venda com canal de delivery. Verifique a coluna "Canal" nas importações.</Empty> : <>
        <Grid cols={4}>
          <Kpi label="Faturamento delivery" value={money(s.revenue)} sub={`${pct(all.revenue ? (s.revenue / all.revenue) * 100 : null)} do total`} />
          <Kpi label="Pedidos" value={s.orders ?? 'n/d'} /><Kpi label="Ticket" value={s.ticket ? money(s.ticket) : 'n/d'} /><Kpi label="Descontos" value={money(s.discounts)} />
        </Grid>
        <Section title="Por plataforma"><ChartBox height={220}><ResponsiveContainer><PieChart><Pie data={ch} dataKey="revenue" nameKey="channel" outerRadius={80} label={(e: any) => e.channel}>{ch.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}</Pie><Tooltip formatter={(v: any) => money(Number(v))} /></PieChart></ResponsiveContainer></ChartBox></Section>
        <DataTable rows={ch} filename="delivery" cols={[{ key: 'channel', label: 'Canal' }, { key: 'orders', label: 'Pedidos', align: 'right' }, { key: 'revenue', label: 'Faturamento', align: 'right', render: (r) => money(r.revenue) }, { key: 'discounts', label: 'Descontos', align: 'right', render: (r) => money(r.discounts) }]} />
      </>}
    </Page>
  )
}

export function TaxasComissoes() {
  const data = useData()
  const [p, setP] = usePeriod()
  const rows = useMemo(() => channelFees(data, p), [data, p])
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Notice>As taxas são calculadas com os percentuais que você cadastrar abaixo (confira no contrato de cada plataforma ou adquirente). Canais sem taxa cadastrada aparecem como "não configurado" e não são estimados.</Notice>
      <Grid cols={3}><Kpi label="Taxas estimadas" value={money(rows.reduce((a, r) => a + r.fees, 0))} tone="down" /><Kpi label="Receita líquida de taxas" value={money(rows.reduce((a, r) => a + r.net, 0))} /><Kpi label="Canais sem taxa cadastrada" value={rows.filter((r) => !r.configured).length} tone="warn" /></Grid>
      <DataTable rows={rows} filename="taxas" cols={[
        { key: 'channel', label: 'Canal' }, { key: 'revenue', label: 'Faturamento', align: 'right', render: (r) => money(r.revenue) },
        { key: 'feePct', label: 'Comissão', align: 'right', render: (r) => (r.configured ? `${r.feePct}%` : <Badge tone="amber">não configurado</Badge>) },
        { key: 'fees', label: 'Taxas', align: 'right', render: (r) => money(r.fees) }, { key: 'net', label: 'Líquido', align: 'right', render: (r) => money(r.net) },
      ]} />
      <EntityManager entity="fees" title="Taxas cadastradas" />
    </Page>
  )
}

export function ComparadorCanais() {
  const data = useData()
  const [p, setP] = usePeriod()
  const rows = useMemo(() => channelFees(data, p), [data, p])
  return (
    <Page actions={<PeriodPicker value={p} onChange={setP} />}>
      <Section title="Faturamento bruto x líquido de taxas por canal"><ChartBox><ResponsiveContainer><BarChart data={rows}><XAxis dataKey="channel" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => money(Number(v))} /><Legend /><Bar dataKey="revenue" name="Bruto" fill="#94a3b8" /><Bar dataKey="net" name="Líquido de taxas" fill="#10b981" /></BarChart></ResponsiveContainer></ChartBox></Section>
      <DataTable rows={rows} filename="canais" cols={[
        { key: 'channel', label: 'Canal' }, { key: 'orders', label: 'Pedidos', align: 'right', render: (r) => r.orders ?? 'n/d' }, { key: 'ticket', label: 'Ticket', align: 'right', render: (r) => (r.ticket ? money(r.ticket) : 'n/d') },
        { key: 'revenue', label: 'Bruto', align: 'right', render: (r) => money(r.revenue) }, { key: 'fees', label: 'Taxas', align: 'right', render: (r) => (r.configured ? money(r.fees) : 'n/d') },
        { key: 'net', label: 'Líquido', align: 'right', render: (r) => money(r.net) }, { key: 'pctNet', label: '% retido', align: 'right', render: (r) => pct(r.revenue ? (r.net / r.revenue) * 100 : null) },
      ]} />
    </Page>
  )
}

const ORDER_FLOW = ['novo', 'preparo', 'pronto', 'entregue'] as const
const nowStamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ')

export function CentralPedidos() {
  const data = useData()
  const { add, update } = useStore()
  const [f, setF] = useState({ customer: '', items: '', total: '', channel: 'salao' })
  const create = (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.items || !f.total) return
    add('orders', { code: `P${Date.now().toString().slice(-6)}`, customer: f.customer, items: f.items, total: Number(f.total.replace(',', '.')), channel: f.channel, status: 'novo', createdAt: nowStamp(), unit: useStore.getState().settings.unitFilter })
    setF({ customer: '', items: '', total: '', channel: 'salao' })
  }
  const advance = (o: any) => {
    const i = ORDER_FLOW.indexOf(o.status)
    const next = ORDER_FLOW[i + 1]
    if (!next) return
    update('orders', o.id, { status: next, ...(next === 'preparo' ? { startedAt: nowStamp() } : next === 'pronto' ? { readyAt: nowStamp() } : {}) })
  }
  return (
    <Page>
      <Notice>Pedidos criados aqui são registrados no sistema. Integrações oficiais com plataformas de delivery não estão conectadas (ver Central de Integrações). Com vários dispositivos, a atualização em tempo real exige o banco em nuvem.</Notice>
      <form onSubmit={create} className="card grid gap-2 sm:grid-cols-5" data-tour="form">
        <input className="input" placeholder="Cliente" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} />
        <input className="input sm:col-span-2" placeholder="Itens (ex.: 2 Classic Burger, 1 Refri)" value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} />
        <input className="input" placeholder="Total R$" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} />
        <div className="flex gap-2"><select className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>{['salao', 'retirada', 'delivery_proprio'].map((c) => <option key={c}>{c}</option>)}</select><button className="btn-primary">Criar</button></div>
      </form>
      <div className="grid gap-3 md:grid-cols-4" data-tour="board">
        {ORDER_FLOW.map((s) => (
          <div key={s} className="rounded-xl bg-slate-100 p-2 dark:bg-slate-900">
            <div className="mb-2 text-sm font-semibold uppercase">{s} ({data.orders.filter((o) => o.status === s).length})</div>
            {data.orders.filter((o) => o.status === s).slice(-20).map((o) => (
              <div key={o.id} className="mb-2 rounded-lg bg-white p-2 text-sm shadow-sm dark:bg-slate-800">
                <div className="flex justify-between"><b>{o.code}</b><span>{money(Number(o.total))}</span></div>
                <div className="text-xs text-slate-500">{o.customer} · {o.channel} · {o.createdAt}</div><div className="text-xs">{o.items}</div>
                <div className="mt-1 flex gap-1">{s !== 'entregue' && <button className="btn-primary px-2 py-0.5 text-xs" onClick={() => advance(o)}>Avançar</button>}{s !== 'entregue' && <button className="btn-ghost px-2 py-0.5 text-xs" onClick={() => update('orders', o.id, { status: 'cancelado' })}>Cancelar</button>}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Page>
  )
}

const mins = (a?: string, b?: string) => {
  if (!a || !b) return null
  const t = (s: string) => new Date(s.replace(' ', 'T')).getTime()
  const d = (t(b) - t(a)) / 60000
  return Number.isFinite(d) && d >= 0 ? d : null
}
export function TempoPreparo() {
  const data = useData()
  const rows = data.orders.map((o) => ({ ...o, wait: mins(o.createdAt, o.startedAt), prep: mins(o.startedAt, o.readyAt) })).filter((o) => o.prep != null || o.wait != null)
  const prepVals = rows.map((r) => r.prep).filter((x): x is number => x != null)
  const avg = prepVals.length ? prepVals.reduce((a, b) => a + b, 0) / prepVals.length : null
  const sorted = [...prepVals].sort((a, b) => a - b)
  return (
    <Page>
      <Notice>Tempo de preparo = "pronto em" - "início do preparo". Só são usados pedidos com os dois horários registrados (na Central de Pedidos ou por importação). Nenhum tempo é presumido.</Notice>
      <Grid cols={4}>
        <Kpi label="Pedidos com tempos" value={rows.length} sub={`de ${data.orders.length} pedidos`} />
        <Kpi label="Preparo médio" value={avg != null ? `${num(avg, 1)} min` : 'n/d'} />
        <Kpi label="Mediana" value={sorted.length ? `${num(sorted[Math.floor(sorted.length / 2)], 1)} min` : 'n/d'} />
        <Kpi label="Espera média até iniciar" value={(() => { const w = rows.map((r) => r.wait).filter((x): x is number => x != null); return w.length ? `${num(w.reduce((a, b) => a + b, 0) / w.length, 1)} min` : 'n/d' })()} />
      </Grid>
      <DataTable rows={rows} filename="tempo-preparo" empty={<Empty action={{ to: '/pedidos', label: 'Ir para Central de Pedidos' }}>Nenhum pedido com início e fim de preparo registrados.</Empty>} cols={[
        { key: 'code', label: 'Pedido' }, { key: 'createdAt', label: 'Recebido' }, { key: 'startedAt', label: 'Início' }, { key: 'readyAt', label: 'Pronto' },
        { key: 'wait', label: 'Espera (min)', align: 'right', render: (r) => (r.wait != null ? num(r.wait, 1) : '-') }, { key: 'prep', label: 'Preparo (min)', align: 'right', render: (r) => (r.prep != null ? num(r.prep, 1) : '-') },
      ]} />
    </Page>
  )
}
