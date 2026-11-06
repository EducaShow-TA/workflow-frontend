import { useApi } from '~/composables/useApi'
import type { SolicitudTarea, Tarea } from '~/types/tarea'

const RUTA_TAREAS = '/api/v1/tareas'

/** US-3.7: creación, consulta y seguimiento real de tareas. */
export function useTareas() {
  const { solicitar } = useApi()

  function listarPorPeriodo(periodoId: number): Promise<Tarea[]> {
    return solicitar<Tarea[]>(`${RUTA_TAREAS}?periodoId=${periodoId}`)
  }

  function registrar(solicitud: SolicitudTarea): Promise<Tarea> {
    return solicitar<Tarea>(RUTA_TAREAS, { metodo: 'POST', cuerpo: solicitud })
  }

  function marcarEntrega(tareaId: number, matriculaId: number, cumplida: boolean): Promise<Tarea> {
    return solicitar<Tarea>(`${RUTA_TAREAS}/${tareaId}/entregas/${matriculaId}`, {
      metodo: 'PATCH',
      cuerpo: { cumplida },
    })
  }

  return { listarPorPeriodo, registrar, marcarEntrega }
}
