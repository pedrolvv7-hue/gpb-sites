import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { Field, Logo, Notice } from '../components/ui'

const schema = z.object({ email: z.string().email('E-mail inválido'), password: z.string().min(8, 'Mínimo de 8 caracteres') })

export default function Auth({ mode }: { mode: 'login' | 'signup' | 'reset' }) {
  const nav = useNavigate()
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [school, setSchool] = useState('')
  const [err, setErr] = useState<Record<string, string>>({}), [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null), [busy, setBusy] = useState(false)
  const title = { login: 'Entrar', signup: 'Criar conta', reset: 'Recuperar senha' }[mode]

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    const r = mode === 'reset' ? z.object({ email: schema.shape.email }).safeParse({ email }) : schema.safeParse({ email, password })
    if (!r.success) { setErr(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))); return }
    setErr({})
    if (!supabase) return
    setBusy(true)
    try {
      if (mode === 'login') { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; nav('/painel') }
      if (mode === 'signup') { const { error } = await supabase.auth.signUp({ email, password, options: { data: { school } } }); if (error) throw error; setMsg({ k: 'ok', t: 'Conta criada. Verifique seu e-mail para confirmar o cadastro.' }) }
      if (mode === 'reset') { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/perfil` }); if (error) throw error; setMsg({ k: 'ok', t: 'Se o e-mail existir, enviaremos um link de redefinição.' }) }
    } catch (e) { setMsg({ k: 'error', t: e instanceof Error ? e.message : 'Falha na autenticação.' }) } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6" noValidate>
        <Link to="/" className="flex items-center gap-2"><Logo /><span className="font-bold">School Sports AI</span></Link>
        <h1 className="h1">{title}</h1>
        {!supabase && <Notice kind="warn">Autenticação não configurada neste ambiente (faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY). Você pode usar a plataforma em <b>modo local</b>: os dados ficam somente neste navegador. <Link className="text-blue underline" to="/painel">Continuar em modo local</Link></Notice>}
        <Field label="E-mail" error={err.email}><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {mode !== 'reset' && <Field label="Senha" error={err.password}><input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>}
        {mode === 'signup' && <Field label="Escola (opcional)"><input className="input" value={school} onChange={(e) => setSchool(e.target.value)} maxLength={120} /></Field>}
        {msg && <Notice kind={msg.k}>{msg.t}</Notice>}
        <button className="btn-primary w-full" disabled={busy || !supabase}>{busy ? 'Aguarde…' : title}</button>
        <div className="flex justify-between text-xs text-muted">
          {mode !== 'login' && <Link to="/entrar">Já tenho conta</Link>}
          {mode !== 'signup' && <Link to="/cadastro">Criar conta</Link>}
          {mode !== 'reset' && <Link to="/recuperar">Esqueci a senha</Link>}
        </div>
      </form>
    </div>
  )
}
