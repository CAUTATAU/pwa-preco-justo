import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOnline } from '@/hooks/useOnline'
import { api } from '@/lib/api'
import { startSession } from '@/lib/cloudSync'
import { fieldErrors, newPasswordSchema } from '@/lib/schemas'

/** Página aberta pelo link do e-mail: cria a senha nova e já entra na conta. */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const online = useOnline()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = newPasswordSchema.safeParse(form)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    setLoading(true)
    try {
      const session = await api.resetPassword(token, parsed.data.password)
      await startSession(session.token, session.user)
      toast.success('Senha nova salva. Você já está na sua conta.')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a senha.')
    } finally {
      setLoading(false)
    }
  }

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <div className="mx-auto min-h-dvh max-w-md px-6 py-10">
        <PageHeader title="Link inválido" back="/entrar" />
        <p className="mb-4 text-sm text-muted-foreground">
          Este link está incompleto. Abra de novo o link do e-mail ou peça um novo.
        </p>
        <Button asChild className="w-full">
          <Link to="/recuperar-senha">Pedir um novo link</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-6 py-10">
      <PageHeader title="Criar nova senha" back="/entrar" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nova senha" htmlFor="password" error={errors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            aria-invalid={!!errors.password || undefined}
          />
        </Field>
        <Field label="Repita a nova senha" htmlFor="confirm" error={errors.confirm}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
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
