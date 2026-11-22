import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { Menu, X, Star, ChevronDown, ChevronRight, Bell, Moon, Sun, Search, Bot, GraduationCap, Rocket } from 'lucide-react'
import { useStore, useData } from './data/store'
import { TABS, CATEGORIES } from './tabs/registry'
import { TourOverlay } from './components/Tour'
import { TutorialPage, GuidePage } from './tutorials/TutorialCenter'
import { CardapioPublico } from './tabs/cardapio'
import { Onboarding } from './components/Onboarding'
import { computeAlerts } from './lib/alerts'
import { runAll } from './lib/autopilot'

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { settings, setSettings } = useStore()
  const { pathname } = useLocation()
  const [q, setQ] = useState('')
  const current = TABS.find((t) => t.route === pathname)
  const [open, setOpen] = useState<Record<string, boolean>>(() => (current ? { [current.category]: true } : {}))
  const fav = settings.favorites
  const toggleFav = (id: string) => setSettings({ favorites: fav.includes(id) ? fav.filter((f) => f !== id) : [...fav, id] })
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const results = q ? TABS.filter((t) => n(t.name + ' ' + t.summary).includes(n(q))) : []
  const link = (t: (typeof TABS)[number]) => (
    <div key={t.id} className="group flex items-center">
      <NavLink to={t.route} end onClick={onNavigate} className={({ isActive }) => `flex-1 truncate rounded-md px-2 py-1.5 text-sm ${isActive ? 'bg-brand-500 font-medium text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
        {t.num ? <span className="mr-1 text-xs opacity-60">{t.num}</span> : null}{t.name}
      </NavLink>
      <button aria-label={fav.includes(t.id) ? `Remover ${t.name} dos favoritos` : `Favoritar ${t.name}`} onClick={() => toggleFav(t.id)} className={`px-1 ${fav.includes(t.id) ? 'text-amber-400' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}><Star size={13} fill={fav.includes(t.id) ? 'currentColor' : 'none'} /></button>
    </div>
  )
  return (
    <nav className="flex h-full flex-col gap-3 overflow-y-auto p-3" aria-label="Menu principal">
      <Link to="/" className="flex items-center gap-2 px-2 text-lg font-bold" onClick={onNavigate}><span className="rounded-lg bg-brand-500 px-2 py-0.5 text-white">RP</span> RestauProfit <span className="text-brand-500">Pro</span></Link>
      <label className="relative"><Search size={14} className="absolute left-2 top-2.5 text-slate-400" /><input className="input pl-7" placeholder="Buscar funcionalidade..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar funcionalidade" /></label>
      {q ? <div>{results.map(link)}{!results.length && <p className="px-2 text-sm text-slate-400">Nada encontrado.</p>}</div> : <>
        <div className="space-y-0.5">
          {TABS.filter((t) => t.id === 'autopilot' || t.id === 'tutorial').map((t) => (
            <NavLink key={t.id} to={t.route} onClick={onNavigate} className={({ isActive }) => `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium ${isActive ? 'bg-brand-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              {t.id === 'autopilot' ? <Bot size={15} /> : <GraduationCap size={15} />} {t.id === 'tutorial' ? 'Central de Tutoriais' : t.name}
            </NavLink>
          ))}
        </div>
        {fav.length > 0 && <div><div className="px-2 pb-1 text-xs font-semibold uppercase text-slate-400">Favoritos</div>{TABS.filter((t) => fav.includes(t.id)).map(link)}</div>}
        {CATEGORIES.map((c, i) => (
          <div key={c}>
            <button className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-expanded={!!open[c]} onClick={() => setOpen({ ...open, [c]: !open[c] })}>
              <span>{i + 1}. {c}</span>{open[c] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {open[c] && <div className="ml-1 border-l pl-1 dark:border-slate-800">{TABS.filter((t) => t.category === c).map(link)}</div>}
          </div>
        ))}
      </>}
    </nav>
  )
}

function Header({ onMenu, onSetup }: { onMenu: () => void; onSetup: () => void }) {
  const { settings, setSettings, resolvedAlerts } = useStore()
  const units = useStore((s) => s.data.units)
  const data = useData()
  const open = useMemo(() => computeAlerts(data, settings).filter((a) => !resolvedAlerts[a.id]).length, [data, settings, resolvedAlerts])
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <button className="btn-ghost lg:hidden" onClick={onMenu} aria-label="Abrir menu"><Menu size={18} /></button>
      <div className="min-w-0 flex-1 truncate text-sm font-medium">{settings.companyName || 'Meu restaurante'}</div>
      {units.length > 0 && (
        <select className="input w-auto max-w-[45vw]" aria-label="Unidade" value={settings.unitFilter} onChange={(e) => setSettings({ unitFilter: e.target.value })}>
          <option value="">Todas as unidades</option>{units.map((u) => <option key={u.id} value={u.code}>{u.name}</option>)}
        </select>
      )}
      {!settings.onboardingDone && <button className="btn-ghost" onClick={onSetup} aria-label="Configuração inicial"><Rocket size={15} /><span className="hidden sm:inline">Configuração inicial</span></button>}
      <Link to="/alertas" className="btn-ghost relative" aria-label={`${open} alertas abertos`}><Bell size={16} />{open > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{open}</span>}</Link>
      <button className="btn-ghost" aria-label="Alternar tema" onClick={() => setSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}>{settings.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
    </header>
  )
}

function Shell() {
  const [menu, setMenu] = useState(false)
  const { settings, setSettings } = useStore()
  const [setup, setSetup] = useState(!settings.onboardingDone && !settings.lastVisit) // abre sozinho só no primeiro acesso
  const { pathname } = useLocation()
  useEffect(() => { document.documentElement.classList.toggle('dark', settings.theme === 'dark') }, [settings.theme])
  useEffect(() => {
    // registra visita (MorningBrain) e executa o AutoPilot no modo automático
    const s = useStore.getState().settings
    setSettings({ prevVisit: s.lastVisit, lastVisit: new Date().toISOString() })
    if (s.autopilotMode === 'automatico') runAll()
  }, [])
  useEffect(() => { setMenu(false); window.scrollTo?.(0, 0) }, [pathname])
  return (
    <div className="flex min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-950 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}>
        <button className="absolute right-2 top-3 lg:hidden" onClick={() => setMenu(false)} aria-label="Fechar menu"><X size={18} /></button>
        <Sidebar onNavigate={() => setMenu(false)} />
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMenu(false)} />}
      <div className="min-w-0 flex-1">
        {settings.demo && <div className="bg-amber-400 px-3 py-1 text-center text-sm font-semibold text-amber-950">MODO DEMONSTRAÇÃO: todos os dados exibidos são fictícios.</div>}
        <Header onMenu={() => setMenu(true)} onSetup={() => setSetup(true)} />
        <main className="mx-auto max-w-7xl p-4">
          <Routes>
            {TABS.map((t) => <Route key={t.id} path={t.route} element={<t.component />} />)}
            <Route path="/tutoriais/guia/:id" element={<GuidePage />} />
            <Route path="/tutoriais/:id" element={<TutorialPage />} />
            <Route path="*" element={<div className="card">Página não encontrada. <Link className="text-brand-600" to="/">Voltar ao início</Link></div>} />
          </Routes>
        </main>
      </div>
      {setup && <Onboarding onClose={() => setSetup(false)} />}
      <TourOverlay />
    </div>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/cardapio-publico" element={<CardapioPublico />} />
      <Route path="*" element={<Shell />} />
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>
}
