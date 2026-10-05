import { CopyIcon, EllipsisVerticalIcon, MessageCircleMoreIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog, Money, PageHeader, RichText } from '@/components/common'
import { GLOSSARY, Hint } from '@/components/Hint'
import { PriceBar } from '@/components/PriceBar'
import { STATUS_INFO, StatusBadge, TrafficLight } from '@/components/PriceStatus'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCalc } from '@/hooks/useCalc'
import { explainItem } from '@/lib/advisor'
import { brl, ceilCents, pct } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'

export function ItemDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, calc, t } = useCalc()
  const saveItem = useData((s) => s.saveItem)
  const removeItem = useData((s) => s.removeItem)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmPrice, setConfirmPrice] = useState<null | number>(null)

  const c = calc.byId.get(id)
  if (!c) return <Navigate to="/itens" replace />

  const info = STATUS_INFO[c.status]
  const explanation = explainItem(c, data)
  const targetMargin = (data.business?.targetMargin ?? 0) / 100
  const rootId = c.item.variantOf ?? c.item.id
  const siblings = calc.items.filter(
    (v) => v.item.id !== id && (v.item.id === rootId || v.item.variantOf === rootId),
  )

  return (
    <div className="space-y-5">
      <PageHeader
        back="/itens"
        title={c.item.name}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mais opções">
                <EllipsisVerticalIcon className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link to={`/itens/${id}/editar`}>
                  <PencilIcon /> Editar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/itens/novo?variante=${id}`}>
                  <CopyIcon /> Criar variante
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2Icon /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Semáforo */}
      <section className={cn('flex items-center gap-4 rounded-2xl border p-4', info.soft)}>
        <TrafficLight status={c.status} />
        <div className="min-w-0 flex-1">
          <p className={cn('text-lg font-bold leading-tight', info.text)}>{info.label}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Você cobra</p>
              <p className="text-xl font-bold tabular-nums">{brl(c.price)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Custa para você</p>
              <Money value={c.total} className="text-xl font-bold" />
            </div>
          </div>
        </div>
      </section>

      {/* Preços sugeridos (RF15) */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Preço mínimo</p>
          <p className="text-xl font-bold tabular-nums">{brl(ceilCents(c.minPrice))}</p>
          <p className="mt-1 text-xs text-muted-foreground">Só cobre os custos, sem sobra.</p>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-secondary p-4">
          <p className="flex items-center gap-1 text-xs text-secondary-foreground">
            Preço ideal <Hint title={GLOSSARY.margem.title}>{GLOSSARY.margem.text}</Hint>
          </p>
          <p className="text-xl font-bold tabular-nums text-primary">{brl(ceilCents(c.idealPrice))}</p>
          <p className="mt-1 text-xs text-muted-foreground">Cobre tudo e sobram {pct(targetMargin)}.</p>
        </div>
      </section>
      {c.status !== 'incompleto' && Math.abs(c.price - ceilCents(c.idealPrice)) >= 0.01 && (
        <Button variant="outline" className="w-full" onClick={() => setConfirmPrice(ceilCents(c.idealPrice))}>
          Usar o preço ideal ({brl(ceilCents(c.idealPrice))})
        </Button>
      )}

      {/* Consultor (RF22) */}
      {explanation.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <MessageCircleMoreIcon className="size-5 text-primary" /> O que isso quer dizer
          </h2>
          <ul className="space-y-2.5 text-sm leading-relaxed">
            {explanation.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>
                  <RichText text={line} />
                </span>
              </li>
            ))}
          </ul>
          {c.status === 'incompleto' && (
            <Button asChild className="mt-3 w-full">
              <Link to="/ajustes?hora=1">Definir o valor da minha hora</Link>
            </Button>
          )}
        </section>
      )}

      {/* Composição do preço (RF16) */}
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-semibold">Para onde vai o seu preço</h2>
        <PriceBar cost={c} />
      </section>

      {/* Conta aberta (RN07) */}
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">A conta, passo a passo</h2>
        <p className="mb-4 text-xs text-muted-foreground">De onde vem cada número do custo de 1 {t.unit}.</p>
        <ol className="space-y-4 text-sm">
          <Step title="Material" value={c.material}>
            {c.materialLines.length === 0 ? (
              <p>Nenhum insumo adicionado.</p>
            ) : (
              <ul className="space-y-1.5">
                {c.materialLines.map((l) => (
                  <li key={l.supplyId}>
                    <span className="font-medium text-foreground">{l.name}: {brl(l.perUnit)}</span>
                    <br />
                    {l.formula}
                  </li>
                ))}
              </ul>
            )}
          </Step>
          <Step title="Seu trabalho" value={c.labor}>
            {c.formulas.labor}
          </Step>
          <Step title="Despesas fixas" value={c.fixed}>
            {c.formulas.fixed}
          </Step>
          {c.loss > 0 && (
            <Step title="Perdas" value={c.loss}>
              {c.formulas.loss}
            </Step>
          )}
          <li className="flex items-center justify-between border-t pt-3 text-base font-bold">
            <span>Custo total</span>
            <span className="tabular-nums">{brl(c.total)}</span>
          </li>
        </ol>
      </section>

      {siblings.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1 font-semibold">
            Outras versões <Hint title={GLOSSARY.variante.title}>{GLOSSARY.variante.text}</Hint>
          </h2>
          <ul className="space-y-2">
            {siblings.map((v) => (
              <li key={v.item.id}>
                <Link to={`/itens/${v.item.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 p-3">
                  <span className="truncate text-sm font-medium">{v.item.name}</span>
                  <span className="flex items-center gap-2 text-sm tabular-nums">
                    {brl(v.price)} <StatusBadge status={v.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Excluir "${c.item.name}"?`}
        description="Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          removeItem(id)
          toast.success(`${t.Item} excluído.`)
          navigate('/itens', { replace: true })
        }}
      />
      <ConfirmDialog
        open={confirmPrice !== null}
        onOpenChange={(o) => !o && setConfirmPrice(null)}
        title="Mudar o preço?"
        description={`O preço de "${c.item.name}" vai passar de ${brl(c.price)} para ${brl(confirmPrice ?? 0)}.`}
        confirmLabel="Mudar preço"
        onConfirm={() => {
          if (confirmPrice !== null) saveItem({ ...c.item, price: confirmPrice })
          toast.success('Preço atualizado.')
          setConfirmPrice(null)
        }}
      />
    </div>
  )
}

function Step({ title, value, children }: { title: string; value: number; children: React.ReactNode }) {
  return (
    <li>
      <div className="flex items-center justify-between font-semibold">
        <span>{title}</span>
        <span className="tabular-nums">{brl(value)}</span>
      </div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </li>
  )
}
