import { Loader2Icon } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { useCloudSync } from '@/hooks/useCloudSync'
import { useOnline } from '@/hooks/useOnline'
import { useAuth } from '@/store/auth'
import { useData } from '@/store/data'
import { useSync } from '@/store/sync'

const AssistantPage = lazy(() => import('@/pages/AssistantPage').then((m) => ({ default: m.AssistantPage })))
const AuthPage = lazy(() => import('@/pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const ForgotPasswordPage = lazy(() =>
  import('@/pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
)
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))
const ExpensesPage = lazy(() => import('@/pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })))
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))
const ItemDetailPage = lazy(() => import('@/pages/ItemDetailPage').then((m) => ({ default: m.ItemDetailPage })))
const ItemFormPage = lazy(() => import('@/pages/ItemFormPage').then((m) => ({ default: m.ItemFormPage })))
const ItemsPage = lazy(() => import('@/pages/ItemsPage').then((m) => ({ default: m.ItemsPage })))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const SalesPage = lazy(() => import('@/pages/SalesPage').then((m) => ({ default: m.SalesPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const SuppliesPage = lazy(() => import('@/pages/SuppliesPage').then((m) => ({ default: m.SuppliesPage })))
const TermsPage = lazy(() => import('@/pages/TermsPage').then((m) => ({ default: m.TermsPage })))

/** Precisa de login (uma vez; depois funciona offline com a sessão salva). */
function RequireAuth() {
  const token = useAuth((s) => s.token)
  useCloudSync()
  return token ? <Outlet /> : <Navigate to="/entrar" replace />
}

/** Precisa ter o negócio cadastrado. */
function RequireBusiness() {
  const business = useData((s) => s.business)
  return business ? <Outlet /> : <Navigate to="/bem-vindo" replace />
}

function PublicOnly() {
  const token = useAuth((s) => s.token)
  const expired = useAuth((s) => s.expired)
  const [params] = useSearchParams()
  return token && !expired && !params.has('reentrar') ? <Navigate to="/" replace /> : <AuthPage />
}

/** Quanto tempo espera os dados da conta antes de oferecer o cadastro do zero */
const FIRST_SYNC_WAIT_MS = 10_000

function OnboardingRoute() {
  const business = useData((s) => s.business)
  const online = useOnline()
  const expired = useAuth((s) => s.expired)
  const neverSynced = useSync((s) => s.revision === null && s.status !== 'error')
  const syncing = useSync((s) => s.status === 'syncing')
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), FIRST_SYNC_WAIT_MS)
    return () => clearTimeout(timer)
  }, [])

  if (business) return <Navigate to="/" replace />
  // A conta pode já ter um negócio cadastrado em outro aparelho: espera chegar antes de pedir o cadastro
  if (online && !expired && !gaveUp && (syncing || neverSynced)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2Icon className="size-6 animate-spin" />
        <p className="text-sm">Buscando os dados da sua conta…</p>
      </div>
    )
  }
  return <OnboardingPage />
}

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Routes>
        <Route path="/entrar" element={<PublicOnly />} />
        <Route path="/termos" element={<TermsPage />} />
        <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/bem-vindo" element={<OnboardingRoute />} />
          <Route element={<RequireBusiness />}>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="itens" element={<ItemsPage />} />
              <Route path="itens/novo" element={<ItemFormPage />} />
              <Route path="itens/:id" element={<ItemDetailPage />} />
              <Route path="itens/:id/editar" element={<ItemFormPage />} />
              <Route path="insumos" element={<SuppliesPage />} />
              <Route path="despesas" element={<ExpensesPage />} />
              <Route path="vendas" element={<SalesPage />} />
              <Route path="ajustes" element={<SettingsPage />} />
              <Route path="assistente" element={<AssistantPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
