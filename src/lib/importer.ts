// SmartImport: leitura de CSV/XLSX, detecção de tipo, mapeamento de colunas,
// normalização, validação e detecção de duplicatas.
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { ENTITIES, ENTITY_LIST, EntityKey, Field } from '../data/schema'
import type { Data } from '../data/store'
import { norm } from './calc'

export type RawRow = Record<string, any>
export interface ParsedFile { name: string; headers: string[]; rows: RawRow[] }

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text()
    return parseCSVText(file.name, text)
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' })
    return { name: file.name, headers: rows.length ? Object.keys(rows[0]) : [], rows }
  }
  throw new Error(`Formato não suportado: .${ext}. Use CSV ou XLSX.`)
}

export function parseCSVText(name: string, text: string): ParsedFile {
  const res = Papa.parse<RawRow>(text.trim(), { header: true, skipEmptyLines: true, delimitersToGuess: [',', ';', '\t', '|'] })
  return { name, headers: res.meta.fields || [], rows: res.data }
}

/** Pontua o quanto um cabeçalho corresponde a um campo. */
function matchScore(header: string, f: Field): number {
  const h = norm(header).replace(/[_\-.]/g, ' ')
  const cands = [f.label, f.key, ...(f.aliases || [])].map((c) => norm(c))
  if (cands.includes(h)) return 3
  if (cands.some((c) => c.length > 2 && (h.startsWith(c) || h.endsWith(c)))) return 2
  if (cands.some((c) => c.length > 3 && h.includes(c))) return 1
  return 0
}

export function autoMap(headers: string[], entity: EntityKey): Record<string, string> {
  const map: Record<string, string> = {}
  const used = new Set<string>()
  for (const f of ENTITIES[entity].fields) {
    let best = '', bestS = 0
    for (const h of headers) {
      if (used.has(h)) continue
      const s = matchScore(h, f)
      if (s > bestS) { best = h; bestS = s }
    }
    if (best) { map[f.key] = best; used.add(best) }
  }
  return map
}

/** Detecta o tipo de relatório comparando os cabeçalhos com todas as entidades. */
export function detectEntity(headers: string[]): { entity: EntityKey; confidence: number; ranking: { entity: EntityKey; score: number }[] } {
  const importable = ENTITY_LIST.filter((e) => e.fields.some((f) => f.aliases?.length))
  const ranking = importable.map((e) => {
    const map = autoMap(headers, e.key)
    const req = e.fields.filter((f) => f.required)
    const reqHit = req.filter((f) => map[f.key]).length
    const score = (reqHit / Math.max(1, req.length)) * 0.7 + (Object.keys(map).length / e.fields.length) * 0.3
    return { entity: e.key, score }
  }).sort((a, b) => b.score - a.score)
  return { entity: ranking[0].entity, confidence: ranking[0].score, ranking: ranking.slice(0, 4) }
}

// ----------------------------------------------------------- normalização de valores
export function parseMoney(v: any): number | null {
  if (typeof v === 'number') return v
  let s = String(v ?? '').trim()
  if (!s) return null
  const neg = /^-|\(.*\)$|-$/.test(s)
  s = s.replace(/[R$\s()]/g, '').replace(/-/g, '')
  if (s.includes(',') && s.includes('.')) {
    // o último separador é o decimal
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (s.includes(',')) s = s.replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) ? (neg ? -n : n) : null
}

export function parseDate(v: any): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const s = String(v ?? '').trim()
  if (!s) return null
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) { // padrão brasileiro DD/MM/AAAA
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return valid(y, +m[2], +m[1])
  }
  if (/^\d{5}$/.test(s)) { // número serial do Excel
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000)
    return d.toISOString().slice(0, 10)
  }
  return null
}
function valid(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCMonth() !== mo - 1) return null
  return dt.toISOString().slice(0, 10)
}
export function parseTime(v: any): string | null {
  const s = String(v ?? '').trim()
  const m = s.match(/(\d{1,2}):(\d{2})/)
  if (!m || +m[1] > 23 || +m[2] > 59) return null
  return `${m[1].padStart(2, '0')}:${m[2]}`
}
const BOOL_T = ['sim', 's', 'true', '1', 'yes', 'x', 'ativo', 'verdadeiro']
const UNIT_ALIASES: Record<string, string> = { kg: 'kg', quilo: 'kg', kilo: 'kg', kilos: 'kg', quilos: 'kg', g: 'g', gr: 'g', grama: 'g', gramas: 'g', l: 'l', lt: 'l', litro: 'l', litros: 'l', ml: 'ml', un: 'un', und: 'un', unid: 'un', unidade: 'un', pc: 'un', peca: 'un', cx: 'un' }
const CHANNEL_ALIASES: Record<string, string> = { salao: 'salao', mesa: 'salao', local: 'salao', balcao: 'retirada', retirada: 'retirada', 'take away': 'retirada', delivery: 'delivery_proprio', 'delivery proprio': 'delivery_proprio', proprio: 'delivery_proprio', ifood: 'ifood' }
const STATUS_ALIASES: Record<string, string> = { concluida: 'concluida', concluido: 'concluida', finalizada: 'concluida', paga: 'concluida', ok: 'concluida', cancelada: 'cancelada', cancelado: 'cancelada', estornada: 'devolvida', devolvida: 'devolvida', devolucao: 'devolvida' }

export function normalizeValue(f: Field, v: any): { value: any; error?: string } {
  const empty = v == null || String(v).trim() === ''
  if (empty) return f.required ? { value: null, error: `"${f.label}" é obrigatório` } : { value: f.type === 'bool' ? false : '' }
  switch (f.type) {
    case 'money': case 'number': {
      const n = parseMoney(v)
      return n == null ? { value: null, error: `"${f.label}": valor inválido (${v})` } : { value: n }
    }
    case 'date': {
      const d = parseDate(v)
      return d ? { value: d } : { value: null, error: `"${f.label}": data inválida (${v})` }
    }
    case 'time': {
      const t = parseTime(v)
      return t ? { value: t } : { value: null, error: `"${f.label}": hora inválida (${v})` }
    }
    case 'bool': return { value: BOOL_T.includes(norm(v)) }
    case 'select': {
      const n = norm(v)
      let mapped = f.options!.find((o) => norm(o) === n)
      if (!mapped && f.key === 'measure') mapped = UNIT_ALIASES[n]
      if (!mapped && f.key === 'channel') mapped = CHANNEL_ALIASES[n] || (n ? 'outra_plataforma' : undefined)
      if (!mapped && f.key === 'status' && f.options!.includes('concluida')) mapped = STATUS_ALIASES[n]
      return mapped ? { value: mapped } : { value: null, error: `"${f.label}": opção não reconhecida (${v}). Aceitas: ${f.options!.join(', ')}` }
    }
    default: return { value: String(v).trim().replace(/\s+/g, ' ') }
  }
}

export const dedupeKey = (entity: EntityKey, r: Record<string, any>) =>
  ENTITIES[entity].dedupe.map((k) => norm(r[k])).join('|')

export interface PreparedRow { row: number; record: Record<string, any>; errors: string[]; duplicate: boolean }
export interface Prepared {
  rows: PreparedRow[]
  valid: number
  invalid: number
  duplicates: number
  kind: 'individual' | 'agregado' | 'n/a'
  warnings: string[]
}

export function prepare(entity: EntityKey, parsed: ParsedFile, map: Record<string, string>, existing: Data, defaults: Record<string, any> = {}): Prepared {
  const def = ENTITIES[entity]
  const seen = new Set(existing[entity].map((r) => dedupeKey(entity, r)))
  const rows: PreparedRow[] = parsed.rows.map((raw, i) => {
    const record: Record<string, any> = {}
    const errors: string[] = []
    for (const f of def.fields) {
      const src = map[f.key]
      const v = src ? raw[src] : defaults[f.key]
      const n = normalizeValue(f, v)
      if (n.error) errors.push(n.error)
      record[f.key] = n.value
    }
    if (entity === 'sales' && !record.status) record.status = 'concluida'
    const key = dedupeKey(entity, record)
    const duplicate = !errors.length && seen.has(key)
    if (!errors.length && !duplicate) seen.add(key)
    return { row: i + 2, record, errors, duplicate }
  })
  const warnings: string[] = []
  let kind: Prepared['kind'] = 'n/a'
  if (entity === 'sales') {
    const withId = rows.filter((r) => r.record.orderId).length
    kind = withId / Math.max(1, rows.length) > 0.5 ? 'individual' : 'agregado'
    if (kind === 'agregado')
      warnings.push('Arquivo parece ser um relatório AGREGADO (sem número de pedido). O faturamento será contado, mas pedidos e ticket médio não serão calculados para estas linhas. Não importe também as vendas individuais do mesmo período, para evitar dupla contagem.')
    const overlap = rows.filter((r) => !r.errors.length).some((r) => existing.sales.some((s) => s.date === r.record.date && (!!s.orderId) !== (!!r.record.orderId)))
    if (overlap) warnings.push('Já existem vendas de outro formato (individual x agregado) nas mesmas datas. Isso pode causar dupla contagem: revise antes de confirmar.')
    if (!map.time) warnings.push('Sem coluna de hora: a aba Horários de Pico não terá dados destas vendas.')
  }
  const missingReq = def.fields.filter((f) => f.required && !map[f.key] && defaults[f.key] == null)
  if (missingReq.length) warnings.push(`Campos obrigatórios sem coluna: ${missingReq.map((f) => f.label).join(', ')}.`)
  return {
    rows, kind, warnings,
    valid: rows.filter((r) => !r.errors.length && !r.duplicate).length,
    invalid: rows.filter((r) => r.errors.length).length,
    duplicates: rows.filter((r) => r.duplicate).length,
  }
}

export function templateCSV(entity: EntityKey): string {
  const def = ENTITIES[entity]
  return def.fields.map((f) => f.label).join(';') + '\n'
}

export function toCSV(rows: Record<string, any>[], cols: { key: string; label: string }[]) {
  const esc = (v: any) => {
    const s = v == null ? '' : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.map((c) => esc(c.label)).join(';'), ...rows.map((r) => cols.map((c) => esc(r[c.key])).join(';'))].join('\n')
}

export function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
