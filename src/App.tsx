import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { useAuth } from '@/store/auth'
import { useData } from '@/store/data'

const AuthPage = lazy(() => import('@/pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const ExpensesPage = lazy(() => import('@/pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })))
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))
const ItemDetailPage = lazy(() => import('@/pages/ItemDetailPage').then((m) => ({ default: m.ItemDetailPage })))
const ItemFormPage = lazy(() => import('@/pages/ItemFormPage').then((m) => ({ default: m.ItemFormPage })))
const ItemsPage = lazy(() => import('@/pages/ItemsPage').then((m) => ({ default: m.ItemsPage })))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const SuppliesPage = lazy(() => import('@/pages/SuppliesPage').then((m) => ({ default: m.SuppliesPage })))

/** Precisa de login (uma vez; depois funciona offline com a sessão salva). */
function RequireAuth() {
  const token = useAuth((s) => s.token)
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

function OnboardingRoute() {
  const business = useData((s) => s.business)
  return business ? <Navigate to="/" replace /> : <OnboardingPage />
}

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <Routes>
        <Route path="/entrar" element={<PublicOnly />} />
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
              <Route path="ajustes" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
