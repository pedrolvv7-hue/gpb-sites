import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { useStore } from '../data/store'
import { TABS } from '../tabs/registry'

const useTour = create<{ tabId: string | null; step: number; set: (t: string | null, s?: number) => void }>((set) => ({
  tabId: null, step: 0, set: (tabId, step = 0) => set({ tabId, step }),
}))

export const startTour = (tabId: string) => useTour.getState().set(tabId, 0)

/** Passos do tour: somente os alvos que existem na tela atual são exibidos. */
export function availableSteps(tabId: string, root: ParentNode = document) {
  const tab = TABS.find((t) => t.id === tabId)
  if (!tab) return []
  return tab.tour.filter((s) => root.querySelector(`main [data-tour="${s.target}"]`) || root.querySelector(`[data-tour="${s.target}"]`))
}

export function TourOverlay() {
  const { tabId, step, set } = useTour()
  const [, force] = useState(0)
  const done = useStore((s) => s.settings.tutorialsDone)
  const setSettings = useStore((s) => s.setSettings)
  const steps = tabId ? availableSteps(tabId) : []
  const cur = steps[step]
  useEffect(() => {
    document.querySelectorAll('.tour-highlight').forEach((e) => e.classList.remove('tour-highlight'))
    if (!cur) return
    const el = document.querySelector(`[data-tour="${cur.target}"]`) as HTMLElement | null
    if (el) { el.classList.add('tour-highlight'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
    const r = () => force((x) => x + 1)
    window.addEventListener('resize', r)
    return () => { window.removeEventListener('resize', r); el?.classList.remove('tour-highlight') }
  }, [cur, tabId, step])
  if (!tabId) return null
  const finish = () => {
    if (!done.includes(tabId)) setSettings({ tutorialsDone: [...done, tabId] })
    set(null)
  }
  if (!cur) {
    return (
      <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-xl bg-white p-4 shadow-2xl dark:bg-slate-800">
        <p className="text-sm">Esta tela ainda não tem elementos para o tour (por exemplo, sem dados). Consulte o tutorial completo.</p>
        <button className="btn-primary mt-2" onClick={() => set(null)}>Fechar</button>
      </div>
    )
  }
  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-xl bg-white p-4 shadow-2xl dark:bg-slate-800" role="dialog" aria-label="Tour interativo">
      <div className="text-xs text-slate-500">Passo {step + 1} de {steps.length}</div>
      <div className="mt-1 font-semibold">{cur.title}</div>
      <p className="mt-1 text-sm">{cur.text}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-ghost" disabled={!step} onClick={() => set(tabId, step - 1)}>Voltar</button>
        {step < steps.length - 1
          ? <button className="btn-primary" onClick={() => set(tabId, step + 1)}>Avançar</button>
          : <button className="btn-primary" onClick={finish}>Concluir</button>}
        <button className="btn-ghost" onClick={() => set(tabId, 0)}>Reiniciar</button>
        <button className="btn-ghost" onClick={() => set(null)}>Pular</button>
      </div>
    </div>
  )
}
