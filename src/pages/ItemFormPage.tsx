import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common'
import { Field, MoneyInput, NumberInput, QuickPicks } from '@/components/Field'
import { GLOSSARY } from '@/components/Hint'
import { StatusBadge } from '@/components/PriceStatus'
import { SupplyFormDrawer } from '@/components/SupplyFormDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCalc } from '@/hooks/useCalc'
import { computeItem } from '@/lib/calc'
import { brl, parseNumber, toInput, uid } from '@/lib/format'
import { type Item, fieldErrors, itemSchema } from '@/lib/schemas'
import { useData } from '@/store/data'

type Row = { key: string; supplyId: string; qty: string }

const MINUTE_PICKS = [
  { label: '15 min', value: '15' },
  { label: '30 min', value: '30' },
  { label: '45 min', value: '45' },
  { label: '1h', value: '60' },
  { label: '1h30', value: '90' },
  { label: '2h', value: '120' },
]

const n0 = (s: string) => {
  const v = parseNumber(s)
  return Number.isFinite(v) ? v : 0
}

export function ItemFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const items = useData((s) => s.items)
  const variantBaseId = params.get('variante')

  const existing = id ? items.find((i) => i.id === id) : undefined
  const base = variantBaseId ? items.find((i) => i.id === variantBaseId) : undefined

  if (id && !existing) return <Navigate to="/itens" replace />

  const initial: Item | undefined = existing ?? (base ? { ...base, id: '', name: `${base.name} (variante)`, variantOf: base.variantOf ?? base.id } : undefined)
  return <ItemForm key={id ?? variantBaseId ?? 'novo'} initial={initial} isEdit={!!existing} />
}

function ItemForm({ initial, isEdit }: { initial?: Item; isEdit: boolean }) {
  const navigate = useNavigate()
  const { data, t } = useCalc()
  const saveItem = useData((s) => s.saveItem)
  const producao = data.business?.type === 'producao'

  const [name, setName] = useState(initial?.name ?? '')
  const [price, setPrice] = useState(toInput(initial?.price))
  const [minutes, setMinutes] = useState(toInput(initial?.minutes))
  const [batchYield, setBatchYield] = useState(toInput(initial?.batchYield ?? 1))
  const [monthlyVolume, setMonthlyVolume] = useState(toInput(initial?.monthlyVolume))
  const [lossPercent, setLossPercent] = useState(toInput(initial?.lossPercent || undefined))
  const [rows, setRows] = useState<Row[]>(
    initial?.composition.map((c) => ({ key: uid(), supplyId: c.supplyId, qty: toInput(c.qty) })) ?? [],
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [supplyDrawer, setSupplyDrawer] = useState(false)

  const suppliesById = useMemo(() => new Map(data.supplies.map((s) => [s.id, s])), [data.supplies])
  const filledRows = rows.filter((r) => r.supplyId)

  const draft: Item = {
    id: initial?.id || 'rascunho',
    name: name || 'Rascunho',
    price: n0(price),
    minutes: n0(minutes),
    batchYield: producao ? Math.max(n0(batchYield), 1) : 1,
    monthlyVolume: n0(monthlyVolume),
    lossPercent: producao ? n0(lossPercent) : 0,
    composition: filledRows.map((r) => ({ supplyId: r.supplyId, qty: suppliesById.get(r.supplyId)?.mode === 'duracao' ? 1 : n0(r.qty) })),
    variantOf: initial?.variantOf ?? null,
  }
  // Prévia ao vivo: considera o rascunho no lugar do item salvo
  const preview = computeItem(draft, {
    ...data,
    items: [...data.items.filter((i) => i.id !== draft.id), draft],
  })

  const updateRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = itemSchema.safeParse({
      id: initial?.id || uid(),
      name,
      price,
      minutes,
      batchYield: producao ? batchYield || 1 : 1,
      monthlyVolume,
      lossPercent: producao ? lossPercent : 0,
      composition: filledRows.map((r) => ({
        supplyId: r.supplyId,
        qty: suppliesById.get(r.supplyId)?.mode === 'duracao' ? 1 : r.qty,
      })),
      variantOf: initial?.variantOf ?? null,
    })
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error)
      setErrors(errs)
      toast.error(Object.values(errs)[0] ?? 'Confira os campos.')
      return
    }
    saveItem(parsed.data)
    toast.success(isEdit ? 'Alterações salvas.' : `${t.Item} cadastrado!`)
    navigate(`/itens/${parsed.data.id}`, { replace: true })
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        back
        title={isEdit ? `Editar ${t.item}` : initial?.variantOf ? 'Nova variante' : `Novo ${t.item}`}
        subtitle={initial?.variantOf && !isEdit ? 'Mude o material para ver o custo desta versão.' : undefined}
      />

      <div className="space-y-5">
        <Field label={`Nome do ${t.item}`} htmlFor="item-name" error={errors.name}>
          <Input
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={producao ? 'Ex.: Brownie tradicional' : 'Ex.: Design de sobrancelha'}
            aria-invalid={!!errors.name || undefined}
          />
        </Field>

        <Field label={`Quanto você cobra hoje por ${t.unit}?`} htmlFor="item-price" error={errors.price}>
          <MoneyInput id="item-price" value={price} onValueChange={setPrice} invalid={!!errors.price} />
        </Field>

        <section className="space-y-4 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Tempo de trabalho</h2>
          <Field
            label={producao ? 'Quanto tempo leva para fazer um lote/fornada?' : 'Quanto tempo leva cada atendimento?'}
            htmlFor="item-minutes"
            error={errors.minutes}
            description="Conte o tempo de preparo, execução e limpeza."
          >
            <NumberInput id="item-minutes" value={minutes} onValueChange={setMinutes} suffix="minutos" />
            <QuickPicks options={MINUTE_PICKS} onPick={setMinutes} current={minutes} />
          </Field>
          {producao && (
            <Field label="Quantas unidades saem desse lote?" htmlFor="item-batch" error={errors.batchYield}>
              <NumberInput id="item-batch" value={batchYield} onValueChange={setBatchYield} suffix="unidades" />
            </Field>
          )}
          <Field
            label={`Quantos ${t.units} você vende por mês?`}
            htmlFor="item-volume"
            description="Um chute já ajuda."
            error={errors.monthlyVolume}
          >
            <NumberInput id="item-volume" value={monthlyVolume} onValueChange={setMonthlyVolume} suffix="por mês" />
          </Field>
          {producao && (
            <Field
              label="De cada 100 que você faz, quantos se perdem?"
              htmlFor="item-loss"
              help={GLOSSARY.perda}
              error={errors.lossPercent}
            >
              <NumberInput id="item-loss" value={lossPercent} onValueChange={setLossPercent} suffix="%" placeholder="0" />
            </Field>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <div>
            <h2 className="font-semibold">{producao ? 'Ingredientes e embalagens' : 'Material usado'}</h2>
            <p className="text-xs text-muted-foreground">
              {producao ? 'O que vai em um lote/fornada.' : 'O que você gasta em cada atendimento.'}
            </p>
          </div>

          {rows.map((r) => {
            const s = suppliesById.get(r.supplyId)
            return (
              <div key={r.key} className="space-y-2 rounded-xl bg-muted/50 p-3">
                <div className="flex gap-2">
                  <Select value={r.supplyId} onValueChange={(v) => updateRow(r.key, { supplyId: v, qty: r.qty || '1' })}>
                    <SelectTrigger className="w-full bg-card">
                      <SelectValue placeholder="Escolha o insumo" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.supplies.map((sup) => (
                        <SelectItem key={sup.id} value={sup.id}>
                          {sup.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0"
                    aria-label="Remover"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
                {s?.mode === 'rendimento' && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="shrink-0 text-muted-foreground">Usa</span>
                    <NumberInput
                      value={r.qty}
                      onValueChange={(qty) => updateRow(r.key, { qty })}
                      suffix={s.unit}
                      className="bg-card"
                      aria-label={`Quantidade de ${s.name}`}
                    />
                  </div>
                )}
                {s?.mode === 'duracao' && (
                  <p className="text-xs text-muted-foreground">
                    Dura {s.amount} {s.unit}: o custo do mês é dividido pelas vendas de quem usa este insumo.
                  </p>
                )}
              </div>
            )
          })}

          <div className="flex flex-col gap-2 sm:flex-row">
            {data.supplies.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setRows((rs) => [...rs, { key: uid(), supplyId: '', qty: '1' }])}
              >
                <PlusIcon /> Adicionar insumo
              </Button>
            )}
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setSupplyDrawer(true)}>
              <PlusIcon /> Cadastrar insumo novo
            </Button>
          </div>
        </section>
      </div>

      {/* Prévia ao vivo do cálculo */}
      <div className="sticky bottom-20 z-10 mt-6 rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Custo por {t.unit}</span>
          <span className="text-lg font-bold tabular-nums">{brl(preview.total)}</span>
        </div>
        <div className="mb-3 flex items-center justify-between gap-2 text-sm">
          <StatusBadge status={preview.status} />
          <span className="text-muted-foreground">
            Ideal: <strong className="text-primary">{brl(preview.idealPrice)}</strong>
          </span>
        </div>
        <Button type="submit" size="lg" className="w-full">
          {isEdit ? 'Salvar alterações' : 'Salvar e ver a conta'}
        </Button>
      </div>

      <SupplyFormDrawer
        open={supplyDrawer}
        onOpenChange={setSupplyDrawer}
        onSaved={(s) => setRows((rs) => [...rs, { key: uid(), supplyId: s.id, qty: '1' }])}
      />
    </form>
  )
}
