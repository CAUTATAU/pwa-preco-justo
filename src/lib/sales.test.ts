import { describe, expect, it } from 'vitest'
import { computeAll } from './calc'
import { addDays, buildSale, dayKey, dayLabel, salesOfDay, salesOfMonth, summarize } from './sales'
import { type AppData, type Sale, appDataSchema, emptyData } from './schemas'

const venda = (patch: Partial<Sale>): Sale => ({
  id: 'v',
  date: '2026-10-19',
  itemId: 'i1',
  itemName: 'Design',
  qty: 1,
  unitPrice: 40,
  unitCost: 30,
  createdAt: '2026-10-19T12:00:00.000Z',
  ...patch,
})

describe('fecho do dia', () => {
  it('usa o dia do aparelho e atravessa virada de mês e ano', () => {
    expect(dayKey(new Date(2026, 9, 19, 23, 59))).toBe('2026-10-19')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(dayLabel('2026-10-19', '2026-10-19')).toBe('Hoje')
    expect(dayLabel('2026-10-18', '2026-10-19')).toBe('Ontem')
  })

  it('soma faturamento e sobra; venda sem custo conhecido fica fora da sobra', () => {
    const r = summarize([
      venda({ qty: 2, unitPrice: 40, unitCost: 30 }), // fatura 80, sobra 20
      venda({ qty: 1, unitPrice: 25, unitCost: 30 }), // desconto: fatura 25, falta 5
      venda({ qty: 3, unitPrice: 10, unitCost: null }), // fatura 30, sem custo
    ])
    expect(r).toEqual({ count: 6, revenue: 135, profit: 15, unknownCost: 3 })
  })

  it('separa vendas por dia (mais recentes primeiro) e por mês', () => {
    const sales = [
      venda({ id: 'a', date: '2026-10-19', createdAt: '2026-10-19T10:00:00.000Z' }),
      venda({ id: 'b', date: '2026-10-19', createdAt: '2026-10-19T15:00:00.000Z' }),
      venda({ id: 'c', date: '2026-10-01' }),
      venda({ id: 'd', date: '2026-09-30' }),
    ]
    expect(salesOfDay(sales, '2026-10-19').map((s) => s.id)).toEqual(['b', 'a'])
    expect(salesOfMonth(sales, '2026-10-19').map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('guarda nome, preço e custo do momento; ficha incompleta fica sem custo', () => {
    const data: AppData = {
      ...emptyData(),
      business: { name: 'Studio', type: 'servico', hourlyRate: 25, weeklyHours: 40, targetMargin: 30 },
      items: [
        { id: 'i1', name: 'Design', price: 40, minutes: 60, batchYield: 1, monthlyVolume: 0, lossPercent: 0, composition: [], variantOf: null },
      ],
    }
    const c = computeAll(data).byId.get('i1')!
    const sale = buildSale(c, '2026-10-19', 2)
    expect(sale).toMatchObject({ itemId: 'i1', itemName: 'Design', qty: 2, unitPrice: 40, date: '2026-10-19' })
    expect(sale.unitCost).toBeCloseTo(c.total)
    expect(buildSale(c, '2026-10-19', 1, 35).unitPrice).toBe(35)

    const semHora = computeAll({ ...data, business: { ...data.business!, hourlyRate: null } }).byId.get('i1')!
    expect(buildSale(semHora, '2026-10-19').unitCost).toBeNull()
  })

  it('aceita backup antigo, sem vendas', () => {
    const { sales: _sales, ...antigo } = emptyData()
    const parsed = appDataSchema.parse(antigo)
    expect(parsed.sales).toEqual([])
  })
})
