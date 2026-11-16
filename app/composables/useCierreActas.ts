import { useApi } from '~/composables/useApi'
import { formatearFecha } from '~/composables/useFechas'
import type { CierreActas } from '~/types/cierreActas'
import type { PeriodoAcademico } from '~/types/periodoAcademico'

/** "2026-12-18T10:42:31.5" → "18/12/2026 10:42". */
export function formatearMomentoCierre(momento: string | null): string {
  if (!momento) {
    return ''
  }

  return `${formatearFecha(momento.slice(0, 10))} ${momento.slice(11, 16)}`
}

export function nombrePeriodo(periodo: PeriodoAcademico): string {
  return `${periodo.numeroGrado}.° ${periodo.seccion}`
}

export function ordenarPeriodos(periodos: PeriodoAcademico[]): PeriodoAcademico[] {
  return [...periodos].sort(
    (primero, segundo) =>
      primero.numeroGrado - segundo.numeroGrado || primero.seccion.localeCompare(segundo.seccion, 'es'),
  )
}

/** Cierre de actas por periodo (grado y sección de un año). Solo lo usa el administrador. */
export function useCierreActas() {
  const { solicitar } = useApi()

  function consultar(periodoId: number): Promise<CierreActas> {
    return solicitar<CierreActas>(`/api/v1/periodos/${periodoId}/cierre-actas`)
  }

  function cerrar(periodoId: number): Promise<CierreActas> {
    return solicitar<CierreActas>(`/api/v1/periodos/${periodoId}/cierre-actas`, { metodo: 'POST' })
  }

  return { consultar, cerrar }
}
