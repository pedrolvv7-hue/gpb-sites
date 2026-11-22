import { useMemo } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ENTITIES, EntityKey } from './schema'

// Registro genérico: sempre tem id e _createdAt; demais campos seguem ENTITIES.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Rec = any

export interface ImportLog {
  id: string
  at: string
  fileName: string
  entity: EntityKey
  kind: 'individual' | 'agregado' | 'n/a'
  inserted: number
  duplicates: number
  errors: number
  errorRows: { row: number; message: string }[]
  undone?: boolean
}

export interface AutomationRun {
  id: string
  at: string
  task: string
  mode: 'automatico' | 'aprovacao' | 'monitoramento'
  status: 'ok' | 'erro' | 'aguardando_aprovacao' | 'sem_dados'
  source: string
  result: string
  error?: string
}

export interface AuditEntry { at: string; action: string; entity?: string; detail: string }

export interface Settings {
  companyName: string
  ownerName: string
  ownerEmail: string
  theme: 'light' | 'dark'
  unitFilter: string // '' = todas
  favorites: string[]
  tutorialsDone: string[]
  onboardingStep: number
  onboardingDone: boolean
  lastVisit: string | null
  prevVisit: string | null
  demo: boolean
  autopilotMode: 'automatico' | 'aprovacao' | 'monitoramento'
  thresholds: {
    salesDropPct: number
    minMarginPct: number
    expiryDays: number
    staleDays: number
    expenseZ: number
    docDays: number
  }
  loyalty: { pointsPerReal: number; rewardPoints: number; rewardLabel: string; enabled: boolean }
  menuTheme: { color: string; title: string }
  generativeAI: boolean
}

export type Data = Record<EntityKey, Rec[]>

const emptyData = (): Data =>
  Object.fromEntries(Object.keys(ENTITIES).map((k) => [k, []])) as unknown as Data

export const defaultSettings: Settings = {
  companyName: '',
  ownerName: '',
  ownerEmail: '',
  theme: 'light',
  unitFilter: '',
  favorites: ['visao-geral', 'importacao', 'alertas'],
  tutorialsDone: [],
  onboardingStep: 0,
  onboardingDone: false,
  lastVisit: null,
  prevVisit: null,
  demo: false,
  autopilotMode: 'aprovacao',
  thresholds: { salesDropPct: 20, minMarginPct: 55, expiryDays: 5, staleDays: 7, expenseZ: 2, docDays: 30 },
  loyalty: { pointsPerReal: 1, rewardPoints: 200, rewardLabel: 'Sobremesa grátis', enabled: false },
  menuTheme: { color: '#2563eb', title: 'Nosso cardápio' },
  generativeAI: false,
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const nowISO = () => new Date().toISOString()

interface State {
  data: Data
  imports: ImportLog[]
  automation: AutomationRun[]
  audit: AuditEntry[]
  resolvedAlerts: Record<string, { at: string; note: string }>
  settings: Settings
  add: (e: EntityKey, rec: Record<string, any>) => Rec
  update: (e: EntityKey, id: string, patch: Record<string, any>) => void
  remove: (e: EntityKey, id: string) => void
  bulkAdd: (e: EntityKey, recs: Record<string, any>[], importId?: string) => void
  logImport: (l: ImportLog) => void
  undoImport: (id: string) => number
  logRun: (r: Omit<AutomationRun, 'id' | 'at'>) => void
  resolveAlert: (id: string, note: string) => void
  reopenAlert: (id: string) => void
  setSettings: (p: Partial<Settings>) => void
  replaceAll: (d: Partial<Data>, demo: boolean) => void
  clearAll: () => void
  log: (action: string, detail: string, entity?: string) => void
}

/** Registra histórico quando preço de venda ou custo muda (preserva histórico). */
function trackPrice(e: EntityKey, before: Rec | undefined, after: Rec): Rec[] {
  const today = new Date().toISOString().slice(0, 10)
  if (e === 'products' && after.price != null && before?.price !== after.price)
    return [{ id: uid(), _createdAt: nowISO(), kind: 'venda', item: after.name, date: today, value: Number(after.price) }]
  if (e === 'ingredients' && after.cost != null && before?.cost !== after.cost)
    return [{ id: uid(), _createdAt: nowISO(), kind: 'custo', item: after.name, date: today, value: Number(after.cost) }]
  return []
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      data: emptyData(),
      imports: [],
      automation: [],
      audit: [],
      resolvedAlerts: {},
      settings: defaultSettings,
      log: (action, detail, entity) =>
        set((s) => ({ audit: [{ at: nowISO(), action, detail, entity }, ...s.audit].slice(0, 500) })),
      add: (e, rec) => {
        const r: Rec = { ...rec, id: uid(), _createdAt: nowISO() }
        set((s) => ({
          data: { ...s.data, [e]: [...s.data[e], r], priceHistory: [...s.data.priceHistory, ...trackPrice(e, undefined, r)] },
        }))
        get().log('criar', `${ENTITIES[e].label}: registro criado`, e)
        return r
      },
      update: (e, id, patch) => {
        const before = get().data[e].find((r) => r.id === id)
        if (!before) return
        const after = { ...before, ...patch }
        set((s) => ({
          data: {
            ...s.data,
            [e]: s.data[e].map((r) => (r.id === id ? after : r)),
            priceHistory: [...s.data.priceHistory, ...trackPrice(e, before, after)],
          },
        }))
        get().log('editar', `${ENTITIES[e].label}: registro alterado`, e)
      },
      remove: (e, id) => {
        set((s) => ({ data: { ...s.data, [e]: s.data[e].filter((r) => r.id !== id) } }))
        get().log('excluir', `${ENTITIES[e].label}: registro excluído`, e)
      },
      bulkAdd: (e, recs, importId) => {
        const created = recs.map((r) => ({ ...r, id: uid(), _createdAt: nowISO(), _import: importId }))
        set((s) => ({
          data: {
            ...s.data,
            [e]: [...s.data[e], ...created],
            priceHistory: [...s.data.priceHistory, ...created.flatMap((c) => trackPrice(e, undefined, c))],
          },
        }))
      },
      logImport: (l) => {
        set((s) => ({ imports: [l, ...s.imports] }))
        get().log('importar', `${l.fileName}: ${l.inserted} registros em ${ENTITIES[l.entity].label}`, l.entity)
      },
      undoImport: (id) => {
        const imp = get().imports.find((i) => i.id === id)
        if (!imp || imp.undone) return 0
        const n = get().data[imp.entity].filter((r) => r._import === id).length
        set((s) => ({
          data: { ...s.data, [imp.entity]: s.data[imp.entity].filter((r) => r._import !== id) },
          imports: s.imports.map((i) => (i.id === id ? { ...i, undone: true } : i)),
        }))
        get().log('desfazer importação', `${imp.fileName}: ${n} registros removidos`, imp.entity)
        return n
      },
      logRun: (r) => set((s) => ({ automation: [{ ...r, id: uid(), at: nowISO() }, ...s.automation].slice(0, 300) })),
      resolveAlert: (id, note) => set((s) => ({ resolvedAlerts: { ...s.resolvedAlerts, [id]: { at: nowISO(), note } } })),
      reopenAlert: (id) =>
        set((s) => {
          const r = { ...s.resolvedAlerts }
          delete r[id]
          return { resolvedAlerts: r }
        }),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      replaceAll: (input, demo) => {
        // histórico inicial de preços e custos, para preservar a referência de partida
        const day = new Date().toISOString().slice(0, 10)
        const hist = [
          ...((input.products as any[]) || []).map((p) => ({ kind: 'venda', item: p.name, date: day, value: Number(p.price) })),
          ...((input.ingredients as any[]) || []).map((i) => ({ kind: 'custo', item: i.name, date: day, value: Number(i.cost) })),
        ]
        const d = { ...input, priceHistory: [...((input.priceHistory as any[]) || []), ...hist] }
        set((s) => ({
          data: { ...emptyData(), ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, (v as any[]).map((r) => ({ id: uid(), _createdAt: nowISO(), ...r }))])) } as Data,
          settings: { ...s.settings, demo },
          imports: [],
          resolvedAlerts: {},
        }))
      },
      clearAll: () => set((s) => ({ data: emptyData(), imports: [], automation: [], resolvedAlerts: {}, settings: { ...s.settings, demo: false } })),
    }),
    {
      name: 'restauprofit-pro-v1',
      storage: createJSONStorage(() => ({
        // navegadores de celular limitam o armazenamento; uma falha ao salvar não pode travar a tela
        getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
        setItem: (k, v) => { try { localStorage.setItem(k, v) } catch (e) { console.warn('Armazenamento local cheio ou indisponível', e) } },
        removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* ignora */ } },
      })),
      merge: (persisted: any, current) => ({
        ...current,
        ...persisted,
        data: { ...emptyData(), ...(persisted?.data || {}) },
        settings: { ...defaultSettings, ...(persisted?.settings || {}), thresholds: { ...defaultSettings.thresholds, ...(persisted?.settings?.thresholds || {}) } },
      }),
    },
  ),
)

/** Filtra registros pela unidade selecionada (registros sem unidade aparecem em todas). */
export function byUnit(rows: Rec[], unit: string): Rec[] {
  if (!unit) return rows
  return rows.filter((r) => !r.unit || r.unit === unit)
}

/** Hook que retorna os dados já filtrados pela unidade ativa. */
export function useData(): Data {
  const data = useStore((s) => s.data)
  const unit = useStore((s) => s.settings.unitFilter)
  return useMemo(
    () => (unit ? (Object.fromEntries(Object.entries(data).map(([k, v]) => [k, byUnit(v, unit)])) as Data) : data),
    [data, unit],
  )
}
