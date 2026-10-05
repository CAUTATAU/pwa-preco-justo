import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SyncState = {
  /** Consentimento explícito para guardar uma cópia na nuvem (RNF06) */
  enabled: boolean
  lastSavedAt: string | null
  status: 'idle' | 'saving' | 'error'
  error: string | null
  setEnabled: (enabled: boolean) => void
  setStatus: (status: SyncState['status'], error?: string | null) => void
  setSaved: (at: string) => void
}

export const useSync = create<SyncState>()(
  persist(
    (set) => ({
      enabled: false,
      lastSavedAt: null,
      status: 'idle',
      error: null,
      setEnabled: (enabled) => set({ enabled, ...(enabled ? {} : { lastSavedAt: null }) }),
      setStatus: (status, error = null) => set({ status, error }),
      setSaved: (at) => set({ lastSavedAt: at, status: 'idle', error: null }),
    }),
    {
      name: 'preco-justo:sync',
      partialize: (s) => ({ enabled: s.enabled, lastSavedAt: s.lastSavedAt }),
    },
  ),
)
