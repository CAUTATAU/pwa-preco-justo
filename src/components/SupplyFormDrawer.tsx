import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { supplyMonthlyCost, supplyUnitCost } from '@/lib/calc'
import { brl, parseNumber, toInput, uid } from '@/lib/format'
import { type Supply, type SupplyMode, fieldErrors, supplySchema } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { Field, MoneyInput, NumberInput, QuickPicks } from './Field'
import { GLOSSARY } from './Hint'

const YIELD_UNITS = ['atendimentos', 'unidades', 'receitas', 'g', 'ml']

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  supply?: Supply | null
  onSaved?: (supply: Supply) => void
}

/** Cadastro de insumo: sempre preço de compra + rendimento (RF04 / RN02). */
export function SupplyFormDrawer({ open, onOpenChange, supply, onSaved }: Props) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[94dvh]">
        {open && <SupplyForm supply={supply} onDone={() => onOpenChange(false)} onSaved={onSaved} />}
      </DrawerContent>
    </Drawer>
  )
}

function SupplyForm({ supply, onDone, onSaved }: { supply?: Supply | null; onDone: () => void; onSaved?: Props['onSaved'] }) {
  const saveSupply = useData((s) => s.saveSupply)
  const items = useData((s) => s.items)
  const [name, setName] = useState(supply?.name ?? '')
  const [price, setPrice] = useState(toInput(supply?.price))
  const [mode, setMode] = useState<SupplyMode>(supply?.mode ?? 'rendimento')
  const [amount, setAmount] = useState(toInput(supply?.amount))
  const [unit, setUnit] = useState(supply?.unit ?? 'atendimentos')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const switchMode = (m: SupplyMode) => {
    setMode(m)
    setUnit(m === 'duracao' ? 'meses' : 'atendimentos')
  }

  const priceN = parseNumber(price)
  const amountN = parseNumber(amount)
  const ready = priceN >= 0 && amountN > 0 && unit.trim()
  const preview = !ready
    ? null
    : mode === 'rendimento'
      ? `Cada ${unit.replace(/s$/, '')} sai por ${brl(supplyUnitCost({ price: priceN, amount: amountN }))}`
      : `Custa ${brl(supplyMonthlyCost({ price: priceN, amount: amountN, unit }))} por mês`

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    // o drawer pode estar dentro do formulário do item: o submit não deve "vazar" pelo portal
    e.stopPropagation()
    const parsed = supplySchema.safeParse({ id: supply?.id ?? uid(), name, price, mode, amount, unit })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    saveSupply(parsed.data)
    if (supply && supply.price !== parsed.data.price) {
      const affected = items.filter((i) => i.composition.some((c) => c.supplyId === supply.id)).length
      toast.success(affected ? `Preço atualizado. ${affected} item(ns) recalculado(s).` : 'Insumo atualizado.')
    } else {
      toast.success(supply ? 'Insumo atualizado.' : 'Insumo cadastrado!')
    }
    onSaved?.(parsed.data)
    onDone()
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-md flex-col overflow-y-auto">
      <DrawerHeader>
        <DrawerTitle>{supply ? 'Editar insumo' : 'Novo insumo'}</DrawerTitle>
        <DrawerDescription>Informe quanto você paga e quanto rende. A conta é com o app.</DrawerDescription>
      </DrawerHeader>

      <div className="space-y-4 px-4">
        <Field label="Nome" htmlFor="supply-name" error={errors.name}>
          <Input
            id="supply-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Linha de algodão, Chocolate em pó"
            aria-invalid={!!errors.name || undefined}
          />
        </Field>

        <Field label="Quanto você paga?" htmlFor="supply-price" error={errors.price} description="Preço da embalagem/pacote que você compra.">
          <MoneyInput id="supply-price" value={price} onValueChange={setPrice} invalid={!!errors.price} />
        </Field>

        <Field label="Como ele é usado?" help={GLOSSARY.rendimento}>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['rendimento', 'Rende', 'N atendimentos, unidades, gramas…'],
                ['duracao', 'Dura', 'N semanas ou meses'],
              ] as const
            ).map(([value, label, desc]) => (
              <button
                key={value}
                type="button"
                onClick={() => switchMode(value)}
                className={cn(
                  'rounded-xl border-2 p-3 text-left transition-colors',
                  mode === value ? 'border-primary bg-secondary' : 'border-border bg-card',
                )}
              >
                <p className="font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </button>
            ))}
          </div>
        </Field>

        {mode === 'rendimento' ? (
          <Field label="Rende quanto?" htmlFor="supply-amount" error={errors.amount ?? errors.unit}>
            <div className="flex gap-2">
              <NumberInput
                id="supply-amount"
                value={amount}
                onValueChange={setAmount}
                placeholder="50"
                className="w-28"
                invalid={!!errors.amount}
              />
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="atendimentos" aria-label="Unidade" />
            </div>
            <QuickPicks options={YIELD_UNITS.map((u) => ({ label: u, value: u }))} onPick={setUnit} current={unit} />
          </Field>
        ) : (
          <Field label="Dura quanto tempo?" htmlFor="supply-amount" error={errors.amount ?? errors.unit}>
            <div className="flex gap-2">
              <NumberInput id="supply-amount" value={amount} onValueChange={setAmount} placeholder="2" className="w-28" invalid={!!errors.amount} />
              <div className="grid flex-1 grid-cols-2 gap-2">
                {(['semanas', 'meses'] as const).map((u) => (
                  <Button key={u} type="button" variant={unit === u ? 'default' : 'outline'} className="h-11" onClick={() => setUnit(u)}>
                    {u}
                  </Button>
                ))}
              </div>
            </div>
          </Field>
        )}

        <div className="rounded-xl bg-secondary px-4 py-3 text-center text-sm font-medium text-secondary-foreground">
          {preview ?? 'Preencha o preço e o rendimento para ver o custo.'}
        </div>
      </div>

      <DrawerFooter>
        <Button type="submit" size="lg">
          {supply ? 'Salvar alterações' : 'Cadastrar insumo'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </DrawerFooter>
    </form>
  )
}
