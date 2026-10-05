import { ChevronRightIcon, CornerDownRightIcon, PlusIcon, TagsIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, PageHeader } from '@/components/common'
import { StatusBadge } from '@/components/PriceStatus'
import { Button } from '@/components/ui/button'
import { useCalc } from '@/hooks/useCalc'
import type { ItemCost } from '@/lib/calc'
import { brl, minutesLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

export function ItemsPage() {
  const { calc, t } = useCalc()
  const ids = new Set(calc.items.map((c) => c.item.id))
  const roots = calc.items.filter((c) => !c.item.variantOf || !ids.has(c.item.variantOf))
  const variantsOf = (id: string) => calc.items.filter((c) => c.item.variantOf === id)

  return (
    <div>
      <PageHeader
        title={t.Items}
        subtitle={`Tudo que você vende, com o custo de cada ${t.unit}.`}
        action={
          calc.items.length > 0 && (
            <Button asChild>
              <Link to="/itens/novo">
                <PlusIcon /> Novo
              </Link>
            </Button>
          )
        }
      />

      {calc.items.length === 0 ? (
        <EmptyState
          icon={<TagsIcon />}
          title={`Nenhum ${t.item} cadastrado`}
          text="Comece pelo que você mais vende. Leva menos de 5 minutos."
          action={
            <Button asChild size="lg">
              <Link to="/itens/novo">
                <PlusIcon /> Cadastrar {t.item}
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {roots.map((c) => (
            <li key={c.item.id} className="space-y-2">
              <ItemCard cost={c} unit={t.unit} />
              {variantsOf(c.item.id).map((v) => (
                <div key={v.item.id} className="flex items-stretch gap-1 pl-3">
                  <CornerDownRightIcon className="mt-4 size-4 shrink-0 text-muted-foreground" />
                  <ItemCard cost={v} unit={t.unit} variant />
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ItemCard({ cost: c, unit, variant }: { cost: ItemCost; unit: string; variant?: boolean }) {
  return (
    <Link
      to={`/itens/${c.item.id}`}
      className={cn('flex flex-1 items-center gap-3 rounded-2xl border bg-card p-4 active:bg-muted', variant && 'bg-card/70')}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{c.item.name}</p>
        </div>
        <StatusBadge status={c.status} />
        <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
          <div>
            <p className="text-muted-foreground">Cobra</p>
            <p className="font-semibold tabular-nums">{brl(c.price)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Custa</p>
            <p className="font-semibold tabular-nums">{brl(c.total)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ideal</p>
            <p className="font-semibold tabular-nums text-primary">{brl(c.idealPrice)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {minutesLabel(c.hoursPerUnit * 60)} por {unit}
          {c.item.monthlyVolume > 0 && ` · ${c.item.monthlyVolume} por mês`}
        </p>
      </div>
      <ChevronRightIcon className="size-5 text-muted-foreground" />
    </Link>
  )
}
