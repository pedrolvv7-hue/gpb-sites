// Cliente Supabase. A chave anon pode ficar no navegador: a proteção vem das políticas RLS.
// Nunca use a chave service_role no frontend.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const backendEnabled = !!supabase
