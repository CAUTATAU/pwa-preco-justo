import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '@/components/common'

// Texto para revisão da equipe (e jurídica: envio de dados para fora do país, LGPD art. 33)
export function TermsPage() {
  const location = useLocation()
  return (
    <div className="mx-auto min-h-dvh max-w-md px-6 py-10">
      <PageHeader title="Termos de uso" back={location.key === 'default' ? '/' : true} />
      <div className="space-y-4 text-sm leading-relaxed">
        <Secao titulo="O que o app faz">
          O Preço Justo faz as contas do custo dos seus serviços e produtos com os números que você cadastra. As
          contas rodam no seu celular e são estimativas: confira sempre antes de mudar um preço.
        </Secao>
        <Secao titulo="Onde ficam os seus dados">
          Os números do seu negócio ficam guardados no seu celular. A conta (nome, e-mail e senha) fica no servidor do
          Preço Justo. Uma cópia dos seus dados só vai para o servidor se você ligar o backup em Ajustes.
        </Secao>
        <Secao titulo="Assistente com inteligência artificial">
          <p>Quando você faz uma pergunta ao assistente, o app envia:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>a sua pergunta e as últimas mensagens da conversa;</li>
            <li>
              um resumo da sua ficha: nomes dos itens, insumos e ferramentas, categorias de despesa e os números
              calculados pelo app.
            </li>
          </ul>
          <p className="mt-2">
            Não vão o nome do seu negócio, as descrições das despesas nem o seu e-mail. A resposta é gerada pela AWS
            (Amazon Bedrock), nos Estados Unidos. O servidor do Preço Justo não guarda as perguntas, e a conversa
            some quando você fecha o app.
          </p>
        </Secao>
        <Secao titulo="A IA pode errar">
          Quem faz as contas é sempre o app. O assistente só explica e sugere, e nada muda na sua ficha sem você tocar
          em Aceitar. Há um limite de perguntas por dia.
        </Secao>
        <Secao titulo="Aceite">
          Ao criar a conta, você aceita estes termos. Se não quiser enviar dados para o assistente, é só não usá-lo:
          todo o resto do app funciona sem ele.
        </Secao>
      </div>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-2 font-semibold">{titulo}</h2>
      <div className="text-muted-foreground">{children}</div>
    </section>
  )
}
