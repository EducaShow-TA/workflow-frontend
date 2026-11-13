import { useApi } from '~/composables/useApi'
import type { EvaluacionParcial, SolicitudEvaluacionParcial } from '~/types/evaluacionParcial'

const RUTA_EVALUACIONES = '/api/v1/evaluaciones-parciales'

export function useEvaluacionesParciales() {
  const { solicitar } = useApi()

  function listar(periodoId: number, competenciaCodigo: string): Promise<EvaluacionParcial[]> {
    const parametros = new URLSearchParams({
      periodoId: String(periodoId),
      competenciaCodigo,
    })
    return solicitar<EvaluacionParcial[]>(`${RUTA_EVALUACIONES}?${parametros.toString()}`)
  }

  function crear(solicitud: SolicitudEvaluacionParcial): Promise<EvaluacionParcial> {
    return solicitar<EvaluacionParcial>(RUTA_EVALUACIONES, {
      metodo: 'POST',
      cuerpo: solicitud,
    })
  }

  function actualizar(id: number, solicitud: SolicitudEvaluacionParcial): Promise<EvaluacionParcial> {
    return solicitar<EvaluacionParcial>(`${RUTA_EVALUACIONES}/${id}`, {
      metodo: 'PUT',
      cuerpo: solicitud,
    })
  }

  return { listar, crear, actualizar }
}
