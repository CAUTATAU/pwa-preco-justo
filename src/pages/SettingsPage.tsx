import {
  CloudIcon,
  CloudOffIcon,
  DownloadIcon,
  FileUpIcon,
  Loader2Icon,
  LogOutIcon,
  RotateCcwIcon,
  SmartphoneIcon,
  Trash2Icon,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog, PageHeader } from '@/components/common'
import { Field, MoneyInput, NumberInput, QuickPicks } from '@/components/Field'
import { GLOSSARY } from '@/components/Hint'
import { HourlyRateHelper } from '@/components/HourlyRateHelper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useOnline } from '@/hooks/useOnline'
import { api } from '@/lib/api'
import { dateTime, toInput } from '@/lib/format'
import { type AppData, type BusinessType, appDataSchema, businessSchema, fieldErrors } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth'
import { snapshot, useData } from '@/store/data'
import { useSync } from '@/store/sync'

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Ajustes" />
      <BusinessSection />
      <BackupSection />
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

/** Backup opcional, com consentimento explícito (RNF06). */
function BackupSection() {
  const online = useOnline()
  const { enabled, lastSavedAt, status, error, setEnabled, setSaved } = useSync()
  const expired = useAuth((s) => s.expired)
  const replaceAll = useData((s) => s.replaceAll)
  const [consentOpen, setConsentOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Algo deu errado.')
    } finally {
      setBusy(false)
    }
  }

  const saveNow = () =>
    run(async () => {
      const { savedAt } = await api.putBackup(snapshot())
      setSaved(savedAt)
      toast.success('Backup feito!')
    })

  const restore = () =>
    run(async () => {
      const { backup } = await api.getBackup()
      if (!backup) return void toast.info('Ainda não existe backup na nuvem.')
      const parsed = appDataSchema.safeParse(backup.data)
      if (!parsed.success) return void toast.error('O backup está em um formato que este app não reconhece.')
      replaceAll(parsed.data)
      toast.success(`Dados restaurados (backup de ${dateTime(backup.savedAt)}).`)
    })

  const removeCloud = () =>
    run(async () => {
      await api.deleteBackup()
      setEnabled(false)
      toast.success('Cópia da nuvem apagada. Seus dados continuam neste celular.')
    })

  return (
    <Section
      title="Backup na nuvem"
      description="Seus dados ficam só neste celular. Se quiser, guarde uma cópia na nuvem para não perder nada se trocar ou perder o aparelho."
    >
      <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 p-3">
        <div className="flex items-center gap-3">
          {enabled ? <CloudIcon className="size-5 text-primary" /> : <CloudOffIcon className="size-5 text-muted-foreground" />}
          <div>
            <p className="text-sm font-medium">{enabled ? 'Backup automático ligado' : 'Backup desligado'}</p>
            <p className="text-xs text-muted-foreground">
              {!enabled
                ? 'Nada é enviado.'
                : expired
                  ? 'Entre de novo para continuar o backup.'
                  : status === 'saving'
                    ? 'Salvando…'
                    : status === 'error'
                      ? error
                      : lastSavedAt
                        ? `Último backup: ${dateTime(lastSavedAt)}`
                        : online
                          ? 'Aguardando a primeira cópia…'
                          : 'Será feito quando a internet voltar.'}
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(on) => (on ? setConsentOpen(true) : setEnabled(false))}
          aria-label="Backup automático"
        />
      </div>

      <div className="mt-3 grid gap-2">
        {enabled && (
          <Button variant="outline" disabled={busy || !online} onClick={saveNow}>
            {busy ? <Loader2Icon className="animate-spin" /> : <CloudIcon />} Fazer backup agora
          </Button>
        )}
        <Button variant="outline" disabled={busy || !online} onClick={() => setRestoreOpen(true)}>
          <RotateCcwIcon /> Restaurar da nuvem
        </Button>
        <Button variant="ghost" className="text-destructive" disabled={busy || !online} onClick={() => setDeleteOpen(true)}>
          <Trash2Icon /> Apagar cópia da nuvem
        </Button>
      </div>

      <ConfirmDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        title="Guardar uma cópia na nuvem?"
        description="Seus insumos, despesas, preços e o valor da sua hora serão enviados para o servidor do Preço Justo, protegidos pela sua senha. Você pode desligar e apagar a cópia quando quiser."
        confirmLabel="Concordo, ligar backup"
        onConfirm={() => {
          setEnabled(true)
          if (online) void saveNow()
        }}
      />
      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Restaurar da nuvem?"
        description="Os dados deste celular serão substituídos pela cópia da nuvem."
        confirmLabel="Restaurar"
        onConfirm={restore}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Apagar a cópia da nuvem?"
        description="O backup será desligado e a cópia apagada do servidor. Os dados deste celular não mudam."
        confirmLabel="Apagar"
        destructive
        onConfirm={removeCloud}
      />
    </Section>
  )
}

/** Exportar/importar arquivo: backup que funciona sem internet. */
function FileSection() {
  const replaceAll = useData((s) => s.replaceAll)
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
    <Section title="Arquivo e app" description="Salve uma cópia em arquivo no celular, sem precisar de internet.">
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
        description="Os dados deste celular serão substituídos pelos do arquivo."
        confirmLabel="Substituir"
        onConfirm={() => {
          if (pending) replaceAll({ ...pending, updatedAt: new Date().toISOString() })
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

  return (
    <Section title="Conta">
      <div className="mb-3 text-sm">
        <p className="font-medium">{user?.name}</p>
        <p className="text-muted-foreground">{user?.email}</p>
      </div>
      <Button variant="outline" className={cn('w-full')} onClick={() => setOpen(true)}>
        <LogOutIcon /> Sair
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sair da conta?"
        description="Seus dados continuam neste celular e voltam quando você entrar de novo. Atenção: se outra conta entrar neste aparelho, os dados daqui serão substituídos. Faça backup antes."
        confirmLabel="Sair"
        onConfirm={() => {
          logout()
          navigate('/entrar', { replace: true })
        }}
      />
    </Section>
  )
}
