import { useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, History, Dumbbell, Map, Settings, GraduationCap, LifeBuoy, PlayCircle, Menu, X, Smartphone, User, Gauge, ShieldCheck, GitCompare, Tv } from 'lucide-react'
import { Logo } from '../components/ui'

const NAV = [
  { to: '/painel', label: 'Painel', icon: LayoutDashboard },
  { to: '/nova', label: 'Nova partida', icon: PlusCircle },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/comparar', label: 'Comparações', icon: GitCompare },
  { to: '/treinos', label: 'Treinamentos', icon: Dumbbell },
  { to: '/simulador', label: 'Simulador tático', icon: Map },
  { to: '/assistir', label: 'Assistir transmissão', icon: Tv },
  { to: '/camera', label: 'Entrar como câmera', icon: Smartphone },
  { to: '/demo', label: 'Modo demonstração', icon: PlayCircle },
  { to: '/diagnostico', label: 'Diagnóstico', icon: Gauge },
  { to: '/privacidade', label: 'Privacidade', icon: ShieldCheck },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/tutoriais', label: 'Tutoriais', icon: GraduationCap },
  { to: '/ajuda', label: 'Ajuda', icon: LifeBuoy },
  { to: '/perfil', label: 'Perfil', icon: User },
]

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const loc = useLocation()
  return (
    <div className="flex min-h-screen">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-blue focus:p-2">Pular para o conteúdo</a>
      <aside className={`no-print fixed inset-y-0 left-0 z-40 border-r border-line bg-bg2 transition-all lg:static ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${collapsed ? 'lg:w-16' : 'w-64'}`} aria-label="Menu principal">
        <div className="flex h-14 items-center gap-2 border-b border-line px-3">
          <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}><Logo />{!collapsed && <span className="font-bold">School Sports <span className="text-blue">AI</span></span>}</Link>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={18} /></button>
        </div>
        <nav className="space-y-0.5 overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - 6.5rem)' }}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)} title={n.label}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive || loc.pathname.startsWith(n.to + '/') ? 'bg-blue/15 text-blue' : 'text-muted hover:bg-card hover:text-fg'}`}>
              <n.icon size={18} className="shrink-0" />{!collapsed && n.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={() => setCollapsed(!collapsed)} className="absolute bottom-2 left-2 right-2 hidden rounded-lg border border-line py-1.5 text-xs text-muted lg:block">{collapsed ? '»' : '« Recolher'}</button>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-14 items-center gap-3 border-b border-line bg-bg2/80 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu /></button><Logo size={24} /><span className="font-bold">School Sports AI</span>
        </header>
        <main id="conteudo" className="fade-in mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6" key={loc.pathname}>{children}</main>
      </div>
    </div>
  )
}
