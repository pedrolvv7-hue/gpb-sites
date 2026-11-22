import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '../App'
import { TABS } from '../tabs/registry'
import { useStore } from '../data/store'
import { buildDemo } from '../data/demo'
import { docChecks } from '../tutorials/TutorialCenter'
import { TUTORIALS } from '../tutorials/content'

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>)
afterEach(cleanup)

describe('estrutura', () => {
  it('tem 70 abas numeradas + AutoPilot, com rotas únicas', () => {
    expect(TABS.filter((t) => t.num).length).toBe(70)
    expect(TABS.some((t) => t.id === 'autopilot')).toBe(true)
    expect(new Set(TABS.map((t) => t.route)).size).toBe(TABS.length)
    expect(new Set(TABS.map((t) => t.category)).size).toBe(11)
  })
  it('todas as abas têm tutorial e não há tutorial órfão', () => {
    expect(docChecks()).toMatchObject({ ok: true })
    for (const t of TABS) expect(TUTORIALS[t.id].steps.length).toBeGreaterThan(0)
  })
})

describe('todas as abas renderizam sem dados', () => {
  beforeAll(() => { useStore.getState().clearAll(); useStore.getState().setSettings({ onboardingDone: true, autopilotMode: 'aprovacao' }) })
  for (const t of TABS) it(`${t.num ?? '-'} ${t.name}`, () => {
    renderAt(t.route)
    expect(screen.getAllByText(t.name).length).toBeGreaterThan(0)
  })
})

describe('todas as abas renderizam com dados e os alvos do tour existem', () => {
  beforeAll(() => { useStore.getState().replaceAll(buildDemo() as any, true); useStore.getState().setSettings({ onboardingDone: true }) })
  for (const t of TABS) it(`${t.num ?? '-'} ${t.name}`, () => {
    const { container } = renderAt(t.route)
    expect(screen.getAllByText(t.name).length).toBeGreaterThan(0)
    const present = t.tour.filter((s) => container.querySelector(`[data-tour="${s.target}"]`))
    // título, atualização e botão de aprender sempre existem
    expect(present.length).toBeGreaterThanOrEqual(3)
    // passos específicos da aba (não genéricos de estado vazio) devem existir com dados
    const generic = ['empty', 'answer', 'resolve', 'undo', 'pay', 'approve', 'receive', 'filter', 'detect', 'mapping', 'diagnosis', 'confirm', 'kpi']
    const hasEmpty = !!container.querySelector('[data-tour="empty"]')
    const conditional = (target: string) => generic.includes(target) || target === 'form' /* abre ao clicar em Adicionar */ || (hasEmpty && ['table', 'chart', 'search', 'export'].includes(target))
    const missing = t.tour.filter((s) => !conditional(s.target) && !container.querySelector(`[data-tour="${s.target}"]`)).map((s) => s.target)
    expect(missing).toEqual([])
  }, 20000)
})

describe('navegação e tutoriais', () => {
  it('busca global encontra abas', () => {
    renderAt('/')
    fireEvent.change(screen.getAllByLabelText('Buscar funcionalidade')[0], { target: { value: 'fluxo' } })
    expect(screen.getAllByText('Fluxo de Caixa').length).toBeGreaterThan(0)
  })
  it('página de tutorial individual tem as 20 seções', () => {
    const { container } = renderAt('/tutoriais/fichas-tecnicas')
    const hs = [...container.querySelectorAll('main h2')].map((h) => h.textContent)
    for (let i = 1; i <= 20; i++) expect(hs.some((h) => h?.startsWith(`${i}. `))).toBe(true)
  })
  it('guia de importação tem os 18 tópicos', () => {
    renderAt('/tutoriais/guia/importacao')
    expect(screen.getByText('18. Desfazer')).toBeInTheDocument()
  })
  it('formulário de cadastro abre e mostra o alvo do tour', () => {
    const { container } = renderAt('/despesas')
    fireEvent.click(screen.getByText('Adicionar'))
    expect(container.querySelector('[data-tour="form"]')).not.toBeNull()
  })
  it('tour interativo abre e avança', () => {
    renderAt('/faturamento')
    fireEvent.click(screen.getByText(/Aprender a usar esta aba/))
    expect(screen.getByRole('dialog', { name: 'Tour interativo' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('Avançar'))
    expect(screen.getByText(/Passo 2 de/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Pular'))
  })
  it('calculadora normal faz porcentagem', () => {
    renderAt('/calculadora')
    fireEvent.change(screen.getByLabelText('Expressão'), { target: { value: '200*10%' } })
    fireEvent.click(screen.getByText('='))
    expect(screen.getByTestId('calc-out')).toHaveTextContent('20')
  })
  it('modo demonstração é identificado', () => {
    renderAt('/')
    expect(screen.getByText(/MODO DEMONSTRAÇÃO/)).toBeInTheDocument()
  })
})
