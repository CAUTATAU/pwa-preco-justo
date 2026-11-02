import { Loader2Icon, MailCheckIcon, SmartphoneIcon } from 'lucide-react'
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
  const [otherMethod, setOtherMethod] = useState(false)

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
          <Button variant="secondary" className="w-full" onClick={() => setOtherMethod(true)}>
            Não chegou? Tentar outro método
          </Button>
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
          <Button type="button" variant="link" className="w-full" onClick={() => setOtherMethod(true)}>
            Tentar outro método
          </Button>
        </form>
      )}

      {otherMethod && (
        <div className="mt-6 space-y-3 rounded-2xl border bg-card p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <SmartphoneIcon className="size-5 text-primary" />
            Usar um aparelho em que você já entrou
          </div>
          <p className="text-muted-foreground">
            Se a sua conta ainda está aberta em outro aparelho (por exemplo, no celular), dá para criar a senha nova
            por lá, sem e-mail:
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Abra o Preço Justo nesse aparelho.</li>
            <li>
              Vá em <strong>Ajustes</strong> e, em <strong>Conta</strong>, toque em <strong>Trocar senha</strong>.
            </li>
            <li>Crie a senha nova e volte aqui para entrar com ela.</li>
          </ol>
          <Button asChild className="w-full">
            <Link to="/entrar" state={{ email: email.trim() }}>
              Já troquei, quero entrar
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
