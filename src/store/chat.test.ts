import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '@/lib/api'
import { useChat } from './chat'
import { useData } from './data'

vi.mock('@/lib/api', async (original) => ({
  ...(await original<typeof import('@/lib/api')>()),
  api: { chat: vi.fn() },
}))
const chat = vi.mocked(api.chat)
const resposta = (texto: string) => ({ resposta: texto, propostas: [], acoes: [] })

beforeEach(() => {
  chat.mockReset()
  useChat.getState().limpar()
  useData.getState().setBusiness({ name: 'Studio', type: 'servico', hourlyRate: 25, weeklyHours: 40, targetMargin: 30 })
})

describe('useChat.enviar', () => {
  it('manda só as 6 últimas mensagens respondidas como histórico', async () => {
    chat.mockImplementation(async ({ pergunta }) => resposta(`resposta para ${pergunta}`))
    for (const n of [1, 2, 3, 4, 5]) await useChat.getState().enviar(`pergunta ${n}`)

    // antes da 5ª: 4 perguntas + 4 respostas = 8 mensagens; vão só as 6 últimas
    const { historico, pergunta, contexto } = chat.mock.calls.at(-1)![0]
    expect(pergunta).toBe('pergunta 5')
    expect(historico).toHaveLength(6)
    expect(historico[0]).toEqual({ papel: 'usuario', texto: 'pergunta 2' })
    expect(historico.at(-1)).toEqual({ papel: 'assistente', texto: 'resposta para pergunta 4' })
    expect(contexto.tipo).toBe('servico')
  })

  it('pergunta sem resposta mostra o erro do servidor e não entra no histórico', async () => {
    chat.mockRejectedValueOnce(new ApiError(429, 'Você fez muitas perguntas seguidas. Espere um minuto.'))
    await useChat.getState().enviar('primeira')
    expect(useChat.getState().mensagens).toEqual([
      expect.objectContaining({ texto: 'primeira', erro: 'Você fez muitas perguntas seguidas. Espere um minuto.' }),
    ])

    chat.mockResolvedValueOnce(resposta('ok'))
    await useChat.getState().enviar('segunda')
    expect(chat.mock.calls.at(-1)![0].historico).toEqual([])
  })

  it('chave errada no servidor (403) aparece como indisponível, sem detalhes técnicos', async () => {
    chat.mockRejectedValueOnce(new ApiError(403, 'Acesso negado.'))
    await useChat.getState().enviar('oi')
    expect(useChat.getState().mensagens[0].erro).toBe('O assistente está indisponível agora. Tente de novo em alguns minutos.')
  })

  it('resposta que chega depois de limpar a conversa é descartada', async () => {
    chat.mockImplementationOnce(async () => {
      useChat.getState().limpar()
      return resposta('tarde demais')
    })
    await useChat.getState().enviar('oi')
    expect(useChat.getState().mensagens).toEqual([])
    expect(useChat.getState().enviando).toBe(false)
  })

  it('ignora pergunta vazia', async () => {
    await useChat.getState().enviar('   ')
    expect(chat).not.toHaveBeenCalled()
  })
})
