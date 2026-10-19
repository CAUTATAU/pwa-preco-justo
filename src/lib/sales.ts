/**
 * Fecho do dia: vendas e atendimentos registrados e o resumo do dia e do mês.
 * A sobra usa o custo guardado em cada venda, calculado pelo calc.ts na hora do registro.
 */
import type { ItemCost } from './calc'
import { uid } from './format'
import type { Sale } from './schemas'

const pad = (n: number) => String(n).padStart(2, '0')

/** Dia no fuso do aparelho (AAAA-MM-DD). toISOString daria o dia em UTC. */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const fromKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function addDays(key: string, days: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + days)
  return dayKey(d)
}

/** "Hoje", "Ontem" ou "seg., 13 de out." */
export function dayLabel(key: string, today = dayKey()): string {
  if (key === today) return 'Hoje'
  if (key === addDays(today, -1)) return 'Ontem'
  return fromKey(key).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** "outubro" */
export const monthLabel = (key: string) => fromKey(key).toLocaleDateString('pt-BR', { month: 'long' })

export type SalesSummary = {
  /** Unidades ou atendimentos */
  count: number
  revenue: number
  /** Sobra só das vendas com custo conhecido */
  profit: number
  /** Unidades vendidas sem custo calculado (ficha incompleta na hora) */
  unknownCost: number
}

export function summarize(sales: Sale[]): SalesSummary {
  const out: SalesSummary = { count: 0, revenue: 0, profit: 0, unknownCost: 0 }
  for (const s of sales) {
    out.count += s.qty
    out.revenue += s.qty * s.unitPrice
    if (s.unitCost === null) out.unknownCost += s.qty
    else out.profit += s.qty * (s.unitPrice - s.unitCost)
  }
  return out
}

/** Vendas de um dia, as mais recentes primeiro. */
export const salesOfDay = (sales: Sale[], key: string) =>
  sales.filter((s) => s.date === key).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

/** Vendas do mês do dia informado. */
export const salesOfMonth = (sales: Sale[], key: string) => sales.filter((s) => s.date.slice(0, 7) === key.slice(0, 7))

/** Nova venda a partir do cálculo atual do item. Sem preço informado, vale o preço da ficha. */
export function buildSale(c: ItemCost, date: string, qty = 1, unitPrice = c.price): Sale {
  return {
    id: uid(),
    date,
    itemId: c.item.id,
    itemName: c.item.name,
    qty,
    unitPrice,
    unitCost: c.status === 'incompleto' ? null : c.total,
    createdAt: new Date().toISOString(),
  }
}
