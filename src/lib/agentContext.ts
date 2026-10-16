/**
 * Ponte com o assistente de IA (repo agente-preco-justo): o contexto que vai em cada pergunta e a
 * validação do que volta. O contrato está no README do agente; quem soma é sempre o calc.ts (RN07).
 */
import { z } from 'zod'
import { type Tip, explainItem } from './advisor'
import { type CalcResult, type PriceStatus, occupiedHours } from './calc'
import { type AppData, type Business, type Item, businessSchema, itemSchema } from './schemas'

const r2 = (v: number) => Math.round(v * 100) / 100
const ordem: Record<PriceStatus, number> = { vermelho: 0, amarelo: 1, incompleto: 2, verde: 3 }

/** Corta em `n` caracteres de verdade (como o agente conta), sem quebrar emoji ao meio. */
export const corta = (s: string, n: number) => [...s].slice(0, n).join('')

/**
 * Resumo da ficha que vai para o agente. Sem o nome do negócio e sem a descrição das despesas
 * (texto livre): só o necessário para responder (RNF06). As listas respeitam os limites do agente.
 */
export function montarContexto(data: AppData, calc: CalcResult, tips: Tip[]) {
  const b = data.business!, o = calc.overhead // o assistente só abre com o negócio cadastrado
  return {
    tipo: b.type,
    valorHora: b.hourlyRate,
    horasSemana: b.weeklyHours,
    metaSobraPct: b.targetMargin,
    despesas: {
      porMes: r2(o.expensesMonthly),
      ferramentasPorMes: r2(o.toolsMonthly),
      totalPorMes: r2(o.totalMonthly),
      porHora: r2(o.perHour),
      horasMes: r2(o.monthlyHours),
      lista: data.expenses.slice(0, 50).map((e) => ({ categoria: corta(e.category, 60), valor: e.amount })),
      ferramentas: data.tools
        .slice(0, 50)
        .map((t) => ({ nome: t.name, porMes: r2(t.everyMonths > 0 ? t.cost / t.everyMonths : 0) })),
    },
    resumo: {
      sobraMesTotal: r2(calc.items.reduce((s, c) => s + c.monthlyProfit, 0)),
      horasOcupadasMes: r2(occupiedHours(data)),
    },
    itens: [...calc.items]
      .sort((a, c) => ordem[a.status] - ordem[c.status])
      .slice(0, 50)
      .map((c) => ({
        id: c.item.id,
        nome: c.item.name,
        preco: c.price,
        custoTotal: c.total, // sem arredondar: o agente repete o semáforo (RN04) com este valor
        partes: { material: r2(c.material), trabalho: r2(c.labor), despesas: r2(c.fixed), perdas: r2(c.loss) },
        precoMinimo: c.minPrice,
        precoIdeal: c.idealPrice,
        sobra: r2(c.profit),
        sobraPct: Math.round(c.margin * 1000) / 10,
        sobraPorHora: c.hoursPerUnit > 0 ? r2(c.profit / c.hoursPerUnit) : null,
        minutos: r2(c.hoursPerUnit * 60),
        status: c.status,
        vendasMes: c.item.monthlyVolume,
        sobraMes: r2(c.monthlyProfit),
        faltando: c.missing,
        explicacao: explainItem(c, data),
        insumosMaisCaros: [...c.materialLines]
          .sort((a, z) => z.perUnit - a.perUnit)
          .slice(0, 3)
          .map((l) => ({ nome: l.name, porUnidade: r2(l.perUnit) })),
      })),
    dicas: tips
      .filter((t) => !data.dismissedTips.includes(t.id))
      .slice(0, 40)
      .map((t) => ({ id: t.id, nivel: t.level, titulo: t.title, texto: t.text, acao: t.action })),
  }
}

export type Contexto = ReturnType<typeof montarContexto>
export type MensagemHistorico = { papel: 'usuario' | 'assistente'; texto: string }
export type PedidoChat = { contexto: Contexto; historico: MensagemHistorico[]; pergunta: string }

const propostaSchema = z.object({
  tipo: z.enum(['preco', 'valor_hora']),
  valor: z.number().positive(),
  motivo: z.string(),
  itemId: z.string().nullish(),
  horasSemana: z.number().nullish(),
})

/** O que volta do agente. Proposta ou ação malformada só esvazia a lista dela, não perde o texto. */
export const respostaChatSchema = z.object({
  resposta: z.string().trim().min(1),
  propostas: z.array(propostaSchema).max(3).catch([]),
  acoes: z.array(z.object({ label: z.string(), to: z.string() })).max(3).catch([]),
})

export type Proposta = z.infer<typeof propostaSchema>
export type Acao = z.infer<typeof respostaChatSchema>['acoes'][number]
export type RespostaChat = z.infer<typeof respostaChatSchema>

/**
 * Como a ficha fica se a pessoa aceitar a proposta (RF24/RN06). A mesma função faz a prévia do
 * cartão e o aceite, então o que aparece é exatamente o que é salvo. null = não dá para aplicar.
 */
export function aplicarProposta(p: Proposta, data: AppData): { item: Item } | { business: Business } | null {
  if (p.tipo === 'preco') {
    const item = data.items.find((i) => i.id === p.itemId)
    const r = item && itemSchema.safeParse({ ...item, price: p.valor })
    return r?.success ? { item: r.data } : null
  }
  const b = data.business
  const r = b && businessSchema.safeParse({ ...b, hourlyRate: p.valor, weeklyHours: p.horasSemana ?? b.weeklyHours })
  return r?.success ? { business: r.data } : null
}
