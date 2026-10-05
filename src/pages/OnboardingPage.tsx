import { ArrowLeftIcon, ArrowRightIcon, CakeSliceIcon, ScissorsIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field, MoneyInput, NumberInput, QuickPicks } from '@/components/Field'
import { GLOSSARY } from '@/components/Hint'
import { HourlyRateHelper } from '@/components/HourlyRateHelper'
import BlurText from '@/components/reactbits/BlurText'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { DEFAULT_TARGET_MARGIN } from '@/lib/calc'
import { brl, parseNumber, toInput } from '@/lib/format'
import { type BusinessType, businessSchema, fieldErrors } from '@/lib/schemas'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth'
import { useData } from '@/store/data'

const TYPES: { value: BusinessType; title: string; text: string; icon: typeof ScissorsIcon }[] = [
  {
    value: 'servico',
    title: 'Presto serviço',
    text: 'Ex.: oficina, design de sobrancelhas, manicure, conserto',
    icon: ScissorsIcon,
  },
  {
    value: 'producao',
    title: 'Produzo e vendo',
    text: 'Ex.: brownies, salgados, artesanato, costura',
    icon: CakeSliceIcon,
  },
]

export function OnboardingPage() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const setBusiness = useData((s) => s.setBusiness)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [type, setType] = useState<BusinessType | null>(null)
  const [weeklyHours, setWeeklyHours] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [margin, setMargin] = useState(String(DEFAULT_TARGET_MARGIN))
  const [helperOpen, setHelperOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const firstName = user?.name.split(' ')[0] ?? ''

  const validateStep = () => {
    const parsed = businessSchema.safeParse({ name, type, weeklyHours, hourlyRate, targetMargin: margin })
    const errs = parsed.success ? {} : fieldErrors(parsed.error)
    const stepFields = [['name', 'type'], ['weeklyHours', 'hourlyRate'], ['targetMargin']][step]
    const stepErrors = Object.fromEntries(Object.entries(errs).filter(([k]) => stepFields.includes(k)))
    setErrors(stepErrors)
    return { ok: Object.keys(stepErrors).length === 0, parsed }
  }

  const next = () => {
    const { ok, parsed } = validateStep()
    if (!ok) return
    if (step < 2) return setStep(step + 1)
    if (parsed.success) {
      setBusiness(parsed.data)
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        {step > 0 ? (
          <Button variant="ghost" size="icon" className="-ml-2" onClick={() => setStep(step - 1)} aria-label="Voltar">
            <ArrowLeftIcon className="size-5" />
          </Button>
        ) : (
          <div className="size-10" />
        )}
        <Progress value={((step + 1) / 3) * 100} className="h-2 flex-1" />
        <span className="w-10 text-right text-xs text-muted-foreground">{step + 1} de 3</span>
      </div>

      <div className="flex-1">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <BlurText
                text={`Olá${firstName ? `, ${firstName}` : ''}! Vamos começar.`}
                className="text-3xl font-bold tracking-tight"
                delay={80}
                animateBy="words"
              />
              <p className="mt-2 text-muted-foreground">Em 1 minuto o app fica pronto para calcular seus preços.</p>
            </div>
            <Field label="Nome do seu negócio" htmlFor="biz-name" error={errors.name}>
              <Input id="biz-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Oficina do Zé" />
            </Field>
            <Field label="O que você faz?" error={errors.type}>
              <div className="grid gap-3">
                {TYPES.map(({ value, title, text, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={cn(
                      'flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all',
                      type === value ? 'border-primary bg-secondary shadow-sm' : 'border-border bg-card',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-12 shrink-0 items-center justify-center rounded-xl',
                        type === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="size-6" />
                    </span>
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="block text-sm text-muted-foreground">{text}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Seu tempo vale dinheiro</h1>
              <p className="mt-2 text-muted-foreground">
                O seu trabalho precisa estar dentro do preço. Sem isso, você trabalha de graça.
              </p>
            </div>
            <Field label="Quantas horas você trabalha por semana?" htmlFor="hours" help={GLOSSARY.jornada} error={errors.weeklyHours}>
              <NumberInput id="hours" value={weeklyHours} onValueChange={setWeeklyHours} suffix="horas" placeholder="44" />
              <QuickPicks
                options={['20', '30', '40', '44', '52'].map((h) => ({ label: `${h}h`, value: h }))}
                onPick={setWeeklyHours}
                current={weeklyHours}
              />
            </Field>
            <Field label="Quanto vale 1 hora do seu trabalho?" htmlFor="rate" help={GLOSSARY.hora} error={errors.hourlyRate}>
              <MoneyInput id="rate" value={hourlyRate} onValueChange={setHourlyRate} suffix="por hora" />
            </Field>
            <Button variant="secondary" className="w-full" onClick={() => setHelperOpen(true)}>
              Não sei. Me ajude a calcular
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Quanto quer que sobre?</h1>
              <p className="mt-2 text-muted-foreground">
                Depois de pagar tudo (material, contas e o seu trabalho), quanto do preço você quer que sobre para o
                negócio crescer?
              </p>
            </div>
            <Field label="Sobra desejada" htmlFor="margin" help={GLOSSARY.margem} error={errors.targetMargin}>
              <NumberInput id="margin" value={margin} onValueChange={setMargin} suffix="% do preço" />
              <QuickPicks
                options={['10', '20', '30', '40'].map((m) => ({ label: `${m}%`, value: m }))}
                onPick={setMargin}
                current={margin}
              />
            </Field>
            <div className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
              Exemplo: num preço de {brl(100)}, uma sobra de {margin || 0}% deixa{' '}
              <strong>{brl((parseNumber(margin) || 0) * 1)}</strong> para o negócio. Se não souber, deixe 30%: dá para mudar
              depois.
            </div>
          </div>
        )}
      </div>

      <Button size="lg" className="mt-8 w-full" onClick={next}>
        {step < 2 ? 'Continuar' : 'Pronto, começar!'} <ArrowRightIcon />
      </Button>

      <HourlyRateHelper
        key={String(helperOpen)}
        open={helperOpen}
        onOpenChange={setHelperOpen}
        weeklyHours={parseNumber(weeklyHours) || undefined}
        onAccept={(rate, hours) => {
          setHourlyRate(toInput(rate))
          setWeeklyHours(toInput(hours))
        }}
      />
    </div>
  )
}
