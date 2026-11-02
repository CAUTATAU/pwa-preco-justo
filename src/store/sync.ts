import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SyncState = {
  /** Revisão dos dados da conta que este aparelho já tem (null = nunca sincronizou) */
  revision: number | null
  /** updatedAt dos dados locais na última sincronização: se mudou, há o que enviar */
  syncedUpdatedAt: string | null
  lastSyncedAt: string | null
  status: 'idle' | 'syncing' | 'error'
  error: string | null
  setStatus: (status: SyncState['status'], error?: string | null) => void
  setSynced: (revision: number | null, syncedUpdatedAt: string) => void
  reset: () => void
}

/** Estado da sincronização dos dados da conta entre os aparelhos. */
export const useSync = create<SyncState>()(
  persist(
    (set) => ({
      revision: null,
      syncedUpdatedAt: null,
      lastSyncedAt: null,
      status: 'idle',
      error: null,
      setStatus: (status, error = null) => set({ status, error }),
      setSynced: (revision, syncedUpdatedAt) =>
        set({ revision, syncedUpdatedAt, lastSyncedAt: new Date().toISOString(), status: 'idle', error: null }),
      reset: () => set({ revision: null, syncedUpdatedAt: null, lastSyncedAt: null, status: 'idle', error: null }),
    }),
    {
      name: 'preco-justo:sync',
      version: 2,
      // A v1 era o backup opcional (enabled/lastSavedAt): agora todo aparelho sincroniza, começando do zero
      migrate: () => ({ revision: null, syncedUpdatedAt: null, lastSyncedAt: null }),
      partialize: (s) => ({ revision: s.revision, syncedUpdatedAt: s.syncedUpdatedAt, lastSyncedAt: s.lastSyncedAt }),
    },
  ),
)
