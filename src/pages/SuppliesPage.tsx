import { BoxesIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog, EmptyState, PageHeader } from '@/components/common'
import { GLOSSARY, Hint } from '@/components/Hint'
import { SupplyFormDrawer } from '@/components/SupplyFormDrawer'
import { Button } from '@/components/ui/button'
import { useCalc } from '@/hooks/useCalc'
import { supplyMonthlyCost, supplyUnitCost } from '@/lib/calc'
import { brl, num } from '@/lib/format'
import type { Supply } from '@/lib/schemas'
import { useData } from '@/store/data'

export function SuppliesPage() {
  const { data, t } = useCalc()
  const removeSupply = useData((s) => s.removeSupply)
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Supply | null>(null)
  const [creating, setCreating] = useState(params.get('novo') === '1')
  const [deleting, setDeleting] = useState<Supply | null>(null)

  const usedIn = (id: string) => data.items.filter((i) => i.composition.some((c) => c.supplyId === id))
  const sorted = [...data.supplies].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const closeCreate = (open: boolean) => {
    setCreating(open)
    if (!open && params.has('novo')) setParams({}, { replace: true })
  }

  return (
    <div>
      <PageHeader
        title="Insumos"
        subtitle={
          <span className="inline-flex items-center gap-1">
            Material que você compra e usa no trabalho. <Hint title={GLOSSARY.rendimento.title}>{GLOSSARY.rendimento.text}</Hint>
          </span>
        }
        action={
          data.supplies.length > 0 && (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon /> Novo
            </Button>
          )
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={<BoxesIcon />}
          title="Nenhum insumo ainda"
          text="Cadastre o material pelo preço que você paga e quanto ele rende. O app calcula o custo de cada uso."
          action={
            <Button size="lg" onClick={() => setCreating(true)}>
              <PlusIcon /> Cadastrar insumo
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {sorted.map((s) => {
            const used = usedIn(s.id)
            return (
              <li key={s.id} className="flex items-center gap-2 rounded-2xl border bg-card p-1 pr-2">
                <button type="button" className="min-w-0 flex-1 rounded-xl p-3 text-left active:bg-muted" onClick={() => setEditing(s)}>
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {brl(s.price)} · {s.mode === 'rendimento' ? 'rende' : 'dura'} {num(s.amount)} {s.unit}
                  </p>
                  <p className="mt-1 text-sm font-medium text-primary">
                    {s.mode === 'rendimento'
                      ? `${brl(supplyUnitCost(s))} por ${s.unit.replace(/s$/, '')}`
                      : `${brl(supplyMonthlyCost(s))} por mês`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {used.length ? `Usado em ${used.length} ${used.length === 1 ? t.item : t.items}` : `Ainda não usado em nenhum ${t.item}`}
                  </p>
                </button>
                <Button variant="ghost" size="icon" aria-label={`Excluir ${s.name}`} onClick={() => setDeleting(s)}>
                  <Trash2Icon className="size-4 text-muted-foreground" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <SupplyFormDrawer open={creating} onOpenChange={closeCreate} />
      <SupplyFormDrawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)} supply={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Excluir "${deleting?.name}"?`}
        description={
          deleting && usedIn(deleting.id).length
            ? `Ele será removido de ${usedIn(deleting.id).length} ${t.items}, e o custo deles será recalculado.`
            : 'Essa ação não pode ser desfeita.'
        }
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          if (deleting) removeSupply(deleting.id)
          toast.success('Insumo excluído.')
          setDeleting(null)
        }}
      />
    </div>
  )
}
