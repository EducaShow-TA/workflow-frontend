import { useApi } from '~/composables/useApi'
import type { MatriculaApi } from '~/types/matricula'

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

  function confirmar(periodoId: number, estudianteId: number): Promise<MatriculaApi> {
    return solicitar<MatriculaApi>(`${RUTA_PERIODOS}/${periodoId}/matriculas/${estudianteId}/confirmar`, {
      metodo: 'PATCH',
    })
  }

  return { registrar, confirmar }
}
