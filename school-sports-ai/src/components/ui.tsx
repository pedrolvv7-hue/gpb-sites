import { useEffect, useState, type ReactNode } from 'react'
import type { EventStatus, TeamSide } from '../lib/types'
import { AlertTriangle, Info, Loader2 } from 'lucide-react'

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#10151D" stroke="#252E3B" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#3B82F6" strokeWidth="5" />
      <path d="M15 32h34M32 15v34" stroke="#22C55E" strokeWidth="3" />
      <circle cx="46" cy="18" r="4" fill="#EF4444" />
    </svg>
  )
}

export const Card = ({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) => (
  <section className={`card p-4 ${className}`}>
    {(title || action) && <div className="mb-3 flex items-center justify-between gap-2">{title && <h2 className="h2">{title}</h2>}{action}</div>}
    {children}
  </section>
)

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? <span role="alert" className="mt-1 block text-xs text-live">{error}</span> : hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const Notice = ({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) => {
  const cls = { info: 'border-blue/40 bg-blue/10', warn: 'border-pend/40 bg-pend/10', error: 'border-live/40 bg-live/10', ok: 'border-neon/40 bg-neon/10' }[kind]
  const Icon = kind === 'info' || kind === 'ok' ? Info : AlertTriangle
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-lg border p-3 text-sm ${cls}`}><Icon size={16} className="mt-0.5 shrink-0" /><div>{children}</div></div>
}

export const Spinner = ({ label }: { label: string }) => <div role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 size={16} className="animate-spin" />{label}</div>

export const Empty = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted"><p className="font-semibold text-fg">{title}</p>{children}</div>
)

const STATUS: Record<EventStatus, [string, string]> = {
  detectado: ['Detectado', 'bg-blue/20 text-blue'], estimado: ['Estimado', 'bg-blue/20 text-blue'],
  aguardando: ['Aguardando confirmação', 'bg-pend/20 text-pend'], confirmado_auto: ['Confirmado (auto)', 'bg-neon/20 text-neon'],
  confirmado_manual: ['Confirmado', 'bg-neon/20 text-neon'], rejeitado: ['Rejeitado', 'bg-live/20 text-live'],
  corrigido: ['Corrigido', 'bg-neon/20 text-neon'], indeterminado: ['Indeterminado', 'bg-line text-muted'],
}
export const StatusChip = ({ s }: { s: EventStatus }) => <span className={`chip ${STATUS[s][1]}`}>{STATUS[s][0]}</span>
export const statusLabel = (s: EventStatus) => STATUS[s][0]

export const TeamDot = ({ color, side }: { color: string; side: TeamSide | 'U' }) => (
  // forma + letra além da cor (acessibilidade: não depender só de cor)
  <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: side === 'U' ? '#64748b' : color, borderRadius: side === 'B' ? 2 : 999 }} aria-label={side === 'U' ? 'Equipe indefinida' : `Equipe ${side}`}>{side}</span>
)

export const ExperimentalTag = () => <span className="chip bg-pend/20 text-pend">Experimental</span>

export function useNow(ms = 250) {
  const [n, setN] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setN(Date.now()), ms); return () => clearInterval(i) }, [ms])
  return n
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[] }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-lg border border-line bg-bg2 p-1">
      {items.map((i) => <button key={i.id} role="tab" aria-selected={value === i.id} onClick={() => onChange(i.id)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${value === i.id ? 'bg-blue text-white' : 'text-muted hover:text-fg'}`}>{i.label}</button>)}
    </div>
  )
}

export function DemoBanner() {
  return <div className="sticky top-0 z-50 bg-pend px-3 py-1.5 text-center text-xs font-bold text-black">MODO DEMONSTRAÇÃO · dados simulados, separados das partidas reais</div>
}
