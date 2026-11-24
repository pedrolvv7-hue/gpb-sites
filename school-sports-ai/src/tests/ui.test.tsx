import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NewMatch from '../pages/NewMatch'
import { useStore, useDemo } from '../store/store'
import { newMatch } from '../store/matchFactory'

beforeEach(() => { useStore.getState().deleteAll(); useDemo.getState().clear() })

describe('assistente de nova partida', () => {
  it('bloqueia avanço sem nome válido', () => {
    render(<MemoryRouter initialEntries={['/nova?esporte=futsal']}><NewMatch /></MemoryRouter>)
    const name = screen.getByLabelText(/Nome da partida/i) as HTMLInputElement
    fireEvent.change(name, { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('alert').textContent).toMatch(/mín\. 2/)
  })
  it('bloqueia números de camisa repetidos', () => {
    render(<MemoryRouter initialEntries={['/nova?esporte=futsal']}><NewMatch /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    const add = screen.getAllByRole('button', { name: /Adicionar jogador/ })[0]
    fireEvent.click(add); fireEvent.click(add)
    screen.getAllByLabelText('Número').slice(0, 2).forEach((el) => fireEvent.change(el, { target: { value: '7' } }))
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('alert').textContent).toMatch(/repetidos/)
  })
})

describe('isolamento do modo demonstração', () => {
  it('partida de demonstração nunca vai para o armazenamento real', () => {
    useStore.getState().saveMatch(newMatch('futsal', { demo: true, name: 'demo' }))
    expect(Object.keys(useStore.getState().matches).length).toBe(0)
    expect(Object.keys(useDemo.getState().matches).length).toBe(1)
    useStore.getState().saveMatch(newMatch('futsal', { name: 'real' }))
    expect(Object.keys(useStore.getState().matches).length).toBe(1)
  })
})
