import { useApi } from '~/composables/useApi'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { Calificacion, MovimientoCalificacion, SolicitudCalificacion } from '~/types/calificacion'

const RUTA = '/api/v1/calificaciones'

export const LONGITUD_MINIMA_MOTIVO_RECTIFICACION = 10
export const LONGITUD_MAXIMA_MOTIVO_RECTIFICACION = 500
export const ATAJOS_MOTIVO_RECTIFICACION = [
  'Error de digitación',
  'Revisión de la evidencia',
  'Reclamo del alumno o apoderado',
] as const

/** Antepone el atajo elegido al motivo, reemplazando otro atajo si ya había uno. */
export function aplicarAtajoMotivo(motivo: string, atajo: string): string {
  let resto = motivo
  for (const existente of ATAJOS_MOTIVO_RECTIFICACION) {
    if (resto.startsWith(`${existente}:`)) {
      resto = resto.slice(existente.length + 1)
      break
    }
  }
  return `${atajo}: ${resto.trimStart()}`
}

/** Valida el motivo de una rectificación; devuelve el mensaje de error o una cadena vacía. */
export function validarMotivoRectificacion(motivo: string): string {
  return motivo.trim().length < LONGITUD_MINIMA_MOTIVO_RECTIFICACION
    ? `Escribe un motivo de al menos ${LONGITUD_MINIMA_MOTIVO_RECTIFICACION} caracteres.`
    : ''
}

/** US-3.8: calificaciones con evidencia pedagógica y seguimiento por competencia. */
export function useCalificaciones() {
  const { solicitar } = useApi()
  const autenticacion = useAutenticacionStore()
  const configuracion = useRuntimeConfig()

  function listar(periodoId: number, competenciaCodigo: string, bimestre: number): Promise<Calificacion[]> {
    return solicitar<Calificacion[]>(
      `/api/v1/seguimiento/competencias/${encodeURIComponent(competenciaCodigo)}?periodoId=${periodoId}&bimestre=${bimestre}`,
    )
  }

  function registrar(solicitud: SolicitudCalificacion, archivo: File | null): Promise<Calificacion> {
    // Spring Boot espera @RequestPart("datos") JSON, no un campo de texto plano.
    const cuerpo = new FormData()
    const datos = new Blob([JSON.stringify(solicitud)], { type: 'application/json' })
    cuerpo.append('datos', datos, 'datos.json')
    if (archivo) cuerpo.append('archivo', archivo, archivo.name)
    // useApi no fija Content-Type para FormData: el navegador genera el boundary multipart.
    return solicitar<Calificacion>(RUTA, { metodo: 'POST', cuerpo })
  }

  function historial(calificacionId: number): Promise<MovimientoCalificacion[]> {
    return solicitar<MovimientoCalificacion[]>(`${RUTA}/${calificacionId}/historial`)
  }

  async function descargarEvidencia(calificacion: Calificacion): Promise<void> {
    if (calificacion.evidenciaTipo !== 'ARCHIVO') return
    if (!calificacion.evidenciaUrl?.startsWith('/api/v1/evidencias/')) {
      throw new Error('No se encontró una ruta válida para descargar esta evidencia.')
    }
    const base = String(configuracion.public.apiBase || '').replace(/\/+$/, '')
    const respuesta = await fetch(`${base}${calificacion.evidenciaUrl}`, {
      headers: autenticacion.token ? { Authorization: `Bearer ${autenticacion.token}` } : {},
    })
    if (!respuesta.ok) {
      if (respuesta.status === 401) autenticacion.cerrarSesion()
      throw new Error('No fue posible descargar la evidencia adjunta.')
    }
    const objetoUrl = URL.createObjectURL(await respuesta.blob())
    const enlace = document.createElement('a')
    enlace.href = objetoUrl
    enlace.download = calificacion.evidenciaNombre || `evidencia-${calificacion.id}`
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    window.setTimeout(() => URL.revokeObjectURL(objetoUrl), 1000)
  }

  return { listar, registrar, historial, descargarEvidencia }
}
