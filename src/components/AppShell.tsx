import { BoxesIcon, HomeIcon, ReceiptTextIcon, SettingsIcon, TagsIcon, WifiOffIcon } from 'lucide-react'
import { Suspense } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useCloudSync } from '@/hooks/useCloudSync'
import { useOnline } from '@/hooks/useOnline'
import { terms } from '@/lib/advisor'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth'
import { useData } from '@/store/data'

export function AppShell() {
  useCloudSync()
  const online = useOnline()
  const expired = useAuth((s) => s.expired)
  const type = useData((s) => s.business?.type)
  const t = terms(type)

  const nav = [
    { to: '/', label: 'Início', icon: HomeIcon, end: true },
    { to: '/itens', label: t.Items, icon: TagsIcon },
    { to: '/insumos', label: 'Insumos', icon: BoxesIcon },
    { to: '/despesas', label: 'Despesas', icon: ReceiptTextIcon },
    { to: '/ajustes', label: 'Ajustes', icon: SettingsIcon },
  ]

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {!online && (
        <div className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-foreground px-4 py-1.5 text-xs font-medium text-background">
          <WifiOffIcon className="size-3.5" />
          Sem internet: os cálculos continuam funcionando normalmente.
        </div>
      )}
      {online && expired && (
        <Link
          to="/entrar?reentrar=1"
          className="sticky top-0 z-30 block bg-warn px-4 py-1.5 text-center text-xs font-medium text-black"
        >
          Sua sessão expirou. Toque aqui para entrar de novo e manter o backup em dia.
        </Link>
      )}

      <main className="flex-1 px-4 pt-5 pb-28">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                        isActive && 'bg-secondary',
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
