import { useAuth, type User } from '@/store/auth'
import { snapshot, useData } from '@/store/data'
import { useSync } from '@/store/sync'
import { api } from './api'
import { appDataSchema } from './schemas'

/**
 * Sincroniza os dados deste aparelho com a conta. O servidor junta com o que veio dos outros
 * aparelhos e devolve a versão completa, que substitui a daqui.
 * Uma sincronização por vez; pedidos no meio do caminho viram mais uma rodada no fim.
 */
let running: Promise<void> | null = null
let again = false

export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      do {
        again = false
        await syncOnce()
      } while (again)
    } finally {
      running = null
    }
  })()
  return running
}

async function syncOnce() {
  const { token, expired, user } = useAuth.getState()
  // Só envia dados que são desta conta
  if (!token || expired || !user || useData.getState().ownerId !== user.id) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  const sync = useSync.getState()
  try {
    const local = useData.getState()
    if (sync.revision !== null && sync.syncedUpdatedAt === local.updatedAt) {
      // Nada mudou aqui: só baixa se outro aparelho mudou alguma coisa
      const { revision } = await api.syncRevision()
      if (revision === sync.revision) return
    }

    sync.setStatus('syncing')
    const sent = snapshot()
    const { account } = await api.sync(sent, sync.revision === null)
    const parsed = appDataSchema.safeParse(account.data)
    if (!parsed.success) throw new Error('Os dados da conta estão num formato que esta versão não reconhece. Atualize o app.')

    if (useData.getState().updatedAt === sent.updatedAt) {
      useData.getState().replaceAll(parsed.data)
      sync.setSynced(account.revision, parsed.data.updatedAt)
    } else {
      // Mudou algo aqui enquanto enviava: manda de novo, que o servidor junta
      sync.setSynced(account.revision, sent.updatedAt)
      again = true
    }
  } catch (err) {
    sync.setStatus('error', err instanceof Error ? err.message : 'Falha ao sincronizar.')
  }
}

/**
 * Entra na conta neste aparelho. Se os dados daqui são de outra conta (ou o aparelho é novo),
 * começa do zero e traz os dados da conta antes de abrir o app.
 * Retorna true quando os dados vieram de outro aparelho.
 */
export async function startSession(token: string, user: User): Promise<boolean> {
  useAuth.getState().setSession(token, user)
  const data = useData.getState()
  const fresh = data.ownerId !== user.id
  if (fresh) {
    data.resetFor(user.id)
    useSync.getState().reset()
  }
  await syncNow()
  return fresh && !!useData.getState().business
}
