/**
 * Medição de uso do app para o painel do administrador.
 *
 * Registra: telas abertas e o tempo ativo em cada uma, botões tocados, cliques repetidos (sinal de
 * frustração), mensagens de erro e de sucesso que o app mostrou e erros inesperados.
 * NÃO registra nada que a pessoa digita. Os eventos vão em lotes e, sem internet, esperam a conexão.
 * A conta de administrador não é medida.
 */
import { toast } from 'sonner'
import { useAuth } from '@/store/auth'
import { BASE_URL } from './api'
import { uid } from './format'

type EventType =
  | 'session_start'
  | 'heartbeat'
  | 'page_view'
  | 'page_time'
  | 'click'
  | 'rage_click'
  | 'form_error'
  | 'success'
  | 'js_error'

type TrackEvent = {
  type: EventType
  path: string
  target?: string
  value?: number
  meta?: Record<string, string | number | boolean | null>
  at: string
}

const FLUSH_MS = 5_000
const HEARTBEAT_MS = 60_000
const TICK_MS = 5_000
/** Sem tocar na tela por mais que isso, o tempo para de contar (aba esquecida aberta) */
const IDLE_MS = 2 * 60_000
const MAX_QUEUE = 300

let queue: TrackEvent[] = []
let sessionId = ''
let started = false
let currentPath: string | null = null
let activeMs = 0
let lastTick = Date.now()
let lastInteraction = Date.now()
let flushing = false

const isAdmin = () => useAuth.getState().user?.role === 'admin'

function getSessionId(): string {
  try {
    const saved = sessionStorage.getItem('preco-justo:sessao')
    if (saved) return saved
    const id = uid().replace(/[^A-Za-z0-9_-]/g, '')
    sessionStorage.setItem('preco-justo:sessao', id)
    return id
  } catch {
    return uid().replace(/[^A-Za-z0-9_-]/g, '')
  }
}

/** Tira números, valores e nomes entre aspas das mensagens: o painel soma a mesma mensagem. */
export function scrub(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/"[^"]*"|“[^”]*”/g, '"…"')
    .replace(/^[^:]{1,60}: \+/, '…: +')
    .replace(/R\$\s?[\d.,]+/g, 'R$ #')
    .replace(/\d+([.,]\d+)*/g, '#')
    .slice(0, 120)
}

export function track(type: EventType, data: Omit<Partial<TrackEvent>, 'type' | 'at'> = {}) {
  if (!started || isAdmin()) return
  queue.push({ type, path: data.path ?? location.pathname, ...data, at: new Date().toISOString() })
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE)
  if (queue.length >= 25) void flush()
}

async function flush(keepalive = false) {
  if (flushing || !queue.length || (typeof navigator !== 'undefined' && !navigator.onLine)) return
  if (isAdmin()) {
    queue = []
    return
  }
  flushing = true
  const batch = queue.slice(0, 100)
  const { token, expired } = useAuth.getState()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }
  if (token && !expired) headers.Authorization = `Bearer ${token}`
  try {
    const res = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId, events: batch }),
      keepalive,
    })
    // 4xx: lote recusado, não adianta reenviar. 5xx/429: tenta de novo depois
    if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) queue = queue.slice(batch.length)
  } catch {
    /* sem conexão: fica na fila */
  } finally {
    flushing = false
  }
}

/** Soma o tempo ativo da tela atual (aba visível e alguém mexendo nos últimos minutos). */
function tick() {
  const now = Date.now()
  if (document.visibilityState === 'visible' && now - lastInteraction < IDLE_MS) activeMs += now - lastTick
  lastTick = now
}

function closePage() {
  tick()
  if (currentPath && activeMs >= 500) track('page_time', { path: currentPath, value: Math.round(activeMs) })
  activeMs = 0
}

/** Chamado a cada troca de tela (App.tsx). */
export function trackPage(path: string) {
  if (path === currentPath) return
  const from = currentPath
  closePage()
  currentPath = path
  if (path.startsWith('/admin')) return
  track('page_view', { path, meta: from ? { fromPath: from } : undefined })
}

const CLICKABLE =
  'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="switch"], [role="radio"], [role="checkbox"], [role="option"], [role="combobox"], [data-track]'

/**
 * Texto do botão. Rótulos curtos do app ("40h", "30%", "15 min") ficam como estão;
 * nos longos saem números e valores, que podem ser dados da pessoa.
 */
function scrubLabel(text: string): string {
  const first = text.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  return first.length <= 12 && !/R\$/.test(first) ? first : scrub(first).slice(0, 60)
}

function labelOf(el: Element): string {
  const tracked = el.getAttribute('data-track')
  if (tracked) return tracked
  const role = el.getAttribute('role')
  // Itens de lista e seletores mostram o que a pessoa cadastrou: só o tipo do controle
  if (role === 'option') return 'Opção de uma lista'
  if (role === 'combobox') return 'Abrir lista de opções'
  const aria = el.getAttribute('aria-label')
  if (aria) return scrubLabel(aria)
  const text = scrubLabel((el as HTMLElement).innerText || el.textContent || '')
  if (el.tagName === 'A') {
    const href = el.getAttribute('href') ?? ''
    if (text && text.length <= 30 && !text.includes('#')) return text
    return `Link para ${href.split('?')[0]?.replace(/\/itens\/[^/]+/, '/itens/:id')}`
  }
  return text || (el as HTMLElement).title || el.tagName.toLowerCase()
}

let lastClick = { label: '', at: 0, count: 0 }

function onClick(e: MouseEvent) {
  lastInteraction = Date.now()
  // Troca de tela rápida (página ainda carregando) pode não chegar a montar: confere a URL real
  if (location.pathname !== currentPath) trackPage(location.pathname)
  const el = (e.target as Element | null)?.closest?.(CLICKABLE)
  if (!el || location.pathname.startsWith('/admin')) return
  const label = labelOf(el)
  track('click', { target: label })

  const now = Date.now()
  if (label === lastClick.label && now - lastClick.at < 800) {
    lastClick.count++
    // 3 toques seguidos no mesmo lugar: a pessoa esperava algo que não aconteceu
    if (lastClick.count === 3) track('rage_click', { target: label })
  } else {
    lastClick = { label, at: now, count: 1 }
  }
  lastClick.at = now
}

/** Mensagens de erro e de sucesso já passam pelo toast: medir ali cobre todos os formulários. */
function wrapToasts() {
  const originalError = toast.error
  const originalSuccess = toast.success
  toast.error = ((message, data) => {
    if (typeof message === 'string') track('form_error', { target: scrub(message) })
    return originalError(message, data)
  }) as typeof toast.error
  toast.success = ((message, data) => {
    if (typeof message === 'string') track('success', { target: scrub(message) })
    return originalSuccess(message, data)
  }) as typeof toast.success
}

function deviceOf(): string {
  const w = Math.min(window.innerWidth, window.screen?.width || window.innerWidth)
  return w < 768 ? 'celular' : w < 1024 ? 'tablet' : 'computador'
}

export function initAnalytics() {
  if (started || typeof window === 'undefined') return
  started = true
  sessionId = getSessionId()
  wrapToasts()

  track('session_start', {
    meta: {
      device: deviceOf(),
      standalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
      width: window.innerWidth,
    },
  })

  document.addEventListener('click', onClick, { capture: true })
  for (const ev of ['keydown', 'scroll', 'touchstart', 'pointermove'] as const) {
    window.addEventListener(ev, () => (lastInteraction = Date.now()), { passive: true, capture: true })
  }

  window.addEventListener('error', (e) => {
    if (!e.message || /ResizeObserver/.test(e.message)) return
    track('js_error', { target: scrub(e.message) })
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason instanceof Error ? e.reason.message : String(e.reason ?? '')
    if (reason) track('js_error', { target: scrub(reason) })
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      closePage()
      void flush(true)
    } else {
      lastTick = Date.now()
      lastInteraction = Date.now()
    }
  })
  window.addEventListener('pagehide', () => {
    closePage()
    void flush(true)
  })
  window.addEventListener('online', () => void flush())

  setInterval(tick, TICK_MS)
  setInterval(() => void flush(), FLUSH_MS)
  // "Online agora" no painel: só quem está com o app aberto e mexendo
  setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastInteraction < IDLE_MS && !location.pathname.startsWith('/admin')) {
      track('heartbeat')
    }
  }, HEARTBEAT_MS)
}

/**
 * O admin acabou de entrar: o que esta aba mediu antes do login (tela de entrar) era dele,
 * então sai das estatísticas. Daqui em diante nada é medido nesta sessão.
 */
export async function forgetThisSession() {
  queue = []
  const token = useAuth.getState().token
  if (!sessionId || !token) return
  try {
    await fetch(`${BASE_URL}/admin/forget-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ sessionId }),
    })
  } catch {
    /* só estatística */
  }
}
