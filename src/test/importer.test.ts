import { describe, it, expect } from 'vitest'
import { parseMoney, parseDate, parseTime, autoMap, detectEntity, prepare, parseCSVText, normalizeValue } from '../lib/importer'
import { ENTITIES } from '../data/schema'

const empty = () => Object.fromEntries(Object.keys(ENTITIES).map((k) => [k, []])) as any

describe('SmartImport', () => {
  it('lê valores monetários em formatos brasileiros e internacionais', () => {
    expect(parseMoney('R$ 1.234,56')).toBe(1234.56)
    expect(parseMoney('1,234.56')).toBe(1234.56)
    expect(parseMoney('12,5')).toBe(12.5)
    expect(parseMoney('1.000')).toBe(1000)
    expect(parseMoney('-10,00')).toBe(-10)
    expect(parseMoney('abc')).toBeNull()
  })
  it('lê datas DD/MM/AAAA, ISO e serial do Excel; recusa inválidas', () => {
    expect(parseDate('25/12/2025')).toBe('2025-12-25')
    expect(parseDate('2025-12-25')).toBe('2025-12-25')
    expect(parseDate('31/02/2025')).toBeNull()
    expect(parseDate('45000')).toBe('2023-03-15')
    expect(parseTime('9:05')).toBe('09:05')
  })
  it('normaliza unidades e canais', () => {
    expect(normalizeValue(ENTITIES.ingredients.fields[1], 'Quilos').value).toBe('kg')
    expect(normalizeValue(ENTITIES.sales.fields.find((f) => f.key === 'channel')!, 'iFood').value).toBe('ifood')
    expect(normalizeValue(ENTITIES.sales.fields.find((f) => f.key === 'status')!, 'Cancelado').value).toBe('cancelada')
  })
  it('detecta o tipo e mapeia colunas automaticamente', () => {
    const p = parseCSVText('v.csv', 'Data;Hora;Comanda;Produto;Qtd;Valor Unitário;Canal\n01/01/2026;12:00;1;Burger;2;30,00;Salão')
    const det = detectEntity(p.headers)
    expect(det.entity).toBe('sales')
    const m = autoMap(p.headers, 'sales')
    expect(m.date).toBe('Data'); expect(m.orderId).toBe('Comanda'); expect(m.qty).toBe('Qtd'); expect(m.time).toBe('Hora')
  })
  it('valida, detecta duplicatas no arquivo e na base', () => {
    const p = parseCSVText('v.csv', 'Data;Comanda;Produto;Qtd;Preço\n01/01/2026;1;Burger;2;30\n01/01/2026;1;Burger;2;30\n99/99/2026;2;X;1;1\n02/01/2026;3;Y;1;5')
    const existing = empty()
    existing.sales = [{ id: 'x', orderId: '3', date: '2026-01-02', time: '', product: 'Y', qty: 1, unitPrice: 5 }]
    const prep = prepare('sales', p, autoMap(p.headers, 'sales'), existing)
    expect(prep.valid).toBe(1)
    expect(prep.duplicates).toBe(2)
    expect(prep.invalid).toBe(1)
    expect(prep.kind).toBe('individual')
  })
  it('alerta relatório agregado para evitar dupla contagem', () => {
    const p = parseCSVText('a.csv', 'Data;Produto;Quantidade;Preço\n01/01/2026;Burger;50;30')
    const prep = prepare('sales', p, autoMap(p.headers, 'sales'), empty())
    expect(prep.kind).toBe('agregado')
    expect(prep.warnings.join(' ')).toMatch(/AGREGADO/)
  })
  it('aponta campos obrigatórios sem coluna', () => {
    const p = parseCSVText('a.csv', 'Produto\nBurger')
    const prep = prepare('sales', p, autoMap(p.headers, 'sales'), empty())
    expect(prep.valid).toBe(0)
    expect(prep.warnings.join(' ')).toMatch(/obrigatórios/)
  })
})
