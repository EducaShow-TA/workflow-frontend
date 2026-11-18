export type AccionAuditoriaFinanciera = 'COMPROMISO_GENERADO' | 'BOLETA_GENERADA' | 'PAGO_REGISTRADO' | 'BOLETA_EN_MORA'

/** Evento de la auditoría financiera (API /api/v1/auditoria-finanzas). */
export interface EventoAuditoriaFinanciera {
  id: number
  fechaHora: string
  usuario: string
  rolUsuario: string
  accion: AccionAuditoriaFinanciera
  compromisoId: number
  boletaId: number | null
  estudianteId: number
  estudianteNombre: string
  estudianteDni: string
  gradoNumero: number
  seccionCodigo: string
  apoderadoNombre: string
  concepto: string | null
  mesCobro: string | null
  estadoAnterior: string | null
  estadoNuevo: string
  monto: number | null
  numeroCuotas: number | null
  mecanismo: string | null
  medioPago: string | null
  numeroComprobante: string | null
}

export interface PaginaAuditoriaFinanciera {
  content: EventoAuditoriaFinanciera[]
  page: {
    size: number
    number: number
    totalElements: number
    totalPages: number
  }
}

export interface ResumenAuditoriaFinanciera {
  eventos: number
  pagos: number
  montoPagado: number
  boletasEnMora: number
  boletasGeneradas: number
  compromisosGenerados: number
}

/** Valores del formulario; vacío significa sin filtro. */
export interface FiltrosAuditoriaFinanciera {
  desde: string
  hasta: string
  accion: AccionAuditoriaFinanciera | ''
  medioPago: 'PRESENCIAL' | 'VIRTUAL' | ''
  estudiante: string
  gradoId: string
  seccionId: string
  comprobante: string
}
