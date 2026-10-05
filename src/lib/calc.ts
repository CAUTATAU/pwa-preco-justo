/**
 * Motor de cálculo do Preço Justo.
 *
 * Determinístico e auditável (RN07): recebe os dados cadastrados e devolve o custo
 * por unidade com a "conta aberta" de cada número. Funciona 100% offline (RNF01).
 */
import { brl, ceilCents, num } from './format'
import type { AppData, Item, Supply } from './schemas'

/** 52 semanas / 12 meses */
export const WEEKS_PER_MONTH = 52 / 12

export const DEFAULT_TARGET_MARGIN = 30

export type PriceStatus = 'incompleto' | 'vermelho' | 'amarelo' | 'verde'

export type Overhead = {
  /** Horas de trabalho no mês (jornada semanal × 4,33) */
  monthlyHours: number
  expensesMonthly: number
  toolsMonthly: number
  totalMonthly: number
  /** Quanto cada hora trabalhada precisa pagar de despesa fixa (RN03) */
  perHour: number
}

export type MaterialLine = {
  supplyId: string
  name: string
  mode: Supply['mode']
  /** Custo deste insumo por unidade vendida */
  perUnit: number
  /** Conta em texto, para o empreendedor conferir */
  formula: string
}

export type ItemCost = {
  item: Item
  price: number
  material: number
  labor: number
  fixed: number
  loss: number
  total: number
  materialLines: MaterialLine[]
  hoursPerUnit: number
  /** Preço que só cobre o custo */
  minPrice: number
  /** Preço que cobre o custo e deixa a margem-alvo */
  idealPrice: number
  /** Quanto sobra (ou falta, se negativo) por unidade */
  profit: number
  /** Sobra como % do preço */
  margin: number
  monthlyProfit: number
  status: PriceStatus
  /** Tudo que a ficha precisa para estar completa */
  missing: string[]
  formulas: { labor: string; fixed: string; loss: string }
}

export type CalcResult = {
  overhead: Overhead
  items: ItemCost[]
  byId: Map<string, ItemCost>
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

export function monthsOf(supply: Pick<Supply, 'amount' | 'unit'>): number {
  return supply.unit === 'semanas' ? supply.amount / WEEKS_PER_MONTH : supply.amount
}

/** Custo de 1 unidade de rendimento (ex.: R$ por atendimento, R$ por grama). RN02. */
export function supplyUnitCost(supply: Pick<Supply, 'price' | 'amount'>): number {
  return supply.amount > 0 ? supply.price / supply.amount : 0
}

/** Custo mensal de um insumo que "dura N meses/semanas". */
export function supplyMonthlyCost(supply: Pick<Supply, 'price' | 'amount' | 'unit'>): number {
  const months = monthsOf(supply)
  return months > 0 ? supply.price / months : 0
}

export function computeOverhead(data: Pick<AppData, 'business' | 'expenses' | 'tools'>): Overhead {
  const monthlyHours = (data.business?.weeklyHours ?? 0) * WEEKS_PER_MONTH
  const expensesMonthly = sum(data.expenses.map((e) => e.amount))
  const toolsMonthly = sum(data.tools.map((t) => (t.everyMonths > 0 ? t.cost / t.everyMonths : 0)))
  const totalMonthly = expensesMonthly + toolsMonthly
  return {
    monthlyHours,
    expensesMonthly,
    toolsMonthly,
    totalMonthly,
    perHour: monthlyHours > 0 ? totalMonthly / monthlyHours : 0,
  }
}

/** Unidades vendidas por mês de todos os itens que usam o insumo (para dividir os de "duração"). */
function monthlyUnitsUsing(supplyId: string, items: Item[]): number {
  return sum(
    items.filter((i) => i.composition.some((c) => c.supplyId === supplyId)).map((i) => i.monthlyVolume),
  )
}

export function computeItem(item: Item, data: AppData, overhead = computeOverhead(data)): ItemCost {
  const business = data.business
  const unitWord = business?.type === 'producao' ? 'unidade' : 'atendimento'
  const batch = item.batchYield > 0 ? item.batchYield : 1
  const supplies = new Map(data.supplies.map((s) => [s.id, s]))

  // RF11 — material por unidade, a partir da composição e do rendimento
  const materialLines: MaterialLine[] = []
  for (const line of item.composition) {
    const s = supplies.get(line.supplyId)
    if (!s) continue
    if (s.mode === 'rendimento') {
      const unitCost = supplyUnitCost(s)
      const perUnit = (unitCost * line.qty) / batch
      const batchPart = batch > 1 ? ` ÷ ${num(batch)} unidades do lote` : ''
      materialLines.push({
        supplyId: s.id,
        name: s.name,
        mode: s.mode,
        perUnit,
        formula: `${brl(s.price)} ÷ ${num(s.amount)} ${s.unit} = ${brl(unitCost)} por ${s.unit.replace(/s$/, '')} × ${num(line.qty)} usado${batchPart}`,
      })
    } else {
      const monthly = supplyMonthlyCost(s)
      const units = monthlyUnitsUsing(s.id, data.items)
      const perUnit = units > 0 ? monthly / units : 0
      materialLines.push({
        supplyId: s.id,
        name: s.name,
        mode: s.mode,
        perUnit,
        formula:
          units > 0
            ? `${brl(s.price)} dura ${num(s.amount)} ${s.unit} = ${brl(monthly)} por mês ÷ ${num(units)} vendas no mês`
            : `${brl(monthly)} por mês, mas nenhuma venda por mês foi informada nos itens que usam este insumo`,
      })
    }
  }
  const material = sum(materialLines.map((l) => l.perUnit))

  // RF12 — hora do empreendedor aplicada ao tempo de execução
  const hoursPerUnit = item.minutes / 60 / batch
  const hourlyRate = business?.hourlyRate ?? 0
  const labor = hourlyRate * hoursPerUnit

  // RF13 / RN03 — despesa fixa rateada pelas horas, não pelo número de itens
  const fixed = overhead.perHour * hoursPerUnit

  // RF10 — perdas: o que se perde é pago pelo que se vende
  const lossRatio = Math.min(Math.max(item.lossPercent, 0), 90) / 100
  const base = material + labor + fixed
  const loss = lossRatio > 0 ? base * (lossRatio / (1 - lossRatio)) : 0

  // RF14 — custo total por unidade
  const total = base + loss

  // RF15 — preço mínimo e preço com margem-alvo
  const targetMargin = (business?.targetMargin ?? DEFAULT_TARGET_MARGIN) / 100
  // preços sugeridos sempre arredondados para cima no centavo
  const minPrice = ceilCents(total)
  const idealPrice = ceilCents(targetMargin < 1 ? total / (1 - targetMargin) : total)

  const price = item.price
  const profit = price - total
  const margin = price > 0 ? profit / price : profit < 0 ? -1 : 0

  const missing: string[] = []
  if (!business?.hourlyRate) missing.push('o valor da sua hora de trabalho')
  if (!business?.weeklyHours) missing.push('as horas que você trabalha por semana')
  if (item.minutes <= 0) missing.push(`o tempo que leva cada ${unitWord}`)
  if (price <= 0) missing.push('o preço que você cobra hoje')

  // RN04 — semáforo (RN01: sem a hora de trabalho a ficha não está completa)
  const EPS = 0.005
  let status: PriceStatus
  if (!business?.hourlyRate || price <= 0) status = 'incompleto'
  else if (price + EPS < total) status = 'vermelho'
  else if (price + EPS < idealPrice) status = 'amarelo'
  else status = 'verde'

  const timeText = batch > 1 ? `${num(item.minutes)} min ÷ ${num(batch)} unidades` : `${num(item.minutes)} min`

  return {
    item,
    price,
    material,
    labor,
    fixed,
    loss,
    total,
    materialLines,
    hoursPerUnit,
    minPrice,
    idealPrice,
    profit,
    margin,
    monthlyProfit: profit * item.monthlyVolume,
    status,
    missing,
    formulas: {
      labor: `${timeText} = ${num(hoursPerUnit)} h × ${brl(hourlyRate)} por hora`,
      fixed:
        overhead.monthlyHours > 0
          ? `${brl(overhead.totalMonthly)} por mês ÷ ${num(overhead.monthlyHours)} h no mês = ${brl(overhead.perHour)} por hora × ${num(hoursPerUnit)} h`
          : 'Informe as horas trabalhadas por semana',
      loss:
        lossRatio > 0
          ? `Perde ${num(item.lossPercent)}% do que faz: ${brl(base)} × ${num(lossRatio * 100)}% ÷ ${num((1 - lossRatio) * 100)}%`
          : 'Sem perdas informadas',
    },
  }
}

export function computeAll(data: AppData): CalcResult {
  const overhead = computeOverhead(data)
  const items = data.items.map((item) => computeItem(item, data, overhead))
  return { overhead, items, byId: new Map(items.map((c) => [c.item.id, c])) }
}

/** Partes do preço (RF16), como fração do preço cobrado (ou do custo, se o preço não cobre). */
export function priceParts(c: ItemCost) {
  const base = Math.max(c.price, c.total, 0.01)
  return [
    { key: 'material', label: 'Material', value: c.material, ratio: c.material / base },
    { key: 'labor', label: 'Seu trabalho', value: c.labor, ratio: c.labor / base },
    { key: 'fixed', label: 'Despesas fixas', value: c.fixed, ratio: c.fixed / base },
    { key: 'loss', label: 'Perdas', value: c.loss, ratio: c.loss / base },
    { key: 'profit', label: 'Sobra (lucro)', value: Math.max(c.profit, 0), ratio: Math.max(c.profit, 0) / base },
  ] as const
}

/** Horas por mês que as vendas estimadas ocupam. */
export function occupiedHours(data: AppData): number {
  return sum(
    data.items.map((i) => (i.minutes / 60 / (i.batchYield > 0 ? i.batchYield : 1)) * i.monthlyVolume),
  )
}
