const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

/** R$ 1.234,56 */
export const brl = (value: number) => brlFormatter.format(Number.isFinite(value) ? value : 0)

/** 1.234,5 */
export const num = (value: number) => numFormatter.format(Number.isFinite(value) ? value : 0)

/** 12% */
export const pct = (ratio: number, digits = 0) =>
  `${(Number.isFinite(ratio) ? ratio * 100 : 0).toFixed(digits).replace('.', ',')}%`

/**
 * Converte o que a pessoa digitou ("12,50", "1.200,00", "12.5") em número.
 * Retorna NaN quando não for possível.
 */
export function parseNumber(input: unknown): number {
  if (typeof input === 'number') return input
  if (typeof input !== 'string') return Number.NaN
  let s = input.trim().replace(/[R$\s%]/g, '')
  if (!s) return Number.NaN
  if (s.includes(',')) {
    // formato brasileiro: ponto é milhar, vírgula é decimal
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "6.000" ou "1.200.000": ponto como separador de milhar
    s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : Number.NaN
}

/** Número para preencher um campo de texto ("12,5"). */
export const toInput = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? '' : String(value).replace('.', ',')

/** Arredonda para cima no centavo. */
export const ceilCents = (value: number) => Math.ceil(Math.round(value * 1000) / 10) / 100

export const minutesLabel = (minutes: number) => {
  if (minutes < 60) return `${num(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID()
    } catch {
      /* contexto não seguro (http em IP da rede) */
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
