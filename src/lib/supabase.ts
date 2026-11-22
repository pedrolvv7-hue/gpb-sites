// Cliente Supabase. A URL e a chave pública (anon) podem ficar no navegador:
// a proteção dos dados vem das políticas RLS definidas em supabase/schema.sql.
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const authEnabled = !!supabase
