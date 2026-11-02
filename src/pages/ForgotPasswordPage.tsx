import { Loader2Icon, MailCheckIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { PageHeader } from '@/components/common'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOnline } from '@/hooks/useOnline'
import { api } from '@/lib/api'

const emailSchema = z.email('Digite um e-mail válido.')

/** Pede o link para criar uma senha nova. */
export function ForgotPasswordPage() {
  const location = useLocation()
  const online = useOnline()
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = emailSchema.safeParse(email.trim().toLowerCase())
    if (!parsed.success) return setError(parsed.error.issues[0]?.message)
    setError(undefined)
    setLoading(true)
    try {
      await api.forgotPassword(parsed.data)
      setSentTo(parsed.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar agora.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-6 py-10">
      <PageHeader title="Esqueci minha senha" back="/entrar" />

      {sentTo ? (
        <div className="space-y-4 text-center">
          <MailCheckIcon className="mx-auto size-12 text-primary" />
          <p>
            Se existir uma conta com <strong>{sentTo}</strong>, enviamos um link para criar uma nova senha.
          </p>
          <p className="text-sm text-muted-foreground">
            O link vale por 1 hora. Não chegou? Olhe a caixa de spam ou peça de novo daqui a 2 minutos.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/entrar">Voltar para entrar</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <p className="text-sm text-muted-foreground">
            Digite o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova.
          </p>
          <Field label="E-mail" htmlFor="email" error={error}>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error || undefined}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={loading || !online}>
            {loading && <Loader2Icon className="animate-spin" />}
            Enviar link
          </Button>
        </form>
      )}
    </div>
  )
}
