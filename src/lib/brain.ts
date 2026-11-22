// RestauBrain: respostas determinísticas, sempre baseadas nos registros, com fontes.
import type { Data, Settings } from '../data/store'
import { computeAlerts } from './alerts'
import {
  defaultPeriod, expenseAnomalies, groupSum, money, norm, pct, previousPeriod, productProfit,
  productRanking, salesSummary, stockPosition, byWeekday, operatingResult, inPeriod,
} from './calc'

export interface Answer { text: string; bullets: string[]; sources: string[] }

const has = (q: string, ...w: string[]) => w.some((x) => q.includes(x))

export const SUGGESTED = [
  'Quais pratos possuem menor margem?',
  'Quais despesas aumentaram?',
  'Como foram as vendas neste mês?',
  'Qual produto está com estoque baixo?',
  'Quais unidades precisam de atenção?',
  'Quais são os produtos mais vendidos?',
  'Qual o melhor dia da semana?',
  'Qual o resultado operacional?',
]

export function ask(question: string, data: Data, settings: Settings): Answer {
  const q = norm(question)
  const p = defaultPeriod(data)
  const per = `${p.from} a ${p.to}`
  if (!Object.values(data).some((v) => v.length))
    return { text: 'Ainda não há dados registrados. Importe planilhas em Importação Inteligente ou carregue a demonstração.', bullets: [], sources: [] }

  if (has(q, 'margem', 'lucro por prato', 'menos lucr')) {
    const pp = productProfit(data, p).filter((r) => r.marginPct != null && r.qty > 0).sort((a, b) => a.marginPct! - b.marginPct!)
    const missing = productProfit(data, p).filter((r) => r.qty > 0 && !r.hasRecipe).length
    if (!pp.length) return { text: 'Não consigo calcular margens: nenhum produto vendido tem ficha técnica com custos.', bullets: [], sources: ['Fichas técnicas', 'Vendas'] }
    return { text: `Pratos com menor margem no período ${per}:`, bullets: [...pp.slice(0, 5).map((r) => `${r.product}: margem ${pct(r.marginPct)} (custo ${money(r.unitCost!)} x preço ${money(r.price || 0)})`),
      ...(missing ? [`${missing} produto(s) vendidos sem ficha técnica não entraram nesta análise.`] : [])],
      sources: ['Vendas (preço praticado)', 'Fichas técnicas', 'Custos de ingredientes'] }
  }
  if (has(q, 'despesa', 'gasto', 'custo fixo')) {
    const an = expenseAnomalies(data, 1.5)
    const cur = groupSum(data.expenses.filter((e) => inPeriod(e.date, p)), (e) => e.category || 'outros', (e) => Number(e.amount))
    const prev = groupSum(data.expenses.filter((e) => inPeriod(e.date, previousPeriod(p))), (e) => e.category || 'outros', (e) => Number(e.amount))
    const diffs = [...cur.entries()].map(([c, v]) => ({ c, v, d: v - (prev.get(c) || 0) })).filter((x) => x.d > 0).sort((a, b) => b.d - a.d)
    return { text: diffs.length ? `Categorias de despesa que aumentaram (${per} contra os 30 dias anteriores):` : 'Nenhuma categoria de despesa aumentou no período.',
      bullets: [...diffs.slice(0, 6).map((x) => `${x.c}: ${money(x.v)} (+${money(x.d)})`), ...an.map((a) => `Estatisticamente incomum: ${a.kind}. ${a.evidence}`)],
      sources: ['Despesas registradas'] }
  }
  if (has(q, 'estoque', 'acabando', 'repor', 'faltando')) {
    const low = stockPosition(data).filter((s) => s.minStock != null && s.current <= s.minStock)
    const noMin = stockPosition(data).filter((s) => s.minStock == null).length
    return { text: low.length ? 'Itens no estoque mínimo ou abaixo (estoque teórico):' : 'Nenhum item abaixo do mínimo configurado.',
      bullets: [...low.map((s) => `${s.ingredient}: ${s.current.toFixed(2)} ${s.measure} (mínimo ${s.minStock}). ${s.lastCount ? `Contado em ${s.lastCount.date}.` : 'Sem contagem física.'}`),
        ...(noMin ? [`${noMin} ingrediente(s) sem estoque mínimo configurado.`] : [])],
      sources: ['Contagens físicas', 'Movimentações', 'Compras', 'Vendas x fichas técnicas'] }
  }
  if (has(q, 'unidade', 'loja', 'filial')) {
    const units = data.units.map((u) => u.code || u.name)
    if (units.length < 2) return { text: 'Há menos de duas unidades cadastradas; não há comparação possível.', bullets: [], sources: ['Unidades'] }
    const rows = units.map((u) => {
      const d = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.filter((r: any) => !r.unit || r.unit === u)])) as Data
      const c = salesSummary(d, p).revenue, o = salesSummary(d, previousPeriod(p)).revenue
      return { u, c, var: o ? ((c - o) / o) * 100 : null, alerts: computeAlerts(d, settings).filter((a) => a.severity === 'alta').length }
    }).sort((a, b) => (a.var ?? 0) - (b.var ?? 0))
    return { text: 'Unidades ordenadas da pior para a melhor variação de faturamento:', bullets: rows.map((r) => `${r.u}: ${money(r.c)} (${r.var == null ? 'sem base' : pct(r.var)}), ${r.alerts} alerta(s) de prioridade alta`), sources: ['Vendas por unidade', 'Central de alertas'] }
  }
  if (has(q, 'mais vendid', 'top', 'campe')) {
    const r = productRanking(data, p).sort((a, b) => b.qty - a.qty).slice(0, 5)
    return { text: `Mais vendidos em ${per}:`, bullets: r.map((x) => `${x.product}: ${x.qty} un, ${money(x.revenue)} (${pct(x.share)})`), sources: ['Vendas'] }
  }
  if (has(q, 'dia da semana', 'melhor dia', 'movimentad')) {
    const w = byWeekday(data, p).filter((x) => x.days).sort((a, b) => b.avg - a.avg)
    return { text: 'Média de faturamento por dia da semana:', bullets: w.map((x) => `${x.name}: ${money(x.avg)} (${x.days} dia(s))`), sources: ['Vendas'] }
  }
  if (has(q, 'resultado', 'lucro', 'sobrou')) {
    const r = operatingResult(data, p)
    return { text: `Resultado operacional estimado em ${per}: ${money(r.result)}`, bullets: [`Faturamento ${money(r.revenue)}`, `CMV ${money(r.cmv)} (cobre ${pct(r.cmvCoverage)} da receita)`, `Despesas ${money(r.expenses)}`, `Pessoal ${money(r.payroll)}`, `Taxas ${money(r.fees)}`],
      sources: ['Vendas', 'Fichas técnicas', 'Despesas', 'Custos de pessoal', 'Taxas por canal'] }
  }
  if (has(q, 'venda', 'faturamento', 'faturei', 'mes', 'semana')) {
    const c = salesSummary(data, p), o = salesSummary(data, previousPeriod(p))
    const v = o.revenue ? ((c.revenue - o.revenue) / o.revenue) * 100 : null
    return { text: `Vendas de ${per}: ${money(c.revenue)}${v != null ? ` (${pct(v)} contra os 30 dias anteriores)` : ''}.`,
      bullets: [`Itens vendidos: ${c.items}`, `Pedidos: ${c.orders ?? 'sem número de pedido nos dados'}`, `Ticket médio: ${c.ticket != null ? money(c.ticket) : 'n/d'}`, `Descontos: ${money(c.discounts)}`, `Itens cancelados/devolvidos: ${c.cancelled}`],
      sources: ['Vendas concluídas (canceladas e devolvidas excluídas)'] }
  }
  if (has(q, 'alerta', 'atencao', 'problema')) {
    const a = computeAlerts(data, settings)
    return { text: `${a.length} alerta(s) ativos.`, bullets: a.slice(0, 8).map((x) => `[${x.severity}] ${x.title}`), sources: ['Central de alertas'] }
  }
  return { text: 'Não encontrei uma análise para essa pergunta. Tente uma das sugestões. O RestauBrain responde com cálculos sobre os seus dados; a IA generativa é opcional e não está ativa.', bullets: SUGGESTED, sources: [] }
}
