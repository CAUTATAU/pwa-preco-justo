import { describe, expect, it } from 'vitest'
import { type Tip, buildTips } from './advisor'
import { aplicarProposta, corta, montarContexto, respostaChatSchema } from './agentContext'
import { computeAll } from './calc'
import { type AppData, type Item, emptyData } from './schemas'

const base = (patch: Partial<AppData>): AppData => ({ ...emptyData(), ...patch })
const negocio = { name: 'Studio da Ana', type: 'servico' as const, hourlyRate: 25, weeklyHours: 40, targetMargin: 30 }
const item = (p: Pick<Item, 'id' | 'name' | 'price'> & Partial<Item>): Item => ({
  minutes: 30,
  batchYield: 1,
  monthlyVolume: 10,
  lossPercent: 0,
  composition: [],
  variantOf: null,
  ...p,
})
const dica = (id: string): Tip => ({ id, level: 'dica', title: `Dica ${id}`, text: 'Texto da dica.' })

function contexto(data: AppData, tips?: Tip[]) {
  const calc = computeAll(data)
  return { calc, ctx: montarContexto(data, calc, tips ?? buildTips(data, calc)) }
}

describe('montarContexto', () => {
  it('monta a ficha no formato do agente, do pior para o melhor preço', () => {
    // hora R$ 25 e 30 min: custo R$ 12,50 e preço ideal R$ 17,86 (meta 30%)
    const data = base({
      business: negocio,
      items: [
        item({ id: 'v', name: 'Verde', price: 100 }),
        item({ id: 'r', name: 'Vermelho', price: 5 }),
        item({ id: 'i', name: 'Incompleto', price: 0 }),
        item({ id: 'a', name: 'Amarelo', price: 15 }),
      ],
    })
    const { ctx } = contexto(data)
    expect(Object.keys(ctx)).toEqual(['tipo', 'valorHora', 'horasSemana', 'metaSobraPct', 'despesas', 'resumo', 'itens', 'dicas'])
    expect(ctx.itens.map((i) => i.nome)).toEqual(['Vermelho', 'Amarelo', 'Incompleto', 'Verde'])
    expect(ctx.itens.map((i) => i.status)).toEqual(['vermelho', 'amarelo', 'incompleto', 'verde'])
  })

  it('manda o custo total sem arredondar (o agente repete o semáforo com ele)', () => {
    // 25 min a R$ 25/h = R$ 10,41666…
    const data = base({ business: negocio, items: [item({ id: 'x', name: 'Corte', price: 20, minutes: 25 })] })
    const { calc, ctx } = contexto(data)
    expect(ctx.itens[0].custoTotal).toBe(calc.items[0].total)
    expect(ctx.itens[0].custoTotal).not.toBe(10.42)
    expect(ctx.itens[0].partes.trabalho).toBe(10.42)
  })

  it('não leva o nome do negócio nem a descrição das despesas', () => {
    const data = base({
      business: negocio,
      expenses: [{ id: 'e', category: 'Aluguel', description: 'pago no pix para o João', amount: 600 }],
      items: [item({ id: 'x', name: 'Corte', price: 40 })],
    })
    const json = JSON.stringify(contexto(data).ctx)
    expect(json).not.toContain('Studio da Ana')
    expect(json).not.toContain('João')
    expect(json).toContain('Aluguel')
  })

  it('deixa de fora as dicas que a pessoa dispensou', () => {
    const data = base({ business: negocio, dismissedTips: ['x'] })
    expect(contexto(data, [dica('x'), dica('y')]).ctx.dicas.map((d) => d.id)).toEqual(['y'])
  })

  it('respeita os limites do agente: 50 itens, 40 dicas e categoria até 60 caracteres', () => {
    const data = base({
      business: negocio,
      expenses: [{ id: 'e', category: 'A'.repeat(70), description: '', amount: 10 }],
      items: Array.from({ length: 60 }, (_, n) => item({ id: `i${n}`, name: `Item ${n}`, price: 50 })),
    })
    const { ctx } = contexto(data, Array.from({ length: 45 }, (_, n) => dica(`d${n}`)))
    expect(ctx.itens).toHaveLength(50)
    expect(ctx.dicas).toHaveLength(40)
    expect(ctx.despesas.lista[0].categoria).toHaveLength(60)
  })
})

describe('corta', () => {
  it('conta por caractere de verdade, sem quebrar emoji ao meio', () => {
    expect(corta('😀😀😀', 2)).toBe('😀😀')
    expect(corta('abc', 10)).toBe('abc')
  })
})

describe('respostaChatSchema', () => {
  it('aceita só o texto, com listas vazias', () => {
    expect(respostaChatSchema.parse({ resposta: 'Oi!' })).toEqual({ resposta: 'Oi!', propostas: [], acoes: [] })
  })

  it('descarta propostas malformadas sem perder o texto', () => {
    const r = respostaChatSchema.parse({ resposta: 'Veja', propostas: [{ tipo: 'preco', valor: 0, motivo: 'x', itemId: 'a' }] })
    expect(r.propostas).toEqual([])
    expect(r.resposta).toBe('Veja')
  })

  it.each([[{}], [{ resposta: '' }], [{ resposta: '   ' }]])('recusa resposta sem texto (%o)', (corpo) => {
    expect(respostaChatSchema.safeParse(corpo).success).toBe(false)
  })
})

describe('aplicarProposta', () => {
  const data = base({ business: negocio, items: [item({ id: 'buco', name: 'Buço', price: 15 })] })

  it('preço: devolve o item com o preço novo', () => {
    const r = aplicarProposta({ tipo: 'preco', valor: 12.41, motivo: 'meta', itemId: 'buco', horasSemana: null }, data)
    expect(r && 'item' in r && r.item.price).toBe(12.41)
  })

  it.each([
    ['item que não existe mais', { itemId: 'apagado' }],
    ['sem item', { itemId: null }],
  ])('preço: %s não vira sugestão', (_, extra) => {
    expect(aplicarProposta({ tipo: 'preco', valor: 12, motivo: 'x', horasSemana: null, ...extra }, data)).toBeNull()
  })

  it('valor da hora: sem horas na proposta, mantém a jornada da ficha', () => {
    const r = aplicarProposta({ tipo: 'valor_hora', valor: 17.31, motivo: 'renda', itemId: null, horasSemana: null }, data)
    expect(r && 'business' in r && r.business).toMatchObject({ hourlyRate: 17.31, weeklyHours: 40, name: 'Studio da Ana' })
  })

  it('valor da hora: jornada impossível não vira sugestão', () => {
    expect(aplicarProposta({ tipo: 'valor_hora', valor: 20, motivo: 'x', itemId: null, horasSemana: 200 }, data)).toBeNull()
  })
})
