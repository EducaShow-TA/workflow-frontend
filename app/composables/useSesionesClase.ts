import { useApi } from '~/composables/useApi'
import { esFechaIsoValida } from '~/composables/useFechas'
import type {
  AreaOpcion,
  DocenteOpcion,
  ErroresSesionClase,
  EstadoAsistenciaAlumno,
  ListaAsistencia,
  SesionClaseResumen,
  SituacionSesion,
  SolicitudGuardarAsistencia,
  SolicitudSesionClase,
} from '~/types/sesionClase'

const RUTA_SESIONES = '/api/v1/sesiones-clase'

const ETIQUETAS_ESTADO: Record<EstadoAsistenciaAlumno, string> = {
  PRESENTE: 'Presente',
  TARDANZA: 'Tardanza',
  AUSENTE: 'Ausente',
  JUSTIFICADA: 'Justificada',
}

export function obtenerEtiquetaEstado(estado: EstadoAsistenciaAlumno): string {
  return ETIQUETAS_ESTADO[estado]
}

/** "10:00:00" → "10:00". */
export function formatearHora(hora: string): string {
  return hora.slice(0, 5)
}

/** "2026-11-06T09:45:00" → "09:45". */
export function horaDeMomento(momento: string): string {
  return momento.slice(11, 16)
}

/** "2026-11-06T09:45:00" → "06/11/2026 a las 09:45". */
export function describirMomento(momento: string): string {
  const [anhio, mes, dia] = momento.slice(0, 10).split('-')
  return `${dia}/${mes}/${anhio} a las ${horaDeMomento(momento)}`
}

export function nombreSeccion(sesion: Pick<SesionClaseResumen, 'gradoNumero' | 'seccionCodigo'>): string {
  return `${sesion.gradoNumero}.° ${sesion.seccionCodigo}`
}

/** El back guarda horas locales sin zona; se comparan con la hora local del navegador. */
function aMilisegundos(momento: string): number {
  return new Date(momento).getTime()
}

export function obtenerSituacion(sesion: SesionClaseResumen, ahora: number = Date.now()): SituacionSesion {
  if (sesion.registrados > 0) return 'REGISTRADA'
  if (ahora < aMilisegundos(sesion.ventanaApertura)) return 'POR_ABRIR'
  if (ahora <= aMilisegundos(sesion.ventanaCierre)) return 'ABIERTA'
  return 'CERRADA'
}

export function minutosRestantes(sesion: SesionClaseResumen, ahora: number = Date.now()): number {
  return Math.max(0, Math.ceil((aMilisegundos(sesion.ventanaCierre) - ahora) / 60000))
}

export function ordenarPorHora(sesiones: SesionClaseResumen[]): SesionClaseResumen[] {
  return [...sesiones].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.id - b.id)
}

export function validarSesionClase(solicitud: Partial<SolicitudSesionClase>): ErroresSesionClase {
  const errores: ErroresSesionClase = {}

  if (!solicitud.seccionId) errores.seccionId = 'Selecciona la sección.'
  if (!solicitud.areaCodigo) errores.areaCodigo = 'Selecciona el área.'
  if (!solicitud.docenteId) errores.docenteId = 'Selecciona el docente.'
  if (!solicitud.fecha || !esFechaIsoValida(solicitud.fecha)) errores.fecha = 'Ingresa la fecha de la sesión.'
  if (!solicitud.horaInicio) errores.horaInicio = 'Ingresa la hora de inicio.'
  if (!solicitud.horaFin) {
    errores.horaFin = 'Ingresa la hora de fin.'
  } else if (solicitud.horaInicio && solicitud.horaFin <= solicitud.horaInicio) {
    errores.horaFin = 'La hora de fin debe ser posterior a la de inicio.'
  }

  return errores
}

/** Acceso a sesiones de clase y a la asistencia de sus alumnos (HU 2.1). */
export function useSesionesClase() {
  const { solicitar } = useApi()

  function listarMias(fecha: string): Promise<SesionClaseResumen[]> {
    return solicitar<SesionClaseResumen[]>(`${RUTA_SESIONES}/mias?fecha=${encodeURIComponent(fecha)}`)
  }

  function listar(fecha: string, seccionId?: number): Promise<SesionClaseResumen[]> {
    const parametros = new URLSearchParams({ fecha })
    if (seccionId) parametros.set('seccionId', String(seccionId))
    return solicitar<SesionClaseResumen[]>(`${RUTA_SESIONES}?${parametros.toString()}`)
  }

  function obtenerLista(sesionId: number): Promise<ListaAsistencia> {
    return solicitar<ListaAsistencia>(`${RUTA_SESIONES}/${sesionId}/lista`)
  }

  function guardarAsistencias(sesionId: number, solicitud: SolicitudGuardarAsistencia): Promise<ListaAsistencia> {
    return solicitar<ListaAsistencia>(`${RUTA_SESIONES}/${sesionId}/asistencias`, {
      metodo: 'PUT',
      cuerpo: solicitud,
    })
  }

  function crear(solicitud: SolicitudSesionClase): Promise<unknown> {
    return solicitar(RUTA_SESIONES, { metodo: 'POST', cuerpo: solicitud })
  }

  function listarDocentes(): Promise<DocenteOpcion[]> {
    return solicitar<DocenteOpcion[]>('/api/v1/docentes')
  }

  async function listarAreas(): Promise<AreaOpcion[]> {
    const areas = await solicitar<AreaOpcion[]>('/api/v1/areas')
    return areas.filter((area) => area.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }

  return { listarMias, listar, obtenerLista, guardarAsistencias, crear, listarDocentes, listarAreas }
}
