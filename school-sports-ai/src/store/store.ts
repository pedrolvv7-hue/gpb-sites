// Estado global. Partidas reais e de demonstração ficam em chaves de armazenamento SEPARADAS,
// de modo que o modo demonstração nunca altera dados reais.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Match } from '../lib/types'

export interface Settings {
  theme: 'dark' | 'light'
  aiProfile: 'leve' | 'equilibrado' | 'avancado'
  inferFps: number
  detectScore: number
  thresholds: { auto: number; min: number }
  replaySeconds: number
  recordingAllowed: boolean
  retentionDays: number
  reducedMotion: boolean
  overlays: Record<'boxes' | 'labels' | 'teams' | 'ball' | 'trails' | 'court' | 'confidence' | 'pose', boolean>
}

export const defaultSettings: Settings = {
  theme: 'dark', aiProfile: 'equilibrado', inferFps: 8, detectScore: 0.35, thresholds: { auto: 0.85, min: 0.2 }, replaySeconds: 20,
  recordingAllowed: false, retentionDays: 7, reducedMotion: false,
  overlays: { boxes: true, labels: true, teams: true, ball: true, trails: true, court: true, confidence: true, pose: true },
}

interface State {
  matches: Record<string, Match>
  settings: Settings
  saveMatch: (m: Match) => void
  deleteMatch: (id: string) => void
  deleteAll: () => void
  setSettings: (s: Partial<Settings>) => void
}

const storage = createJSONStorage(() => {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage } catch { return sessionStorage }
})

export const useStore = create<State>()(persist((set) => ({
  matches: {},
  settings: defaultSettings,
  saveMatch: (m) => {
    if (m.demo) { useDemo.getState().save(m); return }
    set((s) => ({ matches: { ...s.matches, [m.id]: m } }))
  },
  deleteMatch: (id) => set((s) => { const c = { ...s.matches }; delete c[id]; return { matches: c } }),
  deleteAll: () => set({ matches: {} }),
  setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
}), { name: 'ssai-real', storage, version: 2, migrate: (st) => { const x = st as State; x.settings = { ...defaultSettings, ...x.settings, overlays: { ...defaultSettings.overlays, ...x.settings?.overlays } }; return x } }))

/** Armazenamento exclusivo do modo demonstração (memória da sessão). */
export const useDemo = create<{ matches: Record<string, Match>; save: (m: Match) => void; clear: () => void }>((set) => ({
  matches: {},
  save: (m) => set((s) => ({ matches: { ...s.matches, [m.id]: { ...m, demo: true } } })),
  clear: () => set({ matches: {} }),
}))

export function useMatch(id: string | undefined): Match | undefined {
  const real = useStore((s) => (id ? s.matches[id] : undefined))
  const demo = useDemo((s) => (id ? s.matches[id] : undefined))
  return real ?? demo
}

/** Limpeza automática conforme a política de retenção configurada. */
export function applyRetention() {
  const { matches, settings, deleteMatch } = useStore.getState()
  const limit = Date.now() - settings.retentionDays * 86400000
  for (const m of Object.values(matches)) if (m.state === 'encerrada' && (m.endedAt ?? m.createdAt) < limit) deleteMatch(m.id)
}
