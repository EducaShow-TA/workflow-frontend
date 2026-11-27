import { ErrorSolicitudApi } from '~/types/api'
import { useApi } from '~/composables/useApi'

export interface ErrorFilaAsistenciaSesion {
  fila: number
  campo: string
  mensaje: string
}

export interface ResultadoCargaAsistenciaSesion {
  guardado: boolean
  soloValidacion: boolean
  totalFilas: number
  filasValidas: number
  filasRechazadas: number
  registrosNuevos: number
  registrosActualizados: number
  errores: ErrorFilaAsistenciaSesion[]
}

function esResultadoCarga(datos: unknown): datos is ResultadoCargaAsistenciaSesion {
  if (!datos || typeof datos !== 'object') return false
  const resultado = datos as Partial<ResultadoCargaAsistenciaSesion>
  return (
    typeof resultado.guardado === 'boolean' &&
    typeof resultado.soloValidacion === 'boolean' &&
    typeof resultado.totalFilas === 'number' &&
    typeof resultado.filasValidas === 'number' &&
    typeof resultado.filasRechazadas === 'number' &&
    typeof resultado.registrosNuevos === 'number' &&
    typeof resultado.registrosActualizados === 'number' &&
    Array.isArray(resultado.errores)
  )
}

/** Carga CSV de asistencia de alumnos para una sesión (US-2.2). */
export function useCargaMasivaAsistenciaSesion() {
  const { solicitar, solicitarArchivo } = useApi()

  async function descargarPlantilla(sesionId: number, formato: 'csv' | 'xlsx'): Promise<Blob> {
    const parametros = new URLSearchParams({ formato })
    return solicitarArchivo(
      `/api/v1/sesiones-clase/${sesionId}/asistencias/carga-masiva/plantilla?${parametros.toString()}`,
    )
  }

  async function cargar(
    sesionId: number,
    archivo: File,
    soloValidar: boolean,
  ): Promise<ResultadoCargaAsistenciaSesion> {
    const formulario = new FormData()
    formulario.append('archivo', archivo)
    const consulta = new URLSearchParams({ soloValidar: String(soloValidar) })
    const ruta = `/api/v1/sesiones-clase/${sesionId}/asistencias/carga-masiva?${consulta}`

    try {
      return await solicitar<ResultadoCargaAsistenciaSesion>(ruta, {
        metodo: 'POST',
        cuerpo: formulario,
      })
    } catch (fallo: unknown) {
      // El backend devuelve 422 con el mismo resumen y errores detallados por fila.
      if (fallo instanceof ErrorSolicitudApi && esResultadoCarga(fallo.datos)) return fallo.datos
      throw fallo
    }
  }

  return { descargarPlantilla, cargar }
}
