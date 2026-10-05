/**
 * Consultor do Preço Justo.
 *
 * Lê as fichas já preenchidas e devolve dicas em linguagem simples:
 * custos esquecidos (RF19), inconsistências (RF21) e explicação do preço (RF22).
 * Funciona offline e nunca altera dados (RN06): toda ação passa pelo empreendedor.
 */
import { type CalcResult, type ItemCost, occupiedHours, priceParts } from './calc'
import { brl, num, pct } from './format'
import type { AppData, BusinessType } from './schemas'

export type Tip = {
  id: string
  level: 'alerta' | 'dica'
  title: string
  text: string
  action?: { label: string; to: string }
  /** Pode ser dispensada com "não tenho esse custo" */
  dismissible?: boolean
}

export function terms(type: BusinessType | undefined) {
  return type === 'producao'
    ? { item: 'produto', items: 'produtos', unit: 'unidade', units: 'unidades', Item: 'Produto', Items: 'Produtos' }
    : { item: 'serviço', items: 'serviços', unit: 'atendimento', units: 'atendimentos', Item: 'Serviço', Items: 'Serviços' }
}

type ChecklistEntry = {
  id: string
  title: string
  text: string
  types: BusinessType[]
  /** true quando o custo parece já ter sido cadastrado */
  covered: (data: AppData) => boolean
  action: { label: string; to: string }
}

const has = (data: AppData, re: RegExp) =>
  data.supplies.some((s) => re.test(s.name)) ||
  data.tools.some((t) => re.test(t.name)) ||
  data.expenses.some((e) => re.test(e.category) || re.test(e.description ?? ''))

const lumpSum = (data: AppData) => data.expenses.some((e) => e.category.startsWith('Tudo junto'))

/** Checklist de custos que costumam ficar de fora, por tipo de conta (RF19). */
const CHECKLIST: ChecklistEntry[] = [
  {
    id: 'falta-ferramenta',
    title: 'E o desgaste das ferramentas?',
    text: 'Ferramentas e equipamentos se gastam e precisam ser trocados. Cadastre quanto custa repor e de quanto em quanto tempo, que o app divide esse valor nos seus preços.',
    types: ['servico', 'producao'],
    covered: (d) => d.tools.length > 0,
    action: { label: 'Cadastrar ferramenta', to: '/despesas?aba=ferramentas' },
  },
  {
    id: 'falta-energia',
    title: 'A conta de luz entrou?',
    text: 'Máquinas, forno, secador e iluminação gastam energia. Mesmo trabalhando em casa, uma parte da conta de luz é do negócio.',
    types: ['servico', 'producao'],
    covered: (d) => lumpSum(d) || has(d, /luz|energia/i),
    action: { label: 'Lançar despesa', to: '/despesas' },
  },
  {
    id: 'falta-embalagem',
    title: 'Esqueceu a embalagem?',
    text: 'Caixinha, saquinho, pote, etiqueta, guardanapo… tudo isso sai do seu bolso a cada venda. Cadastre como insumo e coloque nos produtos.',
    types: ['producao'],
    covered: (d) => has(d, /embal|caixa|saco|saquinho|pote|etiqueta|papel|forminha|sacola/i),
    action: { label: 'Cadastrar insumo', to: '/insumos?novo=1' },
  },
  {
    id: 'falta-gas',
    title: 'E o gás do forno/fogão?',
    text: 'O botijão acaba e custa caro. Cadastre como insumo que "dura N semanas" ou como despesa do mês.',
    types: ['producao'],
    covered: (d) => lumpSum(d) || has(d, /g[aá]s|botij/i),
    action: { label: 'Cadastrar insumo', to: '/insumos?novo=1' },
  },
  {
    id: 'falta-perda',
    title: 'Nada se perde na produção?',
    text: 'Quando algo queima, quebra, vence ou é dado de prova, quem paga é o que você vende. Informe a perda nos produtos.',
    types: ['producao'],
    covered: (d) => d.items.some((i) => i.lossPercent > 0),
    action: { label: 'Ver produtos', to: '/itens' },
  },
  {
    id: 'falta-deslocamento',
    title: 'Você se desloca para trabalhar ou comprar?',
    text: 'Gasolina, passagem ou aplicativo para atender, entregar ou buscar material também é custo do negócio.',
    types: ['servico', 'producao'],
    covered: (d) => lumpSum(d) || has(d, /desloc|transporte|gasolina|combust|uber|passagem|entrega|frete/i),
    action: { label: 'Lançar despesa', to: '/despesas' },
  },
]

export function buildTips(data: AppData, calc: CalcResult): Tip[] {
  const business = data.business
  if (!business) return []
  const t = terms(business.type)
  const tips: Tip[] = []

  // RN01 — sem a hora de trabalho a ficha não está completa
  if (!business.hourlyRate) {
    tips.push({
      id: 'sem-hora',
      level: 'alerta',
      title: 'Falta o valor da sua hora',
      text: 'Sem isso o app não sabe quanto vale o seu tempo, e o seu trabalho fica de graça no preço. Se não souber, o app ajuda a calcular.',
      action: { label: 'Definir minha hora', to: '/ajustes?hora=1' },
    })
  }

  if (data.items.length === 0) {
    tips.push({
      id: 'sem-itens',
      level: 'dica',
      title: `Cadastre seu primeiro ${t.item}`,
      text: `Comece pelo ${t.item} que você mais vende. Leva menos de 5 minutos.`,
      action: { label: `Novo ${t.item}`, to: '/itens/novo' },
    })
  }

  if (data.expenses.length === 0) {
    tips.push({
      id: 'sem-despesas',
      level: 'alerta',
      title: 'Nenhuma despesa fixa lançada',
      text: 'Aluguel, água, luz, internet, MEI… Essas contas chegam todo mês, vendendo ou não, e precisam estar dentro do preço. Se não souber separar, lance um valor total.',
      action: { label: 'Lançar despesas', to: '/despesas' },
    })
  }

  // RF19 — checklist de custos esquecidos
  for (const entry of CHECKLIST) {
    if (!entry.types.includes(business.type)) continue
    if (data.dismissedTips.includes(entry.id) || entry.covered(data)) continue
    if (entry.id === 'falta-perda' && data.items.length === 0) continue
    tips.push({ id: entry.id, level: 'dica', title: entry.title, text: entry.text, action: entry.action, dismissible: true })
  }

  // RF21 — inconsistências entre volume e jornada
  const used = occupiedHours(data)
  const available = calc.overhead.monthlyHours
  if (available > 0 && used > available * 1.05) {
    tips.push({
      id: 'volume-maior-que-jornada',
      level: 'alerta',
      title: 'As vendas não cabem na sua jornada',
      text: `Pelas vendas por mês que você informou, seriam ${num(used)} h de trabalho, mas sua jornada dá ${num(available)} h no mês. Confira o tempo de cada ${t.item}, as vendas por mês ou as horas por semana.`,
      action: { label: 'Revisar', to: '/itens' },
    })
  } else if (available > 0 && used > 0 && used < available * 0.5 && data.items.length >= 2) {
    tips.push({
      id: 'jornada-ociosa',
      level: 'dica',
      title: 'Boa parte da sua jornada fica sem venda',
      text: `Suas vendas ocupam ${pct(used / available)} das horas que você trabalha. As despesas fixas são divididas pelas horas da jornada; se o resto do tempo não gera venda, cada ${t.item} precisa pagar mais despesa do que aparece aqui. Vale conferir as horas por semana e as vendas por mês.`,
      action: { label: 'Ver ajustes', to: '/ajustes' },
      dismissible: true,
    })
  }

  for (const c of calc.items) {
    const name = c.item.name
    if (c.item.monthlyVolume <= 0) {
      tips.push({
        id: `sem-volume-${c.item.id}`,
        level: 'dica',
        title: `Quantos "${name}" você vende por mês?`,
        text: 'Mesmo um chute ajuda: o app usa isso para dividir insumos que duram semanas/meses e estimar sua sobra no mês.',
        action: { label: 'Informar', to: `/itens/${c.item.id}/editar` },
      })
    }
    if (c.item.composition.length === 0 && business.type === 'producao') {
      tips.push({
        id: `sem-insumo-${c.item.id}`,
        level: 'dica',
        title: `"${name}" está sem ingredientes`,
        text: 'Adicione os insumos usados para o custo de material entrar na conta.',
        action: { label: 'Adicionar', to: `/itens/${c.item.id}/editar` },
      })
    }
    if (c.status === 'vermelho') {
      tips.push({
        id: `prejuizo-${c.item.id}`,
        level: 'alerta',
        title: `"${name}" está dando prejuízo`,
        text: `Cada ${t.unit} custa ${brl(c.total)} e você cobra ${brl(c.price)}: faltam ${brl(-c.profit)}.`,
        action: { label: 'Ver a conta', to: `/itens/${c.item.id}` },
      })
    }
  }

  const unusedDuration = data.supplies.filter(
    (s) => s.mode === 'duracao' && !data.items.some((i) => i.composition.some((c) => c.supplyId === s.id)),
  )
  for (const s of unusedDuration) {
    tips.push({
      id: `insumo-solto-${s.id}`,
      level: 'dica',
      title: `"${s.name}" não está em nenhum ${t.item}`,
      text: `Coloque este insumo nos ${t.items} em que ele é usado para o custo entrar no preço.`,
      action: { label: `Ver ${t.items}`, to: '/itens' },
    })
  }

  return tips.sort((a, b) => (a.level === b.level ? 0 : a.level === 'alerta' ? -1 : 1))
}

/** Explicação do resultado de um item (RF22), em frases curtas. */
export function explainItem(c: ItemCost, data: AppData): string[] {
  const t = terms(data.business?.type)
  const lines: string[] = []
  const targetMargin = (data.business?.targetMargin ?? 0) / 100

  if (c.status === 'incompleto') {
    lines.push(`A conta ainda está incompleta: falta ${c.missing.join(', ')}. Sem isso, seu trabalho entra de graça no preço.`)
  }

  const costParts = priceParts(c).filter((p) => p.key !== 'profit' && p.value > 0)
  const heaviest = [...costParts].sort((a, b) => b.value - a.value)[0]
  if (heaviest && c.total > 0) {
    lines.push(`O que mais pesa no custo é **${heaviest.label.toLowerCase()}**: ${brl(heaviest.value)} de ${brl(c.total)} (${pct(heaviest.value / c.total)}).`)
  }

  const topSupply = [...c.materialLines].sort((a, b) => b.perUnit - a.perUnit)[0]
  if (topSupply && c.material > 0 && c.materialLines.length > 1) {
    lines.push(`No material, o insumo mais caro é **${topSupply.name}** (${pct(topSupply.perUnit / c.material)} do material). Fique de olho no preço dele.`)
  }

  if (c.price > 0 && c.material > 0 && c.material / c.price < 0.05 && c.labor + c.fixed > 0) {
    lines.push(`O material é só ${pct(c.material / c.price, 1)} do preço. Seu tempo e as despesas fixas pesam muito mais, então não dá para calcular o preço só pelo material.`)
  }

  if (c.status === 'vermelho') {
    const monthly = c.item.monthlyVolume > 0 ? ` Com ${num(c.item.monthlyVolume)} ${t.units} por mês, são ${brl(-c.monthlyProfit)} a menos no mês.` : ''
    lines.push(`Hoje você cobra ${brl(c.price)}, mas cada ${t.unit} custa ${brl(c.total)}. Você paga ${brl(-c.profit)} para trabalhar.${monthly}`)
    lines.push(`Para não ter prejuízo, cobre pelo menos **${brl(c.minPrice)}**. Para ter a sobra de ${pct(targetMargin)} que você definiu, **${brl(c.idealPrice)}**.`)
  } else if (c.status === 'amarelo') {
    lines.push(`O preço cobre o custo e sobram ${brl(c.profit)} (${pct(c.margin)} do preço), abaixo da sua meta de ${pct(targetMargin)}.`)
    lines.push(`Para chegar na meta, o preço seria **${brl(c.idealPrice)}**.`)
  } else if (c.status === 'verde') {
    const monthly = c.item.monthlyVolume > 0 ? ` Com ${num(c.item.monthlyVolume)} ${t.units} por mês, sobram cerca de ${brl(c.monthlyProfit)}.` : ''
    lines.push(`Preço saudável! Cobre todos os custos e sobram ${brl(c.profit)} (${pct(c.margin)}) por ${t.unit}.${monthly}`)
    if (c.price > c.idealPrice * 1.0001) {
      lines.push(`Se precisar dar desconto, dá para baixar até **${brl(c.idealPrice)}** sem sair da sua meta, ou até ${brl(c.minPrice)} sem ter prejuízo.`)
    }
  }

  return lines
}
