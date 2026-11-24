import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../app/auth'
import { supabase } from '../lib/supabase'
import { Card, Field, Notice } from '../components/ui'

export default function Profile() {
  const { session, enabled, signOut } = useAuth()
  const [pw, setPw] = useState(''), [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null)
  if (!enabled) return <div className="space-y-4"><h1 className="h1">Perfil</h1><Notice kind="info">Modo local (sem conta). Para contas, configure o Supabase conforme o README.</Notice></div>
  if (!session) return <div className="space-y-4"><h1 className="h1">Perfil</h1><Notice kind="info">Você não está conectado. <Link className="text-blue underline" to="/entrar">Entrar</Link></Notice></div>
  return (
    <div className="space-y-4">
      <h1 className="h1">Perfil</h1>
      <Card title="Conta"><p className="text-sm">E-mail: {session.user.email}</p><p className="text-sm text-muted">Escola: {(session.user.user_metadata?.school as string) || 'não informada'}</p><button className="btn-ghost btn-sm mt-3" onClick={signOut}>Sair</button></Card>
      <Card title="Alterar senha">
        <Field label="Nova senha (mín. 8)"><input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
        {msg && <div className="mt-2"><Notice kind={msg.k}>{msg.t}</Notice></div>}
        <button className="btn-primary btn-sm mt-2" disabled={pw.length < 8} onClick={async () => { const { error } = await supabase!.auth.updateUser({ password: pw }); setMsg(error ? { k: 'error', t: error.message } : { k: 'ok', t: 'Senha alterada.' }); setPw('') }}>Salvar</button>
      </Card>
    </div>
  )
}
