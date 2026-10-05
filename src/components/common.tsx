import { ArrowLeftIcon } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import CountUp from '@/components/reactbits/CountUp'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { brl } from '@/lib/format'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string
  subtitle?: ReactNode
  back?: string | true
  action?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="mb-4 flex items-start gap-2">
      {back && (
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 shrink-0"
          aria-label="Voltar"
          onClick={() => (back === true ? navigate(-1) : navigate(back))}
        >
          <ArrowLeftIcon className="size-5" />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-10 text-center">
      <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-secondary text-primary [&_svg]:size-7">
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  destructive,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(destructive && 'bg-destructive text-white hover:bg-destructive/90')}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Valor em reais com animação de contagem (React Bits CountUp). */
export function Money({ value, className }: { value: number; className?: string }) {
  return <CountUp to={value} duration={0.8} formatter={brl} className={cn('tabular-nums', className)} />
}

/** Renderiza **negrito** simples nas frases do consultor. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <Fragment key={i}>{p}</Fragment>))}
    </>
  )
}
