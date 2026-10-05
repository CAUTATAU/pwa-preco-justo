import { ChevronRightIcon, PlusIcon, TagsIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, Money } from '@/components/common'
import { StatusBadge } from '@/components/PriceStatus'
import BlurText from '@/components/reactbits/BlurText'
import CountUp from '@/components/reactbits/CountUp'
import { TipCard } from '@/components/TipCard'
import { Button } from '@/components/ui/button'
import { useCalc } from '@/hooks/useCalc'
import type { PriceStatus } from '@/lib/calc'
import { brl } from '@/lib/format'
import { cn } from '@/lib/utils'

const ORDER: Record<PriceStatus, number> = { vermelho: 0, incompleto: 1, amarelo: 2, verde: 3 }

export function HomePage() {
  const { data, calc, tips, t } = useCalc()
  const [showAllTips, setShowAllTips] = useState(false)

  const counts = { vermelho: 0, amarelo: 0, verde: 0, incompleto: 0 }
  for (const c of calc.items) counts[c.status]++
  const monthly = calc.items.reduce((acc, c) => acc + c.monthlyProfit, 0)
  const hasVolume = calc.items.some((c) => c.item.monthlyVolume > 0)
  const sorted = [...calc.items].sort((a, b) => ORDER[a.status] - ORDER[b.status])
  const visibleTips = showAllTips ? tips : tips.slice(0, 2)

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">{data.business?.name}</p>
        <BlurText text="O seu preço está justo?" className="text-2xl font-bold tracking-tight" delay={60} />
      </header>

      {calc.items.length > 0 && (
        <section className="grid grid-cols-3 gap-2">
          {(
            [
              ['vermelho', 'Prejuízo', 'bg-bad'],
              ['amarelo', 'Sobra pouco', 'bg-warn'],
              ['verde', 'Saudáveis', 'bg-ok'],
            ] as const
          ).map(([key, label, color]) => (
            <div key={key} className="rounded-2xl border bg-card p-3">
              <span className={cn('mb-2 block size-3 rounded-full', color)} />
              <CountUp to={counts[key]} duration={0.6} className="text-2xl font-bold tabular-nums" />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>
      )}

      {hasVolume && (
        <section
          className={cn(
            'rounded-2xl p-4 text-white shadow-sm',
            monthly >= 0 ? 'bg-gradient-to-br from-primary to-emerald-700' : 'bg-gradient-to-br from-bad to-rose-800',
          )}
        >
          <p className="text-sm opacity-90">{monthly >= 0 ? 'Sobra estimada por mês' : 'Prejuízo estimado por mês'}</p>
          <Money value={Math.abs(monthly)} className="text-3xl font-bold" />
          <p className="mt-1 text-xs opacity-80">
            Já descontados material, despesas fixas e o seu trabalho, pelas vendas que você informou.
          </p>
        </section>
      )}

      {tips.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Dicas do consultor</h2>
            {tips.length > 2 && (
              <Button variant="link" size="sm" onClick={() => setShowAllTips((v) => !v)}>
                {showAllTips ? 'Mostrar menos' : `Ver todas (${tips.length})`}
              </Button>
            )}
          </div>
          {visibleTips.map((tip) => (
            <TipCard key={tip.id} tip={tip} />
          ))}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Seus {t.items}</h2>
          {calc.items.length > 0 && (
            <Button asChild size="sm" variant="secondary">
              <Link to="/itens/novo">
                <PlusIcon /> Novo
              </Link>
            </Button>
          )}
        </div>

        {calc.items.length === 0 ? (
          <EmptyState
            icon={<TagsIcon />}
            title={`Nenhum ${t.item} ainda`}
            text={`Cadastre o ${t.item} que você mais vende e veja na hora se o preço cobre o custo.`}
            action={
              <Button asChild size="lg">
                <Link to="/itens/novo">
                  <PlusIcon /> Cadastrar {t.item}
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {sorted.map((c) => (
              <li key={c.item.id}>
                <Link to={`/itens/${c.item.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Cobra {brl(c.price)} · custa {brl(c.total)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
