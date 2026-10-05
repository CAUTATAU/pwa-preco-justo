import { Loader2Icon, WifiOffIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field } from '@/components/Field'
import ShinyText from '@/components/reactbits/ShinyText'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOnline } from '@/hooks/useOnline'
import { api } from '@/lib/api'
import { appDataSchema, fieldErrors } from '@/lib/schemas'
import { useAuth } from '@/store/auth'
import { useData } from '@/store/data'
import { useSync } from '@/store/sync'

const loginSchema = z.object({
  email: z.email('Digite um e-mail válido.'),
  password: z.string().min(1, 'Digite sua senha.'),
})
const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, 'Digite seu nome.'),
  password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.'),
})

export function AuthPage() {
  const navigate = useNavigate()
  const online = useOnline()
  const setSession = useAuth((s) => s.setSession)
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const schema = mode === 'entrar' ? loginSchema : registerSchema
    const parsed = schema.safeParse({ ...form, email: form.email.trim().toLowerCase() })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    setLoading(true)
    try {
      const { token, user } =
        mode === 'entrar'
          ? await api.login(parsed.data.email, parsed.data.password)
          : await api.register(form.name.trim(), parsed.data.email, parsed.data.password)
      setSession(token, user)

      // Outro dono neste aparelho (ou aparelho novo): começa do zero e tenta restaurar o backup
      const data = useData.getState()
      if (data.ownerId !== user.id) {
        data.resetFor(user.id)
        useSync.getState().setEnabled(false)
        if (mode === 'entrar') {
          const { backup } = await api.getBackup().catch(() => ({ backup: null }))
          const restored = backup ? appDataSchema.safeParse(backup.data) : null
          if (restored?.success) {
            useData.getState().replaceAll(restored.data)
            useSync.getState().setEnabled(true)
            toast.success('Encontramos seu backup e seus dados foram restaurados.')
          }
        }
      }
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <img src="/icon.svg" alt="" className="mx-auto mb-4 size-16 rounded-2xl shadow-lg" />
        <h1 className="text-3xl font-extrabold tracking-tight">
          <ShinyText text="Preço Justo" color="oklch(0.45 0.12 158)" shineColor="oklch(0.85 0.12 158)" speed={3} />
        </h1>
        <p className="mt-2 text-muted-foreground">O preço que você cobra cobre o seu custo?</p>
      </div>

      {!online && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          <WifiOffIcon className="size-4 shrink-0" />
          Para entrar pela primeira vez é preciso internet. Depois, o app funciona offline.
        </div>
      )}

      <Tabs value={mode} onValueChange={(v) => (setMode(v as typeof mode), setErrors({}))} className="mb-6">
        <TabsList className="grid h-11 w-full grid-cols-2">
          <TabsTrigger value="entrar">Entrar</TabsTrigger>
          <TabsTrigger value="criar">Criar conta</TabsTrigger>
        </TabsList>
      </Tabs>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === 'criar' && (
          <Field label="Seu nome" htmlFor="name" error={errors.name}>
            <Input id="name" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name || undefined} />
          </Field>
        )}
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            aria-invalid={!!errors.email || undefined}
          />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password}>
          <Input
            id="password"
            type="password"
            autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
            value={form.password}
            onChange={set('password')}
            aria-invalid={!!errors.password || undefined}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={loading || !online}>
          {loading && <Loader2Icon className="animate-spin" />}
          {mode === 'entrar' ? 'Entrar' : 'Criar minha conta'}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Seus números de custo e faturamento ficam guardados no seu celular. Só vão para a nuvem se você ligar o backup.
      </p>
    </div>
  )
}
