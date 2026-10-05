import type { ComponentProps, ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Hint } from './Hint'

type FieldProps = {
  label: string
  htmlFor?: string
  help?: { title: string; text: string }
  description?: ReactNode
  error?: string
  className?: string
  children: ReactNode
}

export function Field({ label, htmlFor, help, description, error, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {help && <Hint title={help.title}>{help.text}</Hint>}
      </div>
      {children}
      {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  )
}

type AffixInputProps = Omit<ComponentProps<typeof Input>, 'onChange' | 'value'> & {
  value: string
  onValueChange: (value: string) => void
  prefix?: string
  suffix?: string
  invalid?: boolean
}

/** Campo numérico que aceita vírgula ("12,50") e abre o teclado numérico no celular. */
export function NumberInput({ value, onValueChange, prefix, suffix, invalid, className, ...props }: AffixInputProps) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onValueChange(e.target.value.replace(/[^\d.,]/g, ''))}
        aria-invalid={invalid || undefined}
        className={cn(prefix && 'pl-10', suffix && 'pr-24', className)}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function MoneyInput(props: Omit<AffixInputProps, 'prefix'>) {
  return <NumberInput prefix="R$" placeholder="0,00" {...props} />
}

/** Atalhos de valores comuns (ex.: 15 min, 30 min, 1h). */
export function QuickPicks({
  options,
  onPick,
  current,
}: {
  options: { label: string; value: string }[]
  onPick: (value: string) => void
  current?: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onPick(o.value)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            current === o.value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-primary/50',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
