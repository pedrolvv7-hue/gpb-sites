import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Layout } from './Layout'
import { Spinner } from '../components/ui'
import { useStore, applyRetention } from '../store/store'
import { AuthProvider } from './auth'

const Landing = lazy(() => import('../pages/Landing'))
const Auth = lazy(() => import('../pages/Auth'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const NewMatch = lazy(() => import('../pages/NewMatch'))
const Cameras = lazy(() => import('../pages/Cameras'))
const Calibration = lazy(() => import('../pages/Calibration'))
const Live = lazy(() => import('../pages/Live'))
const Events = lazy(() => import('../pages/Events'))
const Report = lazy(() => import('../pages/Report'))
const CameraMode = lazy(() => import('../pages/CameraMode'))
const Watch = lazy(() => import('../pages/Watch'))
const HistoryPage = lazy(() => import('../pages/History'))
const Compare = lazy(() => import('../pages/Compare'))
const Simulator = lazy(() => import('../pages/Simulator'))
const Training = lazy(() => import('../pages/Training'))
const SettingsPage = lazy(() => import('../pages/Settings'))
const Diagnostics = lazy(() => import('../pages/Diagnostics'))
const Privacy = lazy(() => import('../pages/Privacy'))
const Tutorials = lazy(() => import('../pages/Tutorials'))
const Help = lazy(() => import('../pages/Help'))
const Profile = lazy(() => import('../pages/Profile'))
const Demo = lazy(() => import('../pages/Demo'))
const Positioning = lazy(() => import('../pages/Positioning'))

export default function App() {
  const theme = useStore((s) => s.settings.theme)
  const reduced = useStore((s) => s.settings.reducedMotion)
  const loc = useLocation()
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.classList.toggle('reduce-motion', reduced) }, [theme, reduced])
  useEffect(() => { applyRetention() }, [])
  const bare = loc.pathname === '/' || loc.pathname.startsWith('/camera/') || /^\/assistir\/.+/.test(loc.pathname) || ['/entrar', '/cadastro', '/recuperar'].includes(loc.pathname)
  const routes = (
    <Suspense fallback={<div className="p-6"><Spinner label="Carregando…" /></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/entrar" element={<Auth mode="login" />} />
        <Route path="/cadastro" element={<Auth mode="signup" />} />
        <Route path="/recuperar" element={<Auth mode="reset" />} />
        <Route path="/painel" element={<Dashboard />} />
        <Route path="/nova" element={<NewMatch />} />
        <Route path="/partida/:id/cameras" element={<Cameras />} />
        <Route path="/partida/:id/calibrar" element={<Calibration />} />
        <Route path="/partida/:id/ao-vivo" element={<Live />} />
        <Route path="/partida/:id/eventos" element={<Events />} />
        <Route path="/partida/:id/relatorio" element={<Report />} />
        <Route path="/posicionamento/:sport" element={<Positioning />} />
        <Route path="/camera" element={<CameraMode />} />
        <Route path="/camera/:room" element={<CameraMode />} />
        <Route path="/assistir" element={<Watch />} />
        <Route path="/assistir/:room" element={<Watch />} />
        <Route path="/historico" element={<HistoryPage />} />
        <Route path="/comparar" element={<Compare />} />
        <Route path="/simulador" element={<Simulator />} />
        <Route path="/treinos" element={<Training />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="/diagnostico" element={<Diagnostics />} />
        <Route path="/privacidade" element={<Privacy />} />
        <Route path="/tutoriais" element={<Tutorials />} />
        <Route path="/ajuda" element={<Help />} />
        <Route path="/perfil" element={<Profile />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
  return <AuthProvider>{bare ? routes : <Layout>{routes}</Layout>}</AuthProvider>
}
