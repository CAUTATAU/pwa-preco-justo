import { type ItemCost, priceParts } from '@/lib/calc'
import { brl, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

const COLORS: Record<string, string> = {
  material: 'bg-sky-500',
  labor: 'bg-violet-500',
  fixed: 'bg-amber-500',
  loss: 'bg-rose-400',
  profit: 'bg-ok',
}

/** Composição do preço (RF16): quanto é material, trabalho, despesa fixa, perda e sobra. */
export function PriceBar({ cost, showLegend = true }: { cost: ItemCost; showLegend?: boolean }) {
  const parts = priceParts(cost).filter((p) => p.value > 0.0001)
  const missing = cost.price < cost.total ? cost.total - cost.price : 0

  return (
    <div className="space-y-3">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
        {parts.map((p) => (
          <div
            key={p.key}
            className={cn('h-full transition-all duration-700', COLORS[p.key])}
            style={{ width: `${p.ratio * 100}%` }}
            title={`${p.label}: ${brl(p.value)}`}
          />
        ))}
      </div>
      {showLegend && (
        <ul className="grid grid-cols-1 gap-1.5 text-sm">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className={cn('size-3 rounded-sm', COLORS[p.key])} />
                {p.label}
              </span>
              <span className="tabular-nums">
                {brl(p.value)} <span className="text-muted-foreground">({pct(p.ratio)})</span>
              </span>
            </li>
          ))}
          {missing > 0 && (
            <li className="flex items-center justify-between gap-2 font-medium text-bad">
              <span className="flex items-center gap-2">
                <span className="size-3 rounded-sm border-2 border-bad" />
                Falta no preço
              </span>
              <span className="tabular-nums">{brl(missing)}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
