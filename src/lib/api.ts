import { useAuth, type User } from '@/store/auth'
import type { AppData } from './schemas'

/**
 * Em desenvolvimento o Vite repassa /api para o backend (vite.config.ts).
 * Em homologação, aponte VITE_API_URL para a URL do ngrok (ex.: https://xxxx.ngrok-free.app/api).
 */
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ApiError(0, 'Você está sem internet. Tente de novo quando a conexão voltar.')
  }
  const token = useAuth.getState().token
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  // evita a página de aviso do ngrok gratuito
  headers.set('ngrok-skip-browser-warning', 'true')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Não foi possível falar com o servidor. Verifique sua internet.')
  }

  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && token) useAuth.getState().markExpired()
    throw new ApiError(res.status, body?.error ?? 'Algo deu errado. Tente novamente.')
  }
  return body as T
}

type Session = { token: string; user: User }

export type CloudBackup = { data: AppData; dataUpdatedAt: string; savedAt: string }

export const api = {
  login: (email: string, password: string) =>
    request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) =>
    request<Session>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  me: () => request<{ user: User }>('/auth/me'),
  getBackup: () => request<{ backup: CloudBackup | null }>('/backup'),
  putBackup: (data: AppData) => request<{ savedAt: string }>('/backup', { method: 'PUT', body: JSON.stringify({ data }) }),
  deleteBackup: () => request<void>('/backup', { method: 'DELETE' }),
}
