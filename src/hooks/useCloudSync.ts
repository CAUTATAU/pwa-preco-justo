import { useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { snapshot, useData } from '@/store/data'
import { useSync } from '@/store/sync'
import { useOnline } from './useOnline'

/**
 * Backup automático na nuvem, só quando o empreendedor ligou a opção (RNF06).
 * Espera alguns segundos sem alterações e envia uma cópia; se estiver offline,
 * envia quando a conexão voltar.
 */
export function useCloudSync() {
  const enabled = useSync((s) => s.enabled)
  const token = useAuth((s) => s.token)
  const expired = useAuth((s) => s.expired)
  const updatedAt = useData((s) => s.updatedAt)
  const online = useOnline()
  const lastPushed = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !token || expired || !online) return
    if (lastPushed.current === updatedAt) return
    const savedAt = useSync.getState().lastSavedAt
    if (!lastPushed.current && savedAt && savedAt >= updatedAt) {
      lastPushed.current = updatedAt
      return
    }

    const timer = setTimeout(async () => {
      const sync = useSync.getState()
      sync.setStatus('saving')
      try {
        const data = snapshot()
        const { savedAt } = await api.putBackup(data)
        lastPushed.current = data.updatedAt
        sync.setSaved(savedAt)
      } catch (err) {
        sync.setStatus('error', err instanceof Error ? err.message : 'Falha no backup')
      }
    }, 2500)
    return () => clearTimeout(timer)
  }, [enabled, token, expired, online, updatedAt])
}
