import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import App from './App'
import './index.css'

// Service worker: guarda o app no celular para funcionar sem internet (RNF01)
const updateSW = registerSW({
  onNeedRefresh() {
    toast('Nova versão do app disponível.', {
      duration: Infinity,
      action: { label: 'Atualizar', onClick: () => void updateSW(true) },
    })
  },
  onOfflineReady() {
    toast.success('Pronto! O app já funciona sem internet.')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster theme="light" position="top-center" richColors closeButton />
    </BrowserRouter>
  </StrictMode>,
)
