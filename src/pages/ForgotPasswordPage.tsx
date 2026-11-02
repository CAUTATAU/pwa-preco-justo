import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { PageHeader } from '@/components/common'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOnline } from '@/hooks/useOnline'
import { api } from '@/lib/api'
import { startSession } from '@/lib/cloudSync'
import { fieldErrors, newPasswordSchema } from '@/lib/schemas'

const forgotSchema = z.object({ email: z.email('Digite um e-mail válido.') }).and(newPasswordSchema)

/**
 * Cria uma senha nova direto pelo e-mail da conta e já entra.
 * Sem confirmação por e-mail: o app não tem domínio próprio para enviar mensagens.
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const online = useOnline()
  const [form, setForm] = useState({
    email: (location.state as { email?: string } | null)?.email ?? '',
    password: '',
    confirm: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = forgotSchema.safeParse({ ...form, email: form.email.trim().toLowerCase() })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    setLoading(true)
    try {
      const session = await api.resetPasswordDirect(parsed.data.email, parsed.data.password)
      await startSession(session.token, session.user)
      toast.success('Senha nova salva. Você já está na sua conta.')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível trocar a senha agora.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-6 py-10">
      <PageHeader title="Esqueci minha senha" back="/entrar" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-muted-foreground">
          Digite o e-mail da sua conta e crie uma senha nova. Você entra na hora, com todos os seus dados.
        </p>
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
        <Field label="Nova senha" htmlFor="password" error={errors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            aria-invalid={!!errors.password || undefined}
          />
        </Field>
        <Field label="Repita a nova senha" htmlFor="confirm" error={errors.confirm}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set('confirm')}
            aria-invalid={!!errors.confirm || undefined}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={loading || !online}>
          {loading && <Loader2Icon className="animate-spin" />}
          Salvar senha e entrar
        </Button>
      </form>
    </div>
  )
}
