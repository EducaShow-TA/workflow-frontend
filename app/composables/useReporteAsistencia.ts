import { useApi } from '~/composables/useApi'
import { ahoraSistema } from '~/composables/useFechas'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { FiltrosReporteAsistencia, ReporteAsistencia, SeccionReporteAsistencia } from '~/types/reporteAsistencia'

const RUTA_REPORTE = '/api/v1/reportes/asistencia-estudiantes'

function fechaLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

/** Valor inicial del filtro: del primer día del mes en curso a hoy (no es una regla de negocio). */
export function crearFiltrosReporteAsistencia(hoy: Date = ahoraSistema()): FiltrosReporteAsistencia {
  return {
    desde: fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
    hasta: fechaLocal(hoy),
    gradoId: null,
    seccionId: null,
  }
}

export function rutaReporteAsistencia(filtros: FiltrosReporteAsistencia, csv = false): string {
  const parametros = new URLSearchParams({ desde: filtros.desde, hasta: filtros.hasta })
  if (filtros.gradoId !== null) parametros.set('gradoId', String(filtros.gradoId))
  if (filtros.seccionId !== null) parametros.set('seccionId', String(filtros.seccionId))
  return `${RUTA_REPORTE}${csv ? '/csv' : ''}?${parametros.toString()}`
}

export function seccionesDelGrado(
  secciones: SeccionReporteAsistencia[],
  gradoId: number | null,
): SeccionReporteAsistencia[] {
  return gradoId === null ? secciones : secciones.filter((seccion) => seccion.gradoId === gradoId)
}

/** Una sección de otro grado no puede quedar seleccionada: el backend devolvería una lista vacía. */
export function seccionAjustadaAlGrado(
  secciones: SeccionReporteAsistencia[],
  gradoId: number | null,
  seccionId: number | null,
): number | null {
  if (seccionId === null || gradoId === null) return seccionId
  const seccion = secciones.find((opcion) => opcion.seccionId === seccionId)
  return seccion && seccion.gradoId !== gradoId ? null : seccionId
}

/**
 * Descarga un Blob como archivo. El enlace se agrega al documento y la URL se libera después, como en
 * ConsultaLibretas: algunos navegadores cancelan la descarga si el enlace no está en el DOM o si la URL
 * se revoca de inmediato.
 */
export function guardarArchivo(
  archivo: Blob,
  nombre: string,
  documento: Document = document,
  urls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL,
): void {
  const url = urls.createObjectURL(archivo)
  const enlace = documento.createElement('a')
  enlace.href = url
  enlace.download = nombre
  documento.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => urls.revokeObjectURL(url), 1000)
}

export function gradosDisponibles(secciones: SeccionReporteAsistencia[]): { gradoId: number; grado: string }[] {
  const grados = new Map<number, string>()
  for (const seccion of secciones) {
    if (!grados.has(seccion.gradoId)) grados.set(seccion.gradoId, seccion.grado)
  }
  return [...grados].map(([gradoId, grado]) => ({ gradoId, grado }))
}

function nombreDesdeCabecera(cabecera: string | null, porDefecto: string): string {
  const coincidencia = cabecera?.match(/filename="?([^";]+)"?/i)
  return coincidencia?.[1] ?? porDefecto
}

/** US-2.6: consulta y exportación; los conteos y el control de acceso los resuelve el servidor. */
export function useReporteAsistencia() {
  const { solicitar } = useApi()
  const autenticacion = useAutenticacionStore()
  const configuracion = useRuntimeConfig()

  function listarSecciones(): Promise<SeccionReporteAsistencia[]> {
    return solicitar<SeccionReporteAsistencia[]>(`${RUTA_REPORTE}/secciones`)
  }

  function consultar(filtros: FiltrosReporteAsistencia): Promise<ReporteAsistencia> {
    return solicitar<ReporteAsistencia>(rutaReporteAsistencia(filtros))
  }

  async function descargarCsv(filtros: FiltrosReporteAsistencia): Promise<{ archivo: Blob; nombre: string }> {
    const base = String(configuracion.public.apiBase || '').replace(/\/+$/, '')
    const respuesta = await fetch(`${base}${rutaReporteAsistencia(filtros, true)}`, {
      headers: autenticacion.token ? { Authorization: `Bearer ${autenticacion.token}` } : {},
      cache: 'no-store',
    })
    if (!respuesta.ok) {
      if (respuesta.status === 401) autenticacion.cerrarSesion()
      const detalle: unknown = await respuesta.json().catch(() => null)
      const mensaje = detalle && typeof detalle === 'object' && 'message' in detalle ? detalle.message : null
      throw new Error(typeof mensaje === 'string' ? mensaje : 'No fue posible exportar el reporte de asistencia.')
    }
    if (!respuesta.headers.get('content-type')?.toLowerCase().includes('text/csv')) {
      throw new Error('El servidor no devolvió un archivo CSV válido.')
    }
    const porDefecto = `reporte-asistencia_${filtros.desde}_${filtros.hasta}.csv`
    return {
      archivo: await respuesta.blob(),
      nombre: nombreDesdeCabecera(respuesta.headers.get('content-disposition'), porDefecto),
    }
  }

  return { listarSecciones, consultar, descargarCsv }
}
