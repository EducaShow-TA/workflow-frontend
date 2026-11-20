import { useApi } from '~/composables/useApi'
import type {
  EvaluacionParcial,
  NotaEvaluacionParcial,
  SolicitudEvaluacionParcial,
  SolicitudNotaParcial,
} from '~/types/evaluacionParcial'

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

  function listarNotas(evaluacionId: number): Promise<NotaEvaluacionParcial[]> {
    return solicitar<NotaEvaluacionParcial[]>(`${RUTA_EVALUACIONES}/${evaluacionId}/calificaciones`)
  }

  function registrarNota(
    evaluacionId: number,
    matriculaId: number,
    solicitud: SolicitudNotaParcial,
    archivo: File | null,
  ): Promise<NotaEvaluacionParcial> {
    const ruta = `${RUTA_EVALUACIONES}/${evaluacionId}/matriculas/${matriculaId}`
    if (!archivo) return solicitar<NotaEvaluacionParcial>(ruta, { metodo: 'PUT', cuerpo: solicitud })
    const cuerpo = new FormData()
    cuerpo.append('datos', new Blob([JSON.stringify(solicitud)], { type: 'application/json' }))
    cuerpo.append('archivo', archivo)
    return solicitar<NotaEvaluacionParcial>(ruta, { metodo: 'PUT', cuerpo })
  }

  return { listar, crear, actualizar, listarNotas, registrarNota }
}
