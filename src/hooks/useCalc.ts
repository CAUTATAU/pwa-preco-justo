import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { buildTips, terms } from '@/lib/advisor'
import { computeAll } from '@/lib/calc'
import { snapshot, useData } from '@/store/data'

/** Dados + cálculo sempre atualizados: mudou um insumo, todos os itens recalculam (RF17). */
export function useCalc() {
  const data = useData(useShallow(snapshot))
  const calc = useMemo(() => computeAll(data), [data])
  const tips = useMemo(() => buildTips(data, calc), [data, calc])
  const t = terms(data.business?.type)
  return { data, calc, tips, t }
}
