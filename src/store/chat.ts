import { create } from 'zustand'
import { buildTips } from '@/lib/advisor'
import { type Acao, type MensagemHistorico, type Proposta, corta, montarContexto } from '@/lib/agentContext'
import { ApiError, api } from '@/lib/api'
import { computeAll } from '@/lib/calc'
import { uid } from '@/lib/format'
import { useAuth } from './auth'
import { snapshot } from './data'

export type EstadoProposta = 'aceita' | 'recusada'

export type MensagemChat = {
  id: string
  papel: 'usuario' | 'assistente'
  texto: string
  propostas?: (Proposta & { estado?: EstadoProposta })[]
  acoes?: Acao[]
  /** Pergunta sem resposta: o erro aparece embaixo dela, com "Tentar de novo" */
  erro?: string
}

const INDISPONIVEL = 'O assistente está indisponível agora. Tente de novo em alguns minutos.'
/** O agente aceita até 6 mensagens de histórico, cada uma com até 2000 caracteres */
const HISTORICO = 6

type ChatState = {
  mensagens: MensagemChat[]
  enviando: boolean
  enviar: (pergunta: string) => Promise<void>
  reenviar: (id: string) => Promise<void>
  marcar: (msgId: string, i: number, estado: EstadoProposta) => void
  limpar: () => void
}

/** Conversa só na memória: sobrevive à troca de tela e some ao recarregar ou fechar o app. */
export const useChat = create<ChatState>()((set, get) => ({
  mensagens: [],
  enviando: false,

  enviar: async (texto) => {
    const pergunta = corta(texto.trim(), 500)
    if (!pergunta || get().enviando) return
    const historico: MensagemHistorico[] = get()
      .mensagens.filter((m) => !m.erro)
      .slice(-HISTORICO)
      .map((m) => ({ papel: m.papel, texto: corta(m.texto, 2000) }))
    const id = uid()
    set((s) => ({ mensagens: [...s.mensagens, { id, papel: 'usuario', texto: pergunta }], enviando: true }))

    try {
      // montado na hora: a ficha pode ter mudado, inclusive por uma proposta aceita
      const data = snapshot()
      const calc = computeAll(data)
      const r = await api.chat({ contexto: montarContexto(data, calc, buildTips(data, calc)), historico, pergunta })
      if (!get().mensagens.some((m) => m.id === id)) return // conversa limpa (ou outra conta) no meio do caminho
      const resposta: MensagemChat = { id: uid(), papel: 'assistente', texto: r.resposta, propostas: r.propostas, acoes: r.acoes }
      set((s) => ({ mensagens: [...s.mensagens, resposta] }))
    } catch (e) {
      // 403 é chave errada entre servidores: para a pessoa, o assistente está fora
      const erro = e instanceof ApiError && e.status !== 403 ? e.message : INDISPONIVEL
      set((s) => ({ mensagens: s.mensagens.map((m) => (m.id === id ? { ...m, erro } : m)) }))
    } finally {
      set({ enviando: false })
    }
  },

  reenviar: async (id) => {
    const msg = get().mensagens.find((m) => m.id === id)
    if (!msg || get().enviando) return
    set((s) => ({ mensagens: s.mensagens.filter((m) => m.id !== id) }))
    await get().enviar(msg.texto)
  },

  marcar: (msgId, i, estado) =>
    set((s) => ({
      mensagens: s.mensagens.map((m) =>
        m.id === msgId && m.propostas ? { ...m, propostas: m.propostas.map((p, j) => (j === i ? { ...p, estado } : p)) } : m,
      ),
    })),

  limpar: () => set({ mensagens: [] }),
}))

// A conversa de uma pessoa não aparece para outra no mesmo aparelho
useAuth.subscribe((s, antes) => {
  if (s.user?.id !== antes.user?.id) useChat.getState().limpar()
})
