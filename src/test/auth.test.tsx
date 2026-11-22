import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuthScreen } from '../components/Auth'
import { authEnabled } from '../lib/supabase'

describe('login', () => {
  it('sem Supabase configurado o login fica desligado (modo local)', () => {
    expect(authEnabled).toBe(false)
  })
  it('tela de acesso alterna entre entrar, criar conta e recuperar senha', () => {
    render(<AuthScreen />)
    expect(screen.getByText('Entrar na sua conta')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Criar conta'))
    expect(screen.getByText('Criar conta grátis')).toBeInTheDocument()
    expect(screen.getByText('Nome do restaurante')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Já tenho conta'))
    fireEvent.click(screen.getByText('Esqueci a senha'))
    expect(screen.getByText('Recuperar acesso')).toBeInTheDocument()
    expect(screen.queryByText('Senha')).toBeNull()
  })
})
