import {
  ActivityIcon,
  AlertTriangleIcon,
  ClockIcon,
  Loader2Icon,
  LogOutIcon,
  MousePointerClickIcon,
  RefreshCwIcon,
  StoreIcon,
  TrendingDownIcon,
  UsersIcon,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarRows, DailyColumns, Heatmap, Segmented, TooltipProvider, compact, nf } from '@/components/admin/charts'
import { Button } from '@/components/ui/button'
import type { AdminOverview, LiveEvent } from '@/lib/adminTypes'
import { type StreamStatus, connectAdminStream } from '@/lib/adminStream'
import { api } from '@/lib/api'
import { brl } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth'

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

function duration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h ${String(min % 60).padStart(2, '0')} min`
}

function ago(iso: string | null, now: number): string {
  if (!iso) return '—'
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 45) return 'agora'
  const min = Math.round(s / 60)
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return `há ${d} dia${d > 1 ? 's' : ''}`
}

const pctOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)
const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function screenName(ev: LiveEvent) {
  if (ev.path === '/itens/novo' || ev.path.endsWith('/editar')) return 'o cadastro de produto'
  if (ev.path.startsWith('/itens/')) return 'a ficha de um produto'
  return ev.area ? `“${ev.area}”` : 'o app'
}

/** Frase do feed ao vivo */
function describe(ev: LiveEvent): { who: string; text: string; tone?: 'bad' | 'ok' } {
  const who = ev.userName?.split(' ')[0] ?? 'Visitante'
  const t = ev.target ? `“${ev.target}”` : ''
  switch (ev.type) {
    case 'session_start':
      return { who, text: 'abriu o app' }
    case 'page_view':
      return { who, text: `abriu ${screenName(ev)}` }
    case 'click':
      return { who, text: `tocou em ${t} (${ev.area})` }
    case 'rage_click':
      return { who, text: `tocou várias vezes seguidas em ${t}`, tone: 'bad' }
    case 'form_error':
      return { who, text: `viu o aviso ${t}`, tone: 'bad' }
    case 'js_error':
      return { who, text: `teve um erro no app: ${t}`, tone: 'bad' }
    case 'success':
      return { who, text: `concluiu: ${t}`, tone: 'ok' }
    case 'login':
      return { who, text: 'entrou na conta' }
    case 'register':
      return { who, text: 'criou uma conta nova', tone: 'ok' }
    case 'password_reset':
      return { who, text: 'trocou a senha (esqueceu a senha)' }
    case 'assistant_question':
      return { who, text: 'fez uma pergunta ao assistente de IA' }
    default:
      return { who, text: ev.type }
  }
}

/* ------------------------------------------------------------------ */
/* Peças de layout                                                     */
/* ------------------------------------------------------------------ */

function Card({ title, subtitle, children, className, action }: { title: string; subtitle?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn('min-w-0 rounded-2xl border bg-card p-4 sm:p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Insight({ icon, title, children, tone = 'neutral' }: { icon: ReactNode; title: string; children: ReactNode; tone?: 'neutral' | 'warn' }) {
  return (
    <div className={cn('flex gap-3 rounded-2xl border p-4', tone === 'warn' ? 'border-warn/40 bg-warn/10' : 'bg-secondary/60')}>
      <div className="mt-0.5 shrink-0 text-primary [&_svg]:size-5">{icon}</div>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

function TopList({ rows, empty }: { rows: { texto: string; area: string; vezes: number; pessoas: number }[]; empty: string }) {
  if (!rows.length) return <p className="py-2 text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="divide-y text-sm">
      {rows.map((r) => (
        <li key={`${r.area}-${r.texto}`} className="flex items-start justify-between gap-3 py-2">
          <span className="min-w-0">
            <span className="block break-words">{r.texto}</span>
            <span className="text-xs text-muted-foreground">{r.area}</span>
          </span>
          <span className="shrink-0 text-right tabular-nums">
            {nf.format(r.vezes)}×
            <span className="block text-xs text-muted-foreground">
              {r.pessoas} pessoa{r.pessoas === 1 ? '' : 's'}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

const PERIODS = [7, 30, 90] as const
const DAILY_METRICS = [
  { key: 'visualizacoes', label: 'Telas abertas' },
  { key: 'sessoes', label: 'Sessões' },
  { key: 'edicoes', label: 'Mudanças salvas' },
  { key: 'cadastros', label: 'Contas criadas' },
  { key: 'vendas', label: 'Vendas registradas' },
] as const
type DailyKey = (typeof DAILY_METRICS)[number]['key']

export function AdminPage() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const expired = useAuth((s) => s.expired)

  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<StreamStatus>('conectando')
  const [feed, setFeed] = useState<LiveEvent[]>([])
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [metric, setMetric] = useState<DailyKey>('visualizacoes')
  const [now, setNow] = useState(Date.now)
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      try {
        const overview = await api.adminOverview(days)
        setData(overview)
        setError(null)
        setFeed((cur) => mergeFeed(cur, overview.feed))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar o painel.')
      } finally {
        setLoading(false)
      }
    },
    [days],
  )

  useEffect(() => {
    void load()
  }, [load])

  // Ao vivo: cada evento entra no feed na hora e os números são recalculados logo depois
  useEffect(() => {
    const scheduleRefetch = () => {
      clearTimeout(refetchTimer.current)
      refetchTimer.current = setTimeout(() => void load(true), 1500)
    }
    const close = connectAdminStream({
      onStatus: setStatus,
      onChanged: scheduleRefetch,
      onEvents: (events) => {
        setFeed((cur) => mergeFeed(cur, events))
        setFresh(new Set(events.map((e) => e.id)))
        scheduleRefetch()
      },
    })
    // Mesmo sem eventos, "online agora" e "há X min" mudam com o tempo
    const tick = setInterval(() => setNow(Date.now()), 15_000)
    const poll = setInterval(() => void load(true), 60_000)
    return () => {
      close()
      clearInterval(tick)
      clearInterval(poll)
      clearTimeout(refetchTimer.current)
    }
  }, [load])

  const insights = useMemo(() => (data ? buildInsights(data) : []), [data])

  const exit = () => {
    logout()
    navigate('/entrar', { replace: true })
  }

  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-background">
        {/* Cabeçalho */}
        <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold leading-tight">Painel de uso · Preço Justo</h1>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email} · {data ? `atualizado ${ago(data.generatedAt, now)}` : 'carregando…'}
              </p>
            </div>
            <LiveBadge status={status} online={data?.online.sessoes ?? 0} />
            <div className="flex rounded-lg border bg-muted p-0.5" role="group" aria-label="Período">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDays(p)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    days === p ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {p} dias
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" aria-label="Atualizar" onClick={() => void load()} disabled={loading}>
              <RefreshCwIcon className={cn(loading && 'animate-spin')} />
            </Button>
            <Button variant="outline" size="sm" onClick={exit}>
              <LogOutIcon /> Sair
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-5 px-4 py-5">
          {expired && (
            <p className="rounded-xl bg-warn/20 px-4 py-3 text-sm">
              Sua sessão expirou. <button className="font-semibold underline" onClick={exit}>Entre de novo</button> para continuar vendo o painel.
            </p>
          )}
          {error && !data && <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">{error}</p>}
          {!data ? (
            <div className="flex justify-center py-24 text-muted-foreground">
              <Loader2Icon className="size-6 animate-spin" />
            </div>
          ) : (
            <Dashboard data={data} feed={feed} fresh={fresh} now={now} insights={insights} metric={metric} setMetric={setMetric} />
          )}
        </main>
      </div>
    </TooltipProvider>
  )
}

function mergeFeed(cur: LiveEvent[], incoming: LiveEvent[]) {
  const byId = new Map(cur.map((e) => [e.id, e]))
  for (const e of incoming) byId.set(e.id, e)
  return [...byId.values()].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 40)
}

function LiveBadge({ status, online }: { status: StreamStatus; online: number }) {
  const live = status === 'ao-vivo'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
        live ? 'border-ok/40 bg-ok/10' : 'border-warn/40 bg-warn/10',
      )}
      title={live ? 'Recebendo os eventos na hora' : 'Reconectando ao servidor'}
    >
      <span className="relative flex size-2">
        {live && <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-75" />}
        <span className={cn('relative inline-flex size-2 rounded-full', live ? 'bg-ok' : 'bg-warn')} />
      </span>
      {live ? 'Ao vivo' : status === 'conectando' ? 'Conectando…' : 'Reconectando…'}
      <span className="font-normal text-muted-foreground">· {online} online</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Conclusões automáticas (o que mostrar primeiro na apresentação)     */
/* ------------------------------------------------------------------ */

type InsightData = { key: string; icon: ReactNode; title: string; text: string; tone?: 'warn' }

function buildInsights(d: AdminOverview): InsightData[] {
  const out: InsightData[] = []
  const totalMs = d.areas.reduce((a, r) => a + r.tempoMs, 0)
  const topTime = d.areas[0]
  if (topTime && totalMs > 0) {
    out.push({
      key: 'tempo',
      icon: <ClockIcon />,
      title: `Área onde passam mais tempo: ${topTime.area}`,
      text: `${pctOf(topTime.tempoMs, totalMs)}% do tempo de uso medido (${duration(topTime.tempoMs)} no total).`,
    })
  } else {
    const topEdit = [...d.areas].sort((a, b) => b.edicoes - a.edicoes)[0]
    if (topEdit && topEdit.edicoes > 0) {
      const totalEd = d.areas.reduce((a, r) => a + r.edicoes, 0)
      out.push({
        key: 'edicoes',
        icon: <ClockIcon />,
        title: `Área com mais mudanças salvas: ${topEdit.area}`,
        text: `${pctOf(topEdit.edicoes, totalEd)}% de tudo que foi cadastrado ou alterado no período.`,
      })
    }
  }
  const topClick = d.botoes[0]
  if (topClick) {
    out.push({
      key: 'clique',
      icon: <MousePointerClickIcon />,
      title: `Botão mais tocado: “${topClick.texto}”`,
      text: `${nf.format(topClick.vezes)} toques em ${topClick.area}, por ${topClick.pessoas} pessoa${topClick.pessoas === 1 ? '' : 's'}.`,
    })
  }
  // Maior perda entre duas etapas do funil
  let worst: { from: string; to: string; lost: number; pct: number } | null = null
  for (let i = 1; i < d.funil.length; i++) {
    const prev = d.funil[i - 1]!
    const cur = d.funil[i]!
    const lost = prev.contas - cur.contas
    if (prev.contas > 0 && lost > 0 && (!worst || lost / prev.contas > worst.pct)) {
      worst = { from: prev.etapa, to: cur.etapa, lost, pct: lost / prev.contas }
    }
  }
  if (worst) {
    out.push({
      key: 'funil',
      icon: <TrendingDownIcon />,
      title: `Maior desistência: depois de “${worst.from}”`,
      text: `${worst.lost} conta${worst.lost === 1 ? '' : 's'} (${Math.round(worst.pct * 100)}%) não chegaram a “${worst.to.toLowerCase()}”.`,
      tone: 'warn',
    })
  }
  const topErr = d.usabilidade.errosFormulario[0] ?? d.usabilidade.cliquesRepetidos[0]
  if (topErr) {
    out.push({
      key: 'erro',
      icon: <AlertTriangleIcon />,
      title: 'Onde as pessoas mais travam',
      text: `“${topErr.texto}” em ${topErr.area}: ${nf.format(topErr.vezes)} vez${topErr.vezes === 1 ? '' : 'es'}.`,
      tone: 'warn',
    })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Conteúdo                                                            */
/* ------------------------------------------------------------------ */

function Dashboard({
  data: d,
  feed,
  fresh,
  now,
  insights,
  metric,
  setMetric,
}: {
  data: AdminOverview
  feed: LiveEvent[]
  fresh: Set<string>
  now: number
  insights: InsightData[]
  metric: DailyKey
  setMetric: (m: DailyKey) => void
}) {
  const totalMs = d.areas.reduce((a, r) => a + r.tempoMs, 0)
  const totalClicks = d.areas.reduce((a, r) => a + r.cliques, 0)
  const totalEdits = d.areas.reduce((a, r) => a + r.edicoes, 0)
  const funnelTop = d.funil[0]?.contas ?? 0
  const metricInfo = DAILY_METRICS.find((m) => m.key === metric)!
  const heatCells = d.heatmap.map((c) => ({ dow: c.dow, h: c.h, value: c.eventos + c.edicoes }))
  const devices = aggregateDevices(d.dispositivos)
  const trackingSince = d.tracking.desde ? new Date(d.tracking.desde).toLocaleDateString('pt-BR') : null

  return (
    <>
      <p className="rounded-xl border border-dashed bg-card px-4 py-2.5 text-xs text-muted-foreground">
        Contas, negócios, cadastros, vendas e mudanças salvas vêm dos dados que o sistema já guardava (histórico completo).
        Telas, tempo de uso e cliques são medidos{' '}
        {trackingSince ? `desde ${trackingSince} (${nf.format(d.tracking.eventos)} eventos)` : 'a partir de agora — ainda sem eventos'}. A
        conta de administrador fica de fora.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Stat icon={<UsersIcon />} label="Contas criadas" value={nf.format(d.contas.total)} hint={`+${d.contas.novas} no período`} />
        <Stat icon={<ActivityIcon />} label="Online agora" value={nf.format(d.online.sessoes)} hint={`${d.online.pessoas} com login`} />
        <Stat label="Ativas em 7 dias" value={nf.format(d.contas.ativas7d)} hint={`${d.contas.ativas24h} nas últimas 24 h`} />
        <Stat icon={<StoreIcon />} label="Negócios cadastrados" value={nf.format(d.contas.comNegocio)} hint={`${pctOf(d.contas.comNegocio, d.contas.total)}% das contas`} />
        <Stat label="Produtos e serviços" value={nf.format(d.cadastros.itens)} hint={`${nf.format(d.cadastros.insumos)} insumos`} />
        <Stat label="Vendas registradas" value={nf.format(d.vendas.registros ?? 0)} hint={brl(d.vendas.receita ?? 0)} />
        <Stat label="Sessões no período" value={nf.format(d.uso.sessoes)} hint={`${(d.uso.paginasPorSessao || 0).toFixed(1).replace('.', ',')} telas por sessão`} />
        <Stat label="Tempo médio por sessão" value={d.uso.duracaoMediaMs ? duration(d.uso.duracaoMediaMs) : '—'} hint={`${pctOf(d.uso.rejeicao, d.uso.sessoes)}% saíram na 1ª tela`} />
      </div>

      {/* Conclusões */}
      {insights.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {insights.map((i) => (
            <Insight key={i.key} icon={i.icon} title={i.title} tone={i.tone}>
              {i.text}
            </Insight>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Áreas */}
        <Card
          className="lg:col-span-2"
          title="Onde os usuários passam o tempo"
          subtitle="Tempo ativo em cada área (aba visível e alguém mexendo). Ao lado: telas abertas e cliques."
        >
          <BarRows
            empty="Ainda sem tempo de uso medido. Abra o app com uma conta comum para ver aparecer aqui."
            rows={d.areas
              .filter((a) => a.tempoMs > 0 || a.visualizacoes > 0)
              .map((a, i) => ({
                key: a.area,
                label: a.area,
                value: a.tempoMs,
                highlight: i === 0,
                display: `${duration(a.tempoMs)} · ${pctOf(a.tempoMs, totalMs)}%`,
                detail: (
                  <>
                    <p className="font-semibold">{a.area}</p>
                    <p>Tempo: {duration(a.tempoMs)}</p>
                    <p>Telas abertas: {nf.format(a.visualizacoes)}</p>
                    <p>Cliques: {nf.format(a.cliques)}</p>
                    <p>Pessoas: {nf.format(a.pessoas)}</p>
                  </>
                ),
              }))}
          />
        </Card>

        <Card title="Agora no app" subtitle="Cada ação aparece aqui na hora." className="lg:row-span-2">
          <LiveFeed feed={feed} fresh={fresh} now={now} />
        </Card>

        <Card title="Cliques por área" subtitle={`${nf.format(totalClicks)} cliques no período`}>
          <BarRows
            empty="Nenhum clique medido ainda."
            rows={[...d.areas]
              .filter((a) => a.cliques > 0)
              .sort((a, b) => b.cliques - a.cliques)
              .map((a, i) => ({
                key: a.area,
                label: a.area,
                value: a.cliques,
                highlight: i === 0,
                display: `${nf.format(a.cliques)} · ${pctOf(a.cliques, totalClicks)}%`,
              }))}
          />
        </Card>

        <Card title="Botões mais tocados" subtitle="O que as pessoas mais usam em cada tela">
          <BarRows
            empty="Nenhum clique medido ainda."
            rows={d.botoes.slice(0, 8).map((b, i) => ({
              key: `${b.area}-${b.texto}`,
              label: (
                <>
                  {b.texto} <span className="text-xs text-muted-foreground">· {b.area}</span>
                </>
              ),
              value: b.vezes,
              highlight: i === 0,
              display: nf.format(b.vezes),
              detail: `${b.texto} (${b.area}): ${b.vezes} toques, ${b.pessoas} pessoa(s)`,
            }))}
          />
        </Card>
      </div>

      {/* Ao longo do tempo */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Uso dia a dia"
          subtitle={`Últimos ${d.days} dias · ${metricInfo.label.toLowerCase()}`}
          action={
            <select
              className="h-8 rounded-md border bg-card px-2 text-sm"
              value={metric}
              onChange={(e) => setMetric(e.target.value as DailyKey)}
              aria-label="Métrica"
            >
              {DAILY_METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          }
        >
          <DailyColumns data={d.daily.map((x) => ({ key: x.date, label: dayLabel(x.date), value: x[metric] }))} />
        </Card>
        <Card title="Horários de uso" subtitle="Telas, cliques e mudanças salvas por dia da semana e hora (horário de Brasília)">
          <Heatmap cells={heatCells} describe={(v) => `${nf.format(v)} ações`} />
        </Card>
      </div>

      {/* Funil + negócio */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Funil de ativação" subtitle="Até onde cada conta chegou (dados já salvos)">
          <BarRows
            rows={d.funil.map((f, i) => ({
              key: f.etapa,
              label: f.etapa,
              value: f.contas,
              highlight: i === 0,
              display: `${nf.format(f.contas)} · ${pctOf(f.contas, funnelTop)}%`,
              detail: i > 0 ? `${f.contas} de ${d.funil[i - 1]!.contas} da etapa anterior (${pctOf(f.contas, d.funil[i - 1]!.contas)}%)` : undefined,
            }))}
          />
        </Card>

        <Card title="Mudanças salvas por área" subtitle={`Cadastros e edições no período (${nf.format(totalEdits)}), do histórico dos dados`}>
          <BarRows
            empty="Nenhuma mudança salva no período."
            rows={[...d.areas]
              .filter((a) => a.edicoes > 0)
              .sort((a, b) => b.edicoes - a.edicoes)
              .map((a, i) => ({
                key: a.area,
                label: a.area,
                value: a.edicoes,
                highlight: i === 0,
                display: `${nf.format(a.edicoes)} · ${pctOf(a.edicoes, totalEdits)}%`,
              }))}
          />
        </Card>

        <Card title="Perfil dos negócios">
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Tipo de negócio</p>
              <Segmented
                parts={[
                  { label: 'Serviço', value: d.contas.servico },
                  { label: 'Produção', value: d.contas.producao },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Aparelho usado (sessões)</p>
              <Segmented parts={devices.parts} empty="Ainda sem sessões medidas." />
              {devices.pwa > 0 && <p className="mt-1 text-xs text-muted-foreground">{devices.pwa} sessão(ões) pelo app instalado.</p>}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Insumos mais cadastrados</p>
              {d.insumosMaisUsados.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {d.insumosMaisUsados.map((s) => (
                    <li key={s.nome} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                      {titleCase(s.nome)} <span className="text-muted-foreground">· {s.contas}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum insumo cadastrado.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Usabilidade */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Telas com mais tempo" subtitle="Tempo médio por visita mostra onde a pessoa demora">
          <ul className="divide-y text-sm">
            {d.telas.length ? (
              d.telas.slice(0, 7).map((t) => (
                <li key={t.tela} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0">{t.tela}</span>
                  <span className="shrink-0 text-right tabular-nums">
                    {duration(t.tempoMs)}
                    <span className="block text-xs text-muted-foreground">{t.mediaMs ? `${duration(t.mediaMs)}/visita` : '—'}</span>
                  </span>
                </li>
              ))
            ) : (
              <li className="py-2 text-muted-foreground">Ainda sem dados.</li>
            )}
          </ul>
        </Card>
        <Card title="Avisos de erro mais vistos" subtitle={`${nf.format(d.uso.errosFormulario)} no período · onde a pessoa se confunde`}>
          <TopList rows={d.usabilidade.errosFormulario} empty="Nenhum aviso de erro." />
        </Card>
        <Card title="Toques repetidos (frustração)" subtitle="3+ toques seguidos no mesmo lugar: esperava algo que não aconteceu">
          <TopList rows={d.usabilidade.cliquesRepetidos} empty="Nenhum toque repetido. Bom sinal!" />
          {d.usabilidade.errosApp.length > 0 && (
            <>
              <p className="mt-4 mb-1 text-xs font-medium text-muted-foreground">Erros inesperados do app</p>
              <TopList rows={d.usabilidade.errosApp} empty="" />
            </>
          )}
        </Card>
        <Card title="Ações concluídas" subtitle={`${nf.format(d.uso.acoesConcluidas)} confirmações de sucesso`}>
          <TopList rows={d.usabilidade.acoes} empty="Nenhuma ação concluída medida ainda." />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Caminhos mais comuns" subtitle="De qual área a pessoa vai para qual">
          {d.caminhos.length ? (
            <ul className="divide-y text-sm">
              {d.caminhos.map((c) => (
                <li key={`${c.de}-${c.para}`} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0">
                    {c.de} <span className="text-muted-foreground">→</span> {c.para}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{nf.format(c.n)}×</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda sem navegação medida.</p>
          )}
        </Card>
        <Card title="Conta e acesso" subtitle="No período">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Logins', d.uso.logins],
              ['Contas criadas', d.uso.contasCriadas],
              ['Senhas trocadas', d.uso.senhasTrocadas],
              ['Perguntas à IA', d.uso.perguntasAssistente],
              ['Telas abertas', d.uso.visualizacoes],
              ['Cliques', d.uso.cliques],
            ].map(([label, v]) => (
              <div key={label as string} className="rounded-xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{compact(v as number)}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Vendas registradas no app" subtitle="Fecho do dia de todas as contas">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['No período', nf.format(d.vendas.registros ?? 0)],
              ['Faturado no período', brl(d.vendas.receita ?? 0)],
              ['Sobra (lucro) no período', brl(d.vendas.sobra ?? 0)],
              ['Faturado desde o início', brl(d.vendas.receita_total ?? 0)],
            ].map(([label, v]) => (
              <div key={label} className="rounded-xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card title="Contas mais recentes em atividade" subtitle="E-mails parcialmente ocultos para a apresentação">
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium sm:px-5">Pessoa</th>
                <th className="px-2 py-2 font-medium">Negócio</th>
                <th className="px-2 py-2 text-right font-medium">Produtos</th>
                <th className="px-2 py-2 text-right font-medium">Insumos</th>
                <th className="px-2 py-2 text-right font-medium">Vendas</th>
                <th className="px-2 py-2 font-medium">Criada em</th>
                <th className="px-4 py-2 font-medium sm:px-5">Última atividade</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.contasRecentes.map((c) => (
                <tr key={`${c.email}-${c.criadaEm}`}>
                  <td className="px-4 py-2 sm:px-5">
                    <p className="font-medium">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </td>
                  <td className="px-2 py-2">
                    {c.negocio ?? <span className="text-muted-foreground">—</span>}
                    {c.tipo && <p className="text-xs text-muted-foreground">{c.tipo === 'producao' ? 'Produção' : 'Serviço'}</p>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{c.itens}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{c.insumos}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{c.vendas}</td>
                  <td className="px-2 py-2 tabular-nums">{new Date(c.criadaEm).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2 sm:px-5">{ago(c.ultimaAtividade, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

function aggregateDevices(rows: AdminOverview['dispositivos']) {
  const order = ['celular', 'computador', 'tablet']
  const counts = new Map<string, number>()
  let pwa = 0
  for (const r of rows) {
    counts.set(r.device, (counts.get(r.device) ?? 0) + r.n)
    if (r.pwa) pwa += r.n
  }
  return {
    pwa,
    parts: order.map((k) => ({ label: titleCase(k), value: counts.get(k) ?? 0 })),
  }
}

function LiveFeed({ feed, fresh, now }: { feed: LiveEvent[]; fresh: Set<string>; now: number }) {
  if (!feed.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nada ainda. Abra o app em outra aba com uma conta comum e veja as ações chegando aqui.
      </p>
    )
  }
  return (
    <ul className="max-h-[620px] space-y-1 overflow-y-auto pr-1">
      {feed.map((ev) => {
        const d = describe(ev)
        return (
          <li
            key={ev.id}
            className={cn(
              'flex gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
              fresh.has(ev.id) && 'animate-in fade-in slide-in-from-top-1 bg-secondary/70 duration-500',
            )}
          >
            <span
              className={cn(
                'mt-1.5 size-2 shrink-0 rounded-full',
                d.tone === 'bad' ? 'bg-bad' : d.tone === 'ok' ? 'bg-ok' : 'bg-idle',
              )}
            />
            <span className="min-w-0 flex-1">
              <strong className="font-medium">{d.who}</strong> {d.text}
              <span className="block text-xs text-muted-foreground">{ago(ev.at, now)}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
