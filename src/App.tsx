import { Loader2Icon } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { AccountEmpty } from '@/components/AccountEmpty'
import { AppShell } from '@/components/AppShell'
import { useCloudSync } from '@/hooks/useCloudSync'
import { useOnline } from '@/hooks/useOnline'
import { trackPage } from '@/lib/analytics'
import { isAdmin, useAuth } from '@/store/auth'
import { useData } from '@/store/data'
import { useSync } from '@/store/sync'

const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })))
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
  const admin = useAuth((s) => isAdmin(s.user))
  useCloudSync()
  if (!token) return <Navigate to="/entrar" replace />
  // A conta de administrador não tem negócio: só o painel
  if (admin) return <Navigate to="/admin" replace />
  return <Outlet />
}

/** Painel de uso: só a conta de administrador (o servidor confere de novo a cada pedido). */
function RequireAdmin() {
  const token = useAuth((s) => s.token)
  const admin = useAuth((s) => isAdmin(s.user))
  if (!token) return <Navigate to="/entrar" replace />
  return admin ? <Outlet /> : <Navigate to="/" replace />
}

/** Conta cada troca de tela para o painel de uso. */
function PageTracker() {
  const { pathname } = useLocation()
  useEffect(() => trackPage(pathname), [pathname])
  return null
}

/** Precisa ter o negócio cadastrado. */
function RequireBusiness() {
  const business = useData((s) => s.business)
  return business ? <Outlet /> : <Navigate to="/bem-vindo" replace />
}

function PublicOnly() {
  const token = useAuth((s) => s.token)
  const expired = useAuth((s) => s.expired)
  const admin = useAuth((s) => isAdmin(s.user))
  const [params] = useSearchParams()
  return token && !expired && !params.has('reentrar') ? <Navigate to={admin ? '/admin' : '/'} replace /> : <AuthPage />
}

/** Quanto tempo espera os dados da conta antes de oferecer o cadastro do zero */
const FIRST_SYNC_WAIT_MS = 10_000
/** Conta criada há menos que isso vai direto para o cadastro: ainda não deu tempo de ter negócio em outro aparelho */
const NEW_ACCOUNT_MS = 10 * 60_000

function OnboardingRoute() {
  const business = useData((s) => s.business)
  const online = useOnline()
  const expired = useAuth((s) => s.expired)
  const createdAt = useAuth((s) => s.user?.createdAt)
  const neverSynced = useSync((s) => s.revision === null && s.status !== 'error')
  const syncing = useSync((s) => s.status === 'syncing')
  const syncError = useSync((s) => (s.status === 'error' ? s.error : null))
  const [gaveUp, setGaveUp] = useState(false)
  const [startNew, setStartNew] = useState(false)
  const [openedAt] = useState(Date.now)

  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), FIRST_SYNC_WAIT_MS)
    return () => clearTimeout(timer)
  }, [])

  if (business) return <Navigate to="/" replace />
  if (startNew || !online || expired) return <OnboardingPage />
  // A conta pode já ter um negócio cadastrado em outro aparelho: espera chegar antes de pedir o cadastro
  if (!gaveUp && (syncing || neverSynced)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2Icon className="size-6 animate-spin" />
        <p className="text-sm">Buscando os dados da sua conta…</p>
      </div>
    )
  }
  const newAccount = !createdAt || openedAt - Date.parse(createdAt) < NEW_ACCOUNT_MS
  if (newAccount && !syncError) return <OnboardingPage />
  return <AccountEmpty error={syncError} onStartNew={() => setStartNew(true)} />
}

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <PageTracker />
      <Routes>
        <Route path="/entrar" element={<PublicOnly />} />
        <Route path="/termos" element={<TermsPage />} />
        <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
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
