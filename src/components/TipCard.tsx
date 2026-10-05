import { LightbulbIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { Tip } from '@/lib/advisor'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'

export function TipCard({ tip }: { tip: Tip }) {
  const dismissTip = useData((s) => s.dismissTip)
  const alert = tip.level === 'alerta'
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        alert ? 'border-bad/25 bg-bad/6' : 'border-primary/20 bg-secondary/60',
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
            alert ? 'bg-bad/15 text-bad' : 'bg-primary/15 text-primary',
          )}
        >
          {alert ? <TriangleAlertIcon className="size-4" /> : <LightbulbIcon className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{tip.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tip.text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tip.action && (
              <Button asChild size="sm" variant={alert ? 'default' : 'secondary'}>
                <Link to={tip.action.to}>{tip.action.label}</Link>
              </Button>
            )}
            {tip.dismissible && (
              <Button size="sm" variant="ghost" onClick={() => dismissTip(tip.id)}>
                <XIcon /> Não tenho esse custo
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
