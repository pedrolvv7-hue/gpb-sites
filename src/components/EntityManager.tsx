import { ReactNode, useState } from 'react'
import { Plus, Pencil, Trash2, Upload, FileDown, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ENTITIES, EntityKey, Field } from '../data/schema'
import { Rec, useData, useStore } from '../data/store'
import { DataTable, Col, Empty } from './ui'
import { download, normalizeValue, templateCSV } from '../lib/importer'
import { money } from '../lib/calc'

export function fmtField(f: Field, v: any) {
  if (v == null || v === '') return ''
  if (f.sensitive) return '••••' + String(v).slice(-2)
  if (f.type === 'money') return money(Number(v))
  if (f.type === 'bool') return v ? 'Sim' : 'Não'
  if (f.type === 'date') return String(v).split('-').reverse().join('/')
  return String(v)
}

export function RecordForm({ entity, initial, onSave, onCancel, fixed }: {
  entity: EntityKey; initial?: Rec | null; onSave: (r: Record<string, any>) => void; onCancel: () => void; fixed?: Record<string, any>
}) {
  const def = ENTITIES[entity]
  const units = useStore((s) => s.data.units)
  const [v, setV] = useState<Record<string, any>>(() => ({ ...(fixed || {}), ...(initial || {}) }))
  const [errors, setErrors] = useState<string[]>([])
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const out: Record<string, any> = {}
    const errs: string[] = []
    for (const f of def.fields) {
      const n = normalizeValue(f, v[f.key])
      if (n.error) errs.push(n.error)
      out[f.key] = n.value
    }
    setErrors(errs)
    if (!errs.length) onSave(out)
  }
  return (
    <form onSubmit={submit} className="card space-y-3 border-brand-400" data-tour="form">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{initial ? 'Editar' : 'Novo'} registro: {def.label}</h3>
        <button type="button" onClick={onCancel} aria-label="Fechar"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {def.fields.map((f) => (
          <label key={f.key} className={f.type === 'bool' ? 'flex items-center gap-2 pt-5' : ''}>
            {f.type !== 'bool' && <span className="label">{f.label}{f.required && ' *'}</span>}
            {f.type === 'select' ? (
              <select className="input" value={v[f.key] ?? ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
                <option value="">Selecione</option>
                {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'bool' ? (
              <><input type="checkbox" checked={!!v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.checked })} /> <span className="text-sm">{f.label}</span></>
            ) : f.key === 'unit' && units.length ? (
              <select className="input" value={v[f.key] ?? ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
                <option value="">Todas / não se aplica</option>
                {units.map((u) => <option key={u.id} value={u.code}>{u.name} ({u.code})</option>)}
              </select>
            ) : (
              <input className="input" type={f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : f.type === 'money' || f.type === 'number' ? 'number' : 'text'}
                step="any" value={v[f.key] ?? ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            )}
          </label>
        ))}
      </div>
      {errors.length > 0 && <ul className="list-disc pl-5 text-sm text-red-600">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="flex gap-2">
        <button className="btn-primary" type="submit" data-tour="save">Salvar</button>
        <button className="btn-ghost" type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export function EntityManager({ entity, extraCols = [], filters, rowActions, hideFields = [], fixed, rows: rowsOverride, title, canAdd = true }: {
  entity: EntityKey
  extraCols?: Col<Rec>[]
  filters?: { key: string; label: string; options: string[] }[]
  rowActions?: (r: Rec) => ReactNode
  hideFields?: string[]
  fixed?: Record<string, any>
  rows?: Rec[]
  title?: string
  canAdd?: boolean
}) {
  const def = ENTITIES[entity]
  const data = useData()
  const { add, update, remove } = useStore()
  const [editing, setEditing] = useState<Rec | null | 'new'>(null)
  const rows = rowsOverride || data[entity]
  const cols: Col<Rec>[] = [
    ...def.fields.filter((f) => !hideFields.includes(f.key)).slice(0, 8).map((f) => ({
      key: f.key, label: f.label, align: f.type === 'money' || f.type === 'number' ? ('right' as const) : undefined, render: (r: Rec) => fmtField(f, r[f.key]),
    })),
    ...extraCols,
    { key: '_actions', label: 'Ações', csv: () => '', render: (r) => (
      <div className="flex gap-1">
        {rowActions?.(r)}
        <button className="btn-ghost px-2" aria-label="Editar" onClick={() => setEditing(r)}><Pencil size={13} /></button>
        <button className="btn-ghost px-2 text-red-600" aria-label="Excluir" onClick={() => confirm('Excluir este registro?') && remove(entity, r.id)}><Trash2 size={13} /></button>
      </div>
    ) },
  ]
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {title && <h3 className="mr-auto font-semibold">{title}</h3>}
        {canAdd && <button className="btn-primary" data-tour="add" onClick={() => setEditing('new')}><Plus size={14} /> Adicionar</button>}
        <Link className="btn-ghost" data-tour="import" to={`/importacao?tipo=${entity}`}><Upload size={14} /> Importar planilha</Link>
        <button className="btn-ghost" data-tour="template" onClick={() => download(`modelo-${entity}.csv`, templateCSV(entity))}><FileDown size={14} /> Modelo</button>
      </div>
      {editing && (
        <RecordForm entity={entity} fixed={fixed} initial={editing === 'new' ? null : editing} onCancel={() => setEditing(null)}
          onSave={(r) => { editing === 'new' ? add(entity, r) : update(entity, editing.id, r); setEditing(null) }} />
      )}
      <DataTable rows={rows} cols={cols} filename={entity} filters={filters}
        empty={<Empty>Nenhum registro de {def.label.toLowerCase()} ainda. Adicione manualmente ou importe uma planilha.</Empty>} />
    </div>
  )
}
