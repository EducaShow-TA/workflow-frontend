import { useApi } from '~/composables/useApi'
import type { MatriculaApi } from '~/types/matricula'
import type { SolicitudCompromisoPago } from '~/types/compromisoPago'

const RUTA_PERIODOS = '/api/v1/periodos'

/** Acceso al registro y confirmación de matrículas. */
export function useMatriculas() {
  const { solicitar } = useApi()

  function registrar(periodoId: number, estudianteId: number): Promise<MatriculaApi> {
    return solicitar<MatriculaApi>(`${RUTA_PERIODOS}/${periodoId}/matriculas`, {
      metodo: 'POST',
      cuerpo: { estudianteId },
    })
  }

  function registrarMasivamente(periodoId: number, estudianteIds: number[]): Promise<MatriculaApi[]> {
    return solicitar<MatriculaApi[]>(`${RUTA_PERIODOS}/${periodoId}/matriculas/masivo`, {
      metodo: 'POST',
      cuerpo: { estudianteIds },
    })
  }

  function retirar(periodoId: number, estudianteId: number): Promise<void> {
    return solicitar<void>(`${RUTA_PERIODOS}/${periodoId}/matriculas/${estudianteId}`, {
      metodo: 'DELETE',
    })
  }

  /** Al confirmar, el back crea el compromiso de pago con estos términos y la primera boleta (US-1.3). */
  function confirmar(
    periodoId: number,
    estudianteId: number,
    compromiso: SolicitudCompromisoPago,
  ): Promise<MatriculaApi> {
    return solicitar<MatriculaApi>(`${RUTA_PERIODOS}/${periodoId}/matriculas/${estudianteId}/confirmar`, {
      metodo: 'PATCH',
      cuerpo: compromiso,
    })
  }

  function confirmarMasivamente(
    periodoId: number,
    estudianteIds: number[],
    compromiso: SolicitudCompromisoPago,
  ): Promise<MatriculaApi[]> {
    return solicitar<MatriculaApi[]>(`${RUTA_PERIODOS}/${periodoId}/matriculas/confirmar-masivo`, {
      metodo: 'PATCH',
      cuerpo: { estudianteIds, compromiso },
    })
  }

  return { registrar, registrarMasivamente, retirar, confirmar, confirmarMasivamente }
}
