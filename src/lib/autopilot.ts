// AutoPilot: executa tarefas internas seguras e prepara (sem executar) ações com consequência financeira.
import { useStore } from '../data/store'
import { computeAlerts } from './alerts'
import { dataFreshness, daysBetween, forecast, grossMargin, recipeCosts, replenishment, salesSummary, today, money } from './calc'

export interface Task { id: string; name: string; kind: 'interno' | 'externo'; describe: string }

export const TASKS: Task[] = [
  { id: 'imports', name: 'Processar novas importações', kind: 'interno', describe: 'Verifica importações recentes e erros pendentes.' },
  { id: 'kpis', name: 'Atualizar indicadores', kind: 'interno', describe: 'Recalcula faturamento, pedidos e ticket médio.' },
  { id: 'margins', name: 'Recalcular margens', kind: 'interno', describe: 'Recalcula custo das receitas e margem bruta.' },
  { id: 'alerts', name: 'Detectar anomalias e gerar alertas', kind: 'interno', describe: 'Reavalia todas as regras de alerta.' },
  { id: 'shopping', name: 'Preparar lista de compras', kind: 'interno', describe: 'Calcula sugestões de reposição.' },
  { id: 'po', name: 'Preparar rascunhos de pedidos de compra', kind: 'externo', describe: 'Cria rascunhos que exigem sua aprovação. Nada é enviado ou pago.' },
  { id: 'expiry', name: 'Monitorar vencimentos registrados', kind: 'interno', describe: 'Lotes, documentos e contas.' },
  { id: 'forecast', name: 'Atualizar previsões', kind: 'interno', describe: 'Previsão de vendas dos próximos 14 dias.' },
  { id: 'missing', name: 'Identificar dados faltantes', kind: 'interno', describe: 'Fichas técnicas, custos e fontes desatualizadas.' },
]

export function runTask(id: string) {
  const st = useStore.getState()
  const { data, settings } = st
  const mode = settings.autopilotMode
  const log = (status: any, source: string, result: string, error?: string) =>
    st.logRun({ task: TASKS.find((t) => t.id === id)!.name, mode, status, source, result, error })
  try {
    switch (id) {
      case 'imports': {
        const recent = st.imports.filter((i) => !i.undone && daysBetween(i.at.slice(0, 10), today()) <= 7)
        const errs = recent.reduce((a, i) => a + i.errors, 0)
        return log(recent.length ? 'ok' : 'sem_dados', 'Histórico de importações', `${recent.length} importação(ões) nos últimos 7 dias; ${errs} linha(s) com erro.`)
      }
      case 'kpis': {
        if (!data.sales.length) return log('sem_dados', 'Vendas', 'Nenhuma venda registrada.')
        const s = salesSummary(data)
        return log('ok', 'Vendas', `Faturamento total ${money(s.revenue)}, ${s.orders ?? 'n/d'} pedidos, ticket ${s.ticket ? money(s.ticket) : 'n/d'}.`)
      }
      case 'margins': {
        const rc = recipeCosts(data)
        const gm = grossMargin(data)
        const inc = [...rc.values()].filter((r) => !r.complete).length
        return log(rc.size ? 'ok' : 'sem_dados', 'Fichas técnicas e ingredientes', `${rc.size} receita(s) recalculadas (${inc} incompletas). Margem bruta ${gm.grossPct?.toFixed(1) ?? 'n/d'}%.`)
      }
      case 'alerts': {
        const a = computeAlerts(data, settings).filter((x) => !st.resolvedAlerts[x.id])
        return log('ok', 'Todas as fontes', `${a.length} alerta(s) abertos (${a.filter((x) => x.severity === 'alta').length} prioridade alta).`)
      }
      case 'shopping': {
        const r = replenishment(data).filter((x) => x.suggested > 0)
        return log(data.ingredients.length ? 'ok' : 'sem_dados', 'Estoque, consumo e mínimos', `${r.length} item(ns) sugeridos para reposição.`)
      }
      case 'po': {
        if (mode === 'monitoramento') {
          const n = replenishment(data).filter((x) => x.suggested > 0).length
          return log('ok', 'Lista de compras', `Modo monitoramento: ${n} rascunho(s) seriam criados, mas nada foi gerado.`)
        }
        const existing = new Set(data.purchaseOrders.filter((p) => p.status === 'rascunho').map((p) => p.ingredient))
        const items = replenishment(data).filter((x) => x.suggested > 0 && !existing.has(x.ingredient))
        const prices = data.supplierPrices
        for (const it of items) {
          const best = prices.filter((p) => p.ingredient === it.ingredient).sort((a, b) => a.price - b.price)[0]
          st.add('purchaseOrders', {
            created: today(), supplier: best?.supplier || it.supplier, ingredient: it.ingredient, qty: it.suggested,
            estCost: +(it.suggested * (best?.price ?? it.cost)).toFixed(2), expectedDate: '', status: 'rascunho', origin: 'AutoPilot',
          })
        }
        return log(items.length ? 'aguardando_aprovacao' : 'ok', 'Lista de compras', `${items.length} rascunho(s) criados. Requer aprovação em Pedidos de Compra.`)
      }
      case 'expiry': {
        const a = computeAlerts(data, settings).filter((x) => ['Validade', 'Documento', 'Conta vencida'].includes(x.type))
        return log('ok', 'Lotes, documentos, contas a pagar', `${a.length} vencimento(s) que exigem atenção.`)
      }
      case 'forecast': {
        const f = forecast(data)
        return f.ok ? log('ok', 'Vendas diárias', `Previsão 14 dias: ${money(f.rows.reduce((a, r) => a + r.forecast, 0))} (estimativa, não garantia).`) : log('sem_dados', 'Vendas diárias', f.reason)
      }
      case 'missing': {
        const sold = new Set(data.sales.map((s) => s.product))
        const rc = recipeCosts(data)
        const noRecipe = [...sold].filter((p) => ![...rc.values()].some((r) => r.product.toLowerCase() === String(p).toLowerCase()))
        const stale = dataFreshness(data).filter((f) => !f.last || daysBetween(f.last, today()) > settings.thresholds.staleDays)
        return log('ok', 'Todas as fontes', `${noRecipe.length} produto(s) vendidos sem ficha técnica. Fontes ausentes ou desatualizadas: ${stale.map((s) => s.area).join(', ') || 'nenhuma'}.`)
      }
    }
  } catch (e: any) {
    log('erro', '-', 'Falha na execução', String(e?.message || e))
  }
}

/** Executa todas as tarefas. Ações externas nunca são executadas: no máximo viram rascunhos para aprovação. */
export function runAll() {
  for (const t of TASKS) runTask(t.id)
}
