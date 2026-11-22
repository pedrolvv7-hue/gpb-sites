import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, byUnit } from '../data/store'
import { buildDemo } from '../data/demo'
import { computeAlerts } from '../lib/alerts'
import { runTask } from '../lib/autopilot'
import { ask } from '../lib/brain'

beforeEach(() => { useStore.getState().clearAll(); useStore.setState({ automation: [] }) })

describe('store, histórico e multiunidade', () => {
  it('registra histórico ao alterar custo de ingrediente', () => {
    const s = useStore.getState()
    const i = s.add('ingredients', { name: 'Queijo', measure: 'kg', cost: 40 })
    useStore.getState().update('ingredients', i.id, { cost: 45 })
    const h = useStore.getState().data.priceHistory.filter((x) => x.item === 'Queijo')
    expect(h.map((x) => x.value)).toEqual([40, 45])
  })
  it('desfaz importação removendo apenas seus registros', () => {
    const s = useStore.getState()
    s.add('expenses', { date: '2026-01-01', description: 'manual', amount: 1 })
    s.bulkAdd('expenses', [{ date: '2026-01-02', description: 'imp', amount: 2 }], 'imp1')
    s.logImport({ id: 'imp1', at: '', fileName: 'a.csv', entity: 'expenses', kind: 'n/a', inserted: 1, duplicates: 0, errors: 0, errorRows: [] })
    expect(useStore.getState().undoImport('imp1')).toBe(1)
    expect(useStore.getState().data.expenses.map((e) => e.description)).toEqual(['manual'])
  })
  it('separa dados por unidade', () => {
    const rows = [{ unit: 'A' }, { unit: 'B' }, { unit: '' }]
    expect(byUnit(rows, 'A')).toHaveLength(2)
    expect(byUnit(rows, '')).toHaveLength(3)
  })
})

describe('alertas, AutoPilot e RestauBrain com dados de demonstração', () => {
  beforeEach(() => useStore.getState().replaceAll(buildDemo() as any, true))
  it('gera alertas de vários tipos a partir dos dados', () => {
    const { data, settings } = useStore.getState()
    const types = new Set(computeAlerts(data, settings).map((a) => a.type))
    for (const t of ['Conta vencida', 'Validade', 'Documento', 'Manutenção']) expect(types.has(t)).toBe(true)
  })
  it('sem dados não há alertas', () => {
    useStore.getState().clearAll()
    const { data, settings } = useStore.getState()
    expect(computeAlerts(data, settings)).toHaveLength(0)
  })
  it('AutoPilot cria só rascunhos de pedido (nunca aprova)', () => {
    useStore.getState().setSettings({ autopilotMode: 'aprovacao' })
    runTask('po')
    const pos = useStore.getState().data.purchaseOrders
    expect(pos.length).toBeGreaterThan(0)
    expect(pos.every((p) => p.status === 'rascunho')).toBe(true)
    expect(useStore.getState().automation[0].status).toBe('aguardando_aprovacao')
  })
  it('modo monitoramento não cria nada', () => {
    useStore.getState().setSettings({ autopilotMode: 'monitoramento' })
    runTask('po')
    expect(useStore.getState().data.purchaseOrders).toHaveLength(0)
  })
  it('reprocessar não duplica rascunhos', () => {
    useStore.getState().setSettings({ autopilotMode: 'aprovacao' })
    runTask('po'); const n = useStore.getState().data.purchaseOrders.length
    runTask('po')
    expect(useStore.getState().data.purchaseOrders.length).toBe(n)
  })
  it('RestauBrain responde com fontes', () => {
    const { data, settings } = useStore.getState()
    const a = ask('Quais pratos possuem menor margem?', data, settings)
    expect(a.bullets.length).toBeGreaterThan(0)
    expect(a.sources).toContain('Fichas técnicas')
    expect(ask('Quais unidades precisam de atenção?', data, settings).bullets).toHaveLength(2)
  })
})
