// Utilidades de fechas. Las fechas sin hora se manejan como texto ISO-8601 yyyy-MM-dd (estandar, seccion 6.4).

const FORMATO_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000

export function esFechaIsoValida(valor: string): boolean {
  if (!FORMATO_FECHA_ISO.test(valor)) {
    return false
  }

  const [anhio, mes, dia] = valor.split('-').map(Number) as [number, number, number]
  const fecha = new Date(Date.UTC(anhio, mes - 1, dia))

  return fecha.getUTCFullYear() === anhio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
}

/** Fecha local de hoy en formato yyyy-MM-dd. No se usa toISOString() porque convierte a UTC y en Lima cambia el dia. */
export function obtenerFechaHoyIso(fecha: Date = new Date()): string {
  const anhio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')

  return `${anhio}-${mes}-${dia}`
}

/** Convierte yyyy-MM-dd en dd/mm/aaaa para mostrarlo en pantalla. */
export function formatearFecha(fechaIso: string): string {
  if (!esFechaIsoValida(fechaIso)) {
    return 'Sin fecha'
  }

  const [anhio, mes, dia] = fechaIso.split('-')
  return `${dia}/${mes}/${anhio}`
}

/** Dias calendario desde fechaInicio hasta fechaFin; negativo si fechaFin es anterior. */
export function calcularDiasEntre(fechaInicio: string, fechaFin: string): number {
  const [anhioInicio, mesInicio, diaInicio] = fechaInicio.split('-').map(Number) as [number, number, number]
  const [anhioFin, mesFin, diaFin] = fechaFin.split('-').map(Number) as [number, number, number]

  const inicio = Date.UTC(anhioInicio, mesInicio - 1, diaInicio)
  const fin = Date.UTC(anhioFin, mesFin - 1, diaFin)

  return Math.round((fin - inicio) / MILISEGUNDOS_POR_DIA)
}
