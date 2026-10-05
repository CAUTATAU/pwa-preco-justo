import { CircleHelpIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** Explicação acessível no próprio ponto de uso (RNF04). Toque no "?" para abrir. */
export function Hint({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={title ? `O que é ${title}?` : 'Ajuda'}
        className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-primary"
      >
        <CircleHelpIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm leading-relaxed" align="start">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  )
}

/** Glossário usado em vários pontos do app. */
export const GLOSSARY = {
  hora: {
    title: 'Valor da sua hora',
    text: 'Quanto vale 1 hora do seu trabalho. É o seu "salário" dentro do preço. Se você não colocar, está trabalhando de graça.',
  },
  jornada: {
    title: 'Horas por semana',
    text: 'Quantas horas você trabalha no negócio em uma semana normal. Serve para dividir as despesas do mês entre as horas trabalhadas.',
  },
  margem: {
    title: 'Sobra (margem)',
    text: 'É o que sobra do preço depois de pagar todos os custos, inclusive o seu trabalho. Serve para investir, guardar ou cobrir imprevistos. Ex.: 30% de sobra num preço de R$ 100 são R$ 30.',
  },
  despesaFixa: {
    title: 'Despesas fixas',
    text: 'Contas que chegam todo mês, vendendo ou não: aluguel, água, luz, internet, MEI… O app divide esse total pelas horas que você trabalha e coloca uma parte em cada venda.',
  },
  rendimento: {
    title: 'Rendimento',
    text: 'Quanto um insumo rende. Ex.: um pacote de R$ 30 que rende 50 atendimentos custa R$ 0,60 por atendimento. Você não precisa fazer a conta: o app faz.',
  },
  perda: {
    title: 'Perdas',
    text: 'O que se perde na produção: queimou, quebrou, venceu, deu de prova. Quem paga a perda é o que você vende.',
  },
  variante: {
    title: 'Variante',
    text: 'Uma versão do mesmo item com material diferente (ex.: linha comum e linha premium). Cada variante tem seu próprio custo e preço.',
  },
  ferramenta: {
    title: 'Ferramentas e equipamentos',
    text: 'Coisas que se desgastam e precisam ser trocadas de tempos em tempos (alicate, pinça, forma, batedeira). O app divide o valor por mês e coloca nos preços.',
  },
} as const
