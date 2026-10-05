import { describe, expect, it } from 'vitest'
import { buildTips, explainItem } from './advisor'
import { WEEKS_PER_MONTH, computeAll, computeItem, computeOverhead, priceParts } from './calc'
import { parseNumber } from './format'
import { type AppData, emptyData } from './schemas'

const base = (patch: Partial<AppData>): AppData => ({ ...emptyData(), ...patch })

describe('motor de cálculo', () => {
  it('rateia a despesa fixa pelas horas da jornada (RN03) e inclui ferramentas (RF09)', () => {
    // Oficina: 52h/semana, R$ 6.000 de despesas sem discriminar, ferramenta R$ 100 a cada 3 meses
    const data = base({
      business: { name: 'Oficina', type: 'servico', hourlyRate: 20, weeklyHours: 52, targetMargin: 30 },
      expenses: [{ id: 'e1', category: 'Tudo junto (não sei separar)', description: '', amount: 6000 }],
      tools: [{ id: 't1', name: 'Jogo de chaves', cost: 100, everyMonths: 3 }],
    })
    const o = computeOverhead(data)
    expect(o.monthlyHours).toBeCloseTo(52 * WEEKS_PER_MONTH)
    expect(o.toolsMonthly).toBeCloseTo(33.333, 2)
    expect(o.perHour).toBeCloseTo((6000 + 100 / 3) / (52 * 52 / 12), 6)
  })

  it('calcula material por rendimento, trabalho, despesa fixa e semáforo (RF11–RF15, RN04)', () => {
    // Sobrancelhas: linha R$ 30 rende 50 atendimentos; 45 min; hora R$ 25; R$ 866,67 fixo / 173,33 h
    const data = base({
      business: { name: 'Sobrancelhas', type: 'servico', hourlyRate: 25, weeklyHours: 40, targetMargin: 30 },
      supplies: [{ id: 's1', name: 'Linha', price: 30, mode: 'rendimento', amount: 50, unit: 'atendimentos' }],
      expenses: [{ id: 'e1', category: 'Aluguel', description: '', amount: 40 * WEEKS_PER_MONTH * 5 }], // R$ 5/h
      items: [
        {
          id: 'i1',
          name: 'Design',
          price: 40,
          minutes: 45,
          batchYield: 1,
          monthlyVolume: 80,
          lossPercent: 0,
          composition: [{ supplyId: 's1', qty: 1 }],
          variantOf: null,
        },
      ],
    })
    const c = computeAll(data).items[0]
    expect(c.material).toBeCloseTo(0.6)
    expect(c.labor).toBeCloseTo(18.75)
    expect(c.fixed).toBeCloseTo(3.75)
    expect(c.total).toBeCloseTo(23.1)
    expect(c.idealPrice).toBeCloseTo(23.1 / 0.7)
    expect(c.status).toBe('verde')
    expect(computeItem({ ...c.item, price: 30 }, data).status).toBe('amarelo')
    expect(computeItem({ ...c.item, price: 20 }, data).status).toBe('vermelho')
  })

  it('divide lote, aplica perdas e recalcula quando o insumo muda (RF10, RF17)', () => {
    // Brownies: fornada de 20 unidades em 60 min, Nescau R$ 20 / 400 g usando 200 g, 10% de perda
    const data = base({
      business: { name: 'Brownies', type: 'producao', hourlyRate: 12, weeklyHours: 20, targetMargin: 30 },
      supplies: [
        { id: 'n', name: 'Nescau', price: 20, mode: 'rendimento', amount: 400, unit: 'g' },
        { id: 'g', name: 'Gás', price: 120, mode: 'duracao', amount: 2, unit: 'meses' },
      ],
      items: [
        {
          id: 'b',
          name: 'Brownie',
          price: 6,
          minutes: 60,
          batchYield: 20,
          monthlyVolume: 300,
          lossPercent: 10,
          composition: [
            { supplyId: 'n', qty: 200 },
            { supplyId: 'g', qty: 1 },
          ],
          variantOf: null,
        },
      ],
    })
    const c = computeAll(data).items[0]
    const nescau = 10 / 20 // R$ 0,50 por unidade
    const gas = 60 / 300 // R$ 60/mês ÷ 300 unidades
    const labor = 12 / 20
    const baseCost = nescau + gas + labor
    expect(c.material).toBeCloseTo(nescau + gas)
    expect(c.labor).toBeCloseTo(labor)
    expect(c.loss).toBeCloseTo(baseCost * (0.1 / 0.9))
    expect(c.total).toBeCloseTo(baseCost / 0.9)

    const pricier = { ...data, supplies: data.supplies.map((s) => (s.id === 'n' ? { ...s, price: 40 } : s)) }
    expect(computeAll(pricier).items[0].material).toBeCloseTo(1 + gas)
  })

  it('marca a ficha como incompleta sem o valor da hora (RN01)', () => {
    const data = base({
      business: { name: 'X', type: 'servico', hourlyRate: null, weeklyHours: 40, targetMargin: 30 },
      items: [
        { id: 'i', name: 'Serviço', price: 50, minutes: 60, batchYield: 1, monthlyVolume: 10, lossPercent: 0, composition: [], variantOf: null },
      ],
    })
    const calc = computeAll(data)
    expect(calc.items[0].status).toBe('incompleto')
    expect(buildTips(data, calc).some((t) => t.id === 'sem-hora')).toBe(true)
  })

  it('soma das partes do preço fecha com o preço (RF16)', () => {
    const data = base({
      business: { name: 'X', type: 'servico', hourlyRate: 30, weeklyHours: 40, targetMargin: 20 },
      expenses: [{ id: 'e', category: 'Aluguel', description: '', amount: 1000 }],
      items: [
        { id: 'i', name: 'Serviço', price: 100, minutes: 60, batchYield: 1, monthlyVolume: 10, lossPercent: 0, composition: [], variantOf: null },
      ],
    })
    const c = computeAll(data).items[0]
    const total = priceParts(c).reduce((a, p) => a + p.value, 0)
    expect(total).toBeCloseTo(100)
    expect(explainItem(c, data).length).toBeGreaterThan(0)
  })
})

describe('consultor', () => {
  it('aponta volume incompatível com a jornada (RF21) e custos esquecidos (RF19)', () => {
    const data = base({
      business: { name: 'Doces', type: 'producao', hourlyRate: 15, weeklyHours: 10, targetMargin: 30 },
      items: [
        { id: 'i', name: 'Bolo', price: 50, minutes: 120, batchYield: 1, monthlyVolume: 100, lossPercent: 0, composition: [], variantOf: null },
      ],
    })
    const ids = buildTips(data, computeAll(data)).map((t) => t.id)
    expect(ids).toContain('volume-maior-que-jornada')
    expect(ids).toContain('falta-embalagem')
    expect(ids).toContain('falta-gas')
    expect(ids).toContain('falta-perda')
    expect(ids).toContain('sem-despesas')
  })
})

describe('parseNumber', () => {
  it('entende números digitados no formato brasileiro', () => {
    expect(parseNumber('12,50')).toBe(12.5)
    expect(parseNumber('1.200,00')).toBe(1200)
    expect(parseNumber('R$ 6.000')).toBe(6000)
    expect(parseNumber('1.200.000')).toBe(1200000)
    expect(parseNumber('7.5')).toBe(7.5)
    expect(parseNumber('')).toBeNaN()
  })
})
