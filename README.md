# Preço Justo — PWA

Aplicativo instalável no celular que responde a uma pergunta: **"o preço que eu cobro hoje ainda cobre o meu custo?"**

Feito para microempreendedores (serviço ou produção artesanal): cadastro rápido, linguagem sem jargão e cálculo 100% offline.

**Stack:** React 19 + Vite + TypeScript · shadcn/ui · React Bits (CountUp, BlurText, ShinyText) · Zustand · Zod · vite-plugin-pwa

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173 (repassa /api para o backend em localhost:3333)
```

O backend fica em `../backend-preco-justo` (veja o README de lá). Sem o backend, só o login e o backup ficam indisponíveis.

| Comando           | O que faz                                          |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | Ambiente de desenvolvimento (aceita acesso pela rede) |
| `npm run build`   | Checa tipos e gera `dist/` com o service worker     |
| `npm run preview` | Serve o build (testar instalação/offline)           |
| `npm test`        | Testes do motor de cálculo e do consultor (Vitest)  |
| `npm run icons`   | Regera os ícones PNG a partir de `public/icon.svg`  |

## Como funciona

- **Motor de cálculo** (`src/lib/calc.ts`): determinístico e auditável. Calcula material (pelo preço de compra + rendimento), hora de trabalho, despesas fixas divididas pelas horas da jornada, perdas e o semáforo:
  - 🔴 preço abaixo do custo · 🟡 cobre o custo mas abaixo da sobra desejada · 🟢 cobre custo e sobra.
  - A tela do item mostra "a conta, passo a passo" de cada número (RN07).
- **Consultor** (`src/lib/advisor.ts`): regras offline que apontam custos esquecidos (ferramenta, energia, embalagem, gás, perda, deslocamento), vendas que não cabem na jornada, itens com prejuízo e explicam o resultado em linguagem simples. Nunca altera dados: toda sugestão passa por um botão de confirmação.
- **Dados no aparelho** (`src/store/data.ts`): tudo fica no `localStorage` do celular (RNF06). O backup na nuvem é opcional e só liga com consentimento explícito em **Ajustes**. Também dá para exportar/importar um arquivo `.json`.
- **PWA**: o service worker guarda o app para uso sem internet; a API nunca é cacheada.

## Deploy na Vercel (front) + backend local pelo ngrok

1. Importe o repositório na Vercel (framework Vite é detectado; `vercel.json` já cuida das rotas do SPA).
2. Em **Settings → Environment Variables**, crie `VITE_API_URL=https://<seu-dominio>.ngrok-free.dev/api` e faça o deploy (a variável entra no build).
3. Na máquina com o backend: `docker compose up -d` e `npm run tunnel` (pasta `backend-preco-justo`).
   O CORS do backend já aceita `https://*.vercel.app`.

## Homologação com ngrok (front + API numa URL só) — recomendado

Pré-requisitos: ngrok instalado com `ngrok config add-authtoken <token>` e o backend rodando (`docker compose up -d` em `backend-preco-justo`).

1. Crie `.env.local` com `NGROK_DOMAIN=<seu-dominio>.ngrok-free.dev` (sem `VITE_API_URL`).
2. Rode:

```bash
npm run homolog
```

O script gera o build, sobe o `vite preview` (que repassa `/api` para `localhost:3333`) e abre o túnel ngrok. A URL aparece no terminal. É HTTPS, então dá para instalar o app no celular e usar offline.

O plano gratuito do ngrok tem um domínio estático e um túnel por vez: não rode o `npm run tunnel` do backend ao mesmo tempo. Na primeira visita, o ngrok mostra uma página de aviso; basta tocar em **Visit Site**.

## Mapa dos requisitos

| Requisito | Onde |
| --- | --- |
| RF01–RF03 tipo de conta, hora, jornada | `pages/OnboardingPage.tsx`, `pages/SettingsPage.tsx` |
| RF04 / RN02 insumo por preço + rendimento | `components/SupplyFormDrawer.tsx` |
| RF05 despesas por categoria ou valor único | `pages/ExpensesPage.tsx` |
| RF06–RF08 itens, composição e variantes | `pages/ItemFormPage.tsx` (`?variante=<id>`) |
| RF09 ferramentas | `pages/ExpensesPage.tsx` (aba Ferramentas) |
| RF10 perdas | `pages/ItemFormPage.tsx` (produção) |
| RF11–RF17 cálculo, semáforo, preço mínimo/ideal, composição | `lib/calc.ts`, `pages/ItemDetailPage.tsx` |
| RF19, RF21, RF22 consultor | `lib/advisor.ts`, `components/TipCard.tsx` |
| RF20 ajuda para a hora | `components/HourlyRateHelper.tsx` |
| RNF01/02 offline | `vite.config.ts` (PWA), aviso em `components/AppShell.tsx` |
| RNF04 explicações no ponto de uso | `components/Hint.tsx` |
| RNF06 dados no aparelho + consentimento | `store/data.ts`, `pages/SettingsPage.tsx` |

**Fora desta versão:** conta de revenda (requisitos ainda em levantamento), perguntas em linguagem natural com IA (RF23; o consultor atual é por regras, sem custo) e "fecho do dia".
