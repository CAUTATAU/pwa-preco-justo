import { CalculatorIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { WEEKS_PER_MONTH } from '@/lib/calc'
import { brl, ceilCents, num, parseNumber, toInput } from '@/lib/format'
import { Field, MoneyInput, NumberInput } from './Field'

/**
 * Ajuda a descobrir o valor da hora com perguntas simples (RF20).
 * O valor só é usado quando a pessoa aperta "Usar este valor" (RN06).
 */
export function HourlyRateHelper({
  open,
  onOpenChange,
  weeklyHours,
  onAccept,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  weeklyHours?: number
  onAccept: (rate: number, weeklyHours: number) => void
}) {
  const [income, setIncome] = useState('')
  const [hours, setHours] = useState(toInput(weeklyHours))

  const incomeN = parseNumber(income)
  const hoursN = parseNumber(hours)
  const monthlyHours = hoursN * WEEKS_PER_MONTH
  const rate = incomeN > 0 && hoursN > 0 ? ceilCents(incomeN / monthlyHours) : null

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <CalculatorIcon className="size-5 text-primary" /> Descobrir o valor da minha hora
            </DrawerTitle>
            <DrawerDescription>Responda duas perguntas e o app faz a conta.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4">
            <Field
              label="1. Quanto você quer ganhar por mês pelo seu trabalho?"
              htmlFor="helper-income"
              description="Pense no que você precisa para pagar suas contas pessoais (casa, comida, transporte) e viver bem. Não inclua as contas do negócio."
            >
              <MoneyInput id="helper-income" value={income} onValueChange={setIncome} autoFocus />
            </Field>
            <Field label="2. Quantas horas você trabalha por semana?" htmlFor="helper-hours">
              <NumberInput id="helper-hours" value={hours} onValueChange={setHours} suffix="horas" />
            </Field>

            <div className="rounded-2xl bg-secondary p-4 text-center">
              {rate ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {brl(incomeN)} ÷ {num(monthlyHours)} horas no mês
                  </p>
                  <p className="mt-1 text-3xl font-bold text-primary">{brl(rate)} por hora</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Preencha as respostas para ver o valor da sua hora.</p>
              )}
            </div>
          </div>
          <DrawerFooter>
            <Button
              size="lg"
              disabled={!rate}
              onClick={() => {
                if (rate) onAccept(rate, hoursN)
                onOpenChange(false)
              }}
            >
              Usar este valor
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Agora não
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
