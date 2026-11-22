import { describe, it, expect } from 'vitest'
import { Data } from '../data/store'
import { ENTITIES } from '../data/schema'
import * as c from '../lib/calc'
import { reconcile } from '../tabs/financeiro'
import { shiftConflicts, extractDates } from '../tabs/operacao'

const empty = (): Data => Object.fromEntries(Object.keys(ENTITIES).map((k) => [k, []])) as any
let n = 0
const r = (o: any) => ({ id: String(++n), _createdAt: '', ...o })

describe('cálculos financeiros', () => {
  it('converte unidades compatíveis e recusa incompatíveis', () => {
    expect(c.convert(500, 'g', 'kg')).toBe(0.5)
    expect(c.convert(2, 'l', 'ml')).toBe(2000)
    expect(c.convert(1, 'kg', 'ml')).toBeNull()
  })
  it('exclui canceladas e calcula ticket por pedido distinto', () => {
    const d = empty()
    d.sales = [
      r({ orderId: 'A', date: '2026-01-01', product: 'X', qty: 2, unitPrice: 10, discount: 1, status: 'concluida' }),
      r({ orderId: 'A', date: '2026-01-01', product: 'Y', qty: 1, unitPrice: 5, status: 'concluida' }),
      r({ orderId: 'B', date: '2026-01-01', product: 'X', qty: 1, unitPrice: 10, status: 'cancelada' }),
      r({ orderId: 'C', date: '2026-01-02', product: 'X', qty: 1, unitPrice: 10 }),
    ]
    const s = c.salesSummary(d)
    expect(s.revenue).toBe(34)
    expect(s.orders).toBe(2)
    expect(s.ticket).toBe(17)
    expect(s.cancelled).toBe(1)
  })
  it('não calcula ticket sem número de pedido (relatório agregado)', () => {
    const d = empty()
    d.sales = [r({ date: '2026-01-01', product: 'X', qty: 10, unitPrice: 10 })]
    expect(c.salesSummary(d).orders).toBeNull()
    expect(c.salesSummary(d).ticket).toBeNull()
  })
  it('usa aritmética decimal sem erro de ponto flutuante', () => {
    const d = empty()
    d.sales = [r({ date: '2026-01-01', product: 'X', qty: 3, unitPrice: 0.1 }), r({ date: '2026-01-01', product: 'X', qty: 1, unitPrice: 0.2 })]
    expect(c.salesSummary(d).revenue).toBe(0.5)
  })
})

describe('fichas técnicas, margem e estoque', () => {
  const base = () => {
    const d = empty()
    d.ingredients = [r({ name: 'Queijo', measure: 'kg', cost: 50 }), r({ name: 'Pão', measure: 'un', cost: 2, minStock: 5 })]
    d.recipes = [r({ product: 'Burger', ingredient: 'Queijo', qty: 100, measure: 'g', yield: 1, lossPct: 0 }), r({ product: 'Burger', ingredient: 'Pão', qty: 1, measure: 'un' })]
    d.products = [r({ name: 'Burger', price: 20 }), r({ name: 'Suco', price: 8 })]
    d.sales = [r({ orderId: '1', date: '2026-01-10', product: 'Burger', qty: 10, unitPrice: 20 }), r({ orderId: '2', date: '2026-01-10', product: 'Suco', qty: 5, unitPrice: 8 })]
    return d
  }
  it('custo por porção soma ingredientes convertidos', () => {
    expect(c.recipeCosts(base()).get('burger')!.costPerPortion).toBe(7)
  })
  it('perda de preparo aumenta o custo', () => {
    const d = base(); d.recipes[0].lossPct = 50
    expect(c.recipeCosts(d).get('burger')!.costPerPortion).toBe(14)
  })
  it('recalcula quando o custo do ingrediente muda', () => {
    const d = base(); d.ingredients[0].cost = 100
    expect(c.recipeCosts(d).get('burger')!.costPerPortion).toBe(12)
  })
  it('margem bruta cobre só produtos com ficha e informa cobertura', () => {
    const m = c.grossMargin(base())
    expect(m.cmv).toBe(70)
    expect(m.grossPct).toBeCloseTo(65)
    expect(m.coveragePct).toBeCloseTo((200 / 240) * 100)
  })
  it('produto sem ficha fica com margem nula (não estimada)', () => {
    const s = c.productProfit(base()).find((p) => p.product === 'Suco')!
    expect(s.marginPct).toBeNull()
    expect(s.cmv).toBeNull()
  })
  it('estoque teórico parte da última contagem e desconta consumo', () => {
    const d = base()
    d.counts = [r({ date: '2026-01-05', ingredient: 'Pão', qty: 30, countedBy: 'Ana' })]
    d.purchases = [r({ date: '2026-01-06', ingredient: 'Pão', qty: 10, supplier: 'P', unitCost: 2 })]
    d.stockMoves = [r({ date: '2026-01-07', ingredient: 'Pão', type: 'perda', qty: 2 })]
    const p = c.stockPosition(d).find((x) => x.ingredient === 'Pão')!
    expect(p.theoretical).toBe(30 + 10 - 2 - 10)
  })
  it('canceladas não consomem ingredientes', () => {
    const d = base(); d.sales[0].status = 'cancelada'
    expect(c.theoreticalConsumption(d).get('pao')).toBeUndefined()
  })
})

describe('estatística', () => {
  it('previsão exige 14 dias', () => {
    const d = empty()
    d.sales = [r({ date: '2026-01-01', product: 'X', qty: 1, unitPrice: 10 })]
    expect(c.forecast(d).ok).toBe(false)
  })
  it('detecta dia anômalo comparando mesmo dia da semana', () => {
    const d = empty()
    for (let i = 0; i < 35; i++) d.sales.push(r({ date: c.addDays('2026-01-01', i), product: 'X', qty: 1, unitPrice: 100 + (i % 3) }))
    d.sales.push(r({ date: c.addDays('2026-01-01', 35), product: 'X', qty: 1, unitPrice: 5 }))
    expect(c.revenueAnomalies(d, 2).some((a) => a.date === c.addDays('2026-01-01', 35))).toBe(true)
  })
  it('previsão gera intervalo com mínimo <= previsto <= máximo', () => {
    const d = empty()
    for (let i = 0; i < 30; i++) d.sales.push(r({ date: c.addDays('2026-01-01', i), product: 'X', qty: 1, unitPrice: 100 + i }))
    const f = c.forecast(d, 7)
    expect(f.ok).toBe(true)
    for (const row of f.rows) { expect(row.low).toBeLessThanOrEqual(row.forecast); expect(row.high).toBeGreaterThanOrEqual(row.forecast) }
  })
})

describe('conciliação, escalas, documentos', () => {
  it('concilia valor exato e sinaliza divergência', () => {
    const d = empty()
    d.receivables = [r({ description: 'Rep', dueDate: '2026-01-10', amount: 100, receivedDate: '2026-01-10' }), r({ description: 'Rep2', dueDate: '2026-01-12', amount: 200 })]
    d.bankStatement = [r({ date: '2026-01-11', description: 'TED', amount: 100 }), r({ date: '2026-01-12', description: 'TED2', amount: 197 }), r({ date: '2026-01-12', description: 'X', amount: -50 })]
    const { rows } = reconcile(d)
    expect(rows.map((x) => x.status)).toEqual(['conciliado', 'divergência de valor', 'não encontrado'])
  })
  it('detecta conflito de turnos sobrepostos', () => {
    expect(shiftConflicts([{ employee: 'A', date: 'd', start: '10:00', end: '18:00' }, { employee: 'A', date: 'd', start: '17:00', end: '23:00' }, { employee: 'B', date: 'd', start: '10:00', end: '18:00' }])).toHaveLength(1)
  })
  it('extrai datas de texto', () => {
    expect(extractDates('Validade: 31/12/2026, emitido 01/02/2025')).toEqual(['2025-02-01', '2026-12-31'])
  })
})
