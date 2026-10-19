import { ChevronLeftIcon, ChevronRightIcon, HandCoinsIcon, MinusIcon, PlusIcon, TagsIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { EmptyState, Money, PageHeader } from '@/components/common'
import { Field, MoneyInput, NumberInput } from '@/components/Field'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCalc } from '@/hooks/useCalc'
import { brl, num, parseNumber, toInput } from '@/lib/format'
import { addDays, buildSale, dayKey, dayLabel, monthLabel, salesOfDay, salesOfMonth, summarize } from '@/lib/sales'
import { type Sale, fieldErrors, saleSchema } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'

/** Fecho do dia: o que foi vendido ou atendido, quanto entrou e quanto sobrou. */
export function SalesPage() {
  const { data, calc, t } = useCalc()
  const saveSale = useData((s) => s.saveSale)
  const removeSale = useData((s) => s.removeSale)
  const [params, setParams] = useSearchParams()
  const [form, setForm] = useState<Sale | 'novo' | null>(null)

  const today = dayKey()
  const asked = params.get('dia') ?? ''
  // Dia vem da URL para o "voltar" do navegador manter o dia; nunca no futuro
  const day = /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today
  const goTo = (key: string) => setParams(key === today ? {} : { dia: key }, { replace: true })

  const daySales = salesOfDay(data.sales, day)
  const totals = summarize(daySales)
  const month = summarize(salesOfMonth(data.sales, day))
  const quick = calc.items.filter((c) => c.price > 0)

  const register = (itemId: string) => {
    const c = calc.byId.get(itemId)
    if (!c) return
    const sale = buildSale(c, day)
    saveSale(sale)
    toast.success(`${c.item.name}: +1 por ${brl(c.price)}`, {
      action: { label: 'Desfazer', onClick: () => removeSale(sale.id) },
    })
  }

  const remove = (sale: Sale) => {
    removeSale(sale.id)
    toast.success('Registro excluído.', {
      action: { label: 'Desfazer', onClick: () => saveSale(sale) },
    })
  }

  return (
    <div>
      <PageHeader title={`${t.Sales} do dia`} subtitle={`Registre cada ${t.sale} e veja quanto entrou e quanto sobrou.`} />

      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Dia anterior" onClick={() => goTo(addDays(day, -1))}>
          <ChevronLeftIcon />
        </Button>
        <p className="flex-1 text-center font-semibold capitalize">{dayLabel(day, today)}</p>
        {day !== today && (
          <Button variant="ghost" size="sm" onClick={() => goTo(today)}>
            Hoje
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label="Próximo dia"
          disabled={day >= today}
          onClick={() => goTo(addDays(day, 1))}
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <section
        className={cn(
          'mb-2 rounded-2xl p-4 text-white shadow-sm',
          totals.profit >= 0 ? 'bg-gradient-to-br from-primary to-emerald-700' : 'bg-gradient-to-br from-bad to-rose-800',
        )}
      >
        <p className="text-sm opacity-90">Entrou {day === today ? 'hoje' : 'neste dia'}</p>
        <Money value={totals.revenue} className="text-3xl font-bold" />
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/20 pt-3 text-sm">
          <div>
            <p className="opacity-80">{t.Sales}</p>
            <p className="font-semibold tabular-nums">{num(totals.count)}</p>
          </div>
          <div>
            <p className="opacity-80">{totals.profit >= 0 ? 'Sobrou' : 'Faltou'}</p>
            <p className="font-semibold tabular-nums">{brl(Math.abs(totals.profit))}</p>
          </div>
        </div>
        <p className="mt-2 text-xs opacity-80">
          A sobra já desconta material, contas do mês e o seu trabalho, pelo custo de cada {t.item} na hora do registro.
          {totals.unknownCost > 0 &&
            ` ${num(totals.unknownCost)} ${totals.unknownCost === 1 ? t.unit : t.units} sem custo calculado (ficha incompleta) ficaram fora da sobra.`}
        </p>
      </section>
      {month.count > 0 && (
        <p className="mb-5 px-1 text-xs text-muted-foreground">
          Em {monthLabel(day)}: {brl(month.revenue)} em {num(month.count)} {month.count === 1 ? t.sale : t.sales} · sobra{' '}
          {brl(month.profit)}
        </p>
      )}

      {calc.items.length === 0 ? (
        <EmptyState
          icon={<TagsIcon />}
          title={`Cadastre seus ${t.items} primeiro`}
          text={`Com o ${t.item} e o preço na ficha, registrar a ${t.sale} é um toque.`}
          action={
            <Button asChild size="lg">
              <Link to="/itens/novo">
                <PlusIcon /> Cadastrar {t.item}
              </Link>
            </Button>
          }
        />
      ) : (
        <section className="mb-6 space-y-3">
          <div>
            <h2 className="font-semibold">Registro rápido</h2>
            <p className="text-sm text-muted-foreground">
              Toque no {t.item} para registrar 1 {t.unit} pelo preço da ficha.
            </p>
          </div>
          {quick.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {quick.map((c) => (
                <button
                  key={c.item.id}
                  type="button"
                  onClick={() => register(c.item.id)}
                  className="flex min-h-16 flex-col items-start justify-center rounded-2xl border bg-card px-3 py-2 text-left transition-colors active:bg-secondary"
                >
                  <span className="line-clamp-2 text-sm font-medium">{c.item.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">+1 · {brl(c.price)}</span>
                </button>
              ))}
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={() => setForm('novo')}>
            <PlusIcon /> Registrar com quantidade ou desconto
          </Button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Registrados {day === today ? 'hoje' : 'neste dia'}</h2>
        {daySales.length === 0 ? (
          <EmptyState
            icon={<HandCoinsIcon />}
            title="Nenhum registro ainda"
            text="O que você registrar aparece aqui. Dá para corrigir ou excluir depois."
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {daySales.map((s) => {
              const total = s.qty * s.unitPrice
              const profit = s.unitCost === null ? null : s.qty * (s.unitPrice - s.unitCost)
              return (
                <li key={s.id} className="flex items-center gap-2 pr-2">
                  <button type="button" className="min-w-0 flex-1 px-4 py-3 text-left active:bg-muted" onClick={() => setForm(s)}>
                    <p className="truncate font-medium">{s.itemName}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {num(s.qty)} × {brl(s.unitPrice)}
                      {profit === null ? ' · sem custo calculado' : ` · ${profit >= 0 ? 'sobra' : 'falta'} ${brl(Math.abs(profit))}`}
                    </p>
                  </button>
                  <span className="font-semibold tabular-nums">{brl(total)}</span>
                  <Button variant="ghost" size="icon" aria-label={`Excluir ${s.itemName}`} onClick={() => remove(s)}>
                    <Trash2Icon className="size-4 text-muted-foreground" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <Drawer open={!!form} onOpenChange={(open) => !open && setForm(null)} repositionInputs={false}>
        <DrawerContent>
          {form && <SaleForm sale={form === 'novo' ? null : form} day={day} onDone={() => setForm(null)} />}
        </DrawerContent>
      </Drawer>
    </div>
  )
}

/** Registro com quantidade e preço cobrado (desconto), ou correção de um registro. */
function SaleForm({ sale, day, onDone }: { sale: Sale | null; day: string; onDone: () => void }) {
  const { calc, t } = useCalc()
  const saveSale = useData((s) => s.saveSale)
  const first = calc.items.length === 1 ? calc.items[0] : undefined
  const [itemId, setItemId] = useState(sale?.itemId ?? first?.item.id ?? '')
  const [qty, setQty] = useState(toInput(sale?.qty ?? 1))
  const [price, setPrice] = useState(toInput(sale?.unitPrice ?? first?.price))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const c = calc.byId.get(itemId)
  // Item apagado depois da venda: mantém o registro como está
  const sameItem = !!sale && sale.itemId === itemId
  const unitCost = sameItem ? sale.unitCost : c && c.status !== 'incompleto' ? c.total : null
  const q = parseNumber(qty)
  const p = parseNumber(price)
  const preview = Number.isFinite(q) && Number.isFinite(p) && q > 0 ? { total: q * p, profit: unitCost === null ? null : q * (p - unitCost) } : null

  const pickItem = (id: string) => {
    setItemId(id)
    const picked = calc.byId.get(id)
    if (picked) setPrice(toInput(picked.price))
  }
  const step = (delta: number) => setQty(toInput(Math.max(1, (Number.isFinite(q) ? Math.round(q) : 0) + delta)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const base = sameItem ? sale : c ? buildSale(c, sale?.date ?? day) : null
    if (!base) return setErrors({ itemId: `Escolha o ${t.item}.` })
    const parsed = saleSchema.safeParse({ ...base, id: sale?.id ?? base.id, createdAt: sale?.createdAt ?? base.createdAt, qty, unitPrice: price })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    saveSale(parsed.data)
    toast.success(sale ? 'Registro corrigido.' : 'Registro salvo!')
    onDone()
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md overflow-y-auto">
      <DrawerHeader>
        <DrawerTitle>{sale ? 'Corrigir registro' : `Registrar ${t.sale}`}</DrawerTitle>
        <DrawerDescription>{dayLabel(sale?.date ?? day)}: o que saiu, quantas vezes e por quanto.</DrawerDescription>
      </DrawerHeader>
      <div className="space-y-4 px-4">
        <Field label={t.Item} error={errors.itemId}>
          {sale && !calc.byId.has(sale.itemId) ? (
            <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
              {sale.itemName} (já não está na sua lista de {t.items})
            </p>
          ) : (
            <Select value={itemId} onValueChange={pickItem}>
              <SelectTrigger className="w-full" aria-invalid={!!errors.itemId || undefined}>
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {calc.items.map((ci) => (
                  <SelectItem key={ci.item.id} value={ci.item.id}>
                    {ci.item.name} · {brl(ci.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="Quantidade" htmlFor="sale-qty" error={errors.qty}>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" aria-label="Diminuir" onClick={() => step(-1)}>
              <MinusIcon />
            </Button>
            <NumberInput
              id="sale-qty"
              inputMode="numeric"
              value={qty}
              onValueChange={setQty}
              invalid={!!errors.qty}
              className="text-center"
            />
            <Button type="button" variant="outline" size="icon" aria-label="Aumentar" onClick={() => step(1)}>
              <PlusIcon />
            </Button>
          </div>
        </Field>
        <Field
          label={`Preço por ${t.unit}`}
          htmlFor="sale-price"
          error={errors.unitPrice}
          description={c && p !== c.price ? `Na ficha: ${brl(c.price)}` : 'Deu desconto? Mude o valor aqui.'}
        >
          <MoneyInput id="sale-price" value={price} onValueChange={setPrice} invalid={!!errors.unitPrice} />
        </Field>
        {preview && (
          <div className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
            Total <strong className="tabular-nums">{brl(preview.total)}</strong>
            {preview.profit === null ? (
              ' · sem custo calculado (complete a ficha)'
            ) : (
              <>
                {' · '}
                <span className={cn('font-semibold', preview.profit < 0 && 'text-bad')}>
                  {preview.profit >= 0 ? 'sobra' : 'falta'} {brl(Math.abs(preview.profit))}
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <DrawerFooter>
        <Button type="submit" size="lg">
          Salvar
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </DrawerFooter>
    </form>
  )
}
