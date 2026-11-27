/** Periodo (grado y sección de un año) en el que está matriculado un hijo del apoderado. */
export interface PeriodoVinculado {
  periodoId: number
  gradoNumero: number
  seccion: string
  fechaInicio: string
  fechaFin: string
}

/** Hijo vinculado al apoderado autenticado (API /api/v1/apoderados/mis-estudiantes). */
export interface HijoVinculado {
  estudianteId: number
  nombreCompleto: string
  periodos: PeriodoVinculado[]
}

export type EstadoAsistenciaHijo = 'PRESENTE' | 'TARDANZA' | 'AUSENTE' | 'JUSTIFICADA'

/** Asistencia de un alumno en una clase (API /api/v1/asistencias-estudiantes/{id}/historial). */
export interface RegistroAsistencia {
  asistenciaId: number
  fecha: string
  horaInicio: string
  horaFin: string
  seccionId: number
  seccionCodigo: string
  areaCodigo: string
  areaNombre: string
  docenteNombre: string
  estado: EstadoAsistenciaHijo
  motivoJustificacion: string | null
  documentoNombre: string | null
  documentoUrl: string | null
}

export interface RespuestaJustificacionAsistencia {
  asistenciaId: number
  estudianteId: number
  estado: 'JUSTIFICADA'
  motivo: string
  documentoNombre: string
  documentoTipo: string | null
  documentoTamanio: number
  documentoUrl: string
}

export interface ResumenAsistencia {
  total: number
  PRESENTE: number
  TARDANZA: number
  AUSENTE: number
  JUSTIFICADA: number
  porcentaje: number | null
}

export interface DiaAsistencia {
  fecha: string
  registros: RegistroAsistencia[]
  resumen: ResumenAsistencia
}

export type AtajoRango = 'SEMANA' | 'MES' | 'MES_ANTERIOR' | 'ANIO'

export type EstadoBoletaFamilia = 'PENDIENTE' | 'PAGADA' | 'EN_MORA'
export type TipoCargoBoletaFamilia = 'MATRICULA' | 'PENSION'

export type SituacionCompromisoFamilia = 'AL_DIA' | 'CON_PENDIENTES' | 'CON_MORA'

export interface ComprobanteFamilia {
  comprobanteId: number
  numeroComprobante: string
  fechaEmision: string
  medioPago: 'PRESENCIAL' | 'VIRTUAL'
  montoPagado: number
}

/** Boleta ya emitida de un compromiso (API /api/v1/apoderados/mis-pagos). */
export interface BoletaFamilia {
  boletaId: number
  mesCobro: string
  fechaVencimiento: string
  monto: number
  mora: number
  montoTotal: number
  estadoPago: EstadoBoletaFamilia
  tipoCargo: TipoCargoBoletaFamilia
  comprobante: ComprobanteFamilia | null
}

export interface CompromisoFamilia {
  compromisoId: number
  concepto: string
  anio: number
  gradoNumero: number
  seccion: string
  apoderadoTitular: string
  montoTotal: number
  montoPagado: number
  montoPorPagar: number
  numeroCuotas: number
  cuotasPagadas: number
  cuotasEnMora: number
  cuotasPendientes: number
  cuotasPorEmitir: number
  proximaEmision: string | null
  situacion: SituacionCompromisoFamilia
  boletas: BoletaFamilia[]
}

export interface PagosHijo {
  estudianteId: number
  nombreCompleto: string
  compromisos: CompromisoFamilia[]
}

/** Boleta por pagar con el hijo al que pertenece, para la franja del Panel y el modal de pago. */
export interface DeudaFamilia {
  estudianteId: number
  nombreHijo: string
  boleta: BoletaFamilia
}

/** Comprobante devuelto al pagar en línea. */
export interface ComprobantePagoFamilia {
  id: number
  boletaId: number
  fechaEmision: string
  montoPagado: number
  medioPago: 'PRESENCIAL' | 'VIRTUAL'
  numeroComprobante: string
}

/** Alertas calculadas por el backend solo para los hijos del apoderado autenticado. */
export interface AlertaRiesgoFamilia {
  estudianteId: number
  periodoId: number
  bimestre: number
  areaCodigo: string
  areaNombre: string
  notasC: number
  umbral: number
  competencias: { codigo: string; nombre: string; notasC: number }[]
}
