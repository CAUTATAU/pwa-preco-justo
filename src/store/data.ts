import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { type AppData, type Business, type Expense, type Item, type Supply, type Tool, emptyData } from '@/lib/schemas'

/**
 * Todos os dados do negócio ficam no aparelho (RNF06), salvos no localStorage.
 * Os cálculos são feitos a partir daqui, por isso tudo funciona offline.
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
  dismissTip: (id: string) => void
  restoreTips: () => void
  replaceAll: (data: AppData) => void
  resetFor: (ownerId: string | null) => void
}

const upsert = <T extends { id: string }>(list: T[], value: T) =>
  list.some((x) => x.id === value.id) ? list.map((x) => (x.id === value.id ? value : x)) : [...list, value]

const touch = () => ({ updatedAt: new Date().toISOString() })

export const useData = create<DataState>()(
  persist(
    (set) => ({
      ...emptyData(),
      ownerId: null,

      setBusiness: (business) => set({ business, ...touch() }),

      saveSupply: (supply) => set((s) => ({ supplies: upsert(s.supplies, supply), ...touch() })),
      removeSupply: (id) =>
        set((s) => ({
          supplies: s.supplies.filter((x) => x.id !== id),
          items: s.items.map((i) => ({ ...i, composition: i.composition.filter((c) => c.supplyId !== id) })),
          ...touch(),
        })),

      saveExpense: (expense) => set((s) => ({ expenses: upsert(s.expenses, expense), ...touch() })),
      removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id), ...touch() })),

      saveTool: (tool) => set((s) => ({ tools: upsert(s.tools, tool), ...touch() })),
      removeTool: (id) => set((s) => ({ tools: s.tools.filter((x) => x.id !== id), ...touch() })),

      saveItem: (item) => set((s) => ({ items: upsert(s.items, item), ...touch() })),
      removeItem: (id) =>
        set((s) => ({
          items: s.items
            .filter((x) => x.id !== id)
            .map((i) => (i.variantOf === id ? { ...i, variantOf: null } : i)),
          ...touch(),
        })),

      dismissTip: (id) => set((s) => ({ dismissedTips: [...new Set([...s.dismissedTips, id])], ...touch() })),
      restoreTips: () => set({ dismissedTips: [], ...touch() }),

      replaceAll: (data) => set({ ...data }),
      resetFor: (ownerId) => set({ ...emptyData(), ownerId }),
    }),
    {
      name: 'preco-justo:data',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
)

/** Recorte só com os dados (sem as funções), para backup/exportação. */
export function snapshot(state: DataState = useData.getState()): AppData {
  const { version, business, supplies, expenses, tools, items, dismissedTips, updatedAt } = state
  return { version, business, supplies, expenses, tools, items, dismissedTips, updatedAt }
}
