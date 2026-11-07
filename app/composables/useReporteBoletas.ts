import { useApi } from '~/composables/useApi'
import { esFechaIsoValida } from '~/composables/useFechas'
import type { FiltrosReporteBoletas, ReporteBoletas } from '~/types/reporteBoletas'

export function crearFiltrosReporte(): FiltrosReporteBoletas {
  return { gradoId: '', seccionId: '', estado: '', vencimientoDesde: '', vencimientoHasta: '' }
}

export function validarFechasReporte(filtros: FiltrosReporteBoletas): string {
  const { vencimientoDesde: desde, vencimientoHasta: hasta } = filtros
  if ((desde && !esFechaIsoValida(desde)) || (hasta && !esFechaIsoValida(hasta))) {
    return 'Ingresa fechas de vencimiento válidas.'
  }
  if (desde && hasta && hasta < desde) {
    return 'La fecha final debe ser igual o posterior a la fecha inicial.'
  }
  return ''
}

/** Una sola consulta devuelve la página y los totales calculados en la base de datos. */
export function construirRutaReporte(filtros: FiltrosReporteBoletas, page = 0, size = 20): string {
  const parametros = new URLSearchParams({ page: String(page), size: String(size) })
  for (const campo of ['gradoId', 'seccionId', 'estado', 'vencimientoDesde', 'vencimientoHasta'] as const) {
    if (filtros[campo]) parametros.set(campo, filtros[campo])
  }
  return `/api/v1/reportes/boletas-pension/pagina?${parametros.toString()}`
}

export function useReporteBoletas() {
  const { solicitar } = useApi()

  async function consultar(filtros: FiltrosReporteBoletas, page = 0, size = 20): Promise<ReporteBoletas> {
    const error = validarFechasReporte(filtros)
    if (error) throw new Error(error)
    return solicitar<ReporteBoletas>(construirRutaReporte(filtros, page, size))
  }

  return { consultar }
}
