import { useApi } from '~/composables/useApi'
import { esFechaIsoValida } from '~/composables/useFechas'
import type { EstadoBoletaCobranza, FiltrosReporteBoletas, ReporteBoletas } from '~/types/reporteBoletas'

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

export function construirRutaReporte(filtros: FiltrosReporteBoletas, estado: EstadoBoletaCobranza): string {
  const parametros = new URLSearchParams({ estado })
  for (const campo of ['gradoId', 'seccionId', 'vencimientoDesde', 'vencimientoHasta'] as const) {
    if (filtros[campo]) parametros.set(campo, filtros[campo])
  }
  return `/api/v1/reportes/boletas-pension?${parametros.toString()}`
}

/** Combina estados disjuntos. Suma en céntimos para no introducir decimales binarios en el total. */
export function combinarReportes(reportes: ReporteBoletas[]): ReporteBoletas {
  return {
    boletas: reportes
      .flatMap((reporte) => reporte.boletas)
      .sort(
        (primera, segunda) =>
          primera.fechaVencimiento.localeCompare(segunda.fechaVencimiento) || primera.id - segunda.id,
      ),
    montoPendiente: reportes.reduce((total, reporte) => total + Math.round(reporte.montoPendiente * 100), 0) / 100,
    // Solo EN_MORA aporta familias; el backend las cuenta una sola vez por apoderado.
    familiasMorosas: reportes.reduce((total, reporte) => total + reporte.familiasMorosas, 0),
  }
}

/** Reporte administrativo US-1.10. No incluye boletas pagadas ni genera o modifica deuda. */
export function useReporteBoletas() {
  const { solicitar } = useApi()

  async function consultar(filtros: FiltrosReporteBoletas): Promise<ReporteBoletas> {
    const error = validarFechasReporte(filtros)
    if (error) throw new Error(error)
    const estados: EstadoBoletaCobranza[] = filtros.estado ? [filtros.estado] : ['PENDIENTE', 'EN_MORA']
    const reportes = await Promise.all(
      estados.map((estado) => solicitar<ReporteBoletas>(construirRutaReporte(filtros, estado))),
    )
    return combinarReportes(reportes)
  }

  return { consultar }
}
