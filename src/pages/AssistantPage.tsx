import { ArrowRightIcon, CheckIcon, Loader2Icon, MessageCircleMoreIcon, RotateCcwIcon, SendIcon } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { EmptyState, PageHeader, RichText } from '@/components/common'
import { StatusBadge } from '@/components/PriceStatus'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCalc } from '@/hooks/useCalc'
import { useOnline } from '@/hooks/useOnline'
import { type Tip, terms } from '@/lib/advisor'
import { aplicarProposta } from '@/lib/agentContext'
import { type ItemCost, computeAll, computeItem } from '@/lib/calc'
import { brl, num } from '@/lib/format'
import { useAuth } from '@/store/auth'
import { type MensagemChat, useChat } from '@/store/chat'
import { useData } from '@/store/data'

/** Assistente de IA (RF18, RF20, RF23): conversa sobre a ficha; propostas só valem com Aceitar (RN06). */
export function AssistantPage() {
  const { data, calc, tips, t } = useCalc()
  const online = useOnline()
  const expired = useAuth((s) => s.expired)
  const { mensagens, enviando, enviar, reenviar, limpar } = useChat()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const [texto, setTexto] = useState('')

  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }, [mensagens.length, enviando])

  const foco = calc.byId.get(params.get('item') ?? '')
  const pode = online && !expired && !enviando
  // O assistente só abre telas que as dicas do próprio app já oferecem, com o rótulo delas
  const rotas = new Map(tips.flatMap((tip) => (tip.action ? [[tip.action.to, tip.action] as const] : [])))
  const sugestoes = sugerir(foco, Boolean(data.business?.hourlyRate), t)

  const perguntar = (pergunta: string) => {
    if (params.has('item')) setParams({}, { replace: true })
    void enviar(pergunta)
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!pode || !texto.trim()) return
    perguntar(texto)
    setTexto('')
  }

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col">
      <PageHeader
        title="Assistente"
        subtitle="Tira dúvidas sobre a sua ficha"
        back={location.key === 'default' ? '/' : true}
        action={
          mensagens.length > 0 &&
          !enviando && (
            <Button variant="ghost" size="icon" aria-label="Começar outra conversa" onClick={limpar}>
              <RotateCcwIcon className="size-5" />
            </Button>
          )
        }
      />

      <div className="flex-1 space-y-3">
        {mensagens.length === 0 && (
          <EmptyState
            icon={<MessageCircleMoreIcon />}
            title="Pergunte sobre os seus preços"
            text="Eu leio a sua ficha e explico com palavras simples. As contas são sempre as do app, e nada muda sem você tocar em Aceitar."
            action={
              <p className="text-xs text-muted-foreground">
                Para responder, um resumo da sua ficha (sem o nome do negócio) vai para a AWS.{' '}
                <Link to="/termos" className="font-medium text-primary underline">
                  Saiba mais
                </Link>
              </p>
            }
          />
        )}

        <div role="log" aria-label="Conversa com o assistente" className="space-y-3">
          {mensagens.map((m) =>
            m.papel === 'usuario' ? (
              <Pergunta key={m.id} m={m} pode={pode} onReenviar={() => void reenviar(m.id)} />
            ) : (
              <Resposta key={m.id} m={m} rotas={rotas} />
            ),
          )}
          {enviando && (
            <div className="flex items-center gap-2 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Pensando… pode levar até 1 minuto.
            </div>
          )}
        </div>

        {!enviando && (foco || mensagens.length === 0) && (
          <div className="space-y-2">
            {sugestoes.map((s) => (
              <Button
                key={s}
                variant="outline"
                className="h-auto w-full justify-start py-3 text-left whitespace-normal"
                disabled={!pode}
                onClick={() => perguntar(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="sticky bottom-20 z-10 mt-4 rounded-2xl border bg-card/95 p-2 shadow-lg backdrop-blur">
        <div className="flex gap-2">
          <Input
            aria-label="Sua pergunta"
            placeholder="Escreva sua pergunta"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={500}
            enterKeyHint="send"
          />
          <Button type="submit" size="icon-lg" aria-label="Enviar pergunta" disabled={!pode || !texto.trim()}>
            <SendIcon />
          </Button>
        </div>
        <Aviso online={online} expired={expired} caracteres={texto.length} />
      </form>
    </div>
  )
}

function sugerir(foco: ItemCost | undefined, temHora: boolean, t: ReturnType<typeof terms>): string[] {
  if (foco) {
    const nome = foco.item.name
    return foco.status === 'incompleto'
      ? [`O que falta para calcular "${nome}"?`, 'Como eu calculo o valor da minha hora?']
      : [`Por que "${nome}" custa ${brl(foco.total)}?`, `Posso baixar o preço de "${nome}"?`, `Como faço para sobrar mais em "${nome}"?`]
  }
  return [
    temHora ? `Qual ${t.item} deixa mais dinheiro para mim?` : 'Como eu calculo o valor da minha hora?',
    `Tem algum ${t.item} dando prejuízo?`,
    'Estou esquecendo algum custo?',
  ]
}

function Aviso({ online, expired, caracteres }: { online: boolean; expired: boolean; caracteres: number }) {
  if (!online) return <p className="px-2 pt-1.5 text-xs text-muted-foreground">Sem internet: o assistente volta quando a conexão voltar.</p>
  if (expired) {
    return (
      <p className="px-2 pt-1.5 text-xs">
        <Link to="/entrar?reentrar=1" className="font-medium text-primary underline">
          Sua sessão expirou. Toque aqui para entrar de novo.
        </Link>
      </p>
    )
  }
  if (caracteres > 400) return <p className="px-2 pt-1.5 text-right text-xs text-muted-foreground">{caracteres}/500</p>
  return null
}

function Pergunta({ m, pode, onReenviar }: { m: MensagemChat; pode: boolean; onReenviar: () => void }) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm break-words whitespace-pre-wrap text-primary-foreground">
        {m.texto}
      </p>
      {m.erro && (
        <div role="alert" className="flex max-w-[85%] flex-wrap items-center justify-end gap-2 text-right text-sm text-destructive">
          <span>{m.erro}</span>
          <Button size="sm" variant="outline" disabled={!pode} onClick={onReenviar}>
            Tentar de novo
          </Button>
        </div>
      )}
    </div>
  )
}

function Resposta({ m, rotas }: { m: MensagemChat; rotas: Map<string, NonNullable<Tip['action']>> }) {
  const linhas = m.texto.split('\n').map((l) => l.trim()).filter(Boolean)
  const acoes = (m.acoes ?? []).flatMap((a) => rotas.get(a.to) ?? [])
  return (
    <div className="space-y-2.5 rounded-2xl rounded-bl-md border bg-card p-4 text-sm leading-relaxed">
      {linhas.map((linha, i) =>
        linha.startsWith('- ') ? (
          <p key={i} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            <span>
              <RichText text={linha.slice(2)} />
            </span>
          </p>
        ) : (
          <p key={i}>
            <RichText text={linha} />
          </p>
        ),
      )}
      {m.propostas?.map((_, i) => <PropostaCard key={i} msgId={m.id} indice={i} />)}
      {acoes.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {acoes.map((a) => (
            <Button key={a.to} asChild size="sm" variant="secondary">
              <Link to={a.to}>{a.label}</Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Cartão de sugestão: mostra o antes → depois calculado pelo app e só salva com Aceitar (RF24/RN06). */
function PropostaCard({ msgId, indice }: { msgId: string; indice: number }) {
  const { data, calc, t } = useCalc()
  const saveItem = useData((s) => s.saveItem)
  const setBusiness = useData((s) => s.setBusiness)
  const marcar = useChat((s) => s.marcar)
  const p = useChat((s) => s.mensagens.find((m) => m.id === msgId)?.propostas?.[indice])

  if (!p) return null
  if (p.estado) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
        <CheckIcon className="size-4" /> {p.estado === 'aceita' ? 'Você aceitou esta sugestão.' : 'Você recusou esta sugestão.'}
      </p>
    )
  }
  const novo = aplicarProposta(p, data)
  if (!novo) return <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">Esta sugestão não está mais disponível.</p>

  let titulo: string
  let linhas: [string, ReactNode, ReactNode][]
  let aceitar: () => void
  if ('item' in novo) {
    const antes = calc.byId.get(novo.item.id)!
    const depois = computeItem(novo.item, data)
    titulo = `Novo preço para "${novo.item.name}"`
    linhas = [
      ['Preço', brl(antes.price), brl(depois.price)],
      ['Situação', <StatusBadge key="antes" status={antes.status} />, <StatusBadge key="depois" status={depois.status} />],
      [`Sobra por ${t.unit}`, brl(antes.profit), brl(depois.profit)],
    ]
    aceitar = () => {
      saveItem(novo.item)
      toast.success(`Preço de "${novo.item.name}" atualizado.`)
    }
  } else {
    const atual = data.business!
    const prejuizo = (itens: ItemCost[]) => String(itens.filter((c) => c.status === 'vermelho').length)
    const depois = computeAll({ ...data, business: novo.business })
    titulo = 'Novo valor da sua hora'
    linhas = [
      ['Valor da hora', atual.hourlyRate ? brl(atual.hourlyRate) : 'não definido', brl(novo.business.hourlyRate ?? 0)],
      ...(atual.weeklyHours !== novo.business.weeklyHours
        ? [['Horas por semana', `${num(atual.weeklyHours)} h`, `${num(novo.business.weeklyHours)} h`] as [string, ReactNode, ReactNode]]
        : []),
      [`${t.Items} dando prejuízo`, prejuizo(calc.items), prejuizo(depois.items)],
    ]
    aceitar = () => {
      setBusiness(novo.business)
      toast.success('Valor da hora atualizado. Todos os preços foram recalculados.')
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-secondary/60 p-4">
      <p className="font-semibold">{titulo}</p>
      <dl className="mt-2 space-y-1.5">
        {linhas.map(([rotulo, antes, depois]) => (
          <div key={rotulo} className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{rotulo}</dt>
            <dd className="flex items-center gap-1.5 font-medium tabular-nums">
              {antes}
              <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">passa para</span>
              {depois}
            </dd>
          </div>
        ))}
      </dl>
      {p.motivo && (
        <p className="mt-2 text-xs text-muted-foreground">
          <RichText text={p.motivo} />
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          className="flex-1"
          onClick={() => {
            aceitar()
            marcar(msgId, indice, 'aceita')
          }}
        >
          <CheckIcon /> Aceitar
        </Button>
        <Button variant="ghost" onClick={() => marcar(msgId, indice, 'recusada')}>
          Recusar
        </Button>
      </div>
    </div>
  )
}
