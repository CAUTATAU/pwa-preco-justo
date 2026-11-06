/**
 * Gráficos do painel do administrador, em HTML/CSS (sem biblioteca de gráficos).
 * Barras finas (≤ 24px) com ponta arredondada, 2px de espaço entre elas, grade discreta,
 * texto sempre na cor de texto (nunca na cor da série) e dica ao passar o mouse/tocar.
 */
import { type ReactNode, createContext, useCallback, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Dica flutuante (hover / toque)                                      */
/* ------------------------------------------------------------------ */

type TipState = { x: number; y: number; content: ReactNode } | null
const TipContext = createContext<{ show: (e: React.PointerEvent, content: ReactNode) => void; hide: () => void }>({
  show: () => undefined,
  hide: () => undefined,
})

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TipState>(null)
  const show = useCallback((e: React.PointerEvent, content: ReactNode) => setTip({ x: e.clientX, y: e.clientY, content }), [])
  const hide = useCallback(() => setTip(null), [])
  const flipX = tip && tip.x > window.innerWidth - 220
  return (
    <TipContext.Provider value={{ show, hide }}>
      {children}
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 max-w-[240px] rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg"
          style={{
            left: flipX ? undefined : tip.x + 14,
            right: flipX ? window.innerWidth - tip.x + 14 : undefined,
            top: tip.y + 14,
          }}
        >
          {tip.content}
        </div>
      )}
    </TipContext.Provider>
  )
}

const useTip = () => useContext(TipContext)

/** Alvo de hover maior que a marca, para ser fácil de acertar */
function hoverProps(show: ReturnType<typeof useTip>['show'], hide: () => void, content: ReactNode) {
  return {
    onPointerEnter: (e: React.PointerEvent) => show(e, content),
    onPointerMove: (e: React.PointerEvent) => show(e, content),
    onPointerLeave: hide,
  }
}

export const nf = new Intl.NumberFormat('pt-BR')
export const compact = (n: number) => (n >= 10_000 ? new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(n) : nf.format(Math.round(n)))

/* ------------------------------------------------------------------ */
/* Barras horizontais (ranking)                                         */
/* ------------------------------------------------------------------ */

export type BarRow = { key: string; label: ReactNode; value: number; display: ReactNode; detail?: ReactNode; highlight?: boolean }

export function BarRows({ rows, empty = 'Ainda sem dados.' }: { rows: BarRow[]; empty?: string }) {
  const { show, hide } = useTip()
  const max = Math.max(...rows.map((r) => r.value), 0)
  if (!rows.length || max <= 0) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="group" {...hoverProps(show, hide, r.detail ?? r.display)}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className={cn('min-w-0 truncate', r.highlight && 'font-semibold')}>{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{r.display}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-700',
                r.highlight ? 'bg-primary' : 'bg-primary/55 group-hover:bg-primary/80',
              )}
              style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 1.5 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Colunas por dia                                                      */
/* ------------------------------------------------------------------ */

export function DailyColumns({
  data,
  format = (n: number) => nf.format(n),
}: {
  data: { key: string; label: string; value: number }[]
  format?: (n: number) => string
}) {
  const { show, hide } = useTip()
  const rawMax = Math.max(...data.map((d) => d.value), 0)
  const max = niceMax(rawMax)
  const ticks = [max, max / 2, 0]
  const labelEvery = Math.ceil(data.length / 6)

  return (
    <div className="flex gap-2">
      <div className="flex h-44 w-10 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-muted-foreground">
        {ticks.map((t) => (
          <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
            {compact(t)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-44 border-b border-border">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border/70" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-border/70" />
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d) => (
              <div
                key={d.key}
                className="group flex h-full min-w-0 flex-1 items-end justify-center"
                {...hoverProps(
                  show,
                  hide,
                  <>
                    <p className="font-semibold">{d.label}</p>
                    <p className="tabular-nums">{format(d.value)}</p>
                  </>,
                )}
              >
                <div
                  className="w-full max-w-6 rounded-t-[4px] bg-primary/70 transition-[height] duration-700 group-hover:bg-primary"
                  style={{ height: max > 0 ? `${(d.value / max) * 100}%` : 0, minHeight: d.value > 0 ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1 flex gap-[2px] text-[10.5px] text-muted-foreground">
          {data.map((d, i) => (
            <span key={d.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
              {i % labelEvery === 0 || i === data.length - 1 ? d.label.slice(0, 5) : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function niceMax(n: number) {
  if (n <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(n))
  const steps = [1, 2, 2.5, 5, 10]
  for (const s of steps) if (s * pow >= n) return s * pow
  return 10 * pow
}

/* ------------------------------------------------------------------ */
/* Mapa de calor: dia da semana × hora                                 */
/* ------------------------------------------------------------------ */

/** Rampa sequencial de um tom (azul), do claro ao escuro */
const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']
const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function Heatmap({ cells, describe }: { cells: { dow: number; h: number; value: number }[]; describe: (v: number) => string }) {
  const { show, hide } = useTip()
  const map = new Map(cells.map((c) => [`${c.dow}-${c.h}`, c.value]))
  const max = Math.max(...cells.map((c) => c.value), 0)
  const colorOf = (v: number) => (v <= 0 || max <= 0 ? undefined : RAMP[Math.min(RAMP.length - 1, Math.floor((v / max) * (RAMP.length - 0.001)))])

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[340px]">
        <div className="grid grid-cols-[32px_repeat(24,minmax(0,1fr))] gap-[2px]">
          {DOW.map((day, i) => (
            <div key={day} className="contents">
              <span className="pr-1 text-right text-[11px] leading-[18px] text-muted-foreground">{day}</span>
              {Array.from({ length: 24 }, (_, h) => {
                const v = map.get(`${i + 1}-${h}`) ?? 0
                return (
                  <div
                    key={h}
                    className="h-[18px] rounded-[3px] bg-muted transition-colors hover:outline-2 hover:outline-foreground/40"
                    style={{ background: colorOf(v) }}
                    {...hoverProps(
                      show,
                      hide,
                      <>
                        <p className="font-semibold">
                          {day}, {String(h).padStart(2, '0')}h–{String(h + 1).padStart(2, '0')}h
                        </p>
                        <p className="tabular-nums">{describe(v)}</p>
                      </>,
                    )}
                  />
                )
              })}
            </div>
          ))}
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center text-[10px] text-muted-foreground">
              {h % 3 === 0 ? `${h}h` : ''}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          menos
          <span className="size-3 rounded-[3px] bg-muted" />
          {RAMP.map((c) => (
            <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} />
          ))}
          mais
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Barra segmentada (um todo dividido em partes)                        */
/* ------------------------------------------------------------------ */

/** Paleta categórica de referência (ordem fixa, validada para daltonismo nos 3 primeiros) */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a']

export function Segmented({ parts, empty = 'Ainda sem dados.' }: { parts: { label: string; value: number }[]; empty?: string }) {
  const { show, hide } = useTip()
  const total = parts.reduce((a, p) => a + p.value, 0)
  if (total <= 0) return <p className="py-2 text-sm text-muted-foreground">{empty}</p>
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {parts.map((p, i) =>
          p.value > 0 ? (
            <div
              key={p.label}
              className="h-full transition-[width] duration-700"
              style={{ width: `${(p.value / total) * 100}%`, background: SERIES[i % SERIES.length] }}
              {...hoverProps(show, hide, `${p.label}: ${nf.format(p.value)} (${Math.round((p.value / total) * 100)}%)`)}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
            {p.label}
            <span className="tabular-nums text-muted-foreground">
              {nf.format(p.value)} ({Math.round((p.value / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
