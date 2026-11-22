import { ReactNode, useMemo, useState } from 'react'
import { HelpCircle, Download, Search, GraduationCap, Info, RefreshCw } from 'lucide-react'
import { useStore, useData } from '../data/store'
import { Period, defaultPeriod, addDays } from '../lib/calc'
import { download, toCSV } from '../lib/importer'
import { startTour } from './Tour'
import { useCurrentTab } from '../tabs/registry'
import { Link } from 'react-router-dom'

export function Help({ title, what, how, source, read, fix }: { title: string; what: string; how?: string; source?: string; read?: string; fix?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block align-middle">
      <button type="button" aria-label={`Ajuda: ${title}`} onClick={() => setOpen(!open)} className="text-slate-400 hover:text-brand-500">
        <HelpCircle size={14} />
      </button>
      {open && (
        <span role="dialog" className="absolute left-0 top-5 z-50 block w-72 rounded-lg border bg-white p-3 text-left text-xs font-normal normal-case text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <b className="block text-sm">{title}</b>
          <span className="mt-1 block"><b>O que significa:</b> {what}</span>
          {how && <span className="mt-1 block"><b>Como é calculado:</b> {how}</span>}
          {source && <span className="mt-1 block"><b>Fonte:</b> {source}</span>}
          {read && <span className="mt-1 block"><b>Como interpretar:</b> {read}</span>}
          {fix && <span className="mt-1 block"><b>Se estiver errado:</b> {fix}</span>}
          <button className="mt-2 text-brand-600" onClick={() => setOpen(false)}>Fechar</button>
        </span>
      )}
    </span>
  )
}

export function Kpi({ label, value, sub, help, tone }: { label: string; value: ReactNode; sub?: ReactNode; help?: Parameters<typeof Help>[0]; tone?: 'up' | 'down' | 'warn' }) {
  const c = tone === 'up' ? 'text-emerald-600' : tone === 'down' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-500'
  return (
    <div className="card" data-tour="kpi">
      <div className="flex items-center gap-1 text-xs font-medium uppercase text-slate-500">{label} {help && <Help {...help} />}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${c}`}>{sub}</div>}
    </div>
  )
}

export function Grid({ children, cols = 4 }: { children: ReactNode; cols?: number }) {
  const m: Record<number, string> = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 5: 'sm:grid-cols-2 lg:grid-cols-5' }
  return <div className={`grid grid-cols-1 gap-3 ${m[cols]}`}>{children}</div>
}

export function Section({ title, children, actions, help }: { title: string; children: ReactNode; actions?: ReactNode; help?: Parameters<typeof Help>[0] }) {
  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1 font-semibold">{title} {help && <Help {...help} />}</h3>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children, action }: { children: ReactNode; action?: { to: string; label: string } }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700" data-tour="empty">
      <Info size={20} />
      <div>{children}</div>
      {action && <Link to={action.to} className="btn-primary">{action.label}</Link>}
    </div>
  )
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'error' | 'ok' }) {
  const c = { info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200', warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200', error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200', ok: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' }[tone]
  return <div className={`rounded-lg border px-3 py-2 text-sm ${c}`}>{children}</div>
}

export function Page({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const tab = useCurrentTab()
  const done = useStore((s) => s.settings.tutorialsDone)
  const data = useData()
  const lastImport = useStore((s) => s.imports.find((i) => !i.undone))
  const total = Object.values(data).reduce((a, v) => a + v.length, 0)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div data-tour="title">
          <div className="text-xs font-medium uppercase text-brand-600">{tab?.category}{tab?.num ? ` · Aba ${tab.num}` : ''}</div>
          <h1 className="text-2xl font-bold">{tab?.name}</h1>
          <p className="max-w-3xl text-sm text-slate-500">{tab?.summary}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400" data-tour="updated">
            <RefreshCw size={11} /> Atualizado ao vivo a partir de {total.toLocaleString('pt-BR')} registros
            {lastImport ? ` · última importação ${new Date(lastImport.at).toLocaleString('pt-BR')}` : ' · nenhuma importação ainda'}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          {actions}
          {tab && (
            <button className="btn-ghost" data-tour="learn" onClick={() => startTour(tab.id)}>
              <GraduationCap size={16} /> Aprender a usar esta aba {done.includes(tab.id) && '✓'}
            </button>
          )}
          {tab && <Link className="btn-ghost" to={`/tutoriais/${tab.id}`}>Tutorial completo</Link>}
        </div>
      </div>
      {children}
    </div>
  )
}

export function usePeriod() {
  const data = useData()
  const def = useMemo(() => defaultPeriod(data), [data])
  const [p, setP] = useState<Period | null>(null)
  return [p || def, setP] as const
}

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const preset = (days: number) => onChange({ from: addDays(value.to, -(days - 1)), to: value.to })
  return (
    <div className="flex flex-wrap items-end gap-2" data-tour="period">
      <label><span className="label">De</span><input type="date" className="input" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} /></label>
      <label><span className="label">Até</span><input type="date" className="input" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} /></label>
      {[7, 30, 90].map((d) => <button key={d} className="btn-ghost" onClick={() => preset(d)}>{d} dias</button>)}
    </div>
  )
}

export interface Col<T> { key: string; label: string; render?: (r: T) => ReactNode; csv?: (r: T) => any; align?: 'right' }

export function DataTable<T extends Record<string, any>>({ rows, cols, filename = 'dados', filters, pageSize = 25, empty }: {
  rows: T[]; cols: Col<T>[]; filename?: string; filters?: { key: string; label: string; options: string[] }[]; pageSize?: number; empty?: ReactNode
}) {
  const [q, setQ] = useState('')
  const [f, setF] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 } | null>(null)
  const [page, setPage] = useState(0)
  const filtered = useMemo(() => {
    let r = rows.filter((x) => (!q || JSON.stringify(x).toLowerCase().includes(q.toLowerCase())) && Object.entries(f).every(([k, v]) => !v || String(x[k]) === v))
    if (sort) r = [...r].sort((a, b) => (a[sort.k] > b[sort.k] ? 1 : a[sort.k] < b[sort.k] ? -1 : 0) * sort.dir)
    return r
  }, [rows, q, f, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const view = filtered.slice(page * pageSize, page * pageSize + pageSize)
  const exp = () => download(`${filename}.csv`, toCSV(filtered.map((r) => Object.fromEntries(cols.map((c) => [c.key, c.csv ? c.csv(r) : r[c.key]]))), cols))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="relative min-w-[180px] flex-1" data-tour="search">
          <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
          <input className="input pl-7" placeholder="Pesquisar..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} />
        </label>
        {filters?.map((fl) => (
          <label key={fl.key} data-tour="filter">
            <span className="label">{fl.label}</span>
            <select className="input" value={f[fl.key] || ''} onChange={(e) => { setF({ ...f, [fl.key]: e.target.value }); setPage(0) }}>
              <option value="">Todos</option>
              {fl.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        ))}
        <button className="btn-ghost" onClick={exp} data-tour="export"><Download size={14} /> Exportar CSV</button>
      </div>
      {!rows.length && empty ? empty : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800" data-tour="table">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>{cols.map((c) => (
                <th key={c.key} className={`th cursor-pointer ${c.align === 'right' ? 'text-right' : ''}`} onClick={() => setSort({ k: c.key, dir: sort?.k === c.key && sort.dir === 1 ? -1 : 1 })}>
                  {c.label}{sort?.k === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {view.map((r, i) => (
                <tr key={r.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  {cols.map((c) => <td key={c.key} className={`td ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{c.render ? c.render(r) : String(r[c.key] ?? '')}</td>)}
                </tr>
              ))}
              {!view.length && <tr><td className="td text-center text-slate-400" colSpan={cols.length}>Nenhum registro encontrado com estes filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-slate-500">{filtered.length} registros · página {page + 1} de {pages}</span>
          <button className="btn-ghost" disabled={!page} onClick={() => setPage(page - 1)}>Anterior</button>
          <button className="btn-ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Próxima</button>
        </div>
      )}
    </div>
  )
}

export const Badge = ({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' }) => {
  const c = { slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', red: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300', blue: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' }[tone]
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>
}

export const CHART_COLORS = ['#f97316', '#0ea5e9', '#10b981', '#8b5cf6', '#ef4444', '#eab308', '#64748b']

export function ChartBox({ children, height = 260 }: { children: ReactNode; height?: number }) {
  return <div data-tour="chart" style={{ height }} className="w-full">{children}</div>
}
