import { useApi } from '~/composables/useApi'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type {
  AccionAuditoriaFinanciera,
  EventoAuditoriaFinanciera,
  FiltrosAuditoriaFinanciera,
  PaginaAuditoriaFinanciera,
  ResumenAuditoriaFinanciera,
} from '~/types/auditoriaFinanciera'

const RUTA_AUDITORIA_FINANZAS = '/api/v1/auditoria-finanzas'

const MESES_AUDITORIA = [
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

export const ACCIONES_FINANCIERAS: AccionAuditoriaFinanciera[] = [
  'PAGO_REGISTRADO',
  'BOLETA_EN_MORA',
  'BOLETA_GENERADA',
  'COMPROMISO_GENERADO',
]

export const NOMBRES_ACCION_FINANCIERA: Record<AccionAuditoriaFinanciera, string> = {
  PAGO_REGISTRADO: 'Pago registrado',
  BOLETA_EN_MORA: 'Boleta en mora',
  BOLETA_GENERADA: 'Boleta generada',
  COMPROMISO_GENERADO: 'Compromiso generado',
}

const NOMBRES_ESTADO_FINANCIERO: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  PAGADA: 'Pagada',
  EN_MORA: 'En mora',
  ACTIVO: 'Activo',
}

const monedaAuditoria = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

/** Abre con el mes en curso: del día 1 hasta hoy. */
export function crearFiltrosAuditoriaFinanciera(hoy: string): FiltrosAuditoriaFinanciera {
  return {
    desde: `${hoy.slice(0, 8)}01`,
    hasta: hoy,
    accion: '',
    medioPago: '',
    estudiante: '',
    gradoId: '',
    seccionId: '',
    comprobante: '',
  }
}

export function rangoAuditoriaInvalido(filtros: FiltrosAuditoriaFinanciera): boolean {
  return Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta)
}

/** Solo envía los filtros con valor; el texto se recorta. */
export function parametrosAuditoriaFinanciera(
  filtros: Partial<FiltrosAuditoriaFinanciera> & { boletaId?: number },
): URLSearchParams {
  const parametros = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) {
    const texto = String(valor ?? '').trim()
    if (texto) parametros.set(clave, texto)
  }
  return parametros
}

export function nombrarEstadoFinanciero(estado: string | null): string {
  return estado ? (NOMBRES_ESTADO_FINANCIERO[estado] ?? estado) : '—'
}

export function formatearMontoAuditoria(monto: number | null): string {
  return monto === null ? '—' : monedaAuditoria.format(monto)
}

/** "2026-11-01" → "noviembre 2026". */
export function nombrarMesCobro(mes: string | null): string {
  if (!mes) return ''
  return `${MESES_AUDITORIA[Number(mes.slice(5, 7)) - 1] ?? ''} ${mes.slice(0, 4)}`
}

/** "2026-11-18T10:42:15" → { fecha: "18/11/2026", hora: "10:42:15" }. */
export function separarFechaHoraAuditoria(fechaHora: string): { fecha: string; hora: string } {
  const [fecha = '', hora = ''] = fechaHora.split('T')
  return { fecha: fecha.split('-').reverse().join('/'), hora: hora.slice(0, 8) }
}

export function describirResponsable(evento: EventoAuditoriaFinanciera): string {
  if (evento.usuario === 'SISTEMA') return 'SISTEMA · Proceso automático'
  const rol = evento.rolUsuario.charAt(0) + evento.rolUsuario.slice(1).toLowerCase()
  return `${evento.usuario} · ${rol}`
}

/** Línea principal y secundaria de la columna "Detalle". */
export function describirDetalleFinanciero(evento: EventoAuditoriaFinanciera): {
  principal: string
  secundario: string
} {
  if (evento.accion === 'COMPROMISO_GENERADO') {
    const cuotas = evento.numeroCuotas ?? 0
    return {
      principal: `${evento.concepto ?? 'Compromiso'} · ${formatearMontoAuditoria(evento.monto)}`,
      secundario: `${cuotas} ${cuotas === 1 ? 'cuota' : 'cuotas'}`,
    }
  }
  const principal = `Boleta ${nombrarMesCobro(evento.mesCobro)} · ${formatearMontoAuditoria(evento.monto)}`
  if (evento.accion === 'PAGO_REGISTRADO') {
    const medio = evento.medioPago === 'VIRTUAL' ? 'Virtual' : 'Presencial'
    return { principal, secundario: `${medio} · ${evento.numeroComprobante ?? ''}` }
  }
  if (evento.accion === 'BOLETA_GENERADA') {
    return {
      principal,
      secundario: evento.mecanismo === 'MANUAL' ? 'Generada manualmente' : 'Generada automáticamente',
    }
  }
  return { principal, secundario: 'Venció sin pago' }
}

function nombreArchivoAuditoria(cabecera: string | null, porDefecto: string): string {
  const coincidencia = cabecera?.match(/filename="?([^";]+)"?/i)
  return coincidencia?.[1] ?? porDefecto
}

/** Consultas de la auditoría de transacciones y pagos (solo administrador). */
export function useAuditoriaFinanciera() {
  const { solicitar } = useApi()
  const autenticacion = useAutenticacionStore()
  const configuracion = useRuntimeConfig()

  function listar(
    filtros: FiltrosAuditoriaFinanciera,
    pagina: number,
    tamanio: number,
  ): Promise<PaginaAuditoriaFinanciera> {
    const parametros = parametrosAuditoriaFinanciera(filtros)
    parametros.set('page', String(pagina))
    parametros.set('size', String(tamanio))
    return solicitar<PaginaAuditoriaFinanciera>(`${RUTA_AUDITORIA_FINANZAS}?${parametros.toString()}`)
  }

  function resumir(filtros: FiltrosAuditoriaFinanciera): Promise<ResumenAuditoriaFinanciera> {
    return solicitar<ResumenAuditoriaFinanciera>(
      `${RUTA_AUDITORIA_FINANZAS}/resumen?${parametrosAuditoriaFinanciera(filtros).toString()}`,
    )
  }

  /** Todos los eventos de una boleta, del más antiguo al más reciente. */
  async function historialBoleta(boletaId: number): Promise<EventoAuditoriaFinanciera[]> {
    const parametros = parametrosAuditoriaFinanciera({ boletaId })
    parametros.set('size', '100')
    const pagina = await solicitar<PaginaAuditoriaFinanciera>(`${RUTA_AUDITORIA_FINANZAS}?${parametros.toString()}`)
    return [...pagina.content].reverse()
  }

  async function descargarCsv(filtros: FiltrosAuditoriaFinanciera): Promise<{ archivo: Blob; nombre: string }> {
    const base = String(configuracion.public.apiBase || '').replace(/\/+$/, '')
    const respuesta = await fetch(
      `${base}${RUTA_AUDITORIA_FINANZAS}/csv?${parametrosAuditoriaFinanciera(filtros).toString()}`,
      {
        headers: autenticacion.token ? { Authorization: `Bearer ${autenticacion.token}` } : {},
        cache: 'no-store',
      },
    )
    if (!respuesta.ok) {
      if (respuesta.status === 401) autenticacion.cerrarSesion()
      const detalle: unknown = await respuesta.json().catch(() => null)
      const mensaje = detalle && typeof detalle === 'object' && 'message' in detalle ? detalle.message : null
      throw new Error(typeof mensaje === 'string' ? mensaje : 'No fue posible exportar la auditoría.')
    }
    if (!respuesta.headers.get('content-type')?.toLowerCase().includes('text/csv')) {
      throw new Error('El servidor no devolvió un archivo CSV válido.')
    }
    return {
      archivo: await respuesta.blob(),
      nombre: nombreArchivoAuditoria(respuesta.headers.get('content-disposition'), 'auditoria-finanzas.csv'),
    }
  }

  return { listar, resumir, historialBoleta, descargarCsv }
}
