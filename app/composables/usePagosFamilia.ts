import { useApi } from '~/composables/useApi'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type {
  BoletaFamilia,
  ComprobantePagoFamilia,
  CompromisoFamilia,
  DeudaFamilia,
  EstadoBoletaFamilia,
  PagosHijo,
  SituacionCompromisoFamilia,
} from '~/types/familia'

const MESES_PAGO = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const solesFamilia = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

export const NOMBRES_ESTADO_BOLETA: Record<EstadoBoletaFamilia, string> = {
  PENDIENTE: 'Pendiente',
  PAGADA: 'Pagada',
  EN_MORA: 'En mora',
}

export const NOMBRES_SITUACION_COMPROMISO: Record<SituacionCompromisoFamilia, string> = {
  AL_DIA: 'Al día',
  CON_PENDIENTES: 'Con boletas pendientes',
  CON_MORA: 'Con boletas en mora',
}

export function formatearSolesFamilia(monto: number): string {
  return solesFamilia.format(monto)
}

/** "2026-11" → "noviembre 2026"; corto: "nov. 2026". */
export function nombrarMesBoleta(mes: string, corto = false): string {
  const nombre = MESES_PAGO[Number(mes.slice(5, 7)) - 1] ?? ''
  return `${corto ? `${nombre.slice(0, 3)}.` : nombre} ${mes.slice(0, 4)}`
}

/** "2026-11-15" → "15/11/2026"; sin año: "15/11". */
export function fechaPago(fecha: string, conAnio = true): string {
  const [anio, mes, dia] = fecha.split('-')
  return conAnio ? `${dia}/${mes}/${anio}` : `${dia}/${mes}`
}

/** En mora y pendientes, de la más antigua a la más reciente. */
/** Por pagar en el orden en que deben pagarse: la matrícula primero y luego las pensiones, de la más antigua a la más reciente. */
export function boletasPorPagar(compromiso: CompromisoFamilia): BoletaFamilia[] {
  return compromiso.boletas
    .filter((boleta) => boleta.estadoPago !== 'PAGADA')
    .sort(
      (primera, segunda) =>
        Number(primera.tipoCargo === 'PENSION') - Number(segunda.tipoCargo === 'PENSION') ||
        primera.mesCobro.localeCompare(segunda.mesCobro),
    )
}

/** Marcadas al entrar: hasta la última vencida o que vence este mes; si no hay, solo la siguiente. */
export function seleccionInicial(porPagar: BoletaFamilia[], fechaHoy: string): number[] {
  const finDeMes = `${fechaHoy.slice(0, 7)}-31`
  const ultima = porPagar
    .map((boleta) => boleta.estadoPago === 'EN_MORA' || boleta.fechaVencimiento <= finDeMes)
    .lastIndexOf(true)
  return porPagar.slice(0, Math.max(ultima, 0) + 1).map((boleta) => boleta.boletaId)
}

/** Las boletas se pagan en orden: marcar una incluye las anteriores y desmarcarla quita las siguientes. */
export function alternarEnOrden(porPagar: BoletaFamilia[], seleccion: number[], boletaId: number): number[] {
  const indice = porPagar.findIndex((boleta) => boleta.boletaId === boletaId)
  const hasta = seleccion.includes(boletaId) ? indice : indice + 1
  return porPagar.slice(0, hasta).map((boleta) => boleta.boletaId)
}

/** Pagadas, de la más reciente a la más antigua. */
export function boletasPagadas(compromiso: CompromisoFamilia): BoletaFamilia[] {
  return compromiso.boletas
    .filter((boleta) => boleta.estadoPago === 'PAGADA')
    .sort((primera, segunda) => segunda.mesCobro.localeCompare(primera.mesCobro))
}

/** Lo que la familia debe hoy: primero lo que está en mora, cada grupo del más antiguo al más reciente. */
export function deudaFamiliar(hijos: PagosHijo[]): DeudaFamilia[] {
  return hijos
    .flatMap((hijo) =>
      hijo.compromisos.flatMap((compromiso) =>
        boletasPorPagar(compromiso).map((boleta) => ({
          estudianteId: hijo.estudianteId,
          nombreHijo: hijo.nombreCompleto,
          boleta,
        })),
      ),
    )
    .sort(
      (primera, segunda) =>
        Number(segunda.boleta.estadoPago === 'EN_MORA') - Number(primera.boleta.estadoPago === 'EN_MORA') ||
        primera.boleta.fechaVencimiento.localeCompare(segunda.boleta.fechaVencimiento),
    )
}

export function sumarDeuda(deudas: DeudaFamilia[]): number {
  return Math.round(deudas.reduce((total, deuda) => total + deuda.boleta.montoTotal, 0) * 100) / 100
}

export function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? nombreCompleto
}

/** Pensiones de los hijos del apoderado autenticado. */
export function usePagosFamilia() {
  const { solicitar } = useApi()
  const autenticacion = useAutenticacionStore()
  const configuracion = useRuntimeConfig()

  function listarPagos(): Promise<PagosHijo[]> {
    return solicitar<PagosHijo[]>('/api/v1/apoderados/mis-pagos')
  }

  /** Todas o ninguna: el back revierte la operación completa si una boleta falla. */
  function pagar(boletaIds: number[]): Promise<ComprobantePagoFamilia[]> {
    return solicitar<ComprobantePagoFamilia[]>('/api/v1/apoderados/mis-pagos/pagos', {
      metodo: 'POST',
      cuerpo: { boletaIds },
    })
  }

  async function descargarComprobante(comprobanteId: number, numero: string): Promise<void> {
    const base = String(configuracion.public.apiBase || '').replace(/\/+$/, '')
    const respuesta = await fetch(`${base}/api/v1/apoderados/mis-pagos/comprobantes/${comprobanteId}/pdf`, {
      headers: autenticacion.token ? { Authorization: `Bearer ${autenticacion.token}` } : {},
      cache: 'no-store',
    })
    if (!respuesta.ok) {
      if (respuesta.status === 401) autenticacion.cerrarSesion()
      const detalle: unknown = await respuesta.json().catch(() => null)
      const mensaje = detalle && typeof detalle === 'object' && 'message' in detalle ? detalle.message : null
      throw new Error(typeof mensaje === 'string' ? mensaje : 'No se pudo descargar el comprobante.')
    }
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(await respuesta.blob())
    enlace.download = `comprobante-${numero}.pdf`
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  }

  return { listarPagos, pagar, descargarComprobante }
}
