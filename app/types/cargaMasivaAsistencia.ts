// Tipos de US-2.2 y US-2.5. Siguen CargaMasivaAsistenciaResultadoDTO del backend.
import type { ErrorFilaCarga } from '~/types/cargaMasiva'

export interface ResultadoCargaAsistencia {
  /** Falso si hubo errores o si solo se pidió validar: no se modificó ningún registro. */
  guardado: boolean
  soloValidacion: boolean
  totalFilas: number
  filasValidas: number
  filasRechazadas: number
  registrosNuevos: number
  registrosActualizados: number
  errores: ErrorFilaCarga[]
}

/** Envía el CSV; con soloValidar el backend revisa todas las filas sin guardar nada. */
export type EnviarCargaAsistencia = (archivo: File, soloValidar: boolean) => Promise<ResultadoCargaAsistencia>
