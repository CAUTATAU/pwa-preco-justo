import type { PriceStatus } from '@/lib/calc'
import { cn } from '@/lib/utils'

export const STATUS_INFO: Record<PriceStatus, { label: string; short: string; dot: string; soft: string; text: string }> = {
  vermelho: {
    label: 'Prejuízo: o preço não cobre o custo',
    short: 'Prejuízo',
    dot: 'bg-bad',
    soft: 'bg-bad/12 border-bad/30',
    text: 'text-bad',
  },
  amarelo: {
    label: 'Cobre o custo, mas sobra pouco',
    short: 'Sobra pouco',
    dot: 'bg-warn',
    soft: 'bg-warn/15 border-warn/40',
    text: 'text-[color-mix(in_oklch,var(--warn),black_35%)]',
  },
  verde: {
    label: 'Preço saudável',
    short: 'Saudável',
    dot: 'bg-ok',
    soft: 'bg-ok/12 border-ok/30',
    text: 'text-[color-mix(in_oklch,var(--ok),black_20%)]',
  },
  incompleto: {
    label: 'Falta informação para calcular',
    short: 'Incompleto',
    dot: 'bg-idle',
    soft: 'bg-muted border-border',
    text: 'text-muted-foreground',
  },
}

export function StatusBadge({ status, className }: { status: PriceStatus; className?: string }) {
  const info = STATUS_INFO[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold',
        info.soft,
        info.text,
        className,
      )}
    >
      <span className={cn('size-2 rounded-full', info.dot)} />
      {info.short}
    </span>
  )
}

const LIGHT_VAR: Record<PriceStatus, string> = { vermelho: 'bad', amarelo: 'warn', verde: 'ok', incompleto: 'idle' }

/** Semáforo de 3 luzes (RF14 / RN04). */
export function TrafficLight({ status, className }: { status: PriceStatus; className?: string }) {
  const lights: PriceStatus[] = ['vermelho', 'amarelo', 'verde']
  return (
    <div
      className={cn('flex flex-col gap-1.5 rounded-2xl bg-foreground/90 p-2 shadow-inner', className)}
      role="img"
      aria-label={STATUS_INFO[status].label}
    >
      {lights.map((l) => {
        const color = `var(--${LIGHT_VAR[l]})`
        return (
          <span
            key={l}
            className="size-5 rounded-full transition-all duration-500"
            style={
              status === l
                ? { background: color, boxShadow: `0 0 14px 2px ${color}` }
                : { background: 'rgb(255 255 255 / 0.15)' }
            }
          />
        )
      })}
    </div>
  )
}
