import { ErrorSolicitudApi } from '~/types/api'
import { useApi } from '~/composables/useApi'

const RUTA = '/api/v1/asistencias-docentes/carga-masiva'

export interface ErrorFilaAsistenciaDocente {
  fila: number
  campo: string
  mensaje: string
}

export interface ResultadoCargaAsistenciaDocente {
  guardado: boolean
  soloValidacion: boolean
  totalFilas: number
  filasValidas: number
  filasRechazadas: number
  registrosNuevos: number
  registrosActualizados: number
  errores: ErrorFilaAsistenciaDocente[]
}

function esResultadoCarga(datos: unknown): datos is ResultadoCargaAsistenciaDocente {
  if (!datos || typeof datos !== 'object') return false
  const resultado = datos as Partial<ResultadoCargaAsistenciaDocente>
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

/** Carga CSV administrativa (US-2.5), con validación previa y guardado transaccional en el servidor. */
export function useCargaMasivaAsistenciaDocente() {
  const { solicitar } = useApi()

  async function descargarPlantilla(): Promise<string> {
    return solicitar<string>(`${RUTA}/plantilla`)
  }

  async function cargar(archivo: File, soloValidar: boolean): Promise<ResultadoCargaAsistenciaDocente> {
    const formulario = new FormData()
    formulario.append('archivo', archivo)
    const consulta = new URLSearchParams({ soloValidar: String(soloValidar) })

    try {
      return await solicitar<ResultadoCargaAsistenciaDocente>(`${RUTA}?${consulta}`, {
        metodo: 'POST',
        cuerpo: formulario,
      })
    } catch (fallo: unknown) {
      // El backend responde 422 con el detalle de validación en el mismo formato de resultado.
      if (fallo instanceof ErrorSolicitudApi && esResultadoCarga(fallo.datos)) return fallo.datos
      throw fallo
    }
  }

  return { descargarPlantilla, cargar }
}
