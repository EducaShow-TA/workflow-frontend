// Términos del compromiso de pago que el back exige al confirmar una matrícula (CompromisoPagoRequest, US-1.3).

/** Cuerpo de PATCH .../confirmar y del campo `compromiso` de .../confirmar-masivo. */
export interface SolicitudCompromisoPago {
  concepto: string
  montoTotal: number
  numeroCuotas: number
  primerVencimiento: string
  diaVencimiento: number
}

/** El día de vencimiento mensual no se pide: sale del primer vencimiento, como exige el back. */
export interface FormularioCompromisoPago {
  concepto: string
  montoTotal: number | null
  numeroCuotas: number | null
  primerVencimiento: string
}

export type ErroresCompromisoPago = Partial<Record<keyof FormularioCompromisoPago, string>>

export interface CuotaCronograma {
  numero: number
  vencimiento: string
  /** En céntimos, para repartir el monto sin errores de redondeo. */
  montoCentimos: number
}

/** CompromisoPagoResponse: compromiso creado al confirmar la matrícula. */
export interface CompromisoPagoApi {
  id: number
  matriculaId: number
  estudianteId: number
  apoderadoId: number
  concepto: string
  montoTotal: number
  fechaEmision: string
  /** "2027-03". */
  mesInicio: string
  numeroCuotas: number
  primerVencimiento: string
  diaVencimiento: number
}

/** Mes del cronograma del compromiso y la boleta que ya le corresponde, si existe. */
export interface MesCompromiso {
  mes: string
  numeroCuota: number
  boleta: { id: number; estado: string; mecanismo: 'AUTOMATICO' | 'MANUAL' } | null
}
