import { useEffect } from 'react'
import { syncNow } from '@/lib/cloudSync'
import { useAuth } from '@/store/auth'
import { useData } from '@/store/data'
import { useOnline } from './useOnline'

/** De quanto em quanto tempo confere se outro aparelho mudou algo (só a revisão, uma consulta leve) */
const POLL_MS = 30_000

/**
 * Mantém os dados da conta iguais em todos os aparelhos.
 * Envia as mudanças daqui alguns segundos depois da última alteração e traz as dos outros
 * aparelhos ao abrir o app, ao voltar para ele e a cada 30 s. Sem internet, espera a conexão voltar.
 */
export function useCloudSync() {
  const token = useAuth((s) => s.token)
  const expired = useAuth((s) => s.expired)
  const updatedAt = useData((s) => s.updatedAt)
  const online = useOnline()
  const active = !!token && !expired && online

  // Ao abrir, ao entrar e quando a internet volta
  useEffect(() => {
    if (active) void syncNow()
  }, [active])

  // Mudança feita aqui
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => void syncNow(), 2000)
    return () => clearTimeout(timer)
  }, [active, updatedAt])

  // Mudanças feitas nos outros aparelhos
  useEffect(() => {
    if (!active) return
    const onVisible = () => document.visibilityState === 'visible' && void syncNow()
    const timer = setInterval(() => document.visibilityState === 'visible' && void syncNow(), POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [active])
}
