import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthCtx { session: Session | null; loading: boolean; enabled: boolean; signOut: () => Promise<void> }
const Ctx = createContext<AuthCtx>({ session: null, loading: false, enabled: false, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!!supabase)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return <Ctx.Provider value={{ session, loading, enabled: !!supabase, signOut: async () => { await supabase?.auth.signOut() } }}>{children}</Ctx.Provider>
}
export const useAuth = () => useContext(Ctx)
