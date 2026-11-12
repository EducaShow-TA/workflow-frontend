import { useApi } from '~/composables/useApi'
import type { AsistenciaDocente } from '~/types/asistenciaDocente'

const RUTA = '/api/v1/docentes/mis-asistencias'

/** Marcaje y consulta del historial del docente autenticado (HU 2.3). */
export function useMiAsistenciaDocente() {
  const { solicitar } = useApi()

  function listar(desde: string, hasta: string): Promise<AsistenciaDocente[]> {
    const parametros = new URLSearchParams({ desde, hasta })
    return solicitar<AsistenciaDocente[]>(`${RUTA}?${parametros.toString()}`)
  }

  function marcarEntrada(): Promise<AsistenciaDocente> {
    return solicitar<AsistenciaDocente>(`${RUTA}/entrada`, { metodo: 'POST' })
  }

  function marcarSalida(): Promise<AsistenciaDocente> {
    return solicitar<AsistenciaDocente>(`${RUTA}/salida`, { metodo: 'POST' })
  }

  return { listar, marcarEntrada, marcarSalida }
}
