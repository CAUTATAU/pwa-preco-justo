import { HammerIcon, PlusIcon, ReceiptTextIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { EmptyState, PageHeader } from '@/components/common'
import { Field, MoneyInput, NumberInput, QuickPicks } from '@/components/Field'
import { GLOSSARY, Hint } from '@/components/Hint'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCalc } from '@/hooks/useCalc'
import { brl, num, toInput, uid } from '@/lib/format'
import { EXPENSE_CATEGORIES, type Expense, type Tool, expenseSchema, fieldErrors, toolSchema } from '@/lib/schemas'
import { useData } from '@/store/data'

export function ExpensesPage() {
  const { data, calc, t } = useCalc()
  const [params, setParams] = useSearchParams()
  const tab = params.get('aba') === 'ferramentas' ? 'ferramentas' : 'despesas'
  const removeExpense = useData((s) => s.removeExpense)
  const removeTool = useData((s) => s.removeTool)
  const [expenseForm, setExpenseForm] = useState<Expense | 'novo' | null>(null)
  const [toolForm, setToolForm] = useState<Tool | 'novo' | null>(null)
  const o = calc.overhead

  return (
    <div>
      <PageHeader
        title="Despesas"
        subtitle={
          <span className="inline-flex items-center gap-1">
            Contas do mês e desgaste de ferramentas. <Hint title={GLOSSARY.despesaFixa.title}>{GLOSSARY.despesaFixa.text}</Hint>
          </span>
        }
      />

      {/* Resumo (RF13 / RN03) */}
      <section className="mb-5 rounded-2xl bg-gradient-to-br from-primary to-emerald-700 p-4 text-white">
        <p className="text-sm opacity-90">Total por mês</p>
        <p className="text-3xl font-bold tabular-nums">{brl(o.totalMonthly)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/20 pt-3 text-sm">
          <div>
            <p className="opacity-80">Horas no mês</p>
            <p className="font-semibold">{num(o.monthlyHours)} h</p>
          </div>
          <div>
            <p className="opacity-80">Cada hora paga</p>
            <p className="font-semibold">{brl(o.perHour)}</p>
          </div>
        </div>
        <p className="mt-2 text-xs opacity-80">
          A cada hora de trabalho, {brl(o.perHour)} vão para as contas. Esse valor entra no custo de cada {t.item} pelo tempo
          que ele leva.
        </p>
      </section>

      <Tabs value={tab} onValueChange={(v) => setParams(v === 'ferramentas' ? { aba: v } : {}, { replace: true })}>
        <TabsList className="mb-4 grid h-11 w-full grid-cols-2">
          <TabsTrigger value="despesas">Contas do mês</TabsTrigger>
          <TabsTrigger value="ferramentas">Ferramentas</TabsTrigger>
        </TabsList>

        <TabsContent value="despesas" className="space-y-3">
          {data.expenses.length === 0 ? (
            <EmptyState
              icon={<ReceiptTextIcon />}
              title="Nenhuma conta lançada"
              text="Aluguel, água, luz, internet, MEI… Se não souber separar, lance tudo junto num valor só."
              action={
                <Button size="lg" onClick={() => setExpenseForm('novo')}>
                  <PlusIcon /> Lançar despesa
                </Button>
              }
            />
          ) : (
            <>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {data.expenses.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 pr-2">
                    <button type="button" className="min-w-0 flex-1 px-4 py-3 text-left active:bg-muted" onClick={() => setExpenseForm(e)}>
                      <p className="truncate font-medium">{e.category}</p>
                      {e.description && <p className="truncate text-xs text-muted-foreground">{e.description}</p>}
                    </button>
                    <span className="font-semibold tabular-nums">{brl(e.amount)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${e.category}`}
                      onClick={() => {
                        removeExpense(e.id)
                        toast.success('Despesa excluída.')
                      }}
                    >
                      <Trash2Icon className="size-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" onClick={() => setExpenseForm('novo')}>
                <PlusIcon /> Lançar outra despesa
              </Button>
            </>
          )}
        </TabsContent>

        <TabsContent value="ferramentas" className="space-y-3">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            O que se desgasta e precisa ser trocado. <Hint title={GLOSSARY.ferramenta.title}>{GLOSSARY.ferramenta.text}</Hint>
          </p>
          {data.tools.length === 0 ? (
            <EmptyState
              icon={<HammerIcon />}
              title="Nenhuma ferramenta"
              text="Ex.: um jogo de chaves de R$ 100 que você troca a cada 3 meses custa R$ 33,33 por mês."
              action={
                <Button size="lg" onClick={() => setToolForm('novo')}>
                  <PlusIcon /> Cadastrar ferramenta
                </Button>
              }
            />
          ) : (
            <>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {data.tools.map((tool) => (
                  <li key={tool.id} className="flex items-center gap-2 pr-2">
                    <button type="button" className="min-w-0 flex-1 px-4 py-3 text-left active:bg-muted" onClick={() => setToolForm(tool)}>
                      <p className="truncate font-medium">{tool.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {brl(tool.cost)} a cada {num(tool.everyMonths)} {tool.everyMonths === 1 ? 'mês' : 'meses'}
                      </p>
                    </button>
                    <span className="text-right text-sm font-semibold tabular-nums">
                      {brl(tool.cost / tool.everyMonths)}
                      <span className="block text-xs font-normal text-muted-foreground">por mês</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${tool.name}`}
                      onClick={() => {
                        removeTool(tool.id)
                        toast.success('Ferramenta excluída.')
                      }}
                    >
                      <Trash2Icon className="size-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" onClick={() => setToolForm('novo')}>
                <PlusIcon /> Cadastrar outra ferramenta
              </Button>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Drawer open={!!expenseForm} onOpenChange={(open) => !open && setExpenseForm(null)} repositionInputs={false}>
        <DrawerContent>
          {expenseForm && (
            <ExpenseForm expense={expenseForm === 'novo' ? null : expenseForm} onDone={() => setExpenseForm(null)} />
          )}
        </DrawerContent>
      </Drawer>
      <Drawer open={!!toolForm} onOpenChange={(open) => !open && setToolForm(null)} repositionInputs={false}>
        <DrawerContent>
          {toolForm && <ToolForm tool={toolForm === 'novo' ? null : toolForm} onDone={() => setToolForm(null)} />}
        </DrawerContent>
      </Drawer>
    </div>
  )
}

/** RF05 — despesa fixa mensal por categoria, ou um valor total quando não souber separar. */
function ExpenseForm({ expense, onDone }: { expense: Expense | null; onDone: () => void }) {
  const saveExpense = useData((s) => s.saveExpense)
  const [category, setCategory] = useState(expense?.category ?? '')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(toInput(expense?.amount))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = expenseSchema.safeParse({ id: expense?.id ?? uid(), category, description, amount })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    saveExpense(parsed.data)
    toast.success(expense ? 'Despesa atualizada.' : 'Despesa lançada!')
    onDone()
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md overflow-y-auto">
      <DrawerHeader>
        <DrawerTitle>{expense ? 'Editar despesa' : 'Nova despesa do mês'}</DrawerTitle>
        <DrawerDescription>Quanto você paga por mês, em média.</DrawerDescription>
      </DrawerHeader>
      <div className="space-y-4 px-4">
        <Field label="Categoria" error={errors.category}>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full" aria-invalid={!!errors.category || undefined}>
              <SelectValue placeholder="Escolha" />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {category.startsWith('Tudo junto') && (
          <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
            Sem problema! Coloque o total que sai por mês com as contas do negócio. Depois, se quiser, você separa.
          </p>
        )}
        <Field label="Descrição (opcional)" htmlFor="exp-desc">
          <Input id="exp-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: metade da conta de casa" />
        </Field>
        <Field label="Valor por mês" htmlFor="exp-amount" error={errors.amount}>
          <MoneyInput id="exp-amount" value={amount} onValueChange={setAmount} invalid={!!errors.amount} />
        </Field>
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

/** RF09 — ferramenta com custo de reposição e periodicidade. */
function ToolForm({ tool, onDone }: { tool: Tool | null; onDone: () => void }) {
  const saveTool = useData((s) => s.saveTool)
  const [name, setName] = useState(tool?.name ?? '')
  const [cost, setCost] = useState(toInput(tool?.cost))
  const [everyMonths, setEveryMonths] = useState(toInput(tool?.everyMonths))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = toolSchema.safeParse({ id: tool?.id ?? uid(), name, cost, everyMonths })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    saveTool(parsed.data)
    toast.success(tool ? 'Ferramenta atualizada.' : 'Ferramenta cadastrada!')
    onDone()
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md overflow-y-auto">
      <DrawerHeader>
        <DrawerTitle>{tool ? 'Editar ferramenta' : 'Nova ferramenta'}</DrawerTitle>
        <DrawerDescription>Quanto custa repor e de quanto em quanto tempo você troca.</DrawerDescription>
      </DrawerHeader>
      <div className="space-y-4 px-4">
        <Field label="Nome" htmlFor="tool-name" error={errors.name}>
          <Input id="tool-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Jogo de chaves, Pinça, Forma" />
        </Field>
        <Field label="Quanto custa repor?" htmlFor="tool-cost" error={errors.cost}>
          <MoneyInput id="tool-cost" value={cost} onValueChange={setCost} invalid={!!errors.cost} />
        </Field>
        <Field label="Troca de quantos em quantos meses?" htmlFor="tool-every" error={errors.everyMonths}>
          <NumberInput id="tool-every" value={everyMonths} onValueChange={setEveryMonths} suffix="meses" />
          <QuickPicks
            options={['1', '3', '6', '12', '24'].map((m) => ({ label: `${m} ${m === '1' ? 'mês' : 'meses'}`, value: m }))}
            onPick={setEveryMonths}
            current={everyMonths}
          />
        </Field>
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
