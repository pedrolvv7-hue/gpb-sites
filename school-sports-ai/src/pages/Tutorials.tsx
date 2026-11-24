import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TUTORIALS } from '../lib/tutorials'
import { Card } from '../components/ui'

export default function Tutorials() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const f = q.toLowerCase()
  return (
    <div className="space-y-4">
      <h1 className="h1">Tutoriais</h1>
      <input className="input max-w-sm" placeholder="Buscar tutorial" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar tutorial" />
      {TUTORIALS.map((c) => { const items = c.items.filter((t) => !f || (t.title + t.steps.join(' ')).toLowerCase().includes(f)); return items.length ? (
        <Card key={c.cat} title={c.cat}>
          <div className="space-y-1">{items.map((t) => (
            <div key={t.id} className="rounded-lg border border-line">
              <button className="w-full p-3 text-left font-medium" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)}>{t.title}</button>
              {open === t.id && <div className="px-3 pb-3"><ol className="list-inside list-decimal space-y-1 text-sm text-muted">{t.steps.map((s) => <li key={s}>{s}</li>)}</ol>{t.link && <Link to={t.link} className="mt-2 inline-block text-sm text-blue">Abrir →</Link>}</div>}
            </div>))}</div>
        </Card>) : null })}
    </div>
  )
}
