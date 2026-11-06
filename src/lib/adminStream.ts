import { useAuth } from '@/store/auth'
import type { LiveEvent } from './adminTypes'
import { BASE_URL } from './api'

export type StreamStatus = 'conectando' | 'ao-vivo' | 'reconectando'

type Handlers = {
  onEvents: (events: LiveEvent[]) => void
  onChanged: () => void
  onStatus: (status: StreamStatus) => void
}

/**
 * Canal ao vivo do painel (GET /api/admin/stream, Server-Sent Events).
 * Lido com fetch para mandar o token no cabeçalho; reconecta sozinho se a conexão cair.
 * Retorna a função que fecha o canal.
 */
export function connectAdminStream({ onEvents, onChanged, onStatus }: Handlers): () => void {
  let closed = false
  let controller: AbortController | null = null
  let retry: ReturnType<typeof setTimeout> | undefined

  const dispatch = (block: string) => {
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (event === 'hello') onStatus('ao-vivo')
    else if (event === 'changed') onChanged()
    else if (event === 'events' && data) {
      try {
        onEvents(JSON.parse(data) as LiveEvent[])
      } catch {
        /* bloco incompleto: ignora */
      }
    }
  }

  const open = async () => {
    if (closed) return
    controller = new AbortController()
    const token = useAuth.getState().token
    try {
      const res = await fetch(`${BASE_URL}/admin/stream`, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        signal: controller.signal,
      })
      if (res.status === 401 || res.status === 403) {
        useAuth.getState().markExpired()
        return
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value.replace(/\r\n/g, '\n')
        let cut: number
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          dispatch(buffer.slice(0, cut))
          buffer = buffer.slice(cut + 2)
        }
      }
      throw new Error('conexão encerrada')
    } catch {
      if (closed) return
      onStatus('reconectando')
      retry = setTimeout(() => void open(), 3000)
    }
  }

  onStatus('conectando')
  void open()
  return () => {
    closed = true
    clearTimeout(retry)
    controller?.abort()
  }
}
