import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { type AppData, type Business, type Expense, type Item, type Sale, type Supply, type Tool, emptyData } from '@/lib/schemas'

/**
 * Todos os dados do negócio ficam no aparelho (RNF06), salvos no localStorage, e são sincronizados
 * com a conta (lib/cloudSync.ts). Os cálculos são feitos a partir daqui, por isso tudo funciona offline.
 */
type DataState = AppData & {
  /** Dono dos dados neste aparelho (id do usuário logado) */
  ownerId: string | null
  setBusiness: (business: Business) => void
  saveSupply: (supply: Supply) => void
  removeSupply: (id: string) => void
  saveExpense: (expense: Expense) => void
  removeExpense: (id: string) => void
  saveTool: (tool: Tool) => void
  removeTool: (id: string) => void
  saveItem: (item: Item) => void
  removeItem: (id: string) => void
  saveSale: (sale: Sale) => void
  removeSale: (id: string) => void
  dismissTip: (id: string) => void
  restoreTips: () => void
  /** Aplica a versão que voltou da sincronização (sem marcar nada como alterado) */
  replaceAll: (data: AppData) => void
  /** Troca tudo pelo conteúdo de um arquivo: o que não está nele é apagado também nos outros aparelhos */
  importAll: (data: AppData) => void
  resetFor: (ownerId: string | null) => void
}

const upsert = <T extends { id: string }>(list: T[], value: T) =>
  list.some((x) => x.id === value.id) ? list.map((x) => (x.id === value.id ? value : x)) : [...list, value]

type Collection = 'supplies' | 'expenses' | 'tools' | 'items' | 'sales'
const COLLECTIONS: Collection[] = ['supplies', 'expenses', 'tools', 'items', 'sales']

/**
 * Marca a hora da mudança de cada registro (para a sincronização saber qual versão é a mais nova)
 * e a data geral dos dados.
 */
function touch(s: AppData, changed: string[] = [], removed: string[] = []) {
  const at = new Date().toISOString()
  const clock = { ...s.clock }
  const deleted = { ...s.deleted }
  for (const key of changed) {
    clock[key] = at
    delete deleted[key]
  }
  for (const key of removed) {
    delete clock[key]
    deleted[key] = at
  }
  return { updatedAt: at, clock, deleted }
}

/** Chaves dos itens cuja ficha mudou ao filtrar algo de dentro deles. */
const changedItems = (before: Item[], after: Item[]) =>
  after.filter((item, i) => item !== before[i]).map((item) => `items:${item.id}`)

export const useData = create<DataState>()(
  persist(
    (set) => ({
      ...emptyData(),
      ownerId: null,

      setBusiness: (business) => set((s) => ({ business, ...touch(s, ['business']) })),

      saveSupply: (supply) => set((s) => ({ supplies: upsert(s.supplies, supply), ...touch(s, [`supplies:${supply.id}`]) })),
      removeSupply: (id) =>
        set((s) => {
          const items = s.items.map((i) =>
            i.composition.some((c) => c.supplyId === id) ? { ...i, composition: i.composition.filter((c) => c.supplyId !== id) } : i,
          )
          return {
            supplies: s.supplies.filter((x) => x.id !== id),
            items,
            ...touch(s, changedItems(s.items, items), [`supplies:${id}`]),
          }
        }),

      saveExpense: (expense) => set((s) => ({ expenses: upsert(s.expenses, expense), ...touch(s, [`expenses:${expense.id}`]) })),
      removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id), ...touch(s, [], [`expenses:${id}`]) })),

      saveTool: (tool) => set((s) => ({ tools: upsert(s.tools, tool), ...touch(s, [`tools:${tool.id}`]) })),
      removeTool: (id) => set((s) => ({ tools: s.tools.filter((x) => x.id !== id), ...touch(s, [], [`tools:${id}`]) })),

      saveItem: (item) => set((s) => ({ items: upsert(s.items, item), ...touch(s, [`items:${item.id}`]) })),
      removeItem: (id) =>
        set((s) => {
          const kept = s.items.filter((x) => x.id !== id)
          const items = kept.map((i) => (i.variantOf === id ? { ...i, variantOf: null } : i))
          return { items, ...touch(s, changedItems(kept, items), [`items:${id}`]) }
        }),

      // Vendas guardam o nome do item: apagar o item não apaga o histórico
      saveSale: (sale) => set((s) => ({ sales: upsert(s.sales, sale), ...touch(s, [`sales:${sale.id}`]) })),
      removeSale: (id) => set((s) => ({ sales: s.sales.filter((x) => x.id !== id), ...touch(s, [], [`sales:${id}`]) })),

      dismissTip: (id) => set((s) => ({ dismissedTips: [...new Set([...s.dismissedTips, id])], ...touch(s, ['dismissedTips']) })),
      restoreTips: () => set((s) => ({ dismissedTips: [], ...touch(s, ['dismissedTips']) })),

      replaceAll: (data) => set({ ...data }),
      importAll: (data) =>
        set((s) => {
          const keys = (d: AppData) => COLLECTIONS.flatMap((c) => d[c].map((e) => `${c}:${e.id}`))
          const incoming = new Set(keys(data))
          const removed = keys(s).filter((k) => !incoming.has(k))
          const changed = [...incoming, 'dismissedTips', ...(data.business ? ['business'] : [])]
          return { ...data, ...touch({ ...s, clock: {} }, changed, removed) }
        }),
      resetFor: (ownerId) => set({ ...emptyData(), ownerId }),
    }),
    {
      name: 'preco-justo:data',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
)

/** Recorte só com os dados (sem as funções), para sincronizar e exportar. */
export function snapshot(state: DataState = useData.getState()): AppData {
  const { version, business, supplies, expenses, tools, items, sales, dismissedTips, updatedAt, clock, deleted } = state
  return { version, business, supplies, expenses, tools, items, sales, dismissedTips, updatedAt, clock, deleted }
}
