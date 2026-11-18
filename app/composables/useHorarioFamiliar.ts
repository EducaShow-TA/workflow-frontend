import { useApi } from '~/composables/useApi'
import type { HorarioFamiliar } from '~/types/horarioFamiliar'

/** US-4.7: consulta el horario exclusivamente de alumnos autorizados por el backend. */
export function useHorarioFamiliar() {
  const { solicitar } = useApi()

  function listar(anio: number): Promise<HorarioFamiliar[]> {
    if (!Number.isSafeInteger(anio) || anio < 2000 || anio > 2100) {
      return Promise.reject(new Error('El año escolar no es válido.'))
    }
    return solicitar<HorarioFamiliar[]>(`/api/v1/horarios/mi-seccion?anio=${anio}`)
  }

  return { listar }
}
