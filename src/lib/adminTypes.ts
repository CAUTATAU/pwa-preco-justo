/** Resposta de GET /api/admin/overview (backend: src/modules/admin/admin.service.ts). */

export type LiveEvent = {
  id: string
  type: string
  area: string
  path: string
  target: string | null
  userName: string | null
  at: string
}

type Top = { texto: string; area: string; vezes: number; pessoas: number }

export type AdminOverview = {
  generatedAt: string
  days: number
  timezone: string
  tracking: { desde: string | null; eventos: number }
  online: { sessoes: number; pessoas: number }
  contas: {
    total: number
    novas: number
    ativas24h: number
    ativas7d: number
    ativasPeriodo: number
    comNegocio: number
    producao: number
    servico: number
  }
  cadastros: { itens: number; insumos: number; despesas: number; vendas: number }
  funil: { etapa: string; contas: number }[]
  vendas: {
    registros_total?: number
    receita_total?: number
    registros?: number
    unidades?: number
    receita?: number
    sobra?: number
  }
  uso: {
    sessoes: number
    duracaoMediaMs: number
    paginasPorSessao: number
    rejeicao: number
    visualizacoes: number
    cliques: number
    logins: number
    contasCriadas: number
    senhasTrocadas: number
    perguntasAssistente: number
    cliquesRepetidos: number
    errosFormulario: number
    errosApp: number
    acoesConcluidas: number
  }
  daily: {
    date: string
    cadastros: number
    edicoes: number
    visualizacoes: number
    cliques: number
    sessoes: number
    pessoas: number
    vendas: number
    receita: number
  }[]
  areas: { area: string; visualizacoes: number; cliques: number; tempoMs: number; pessoas: number; edicoes: number }[]
  telas: { tela: string; area: string; visualizacoes: number; tempoMs: number; mediaMs: number }[]
  botoes: Top[]
  usabilidade: { cliquesRepetidos: Top[]; errosFormulario: Top[]; errosApp: Top[]; acoes: Top[] }
  caminhos: { de: string; para: string; n: number }[]
  heatmap: { dow: number; h: number; eventos: number; edicoes: number }[]
  dispositivos: { device: string; pwa: boolean; n: number }[]
  insumosMaisUsados: { nome: string; contas: number; n: number }[]
  contasRecentes: {
    nome: string
    email: string
    criadaEm: string
    ultimaAtividade: string | null
    negocio: string | null
    tipo: string | null
    itens: number
    insumos: number
    vendas: number
  }[]
  feed: LiveEvent[]
}
