import { useApi } from '~/composables/useApi'
import { esFechaIsoValida } from '~/composables/useFechas'
import type { VarianteInsignia } from '~/types/interfaz'
import type {
  AsistenciaDocente,
  ErroresMarcaje,
  EstadoAjustable,
  EstadoAsistenciaDocente,
  FormularioMarcaje,
  SolicitudAjusteAsistenciaDocente,
  SolicitudRegistroAsistenciaDocente,
} from '~/types/asistenciaDocente'

const RUTA = '/api/v1/asistencias-docentes'
export const LONGITUD_MAXIMA_MOTIVO = 500

export const ESTADOS_AJUSTABLES: { estado: EstadoAjustable; etiqueta: string }[] = [
  { estado: 'PRESENTE', etiqueta: 'Presente' },
  { estado: 'TARDANZA', etiqueta: 'Tardanza' },
  { estado: 'INASISTENCIA', etiqueta: 'Inasistencia' },
]

const ETIQUETAS: Record<EstadoAsistenciaDocente, string> = {
  PENDIENTE_MARCAJE: 'Pendiente',
  PRESENTE: 'Presente',
  TARDANZA: 'Tardanza',
  INASISTENCIA: 'Inasistencia',
}

const VARIANTES: Record<EstadoAsistenciaDocente, VarianteInsignia> = {
  PENDIENTE_MARCAJE: 'neutro',
  PRESENTE: 'exito',
  TARDANZA: 'advertencia',
  INASISTENCIA: 'error',
}

export function obtenerEtiquetaEstadoDocente(estado: EstadoAsistenciaDocente): string {
  return ETIQUETAS[estado]
}

export function obtenerVarianteEstadoDocente(estado: EstadoAsistenciaDocente): VarianteInsignia {
  return VARIANTES[estado]
}

/** El registro y el ajuste manual exigen motivo (criterio 2 de la HU 2.4); las horas solo aplican si asistió. */
export function validarMarcaje(formulario: FormularioMarcaje, esAjuste: boolean): ErroresMarcaje {
  const errores: ErroresMarcaje = {}
  const motivo = formulario.motivoAjuste.trim()

  if (!esAjuste) {
    if (!formulario.docenteId) errores.docenteId = 'Selecciona el docente.'
    if (!esFechaIsoValida(formulario.fecha)) errores.fecha = 'Ingresa la fecha.'
    if (formulario.estado !== 'INASISTENCIA') {
      if (!formulario.horaEntrada) {
        errores.horaEntrada = 'La hora de entrada es obligatoria si el docente asistió.'
      } else if (formulario.horaSalida && formulario.horaSalida < formulario.horaEntrada) {
        errores.horaSalida = 'La salida no puede ser anterior a la entrada.'
      }
    }
  }

  if (!motivo) {
    errores.motivoAjuste = 'Indica el motivo del registro manual.'
  } else if (motivo.length > LONGITUD_MAXIMA_MOTIVO) {
    errores.motivoAjuste = `El motivo no puede superar los ${LONGITUD_MAXIMA_MOTIVO} caracteres.`
  }

  return errores
}

export function construirRegistro(formulario: FormularioMarcaje): SolicitudRegistroAsistenciaDocente {
  const asistio = formulario.estado !== 'INASISTENCIA'
  return {
    docenteId: formulario.docenteId as number,
    fecha: formulario.fecha,
    estado: formulario.estado,
    horaEntrada: asistio && formulario.horaEntrada ? formulario.horaEntrada : null,
    horaSalida: asistio && formulario.horaSalida ? formulario.horaSalida : null,
    motivoAjuste: formulario.motivoAjuste.trim(),
  }
}

/** Acceso a la asistencia diaria de los docentes (HU 2.4). */
export function useAsistenciaDocente() {
  const { solicitar } = useApi()

  function listar(fecha: string, docenteId?: number): Promise<AsistenciaDocente[]> {
    const parametros = new URLSearchParams({ fecha })
    if (docenteId) parametros.set('docenteId', String(docenteId))
    return solicitar<AsistenciaDocente[]>(`${RUTA}?${parametros.toString()}`)
  }

  function registrar(solicitud: SolicitudRegistroAsistenciaDocente): Promise<AsistenciaDocente> {
    return solicitar<AsistenciaDocente>(RUTA, { metodo: 'POST', cuerpo: solicitud })
  }

  function ajustar(id: number, solicitud: SolicitudAjusteAsistenciaDocente): Promise<AsistenciaDocente> {
    return solicitar<AsistenciaDocente>(`${RUTA}/${id}`, { metodo: 'PATCH', cuerpo: solicitud })
  }

  return { listar, registrar, ajustar }
}
