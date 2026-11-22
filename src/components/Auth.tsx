import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { startSync, stopSync } from '../lib/cloudSync'

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabase)
  const [recovery, setRecovery] = useState(false)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  const uid = session?.user.id
  useEffect(() => { if (uid) startSync(uid); else stopSync() }, [uid])
  return { session, ready, recovery, clearRecovery: () => setRecovery(false) }
}

const MSG: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  'User already registered': 'Já existe uma conta com este e-mail. Use "Entrar".',
}
const tr = (m: string) => MSG[m] || (m.includes('Password should be') ? 'A senha precisa ter pelo menos 6 caracteres.' : m)

export function AuthScreen() {
  const [mode, setMode] = useState<'entrar' | 'criar' | 'esqueci'>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<{ t: 'ok' | 'erro'; m: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true); setMsg(null)
    const redirect = window.location.origin
    if (mode === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg({ t: 'erro', m: tr(error.message) })
    } else if (mode === 'criar') {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { restaurant: name }, emailRedirectTo: redirect } })
      if (error) setMsg({ t: 'erro', m: tr(error.message) })
      else if (!data.session) setMsg({ t: 'ok', m: 'Conta criada. Enviamos um link de confirmação para o seu e-mail.' })
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect })
      setMsg(error ? { t: 'erro', m: tr(error.message) } : { t: 'ok', m: 'Se o e-mail estiver cadastrado, você receberá um link para criar nova senha.' })
    }
    setBusy(false)
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3" aria-label="Acesso">
        <div className="flex items-center gap-2 text-xl font-bold"><span className="rounded-lg bg-brand-500 px-2 py-0.5 text-white">RP</span> RestauProfit <span className="text-brand-500">Pro</span></div>
        <h1 className="text-lg font-semibold">{{ entrar: 'Entrar na sua conta', criar: 'Criar conta grátis', esqueci: 'Recuperar acesso' }[mode]}</h1>
        {mode === 'criar' && <label className="block"><span className="label">Nome do restaurante</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>}
        <label className="block"><span className="label">E-mail</span><input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {mode !== 'esqueci' && <label className="block"><span className="label">Senha</span><input className="input" type="password" required minLength={6} autoComplete={mode === 'criar' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
        {msg && <p className={`text-sm ${msg.t === 'erro' ? 'text-red-600' : 'text-emerald-700'}`}>{msg.m}</p>}
        <button className="btn-primary w-full justify-center py-2" disabled={busy}>{busy ? 'Aguarde...' : { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Enviar link' }[mode]}</button>
        <div className="flex justify-between text-sm">
          {mode !== 'entrar' ? <button type="button" className="text-brand-600" onClick={() => setMode('entrar')}>Já tenho conta</button> : <button type="button" className="text-brand-600" onClick={() => setMode('criar')}>Criar conta</button>}
          {mode === 'entrar' && <button type="button" className="text-slate-500" onClick={() => setMode('esqueci')}>Esqueci a senha</button>}
        </div>
        <p className="text-xs text-slate-500">Cada conta tem seus próprios dados, separados e protegidos.</p>
      </form>
    </div>
  )
}

export function NewPassword({ onDone }: { onDone: () => void }) {
  const [p, setP] = useState('')
  const [msg, setMsg] = useState('')
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form className="card w-full max-w-sm space-y-3" onSubmit={async (e) => { e.preventDefault(); const { error } = await supabase!.auth.updateUser({ password: p }); if (error) setMsg(tr(error.message)); else onDone() }}>
        <h1 className="text-lg font-semibold">Crie sua nova senha</h1>
        <input className="input" type="password" minLength={6} required value={p} onChange={(e) => setP(e.target.value)} aria-label="Nova senha" />
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <button className="btn-primary w-full justify-center">Salvar senha</button>
      </form>
    </div>
  )
}
