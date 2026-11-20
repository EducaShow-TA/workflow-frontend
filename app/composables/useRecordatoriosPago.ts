import { calcularDiasEntre, esFechaIsoValida } from '~/composables/useFechas'
import type { DeudaFamilia } from '~/types/familia'

/** Boletas pendientes que vencen entre hoy y el plazo configurado, inclusive. */
export function obtenerRecordatoriosPago(deudas: DeudaFamilia[], hoy: string, anticipacion: number) {
  const limite = Number.isSafeInteger(anticipacion) && anticipacion >= 0 ? anticipacion : 10
  return deudas
    .filter((deuda) => deuda.boleta.estadoPago === 'PENDIENTE' && esFechaIsoValida(deuda.boleta.fechaVencimiento))
    .map((deuda) => ({ ...deuda, diasRestantes: calcularDiasEntre(hoy, deuda.boleta.fechaVencimiento) }))
    .filter((deuda) => deuda.diasRestantes >= 0 && deuda.diasRestantes <= limite)
    .sort((primera, segunda) => primera.diasRestantes - segunda.diasRestantes)
}
