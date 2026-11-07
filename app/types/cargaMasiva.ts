// Tipos de US-5.9. Siguen CargaMasivaResultadoDTO y sus filas en /api/v1/cuentas-usuario/carga-masiva.

export type RolCarga = 'DOCENTE' | 'ALUMNO' | 'APODERADO'

export type EstadoFilaCarga =
  'CREADO' | 'CREADO_Y_VINCULADO' | 'ACTUALIZADO' | 'ACTUALIZADO_Y_VINCULADO' | 'VINCULADO' | 'SIN_CAMBIOS'

export interface ErrorFilaCarga {
  fila: number
  campo: string
  mensaje: string
}

/** Cuenta creada en la carga; la contraseña temporal solo llega en esta respuesta. */
export interface CuentaCargada {
  fila: number
  rol: RolCarga
  dni: string
  username: string
  contrasenhaTemporal: string
}

export interface FilaProcesada {
  fila: number
  estado: EstadoFilaCarga
  rol: RolCarga
  dni: string
  username: string
}

export interface ResultadoCargaMasiva {
  exitoso: boolean
  totalFilas: number
  usuariosCreados: number
  usuariosActualizados: number
  usuariosVinculados: number
  usuariosSinCambios: number
  filasRechazadas: number
  errores: ErrorFilaCarga[]
  cuentas: CuentaCargada[]
  resultados: FilaProcesada[]
}

/** Fila del CSV leída en el navegador; las claves son los nombres de columna en minúsculas. */
export interface FilaCsv {
  fila: number
  valores: Record<string, string>
}

export interface CsvLeido {
  cabecera: string[]
  filas: FilaCsv[]
}

export interface RevisionCsv {
  /** Impiden enviar el archivo. */
  errores: string[]
  /** El back rechazará esas filas, pero el resto se puede procesar. */
  advertencias: string[]
  csv: CsvLeido
  conteoPorRol: Record<string, number>
}

/** Fila de la tabla "Todas las filas": procesada por el back o rechazada. */
export interface FilaResumenCarga {
  fila: number
  rol: string
  dni: string
  username: string
  estado: EstadoFilaCarga | 'RECHAZADA'
  motivos: ErrorFilaCarga[]
}
