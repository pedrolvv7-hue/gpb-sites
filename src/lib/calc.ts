// Serviço único de cálculos. Todas as abas usam estas funções para que um mesmo
// indicador nunca seja calculado de formas diferentes em lugares diferentes.
import Decimal from 'decimal.js'
import type { Data, Rec } from '../data/store'

export const D = (v: any) => new Decimal(Number.isFinite(Number(v)) ? Number(v) : 0)
export const money = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const pct = (v: number | null | undefined, digits = 1) =>
  v == null || !Number.isFinite(v) ? 'n/d' : `${v.toFixed(digits).replace('.', ',')}%`
export const num = (v: number, d = 0) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { maximumFractionDigits: d })
export const norm = (s: any) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

export const today = () => new Date().toISOString().slice(0, 10)
export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const weekday = (iso: string) => new Date(iso + 'T12:00:00').getDay()

// ---------------------------------------------------------------- Unidades de medida
const BASE: Record<string, [string, number]> = { kg: ['g', 1000], g: ['g', 1], l: ['ml', 1000], ml: ['ml', 1], un: ['un', 1] }
/** Converte quantidade de uma unidade para outra. Retorna null se incompatível. */
export function convert(qty: number, from: string, to: string): number | null {
  const a = BASE[norm(from)], b = BASE[norm(to)]
  if (!a || !b || a[0] !== b[0]) return null
  return D(qty).mul(a[1]).div(b[1]).toNumber()
}

// ---------------------------------------------------------------- Período
export interface Period { from: string; to: string }
export const inPeriod = (date: string, p?: Period) => !p || (date >= p.from && date <= p.to)
export function previousPeriod(p: Period): Period {
  const len = daysBetween(p.from, p.to) + 1
  return { from: addDays(p.from, -len), to: addDays(p.from, -1) }
}
export function defaultPeriod(data: Data): Period {
  const dates = data.sales.map((s) => s.date).filter(Boolean).sort()
  const to = dates[dates.length - 1] || today()
  return { from: addDays(to, -29), to }
}

// ---------------------------------------------------------------- Vendas
export const isValidSale = (s: Rec) => !s.status || s.status === 'concluida'
export const lineRevenue = (s: Rec) => D(s.qty).mul(D(s.unitPrice)).minus(D(s.discount)).toNumber()
export const validSales = (data: Data, p?: Period) => data.sales.filter((s) => isValidSale(s) && inPeriod(s.date, p))

export interface SalesSummary {
  revenue: number
  grossRevenue: number
  discounts: number
  items: number
  orders: number | null // null = sem identificador de pedido (não é possível calcular)
  ticket: number | null
  lines: number
  cancelled: number
}
export function salesSummary(data: Data, p?: Period): SalesSummary {
  const v = validSales(data, p)
  let revenue = D(0), gross = D(0), disc = D(0), items = 0
  for (const s of v) {
    revenue = revenue.plus(lineRevenue(s))
    gross = gross.plus(D(s.qty).mul(D(s.unitPrice)))
    disc = disc.plus(D(s.discount))
    items += Number(s.qty) || 0
  }
  const withId = v.filter((s) => s.orderId)
  const orders = withId.length ? new Set(withId.map((s) => s.orderId)).size : null
  const cancelled = data.sales.filter((s) => s.status && s.status !== 'concluida' && inPeriod(s.date, p)).length
  return {
    revenue: revenue.toNumber(),
    grossRevenue: gross.toNumber(),
    discounts: disc.toNumber(),
    items,
    orders,
    ticket: orders ? revenue.div(orders).toNumber() : null,
    lines: v.length,
    cancelled,
  }
}

export function groupSum<T>(rows: T[], key: (r: T) => string, val: (r: T) => number) {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), D(m.get(key(r)) || 0).plus(val(r)).toNumber())
  return m
}

export function dailyRevenue(data: Data, p?: Period) {
  const m = groupSum(validSales(data, p), (s) => s.date, lineRevenue)
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }))
}

export function revenueBy(data: Data, gran: 'dia' | 'semana' | 'mes' | 'ano', p?: Period) {
  const key = (d: string) => {
    if (gran === 'dia') return d
    if (gran === 'mes') return d.slice(0, 7)
    if (gran === 'ano') return d.slice(0, 4)
    const dt = new Date(d + 'T12:00:00')
    dt.setDate(dt.getDate() - dt.getDay())
    return dt.toISOString().slice(0, 10)
  }
  const m = groupSum(validSales(data, p), (s) => key(s.date), lineRevenue)
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, revenue]) => ({ k, revenue }))
}

export function productRanking(data: Data, p?: Period) {
  const v = validSales(data, p)
  const total = v.reduce((a, s) => a + lineRevenue(s), 0)
  const m = new Map<string, { product: string; qty: number; revenue: number; lastSale: string }>()
  for (const s of v) {
    const k = norm(s.product)
    const cur = m.get(k) || { product: s.product, qty: 0, revenue: 0, lastSale: '' }
    cur.qty += Number(s.qty) || 0
    cur.revenue = D(cur.revenue).plus(lineRevenue(s)).toNumber()
    if (s.date > cur.lastSale) cur.lastSale = s.date
    m.set(k, cur)
  }
  // inclui produtos cadastrados sem venda no período
  for (const pr of data.products) if (!m.has(norm(pr.name))) m.set(norm(pr.name), { product: pr.name, qty: 0, revenue: 0, lastSale: '' })
  return [...m.values()].map((r) => ({ ...r, share: total ? (r.revenue / total) * 100 : 0 }))
}

export function hourly(data: Data, p?: Period) {
  const v = validSales(data, p).filter((s) => /^\d{1,2}:/.test(String(s.time || '')))
  const m = groupSum(v, (s) => String(s.time).split(':')[0].padStart(2, '0'), lineRevenue)
  const orders = new Map<string, Set<string>>()
  for (const s of v) {
    const h = String(s.time).split(':')[0].padStart(2, '0')
    if (!orders.has(h)) orders.set(h, new Set())
    orders.get(h)!.add(s.orderId || s.id)
  }
  return { coverage: validSales(data, p).length ? v.length / validSales(data, p).length : 0,
    rows: [...m.entries()].sort().map(([hour, revenue]) => ({ hour: `${hour}h`, revenue, orders: orders.get(hour)?.size || 0 })) }
}

export function byWeekday(data: Data, p?: Period) {
  const daily = dailyRevenue(data, p)
  return WEEKDAYS.map((name, i) => {
    const ds = daily.filter((d) => weekday(d.date) === i)
    const total = ds.reduce((a, d) => a + d.revenue, 0)
    return { name, total, days: ds.length, avg: ds.length ? total / ds.length : 0 }
  })
}

export function byChannel(data: Data, p?: Period) {
  const v = validSales(data, p)
  const chans = [...new Set(v.map((s) => s.channel || 'nao_informado'))]
  return chans.map((c) => {
    const rows = v.filter((s) => (s.channel || 'nao_informado') === c)
    const revenue = rows.reduce((a, s) => a + lineRevenue(s), 0)
    const ids = rows.filter((s) => s.orderId)
    const orders = ids.length ? new Set(ids.map((s) => s.orderId)).size : null
    const discounts = rows.reduce((a, s) => a + (Number(s.discount) || 0), 0)
    return { channel: c, revenue, orders, ticket: orders ? revenue / orders : null, discounts }
  })
}

// ---------------------------------------------------------------- Fichas técnicas e custos
export interface RecipeCost {
  product: string
  items: { ingredient: string; qty: number; measure: string; unitCost: number | null; cost: number | null; problem?: string }[]
  totalCost: number
  yield: number
  lossPct: number
  costPerPortion: number
  complete: boolean
}
export function recipeCosts(data: Data): Map<string, RecipeCost> {
  const ing = new Map(data.ingredients.map((i) => [norm(i.name), i]))
  const out = new Map<string, RecipeCost>()
  for (const r of data.recipes) {
    const k = norm(r.product)
    const rc: RecipeCost = out.get(k) || { product: r.product, items: [], totalCost: 0, yield: 1, lossPct: 0, costPerPortion: 0, complete: true }
    if (Number(r.yield) > 0) rc.yield = Number(r.yield)
    if (Number(r.lossPct) > 0) rc.lossPct = Number(r.lossPct)
    const i = ing.get(norm(r.ingredient))
    let cost: number | null = null, problem: string | undefined
    if (!i) problem = 'Ingrediente não cadastrado'
    else {
      const q = convert(Number(r.qty), r.measure, i.measure)
      if (q == null) problem = `Unidade incompatível (${r.measure} x ${i.measure})`
      else cost = D(q).mul(D(i.cost)).toNumber()
    }
    if (cost == null) rc.complete = false
    rc.items.push({ ingredient: r.ingredient, qty: Number(r.qty), measure: r.measure, unitCost: i ? Number(i.cost) : null, cost, problem })
    out.set(k, rc)
  }
  for (const rc of out.values()) {
    rc.totalCost = rc.items.reduce((a, it) => D(a).plus(it.cost || 0).toNumber(), 0)
    // perda de preparo aumenta o custo efetivo de cada porção
    rc.costPerPortion = D(rc.totalCost).div(rc.yield || 1).div(D(1).minus(D(rc.lossPct).div(100))).toNumber()
  }
  return out
}

export interface ProductProfit {
  product: string; price: number | null; unitCost: number | null; qty: number; revenue: number
  cmv: number | null; contribution: number | null; marginPct: number | null; hasRecipe: boolean; recipeComplete: boolean
}
export function productProfit(data: Data, p?: Period): ProductProfit[] {
  const rc = recipeCosts(data)
  const prodPrice = new Map(data.products.map((x) => [norm(x.name), Number(x.price)]))
  return productRanking(data, p).map((r) => {
    const c = rc.get(norm(r.product))
    const unitCost = c ? c.costPerPortion : null
    const cmv = unitCost != null ? D(unitCost).mul(r.qty).toNumber() : null
    const contribution = cmv != null ? r.revenue - cmv : null
    const price = prodPrice.get(norm(r.product)) ?? (r.qty ? r.revenue / r.qty : null)
    const marginPct = unitCost != null && price ? ((price - unitCost) / price) * 100 : null
    return { product: r.product, price, unitCost, qty: r.qty, revenue: r.revenue, cmv, contribution, marginPct, hasRecipe: !!c, recipeComplete: !!c?.complete }
  })
}

export interface Margin { revenue: number; cmv: number; gross: number; grossPct: number | null; coveragePct: number; uncoveredRevenue: number }
/** Margem bruta = receita líquida - CMV. Considera apenas o CMV dos produtos com ficha técnica e informa a cobertura. */
export function grossMargin(data: Data, p?: Period): Margin {
  const pp = productProfit(data, p)
  const revenue = pp.reduce((a, r) => a + r.revenue, 0)
  const covered = pp.filter((r) => r.cmv != null)
  const covRev = covered.reduce((a, r) => a + r.revenue, 0)
  const cmv = covered.reduce((a, r) => a + (r.cmv || 0), 0)
  return {
    revenue, cmv, gross: covRev - cmv, grossPct: covRev ? ((covRev - cmv) / covRev) * 100 : null,
    coveragePct: revenue ? (covRev / revenue) * 100 : 0, uncoveredRevenue: revenue - covRev,
  }
}

export function expensesTotal(data: Data, p?: Period) {
  return data.expenses.filter((e) => inPeriod(e.date, p)).reduce((a, e) => D(a).plus(D(e.amount)).toNumber(), 0)
}
export function payrollTotal(data: Data, p?: Period) {
  return data.payroll.filter((r) => !p || (r.month >= p.from.slice(0, 7) && r.month <= p.to.slice(0, 7))).reduce((a, r) => a + Number(r.amount || 0), 0)
}
export function feesTotal(data: Data, p?: Period) {
  return channelFees(data, p).reduce((a, r) => a + r.fees, 0)
}

export function operatingResult(data: Data, p?: Period) {
  const s = salesSummary(data, p)
  const m = grossMargin(data, p)
  const expenses = expensesTotal(data, p)
  const payroll = payrollTotal(data, p)
  const fees = feesTotal(data, p)
  return {
    revenue: s.revenue, cmv: m.cmv, gross: s.revenue - m.cmv, expenses, payroll, fees,
    result: s.revenue - m.cmv - expenses - payroll - fees, cmvCoverage: m.coveragePct,
  }
}

// ---------------------------------------------------------------- Taxas
export function channelFees(data: Data, p?: Period) {
  const fees = new Map(data.fees.map((f) => [norm(f.channel), f]))
  return byChannel(data, p).map((c) => {
    const f = fees.get(norm(c.channel))
    if (!f) return { ...c, feePct: null as number | null, fees: 0, net: c.revenue, configured: false }
    const fee = D(c.revenue).mul(D(f.feePct).div(100)).plus(D(f.fixedFee).mul(c.orders || 0)).toNumber()
    return { ...c, feePct: Number(f.feePct), fees: fee, net: c.revenue - fee, configured: true }
  })
}

// ---------------------------------------------------------------- Estoque
export function theoreticalConsumption(data: Data, p?: Period) {
  // consumo = pratos vendidos (concluídos) x ficha técnica, na unidade de medida do ingrediente
  const ing = new Map(data.ingredients.map((i) => [norm(i.name), i]))
  const sold = groupSum(validSales(data, p), (s) => norm(s.product), (s) => Number(s.qty) || 0)
  const out = new Map<string, number>()
  for (const r of data.recipes) {
    const q = sold.get(norm(r.product))
    if (!q) continue
    const i = ing.get(norm(r.ingredient))
    if (!i) continue
    const per = convert(Number(r.qty), r.measure, i.measure)
    if (per == null) continue
    const yieldN = Number(data.recipes.find((x) => norm(x.product) === norm(r.product) && Number(x.yield) > 0)?.yield) || 1
    out.set(norm(i.name), D(out.get(norm(i.name)) || 0).plus(D(per).mul(q).div(yieldN)).toNumber())
  }
  return out
}

export interface StockRow {
  ingredient: string; measure: string; entries: number; exits: number; losses: number; adjustments: number
  consumption: number; theoretical: number; lastCount: { date: string; qty: number; by: string } | null
  current: number; minStock: number | null; cost: number; value: number
}
/** Estoque teórico: parte da última contagem física (se houver) e aplica movimentos e consumo posteriores. */
export function stockPosition(data: Data): StockRow[] {
  return data.ingredients.map((i) => {
    const k = norm(i.name)
    const counts = data.counts.filter((c) => norm(c.ingredient) === k).sort((a, b) => a.date.localeCompare(b.date))
    const last = counts[counts.length - 1]
    const after = (d: string) => !last || d > last.date
    const moves = data.stockMoves.filter((m) => norm(m.ingredient) === k && after(m.date))
    const sum = (t: string) => moves.filter((m) => m.type === t).reduce((a, m) => a + Number(m.qty || 0), 0)
    const purchases = data.purchases.filter((pu) => norm(pu.ingredient) === k && after(pu.date)).reduce((a, x) => a + Number(x.qty || 0), 0)
    const salesAfter: Data = { ...data, sales: data.sales.filter((s) => after(s.date)) }
    const consumption = theoreticalConsumption(salesAfter).get(k) || 0
    const entries = sum('entrada') + purchases
    const exits = sum('saida'), losses = sum('perda'), adjustments = sum('ajuste')
    const base = last ? Number(last.qty) : 0
    const theoretical = D(base).plus(entries).minus(exits).minus(losses).plus(adjustments).minus(consumption).toNumber()
    return {
      ingredient: i.name, measure: i.measure, entries, exits, losses, adjustments, consumption, theoretical,
      lastCount: last ? { date: last.date, qty: Number(last.qty), by: last.countedBy } : null,
      current: theoretical, minStock: i.minStock != null && i.minStock !== '' ? Number(i.minStock) : null,
      cost: Number(i.cost) || 0, value: Math.max(0, theoretical) * (Number(i.cost) || 0),
    }
  })
}

export function avgDailyConsumption(data: Data, days = 30) {
  const end = defaultPeriod(data).to
  const p = { from: addDays(end, -(days - 1)), to: end }
  const c = theoreticalConsumption(data, p)
  return new Map([...c.entries()].map(([k, v]) => [k, v / days]))
}

export function replenishment(data: Data) {
  const avg = avgDailyConsumption(data)
  const openPO = data.purchaseOrders.filter((po) => po.status === 'aprovado' || po.status === 'enviado' || po.status === 'rascunho')
  return stockPosition(data).map((s) => {
    const k = norm(s.ingredient)
    const ing = data.ingredients.find((i) => norm(i.name) === k)!
    const daily = avg.get(k) || 0
    const lead = Number(ing.leadDays) || 2
    const onOrder = openPO.filter((po) => norm(po.ingredient) === k).reduce((a, po) => a + Number(po.qty || 0), 0)
    const daysLeft = daily > 0 ? s.current / daily : null
    const target = (s.minStock || 0) + daily * (lead + 7)
    const suggested = Math.max(0, Math.ceil((target - s.current - onOrder) * 100) / 100)
    return { ...s, daily, lead, onOrder, daysLeft, suggested, supplier: ing.supplier || '' }
  })
}

// ---------------------------------------------------------------- Estatística
export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
export const stdev = (a: number[]) => {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1))
}

export interface Anomaly { id: string; kind: string; date: string; value: number; expected: number; z: number; evidence: string }
/** Compara cada dia com os mesmos dias da semana anteriores (z-score). Exige ao menos 3 referências. */
export function revenueAnomalies(data: Data, zLimit = 2): Anomaly[] {
  const daily = dailyRevenue(data)
  const out: Anomaly[] = []
  daily.forEach((d, idx) => {
    const ref = daily.slice(0, idx).filter((x) => weekday(x.date) === weekday(d.date)).slice(-8).map((x) => x.revenue)
    if (ref.length < 3) return
    const m = mean(ref), sd = stdev(ref)
    if (!sd) return
    const z = (d.revenue - m) / sd
    if (Math.abs(z) >= zLimit)
      out.push({ id: `rev-${d.date}`, kind: z < 0 ? 'Faturamento abaixo do padrão' : 'Faturamento acima do padrão', date: d.date, value: d.revenue, expected: m, z,
        evidence: `Comparado com ${ref.length} ${WEEKDAYS[weekday(d.date)].toLowerCase()}s anteriores (média ${money(m)}, desvio ${money(sd)}).` })
  })
  return out
}
export function expenseAnomalies(data: Data, zLimit = 2): Anomaly[] {
  const cats = [...new Set(data.expenses.map((e) => e.category || 'outros'))]
  const out: Anomaly[] = []
  for (const c of cats) {
    const months = groupSum(data.expenses.filter((e) => (e.category || 'outros') === c), (e) => e.date.slice(0, 7), (e) => Number(e.amount) || 0)
    const arr = [...months.entries()].sort()
    if (arr.length < 4) continue
    const [lastM, lastV] = arr[arr.length - 1]
    const ref = arr.slice(0, -1).map(([, v]) => v)
    const m = mean(ref), sd = stdev(ref)
    if (!sd) continue
    const z = (lastV - m) / sd
    if (z >= zLimit)
      out.push({ id: `exp-${c}-${lastM}`, kind: `Despesa "${c}" incomum`, date: lastM, value: lastV, expected: m, z,
        evidence: `Média dos ${ref.length} meses anteriores: ${money(m)}. Mês ${lastM}: ${money(lastV)}.` })
  }
  return out
}

/** Previsão: tendência linear + fator de dia da semana, com intervalo de ±1,96 desvios dos resíduos. */
export function forecast(data: Data, horizon = 14) {
  const daily = dailyRevenue(data)
  if (daily.length < 14) return { ok: false as const, reason: `São necessários pelo menos 14 dias com vendas (há ${daily.length}).`, rows: [] }
  const xs = daily.map((_, i) => i), ys = daily.map((d) => d.revenue)
  const mx = mean(xs), my = mean(ys)
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  const icpt = my - slope * mx
  const factor = WEEKDAYS.map((_, w) => {
    const r = daily.map((d, i) => ({ d, i })).filter(({ d }) => weekday(d.date) === w).map(({ d, i }) => d.revenue / Math.max(1, icpt + slope * i))
    return r.length ? mean(r) : 1
  })
  const fitted = daily.map((d, i) => (icpt + slope * i) * factor[weekday(d.date)])
  const sd = stdev(ys.map((y, i) => y - fitted[i]))
  const last = daily[daily.length - 1].date
  const rows = Array.from({ length: horizon }, (_, h) => {
    const date = addDays(last, h + 1)
    const v = Math.max(0, (icpt + slope * (daily.length + h)) * factor[weekday(date)])
    return { date, forecast: v, low: Math.max(0, v - 1.96 * sd), high: v + 1.96 * sd }
  })
  return { ok: true as const, reason: '', rows, history: daily, slope }
}

/** Engenharia de cardápio (matriz popularidade x margem de contribuição). */
export function menuEngineering(data: Data, p?: Period) {
  const pp = productProfit(data, p).filter((r) => r.qty > 0 && r.unitCost != null && r.price)
  if (!pp.length) return []
  const totalQty = pp.reduce((a, r) => a + r.qty, 0)
  const popThreshold = (1 / pp.length) * 0.7 * 100
  const avgCM = pp.reduce((a, r) => a + (r.price! - r.unitCost!) * r.qty, 0) / totalQty
  return pp.map((r) => {
    const mix = (r.qty / totalQty) * 100
    const cm = r.price! - r.unitCost!
    const popular = mix >= popThreshold, profitable = cm >= avgCM
    const cls = popular && profitable ? 'Estrela' : popular ? 'Burro de carga' : profitable ? 'Quebra-cabeça' : 'Cão'
    return { ...r, mix, cm, cls, popThreshold, avgCM }
  })
}

// ---------------------------------------------------------------- Qualidade dos dados
export function dataFreshness(data: Data) {
  const last = (rows: Rec[], key: string) => rows.map((r) => r[key]).filter(Boolean).sort().pop() || null
  return [
    { area: 'Vendas', last: last(data.sales, 'date') },
    { area: 'Despesas', last: last(data.expenses, 'date') },
    { area: 'Compras', last: last(data.purchases, 'date') },
    { area: 'Contagem de estoque', last: last(data.counts, 'date') },
    { area: 'Extrato bancário', last: last(data.bankStatement, 'date') },
  ]
}

export function healthScore(data: Data, minMargin = 55) {
  const end = defaultPeriod(data)
  const prev = previousPeriod(end)
  const cur = salesSummary(data, end), old = salesSummary(data, prev)
  const comps: { name: string; score: number | null; weight: number; why: string }[] = []
  const growth = old.revenue ? ((cur.revenue - old.revenue) / old.revenue) * 100 : null
  comps.push({ name: 'Evolução das vendas', weight: 25, score: growth == null ? null : Math.max(0, Math.min(100, 50 + growth * 2.5)),
    why: growth == null ? 'Sem período anterior para comparar.' : `Variação de ${pct(growth)} contra os 30 dias anteriores.` })
  const gm = grossMargin(data, end)
  comps.push({ name: 'Margem bruta', weight: 25, score: gm.grossPct == null ? null : Math.max(0, Math.min(100, (gm.grossPct / minMargin) * 80)),
    why: gm.grossPct == null ? 'Sem fichas técnicas para calcular CMV.' : `Margem de ${pct(gm.grossPct)} (meta configurada ${minMargin}%), cobrindo ${pct(gm.coveragePct)} da receita.` })
  const exp = expensesTotal(data, end)
  comps.push({ name: 'Peso das despesas', weight: 15, score: cur.revenue ? Math.max(0, Math.min(100, 100 - (exp / cur.revenue) * 150)) : null,
    why: cur.revenue ? `Despesas equivalem a ${pct((exp / cur.revenue) * 100)} do faturamento.` : 'Sem faturamento no período.' })
  const st = stockPosition(data)
  const withMin = st.filter((s) => s.minStock != null)
  comps.push({ name: 'Estoque acima do mínimo', weight: 10, score: withMin.length ? (withMin.filter((s) => s.current > s.minStock!).length / withMin.length) * 100 : null,
    why: withMin.length ? `${withMin.filter((s) => s.current <= s.minStock!).length} de ${withMin.length} itens no mínimo ou abaixo.` : 'Nenhum estoque mínimo configurado.' })
  const due = data.payables.filter((x) => x.dueDate <= today())
  comps.push({ name: 'Pontualidade de pagamentos', weight: 10, score: due.length ? (due.filter((x) => x.paidDate && x.paidDate <= x.dueDate).length / due.length) * 100 : null,
    why: due.length ? `${due.filter((x) => !x.paidDate).length} conta(s) vencida(s) sem pagamento.` : 'Nenhuma conta vencida registrada.' })
  const fr = dataFreshness(data).filter((f) => f.last)
  comps.push({ name: 'Qualidade e atualização dos dados', weight: 15, score: fr.length ? (fr.filter((f) => daysBetween(f.last!, today()) <= 7).length / fr.length) * 100 : 0,
    why: `${fr.length} de 5 fontes com dados; ${fr.filter((f) => daysBetween(f.last!, today()) <= 7).length} atualizadas nos últimos 7 dias.` })
  const valid = comps.filter((c) => c.score != null)
  const w = valid.reduce((a, c) => a + c.weight, 0)
  const total = w ? valid.reduce((a, c) => a + c.score! * c.weight, 0) / w : null
  return { total, comps }
}

export function sumBy<T>(rows: T[], f: (r: T) => number) {
  return rows.reduce((a, r) => D(a).plus(f(r) || 0).toNumber(), 0)
}
