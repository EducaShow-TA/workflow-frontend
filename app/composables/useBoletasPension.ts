import type { PaginaRespuesta } from '~/types/paginacion'
import { useApi } from '~/composables/useApi'
import type { BoletaPension, ComprobanteBoleta, EstadoBoleta, FiltrosBoletas, PagoBoleta } from '~/types/boletaPension'

const RUTA = '/api/v1/boletas-pension'

export function crearFiltrosBoletas(): FiltrosBoletas {
  return { estudianteId: '', periodoId: '', mes: '', estado: '' }
}

export function etiquetaEstadoBoleta(estado: EstadoBoleta): string {
  return { PENDIENTE: 'Pendiente', EN_MORA: 'En mora', PAGADA: 'Pagada' }[estado]
}

export function validarPagoBoleta(boleta: BoletaPension, pago: PagoBoleta): string {
  if (boleta.estadoPago === 'PAGADA') return 'Esta boleta ya está pagada.'
  if (
    !Number.isFinite(pago.monto) ||
    pago.monto <= 0 ||
    Math.round(pago.monto * 100) !== Math.round(boleta.montoTotal * 100)
  ) {
    return 'Debe registrarse el importe total de la boleta, incluidos los recargos.'
  }
  if (!['PRESENCIAL', 'VIRTUAL'].includes(pago.medioPago)) return 'Selecciona un medio de pago válido.'
  if ((pago.referencia?.trim().length ?? 0) > 40) return 'El número de comprobante admite hasta 40 caracteres.'
  return ''
}

/** US-1.5: los estados e importes se consultan al servidor; el cliente no marca pagos por su cuenta. */
export function useBoletasPension() {
  const { solicitar } = useApi()

  function listar(filtros: FiltrosBoletas = crearFiltrosBoletas()): Promise<BoletaPension[]> {
    const parametros = new URLSearchParams()
    for (const campo of ['estudianteId', 'periodoId', 'mes', 'estado'] as const) {
      if (filtros[campo]) parametros.set(campo, filtros[campo])
    }
    return solicitar<BoletaPension[]>(`${RUTA}${parametros.size ? `?${parametros}` : ''}`)
  }

  function listarPagina(filtros: FiltrosBoletas, page = 0, size = 20): Promise<PaginaRespuesta<BoletaPension>> {
    const parametros = new URLSearchParams({ page: String(page), size: String(size) })
    for (const campo of ['estudianteId', 'periodoId', 'mes', 'estado'] as const) {
      if (filtros[campo]) parametros.set(campo, filtros[campo])
    }
    return solicitar<PaginaRespuesta<BoletaPension>>(`${RUTA}/pagina?${parametros}`)
  }

  function estudiantes(): Promise<{ id: number; nombre: string }[]> {
    return solicitar<{ id: number; nombre: string }[]>(`${RUTA}/estudiantes`)
  }

  function obtener(id: number): Promise<BoletaPension> {
    return solicitar<BoletaPension>(`${RUTA}/${id}`)
  }

  function comprobantes(id: number): Promise<ComprobanteBoleta[]> {
    return solicitar<ComprobanteBoleta[]>(`${RUTA}/${id}/comprobantes`)
  }

  async function registrarPago(boleta: BoletaPension, pago: PagoBoleta): Promise<ComprobanteBoleta> {
    const error = validarPagoBoleta(boleta, pago)
    if (error) throw new Error(error)
    return solicitar<ComprobanteBoleta>(`${RUTA}/${boleta.id}/pagos`, {
      metodo: 'POST',
      cuerpo: { monto: pago.monto, medioPago: pago.medioPago, referencia: pago.referencia?.trim() || undefined },
    })
  }

  return { listar, listarPagina, estudiantes, obtener, comprobantes, registrarPago }
}
