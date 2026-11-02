import { Loader2Icon, RefreshCwIcon, SmartphoneIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { syncNow } from '@/lib/cloudSync'
import { useAuth } from '@/store/auth'
import { useData } from '@/store/data'

/**
 * A conta entrou mas ainda não tem negócio salvo. Quase sempre o negócio está em outro aparelho
 * que ainda não enviou (app sem atualizar ou fora da conta): explica isso antes de oferecer o cadastro do zero.
 * Os dados que chegarem pela sincronização abrem o app sozinhos.
 */
export function AccountEmpty({ error, onStartNew }: { error: string | null; onStartNew: () => void }) {
  const email = useAuth((s) => s.user?.email)
  const [checking, setChecking] = useState(false)

  const check = async () => {
    setChecking(true)
    try {
      await syncNow()
      if (!useData.getState().business) toast.info('Ainda não chegou nada. Confira os passos no outro aparelho.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6 py-10">
      <div className="space-y-2">
        <SmartphoneIcon className="size-8 text-primary" />
        <h1 className="text-xl font-semibold">Seu negócio ainda não está nesta conta</h1>
        <p className="text-sm text-muted-foreground">
          Se você já cadastrou o negócio em outro aparelho (por exemplo, no celular), ele ainda não foi enviado para a
          conta. Para trazer para cá:
        </p>
      </div>
      <ol className="list-decimal space-y-2 rounded-2xl border bg-card p-4 pl-9 text-sm">
        <li>Abra o Preço Justo no aparelho em que você cadastrou.</li>
        <li>
          Se aparecer <strong>Nova versão disponível</strong>, toque em <strong>Atualizar</strong>.
        </li>
        <li>
          Entre na conta <strong>{email}</strong> (com a senha nova, se você trocou).
        </li>
      </ol>
      <p className="text-sm text-muted-foreground">Assim que os dados chegarem, esta tela abre o app sozinha.</p>
      {error && <p className="text-sm text-destructive">Não conseguimos buscar os dados da conta: {error}</p>}
      <div className="grid gap-2">
        <Button size="lg" onClick={check} disabled={checking}>
          {checking ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
          Verificar de novo
        </Button>
        <Button variant="ghost" onClick={onStartNew}>
          Cadastrar um negócio do zero
        </Button>
      </div>
    </div>
  )
}
