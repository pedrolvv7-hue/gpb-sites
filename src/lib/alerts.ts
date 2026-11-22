// Motor de alertas: derivado exclusivamente dos dados registrados.
import type { Data, Settings } from '../data/store'
import {
  addDays, dataFreshness, daysBetween, defaultPeriod, expenseAnomalies, money, previousPeriod,
  productProfit, salesSummary, stockPosition, today, pct,
} from './calc'

export type Severity = 'alta' | 'media' | 'baixa'
export interface Alert { id: string; type: string; severity: Severity; title: string; detail: string; route: string; date: string }

export function computeAlerts(data: Data, s: Settings): Alert[] {
  const out: Alert[] = []
  const t = s.thresholds
  const now = today()

  // Queda de vendas: últimos 7 dias com dados x 7 anteriores
  if (data.sales.length) {
    const end = defaultPeriod(data).to
    const cur = { from: addDays(end, -6), to: end }
    const a = salesSummary(data, cur).revenue, b = salesSummary(data, previousPeriod(cur)).revenue
    if (b > 0 && ((b - a) / b) * 100 >= t.salesDropPct)
      out.push({ id: `drop-${end}`, type: 'Queda de vendas', severity: 'alta', route: '/faturamento', date: end,
        title: `Vendas caíram ${pct(((b - a) / b) * 100)} na última semana`, detail: `${money(a)} entre ${cur.from} e ${cur.to}, contra ${money(b)} na semana anterior.` })
  }
  for (const an of expenseAnomalies(data, t.expenseZ))
    out.push({ id: an.id, type: 'Despesa incomum', severity: 'media', route: '/despesas-categoria', date: an.date, title: an.kind, detail: an.evidence })

  for (const p of productProfit(data))
    if (p.marginPct != null && p.marginPct < t.minMarginPct && p.qty > 0)
      out.push({ id: `margin-${p.product}`, type: 'Margem reduzida', severity: 'media', route: '/lucro-prato', date: now,
        title: `${p.product}: margem de ${pct(p.marginPct)}`, detail: `Abaixo do limite configurado de ${t.minMarginPct}%. Custo por porção ${money(p.unitCost!)} e preço ${money(p.price || 0)}.` })

  for (const st of stockPosition(data))
    if (st.minStock != null && st.current <= st.minStock)
      out.push({ id: `stock-${st.ingredient}-${st.lastCount?.date || 'x'}`, type: 'Estoque mínimo', severity: st.current <= 0 ? 'alta' : 'media', route: '/estoque-minimo', date: now,
        title: `${st.ingredient} no estoque mínimo`, detail: `Estoque teórico ${st.current.toFixed(2)} ${st.measure}; mínimo ${st.minStock} ${st.measure}. ${st.lastCount ? `Última contagem física em ${st.lastCount.date}.` : 'Sem contagem física registrada: valor teórico.'}` })

  for (const l of data.lots) {
    const d = daysBetween(now, l.expiry)
    if (d <= t.expiryDays)
      out.push({ id: `exp-${l.id}`, type: 'Validade', severity: d < 0 ? 'alta' : 'media', route: '/validades', date: l.expiry,
        title: d < 0 ? `${l.ingredient} (lote ${l.lot || 's/n'}) vencido` : `${l.ingredient} vence em ${d} dia(s)`, detail: `Validade registrada: ${l.expiry}. Local: ${l.location || 'não informado'}.` })
  }
  for (const p of data.payables)
    if (!p.paidDate && p.dueDate < now)
      out.push({ id: `pay-${p.id}`, type: 'Conta vencida', severity: 'alta', route: '/contas-pagar', date: p.dueDate,
        title: `Conta vencida: ${p.description}`, detail: `${money(Number(p.amount))} venceu em ${p.dueDate}.` })
  for (const r of data.receivables)
    if (!r.receivedDate && r.dueDate < now)
      out.push({ id: `rec-${r.id}`, type: 'Recebível atrasado', severity: 'media', route: '/contas-receber', date: r.dueDate,
        title: `Recebimento atrasado: ${r.description}`, detail: `${money(Number(r.amount))} previsto para ${r.dueDate}.` })
  for (const o of data.orders)
    if (o.status === 'novo' || o.status === 'preparo')
      out.push({ id: `ord-${o.id}`, type: 'Pedido pendente', severity: 'baixa', route: '/pedidos', date: String(o.createdAt || '').slice(0, 10),
        title: `Pedido ${o.code} está "${o.status}"`, detail: `Cliente ${o.customer || 'não informado'}.` })
  for (const po of data.purchaseOrders)
    if (po.status === 'rascunho')
      out.push({ id: `po-${po.id}`, type: 'Aprovação pendente', severity: 'baixa', route: '/pedidos-compra', date: po.created,
        title: `Rascunho de pedido de compra: ${po.ingredient}`, detail: `${po.qty} unidade(s). Aguardando sua aprovação.` })
  for (const d of data.documents) {
    if (!d.expiry) continue
    const n = daysBetween(now, d.expiry)
    if (n <= t.docDays)
      out.push({ id: `doc-${d.id}`, type: 'Documento', severity: n < 0 ? 'alta' : 'media', route: '/documentos', date: d.expiry,
        title: n < 0 ? `${d.name} vencido` : `${d.name} vence em ${n} dia(s)`, detail: d.confirmed ? 'Data confirmada.' : 'Data ainda não confirmada por uma pessoa.' })
  }
  for (const e of data.equipment) {
    const last = [e.lastMaintenance, ...data.maintenance.filter((m) => m.equipment === e.name).map((m) => m.date)].filter(Boolean).sort().pop()
    if (!e.intervalDays || !last) continue
    const due = addDays(last, Number(e.intervalDays))
    if (due <= addDays(now, 7))
      out.push({ id: `eq-${e.id}-${due}`, type: 'Manutenção', severity: due < now ? 'alta' : 'baixa', route: '/manutencao', date: due,
        title: `Revisão de ${e.name} ${due < now ? 'atrasada' : 'próxima'}`, detail: `Última manutenção registrada: ${last}. Próxima: ${due}.` })
  }
  const anyData = Object.values(data).some((v) => v.length)
  if (anyData)
    for (const f of dataFreshness(data))
      if (f.last && daysBetween(f.last, now) > t.staleDays)
        out.push({ id: `stale-${f.area}-${f.last}`, type: 'Dados desatualizados', severity: 'baixa', route: '/importacao', date: f.last,
          title: `${f.area}: último registro em ${f.last}`, detail: `Há ${daysBetween(f.last, now)} dias sem dados novos. Importe o período mais recente.` })
  return out
}
