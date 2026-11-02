import {
  CloudIcon,
  CloudOffIcon,
  DownloadIcon,
  FileUpIcon,
  KeyRoundIcon,
  Loader2Icon,
  LogOutIcon,
  RefreshCwIcon,
  SmartphoneIcon,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog, PageHeader } from '@/components/common'
import { Field, MoneyInput, NumberInput, QuickPicks } from '@/components/Field'
import { GLOSSARY } from '@/components/Hint'
import { HourlyRateHelper } from '@/components/HourlyRateHelper'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useOnline } from '@/hooks/useOnline'
import { api } from '@/lib/api'
import { syncNow } from '@/lib/cloudSync'
import { dateTime, toInput } from '@/lib/format'
import { type AppData, type BusinessType, appDataSchema, businessSchema, fieldErrors, newPasswordSchema } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth'
import { snapshot, useData } from '@/store/data'
import { useSync } from '@/store/sync'

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Ajustes" />
      <BusinessSection />
      <SyncSection />
      <FileSection />
      <AccountSection />
    </div>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mb-4 text-sm text-muted-foreground">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  )
}

function BusinessSection() {
  const [params, setParams] = useSearchParams()
  const business = useData((s) => s.business)
  const setBusiness = useData((s) => s.setBusiness)
  const [name, setName] = useState(business?.name ?? '')
  const [type, setType] = useState<BusinessType>(business?.type ?? 'servico')
  const [weeklyHours, setWeeklyHours] = useState(toInput(business?.weeklyHours))
  const [hourlyRate, setHourlyRate] = useState(toInput(business?.hourlyRate))
  const [margin, setMargin] = useState(toInput(business?.targetMargin))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [helperOpen, setHelperOpen] = useState(params.get('hora') === '1')

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = businessSchema.safeParse({ name, type, weeklyHours, hourlyRate, targetMargin: margin })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    setBusiness(parsed.data)
    toast.success('Dados do negócio salvos. Todos os preços foram recalculados.')
  }

  return (
    <Section title="Seu negócio" description="Mudou alguma coisa? Atualize aqui e todos os preços são recalculados.">
      <form onSubmit={save} className="space-y-4">
        <Field label="Nome do negócio" htmlFor="s-name" error={errors.name}>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Tipo">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['servico', 'Presto serviço'],
                ['producao', 'Produzo e vendo'],
              ] as const
            ).map(([value, label]) => (
              <Button key={value} type="button" variant={type === value ? 'default' : 'outline'} className="h-11" onClick={() => setType(value)}>
                {label}
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Horas de trabalho por semana" htmlFor="s-hours" help={GLOSSARY.jornada} error={errors.weeklyHours}>
          <NumberInput id="s-hours" value={weeklyHours} onValueChange={setWeeklyHours} suffix="horas" />
        </Field>
        <Field label="Valor da sua hora" htmlFor="s-rate" help={GLOSSARY.hora} error={errors.hourlyRate}>
          <MoneyInput id="s-rate" value={hourlyRate} onValueChange={setHourlyRate} suffix="por hora" />
          <Button type="button" variant="link" className="h-auto px-0" onClick={() => setHelperOpen(true)}>
            Não sei. Me ajude a calcular
          </Button>
        </Field>
        <Field label="Sobra desejada" htmlFor="s-margin" help={GLOSSARY.margem} error={errors.targetMargin}>
          <NumberInput id="s-margin" value={margin} onValueChange={setMargin} suffix="% do preço" />
          <QuickPicks options={['10', '20', '30', '40'].map((m) => ({ label: `${m}%`, value: m }))} onPick={setMargin} current={margin} />
        </Field>
        <Button type="submit" className="w-full" size="lg">
          Salvar
        </Button>
      </form>
      <HourlyRateHelper
        key={String(helperOpen)}
        open={helperOpen}
        onOpenChange={(open) => {
          setHelperOpen(open)
          if (!open && params.has('hora')) setParams({}, { replace: true })
        }}
        weeklyHours={business?.weeklyHours}
        onAccept={(rate, hours) => {
          setHourlyRate(toInput(rate))
          setWeeklyHours(toInput(hours))
          toast.info('Valor preenchido. Toque em "Salvar" para confirmar.')
        }}
      />
    </Section>
  )
}

/** Os dados ficam no aparelho e na conta, iguais em todos os aparelhos em que ela entra. */
function SyncSection() {
  const online = useOnline()
  const { lastSyncedAt, status, error } = useSync()
  const expired = useAuth((s) => s.expired)
  const [busy, setBusy] = useState(false)

  const syncNowClick = async () => {
    setBusy(true)
    await syncNow()
    setBusy(false)
    const s = useSync.getState()
    if (s.status === 'error') toast.error(s.error ?? 'Não foi possível sincronizar.')
    else toast.success('Tudo sincronizado!')
  }

  const ok = online && !expired && status !== 'error'
  return (
    <Section
      title="Sincronização"
      description="Seus dados ficam neste aparelho e na sua conta. Entre com o mesmo e-mail no celular ou no computador e encontre tudo igual."
    >
      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
        {ok ? <CloudIcon className="size-5 text-primary" /> : <CloudOffIcon className="size-5 text-muted-foreground" />}
        <div>
          <p className="text-sm font-medium">
            {expired ? 'Sincronização pausada' : !online ? 'Sem internet' : status === 'error' ? 'Falha ao sincronizar' : 'Sincronização ligada'}
          </p>
          <p className="text-xs text-muted-foreground">
            {expired
              ? 'Entre de novo para continuar sincronizando.'
              : !online
                ? 'As mudanças daqui vão para a conta quando a internet voltar.'
                : status === 'syncing'
                  ? 'Sincronizando…'
                  : status === 'error'
                    ? error
                    : lastSyncedAt
                      ? `Última sincronização: ${dateTime(lastSyncedAt)}`
                      : 'Aguardando a primeira sincronização…'}
          </p>
        </div>
      </div>
      <Button variant="outline" className="mt-3 w-full" disabled={busy || !online || expired} onClick={syncNowClick}>
        {busy ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} Sincronizar agora
      </Button>
    </Section>
  )
}

/** Exportar/importar arquivo: backup que funciona sem internet. */
function FileSection() {
  const importAll = useData((s) => s.importAll)
  const dismissed = useData((s) => s.dismissedTips.length)
  const restoreTips = useData((s) => s.restoreTips)
  const businessName = useData((s) => s.business?.name ?? 'preco-justo')
  const { canInstall, install } = useInstallPrompt()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<AppData | null>(null)

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${businessName.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = appDataSchema.safeParse(JSON.parse(await file.text()))
      if (!parsed.success) throw new Error()
      setPending(parsed.data)
    } catch {
      toast.error('Esse arquivo não é um backup válido do Preço Justo.')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Section title="Arquivo e app" description="Salve uma cópia em arquivo no aparelho, sem precisar de internet.">
      <div className="grid gap-2">
        {canInstall && (
          <Button onClick={install}>
            <SmartphoneIcon /> Instalar o app no celular
          </Button>
        )}
        <Button variant="outline" onClick={exportFile}>
          <DownloadIcon /> Salvar cópia em arquivo
        </Button>
        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          <FileUpIcon /> Abrir cópia de arquivo
        </Button>
        <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        {dismissed > 0 && (
          <Button variant="ghost" onClick={() => (restoreTips(), toast.success('As dicas voltaram para o início.'))}>
            Mostrar de novo as {dismissed} dica(s) dispensada(s)
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title="Abrir esta cópia?"
        description="Os dados da sua conta serão substituídos pelos do arquivo, neste e nos outros aparelhos."
        confirmLabel="Substituir"
        onConfirm={() => {
          if (pending) importAll(pending)
          toast.success('Dados carregados do arquivo.')
          setPending(null)
        }}
      />
    </Section>
  )
}

function AccountSection() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const [open, setOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  return (
    <Section title="Conta">
      <div className="mb-3 text-sm">
        <p className="font-medium">{user?.name}</p>
        <p className="text-muted-foreground">{user?.email}</p>
      </div>
      <div className="grid gap-2">
        <Button variant="outline" onClick={() => setPasswordOpen(true)}>
          <KeyRoundIcon /> Trocar senha
        </Button>
        <Button variant="outline" className={cn('w-full')} onClick={() => setOpen(true)}>
          <LogOutIcon /> Sair
        </Button>
      </div>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sair da conta?"
        description="Seus dados continuam guardados na sua conta e voltam quando você entrar de novo, neste ou em outro aparelho."
        confirmLabel="Sair"
        onConfirm={() => {
          logout()
          navigate('/entrar', { replace: true })
        }}
      />
    </Section>
  )
}

/**
 * Troca a senha sem pedir a atual: serve também para quem esqueceu a senha e ainda está
 * conectado neste aparelho (por exemplo, para entrar no computador).
 */
function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const online = useOnline()
  const setSession = useAuth((s) => s.setSession)
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const close = (next: boolean) => {
    if (!next) {
      setForm({ password: '', confirm: '' })
      setErrors({})
    }
    onOpenChange(next)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = newPasswordSchema.safeParse(form)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    setBusy(true)
    try {
      const { token, user } = await api.changePassword(parsed.data.password)
      setSession(token, user)
      toast.success('Senha trocada. Use a nova senha para entrar nos outros aparelhos.')
      close(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível trocar a senha.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trocar senha</DialogTitle>
          <DialogDescription>Crie a nova senha da sua conta. Ela passa a valer em todos os aparelhos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="Nova senha" htmlFor="new-password" error={errors.password}>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              aria-invalid={!!errors.password || undefined}
            />
          </Field>
          <Field label="Repita a nova senha" htmlFor="new-password-confirm" error={errors.confirm}>
            <Input
              id="new-password-confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
              aria-invalid={!!errors.confirm || undefined}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={busy || !online}>
              {busy && <Loader2Icon className="animate-spin" />}
              Salvar nova senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
