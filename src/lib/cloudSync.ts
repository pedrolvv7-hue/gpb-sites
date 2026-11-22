// Sincroniza o estado de cada usuário com a tabela restaurant_data (uma linha por usuário).
import { supabase } from './supabase'
import { useStore } from '../data/store'

const SAVED_KEYS = ['data', 'imports', 'automation', 'audit', 'resolvedAlerts', 'settings'] as const
let timer: ReturnType<typeof setTimeout> | null = null
let unsub: (() => void) | null = null
let currentUser: string | null = null

export type SyncStatus = 'idle' | 'carregando' | 'salvando' | 'salvo' | 'erro'
export const syncState = { status: 'idle' as SyncStatus, error: '', listeners: new Set<() => void>() }
const setStatus = (s: SyncStatus, error = '') => { syncState.status = s; syncState.error = error; syncState.listeners.forEach((l) => l()) }

function snapshot() {
  const s = useStore.getState() as any
  return Object.fromEntries(SAVED_KEYS.map((k) => [k, s[k]]))
}

async function save() {
  if (!supabase || !currentUser) return
  setStatus('salvando')
  const { error } = await supabase.from('restaurant_data').upsert({ user_id: currentUser, payload: snapshot(), updated_at: new Date().toISOString() })
  setStatus(error ? 'erro' : 'salvo', error?.message)
}

/** Ao entrar: troca o armazenamento local para o do usuário e carrega os dados da nuvem. */
export async function startSync(userId: string) {
  if (!supabase) return
  stopSync()
  currentUser = userId
  setStatus('carregando')
  // cache local separado por usuário
  useStore.persist.setOptions({ name: `restauprofit-pro-v1-${userId}` })
  await useStore.persist.rehydrate()
  const { data, error } = await supabase.from('restaurant_data').select('payload').eq('user_id', userId).maybeSingle()
  if (error) setStatus('erro', error.message)
  else if (data?.payload) {
    const p = data.payload as any
    useStore.setState({ ...p, settings: { ...useStore.getState().settings, ...p.settings }, data: { ...useStore.getState().data, ...p.data } })
    setStatus('salvo')
  } else await save() // primeira vez: cria a linha do usuário
  unsub = useStore.subscribe(() => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, 1500)
  })
}

export function stopSync() {
  unsub?.(); unsub = null
  if (timer) clearTimeout(timer)
  currentUser = null
}

export async function flushAndStop() {
  if (timer) { clearTimeout(timer); await save() }
  stopSync()
}
