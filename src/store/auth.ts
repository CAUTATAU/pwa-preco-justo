import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type User = { id: string; name: string; email: string; createdAt: string }

type AuthState = {
  token: string | null
  user: User | null
  /** Token recusado pelo servidor: os dados continuam no aparelho, só o backup pede novo login */
  expired: boolean
  setSession: (token: string, user: User) => void
  markExpired: () => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      expired: false,
      setSession: (token, user) => set({ token, user, expired: false }),
      markExpired: () => set({ expired: true }),
      logout: () => set({ token: null, user: null, expired: false }),
    }),
    { name: 'preco-justo:auth' },
  ),
)
