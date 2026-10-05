import { z } from 'zod'
import { parseNumber } from './format'

/* ------------------------------------------------------------------ */
/* Helpers para campos numéricos digitados como texto ("12,50")        */
/* ------------------------------------------------------------------ */

const toNum = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : parseNumber(v))

export const zMoney = (label = 'o valor') =>
  z.preprocess(
    toNum,
    z
      .number({ error: `Informe ${label}.` })
      .refine(Number.isFinite, `Informe ${label} com números.`)
      .min(0, 'O valor não pode ser negativo.')
      .max(10_000_000, 'Valor alto demais.'),
  )

export const zPositive = (label = 'um número') =>
  z.preprocess(
    toNum,
    z
      .number({ error: `Informe ${label}.` })
      .refine(Number.isFinite, `Informe ${label} com números.`)
      .positive('Precisa ser maior que zero.')
      .max(1_000_000, 'Número alto demais.'),
  )

export const zOptionalNumber = (min = 0, max = 1_000_000) =>
  z.preprocess(
    (v) => toNum(v) ?? 0,
    z
      .number()
      .refine(Number.isFinite, 'Use apenas números.')
      .min(min, `Mínimo ${min}.`)
      .max(max, `Máximo ${max}.`),
  )

const name = (label: string) =>
  z.string().trim().min(1, `Dê um nome para ${label}.`).max(80, 'Nome muito longo.')

/* ------------------------------------------------------------------ */
/* Modelos de dados                                                    */
/* ------------------------------------------------------------------ */

export const BUSINESS_TYPES = ['servico', 'producao'] as const
export type BusinessType = (typeof BUSINESS_TYPES)[number]

export const businessSchema = z.object({
  name: name('o seu negócio'),
  type: z.enum(BUSINESS_TYPES, { error: 'Escolha o tipo do negócio.' }),
  /** Quanto vale 1 hora do trabalho do empreendedor (RF02). null = ainda não informado. */
  hourlyRate: z.preprocess(
    (v) => (v === '' || v === undefined ? null : toNum(v)),
    z.number().refine(Number.isFinite, 'Use apenas números.').positive('Precisa ser maior que zero.').nullable(),
  ),
  /** Jornada semanal em horas (RF03). */
  weeklyHours: zPositive('as horas por semana').pipe(z.number().max(112, 'Uma semana tem no máximo 112h de trabalho.')),
  /** Margem-alvo em % do preço (RF15). */
  targetMargin: zOptionalNumber(0, 90),
})
export type Business = z.infer<typeof businessSchema>

/**
 * Insumo (RF04 / RN02): sempre preço de compra + rendimento.
 * - "rendimento": rende N <unidade> (atendimentos, unidades, g, ml...)
 * - "duracao": dura N semanas/meses
 */
export const SUPPLY_MODES = ['rendimento', 'duracao'] as const
export type SupplyMode = (typeof SUPPLY_MODES)[number]
export const DURATION_UNITS = ['semanas', 'meses'] as const

export const supplySchema = z
  .object({
    id: z.string(),
    name: name('o insumo'),
    price: zMoney('o preço pago'),
    mode: z.enum(SUPPLY_MODES),
    amount: zPositive('quanto rende'),
    unit: z.string().trim().min(1, 'Diga em que ele rende (ex.: atendimentos, unidades, g).').max(30),
  })
  .refine((s) => s.mode !== 'duracao' || (DURATION_UNITS as readonly string[]).includes(s.unit), {
    message: 'Escolha semanas ou meses.',
    path: ['unit'],
  })
export type Supply = z.infer<typeof supplySchema>

export const EXPENSE_CATEGORIES = [
  'Aluguel',
  'Água',
  'Luz / energia',
  'Internet / telefone',
  'Gás',
  'Impostos / MEI',
  'Limpeza',
  'Transporte / deslocamento',
  'Outros',
  'Tudo junto (não sei separar)',
] as const

export const expenseSchema = z.object({
  id: z.string(),
  category: z.string().min(1, 'Escolha uma categoria.'),
  description: z.string().trim().max(80).optional().default(''),
  amount: zMoney('o valor por mês').pipe(z.number().positive('Precisa ser maior que zero.')),
})
export type Expense = z.infer<typeof expenseSchema>

/** Ferramenta/equipamento com custo de reposição periódica (RF09). */
export const toolSchema = z.object({
  id: z.string(),
  name: name('a ferramenta'),
  cost: zMoney('quanto custa repor').pipe(z.number().positive('Precisa ser maior que zero.')),
  everyMonths: zPositive('de quantos em quantos meses troca'),
})
export type Tool = z.infer<typeof toolSchema>

export const compositionSchema = z.object({
  supplyId: z.string().min(1, 'Escolha o insumo.'),
  qty: zPositive('a quantidade usada'),
})
export type CompositionLine = z.infer<typeof compositionSchema>

/** Item vendido: serviço ou produto (RF06, RF07, RF08, RF10). */
export const itemSchema = z.object({
  id: z.string(),
  name: name('o item'),
  /** Preço cobrado hoje, por unidade/atendimento. */
  price: zMoney('o preço que você cobra'),
  /** Tempo de execução: por atendimento (serviço) ou por lote/fornada (produção). */
  minutes: zOptionalNumber(0, 100_000),
  /** Quantas unidades saem de uma vez (lote/fornada). Serviço = 1. */
  batchYield: zPositive('quantas unidades rende').default(1),
  /** Quantas unidades/atendimentos vende por mês (estimativa). */
  monthlyVolume: zOptionalNumber(0, 1_000_000),
  /** Perdas e descartes (% do que é produzido). */
  lossPercent: zOptionalNumber(0, 90),
  composition: z.array(compositionSchema).default([]),
  /** Variante de outro item (ex.: linha premium). */
  variantOf: z.string().nullable().optional().default(null),
})
export type Item = z.infer<typeof itemSchema>

/* ------------------------------------------------------------------ */
/* Pacote completo de dados (armazenamento local e backup)             */
/* ------------------------------------------------------------------ */

export const DATA_VERSION = 1

export const appDataSchema = z.object({
  version: z.number().int().positive(),
  business: businessSchema.nullable(),
  supplies: z.array(supplySchema),
  expenses: z.array(expenseSchema),
  tools: z.array(toolSchema),
  items: z.array(itemSchema),
  dismissedTips: z.array(z.string()).default([]),
  updatedAt: z.string(),
})
export type AppData = z.infer<typeof appDataSchema>

export const emptyData = (): AppData => ({
  version: DATA_VERSION,
  business: null,
  supplies: [],
  expenses: [],
  tools: [],
  items: [],
  dismissedTips: [],
  updatedAt: new Date(0).toISOString(),
})

/** Mostra a primeira mensagem de erro por campo. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
