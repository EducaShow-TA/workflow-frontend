import { useApi } from '~/composables/useApi'
import type { PeriodoAcademico, SolicitudAperturaAnhio } from '~/types/periodoAcademico'

const RUTA_PERIODOS = '/api/v1/periodos'

/** Acceso a los periodos académicos por grado y sección. */
export function usePeriodosAcademicos() {
  const { solicitar } = useApi()

  function listar(): Promise<PeriodoAcademico[]> {
    return solicitar<PeriodoAcademico[]>(RUTA_PERIODOS)
  }

  function listarPorAnhio(anhio: number): Promise<PeriodoAcademico[]> {
    return solicitar<PeriodoAcademico[]>(`${RUTA_PERIODOS}?anhio=${anhio}`)
  }

  function abrirAnhio(solicitud: SolicitudAperturaAnhio): Promise<PeriodoAcademico[]> {
    return solicitar<PeriodoAcademico[]>(`${RUTA_PERIODOS}/anhio`, { metodo: 'POST', cuerpo: solicitud })
  }

  function actualizarAnhio(solicitud: SolicitudAperturaAnhio): Promise<PeriodoAcademico[]> {
    return solicitar<PeriodoAcademico[]>(`${RUTA_PERIODOS}/anhio`, { metodo: 'PUT', cuerpo: solicitud })
  }

  return { listar, listarPorAnhio, abrirAnhio, actualizarAnhio }
}
