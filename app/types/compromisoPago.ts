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
