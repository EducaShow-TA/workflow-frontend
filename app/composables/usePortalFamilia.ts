import { useApi } from '~/composables/useApi'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type {
  AtajoRango,
  DiaAsistencia,
  EstadoAsistenciaHijo,
  HijoVinculado,
  PeriodoVinculado,
  RespuestaJustificacionAsistencia,
  RegistroAsistencia,
  ResumenAsistencia,
} from '~/types/familia'

export const ESTADOS_ASISTENCIA: EstadoAsistenciaHijo[] = ['PRESENTE', 'TARDANZA', 'AUSENTE', 'JUSTIFICADA']

export const NOMBRES_ESTADO: Record<EstadoAsistenciaHijo, string> = {
  PRESENTE: 'Presente',
  TARDANZA: 'Tardanza',
  AUSENTE: 'Ausente',
  JUSTIFICADA: 'Justificada',
}

export const VARIANTES_ESTADO: Record<EstadoAsistenciaHijo, 'exito' | 'advertencia' | 'error' | 'informacion'> = {
  PRESENTE: 'exito',
  TARDANZA: 'advertencia',
  AUSENTE: 'error',
  JUSTIFICADA: 'informacion',
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function aIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

function desdeIso(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio ?? 1970, (mes ?? 1) - 1, dia ?? 1)
}

/** Rango [desde, hasta] de cada atajo, contado desde hoy (la semana empieza el lunes). */
export function calcularRango(atajo: AtajoRango, hoy: string): { desde: string; hasta: string } {
  const fecha = desdeIso(hoy)

  if (atajo === 'SEMANA') {
    const lunes = new Date(fecha)
    lunes.setDate(fecha.getDate() - ((fecha.getDay() + 6) % 7))
    return { desde: aIso(lunes), hasta: hoy }
  }
  if (atajo === 'MES_ANTERIOR') {
    const inicio = new Date(fecha.getFullYear(), fecha.getMonth() - 1, 1)
    const fin = new Date(fecha.getFullYear(), fecha.getMonth(), 0)
    return { desde: aIso(inicio), hasta: aIso(fin) }
  }
  if (atajo === 'ANIO') {
    return { desde: `${fecha.getFullYear()}-01-01`, hasta: hoy }
  }
  return { desde: aIso(new Date(fecha.getFullYear(), fecha.getMonth(), 1)), hasta: hoy }
}

/** Presente + tardanza + justificada sobre el total de clases: la tardanza y la justificada cuentan como asistidas. */
export function resumirAsistencia(registros: RegistroAsistencia[]): ResumenAsistencia {
  const resumen: ResumenAsistencia = {
    total: 0,
    PRESENTE: 0,
    TARDANZA: 0,
    AUSENTE: 0,
    JUSTIFICADA: 0,
    porcentaje: null,
  }

  for (const registro of registros) {
    resumen.total++
    resumen[registro.estado]++
  }
  if (resumen.total) {
    resumen.porcentaje = Math.round(((resumen.total - resumen.AUSENTE) / resumen.total) * 100)
  }
  return resumen
}

/** Agrupa las clases por día, del más reciente al más antiguo, y dentro del día por hora. */
export function agruparPorDia(registros: RegistroAsistencia[]): DiaAsistencia[] {
  const dias = new Map<string, RegistroAsistencia[]>()

  for (const registro of registros) {
    dias.set(registro.fecha, [...(dias.get(registro.fecha) ?? []), registro])
  }

  return [...dias.entries()]
    .sort(([primera], [segunda]) => segunda.localeCompare(primera))
    .map(([fecha, delDia]) => {
      const ordenados = [...delDia].sort((primero, segundo) => primero.horaInicio.localeCompare(segundo.horaInicio))
      return { fecha, registros: ordenados, resumen: resumirAsistencia(ordenados) }
    })
}

export function tieneIncidencias(dia: DiaAsistencia): boolean {
  return dia.resumen.PRESENTE < dia.resumen.total
}

/** "2026-11-16" → "Lunes 16/11/2026". */
export function nombrarDia(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  return `${DIAS[desdeIso(fecha).getDay()]} ${dia}/${mes}/${anio}`
}

export function horaDeClaseFamilia(hora: string): string {
  return hora.slice(0, 5)
}

/** Periodo del hijo que contiene la fecha; si ninguno, el más reciente. */
export function periodoVigente(hijo: HijoVinculado, hoy: string): PeriodoVinculado | undefined {
  const ordenados = [...hijo.periodos].sort((primero, segundo) =>
    segundo.fechaInicio.localeCompare(primero.fechaInicio),
  )
  return ordenados.find((periodo) => periodo.fechaInicio <= hoy && hoy <= periodo.fechaFin) ?? ordenados[0]
}

export function describirSeccionHijo(periodo: PeriodoVinculado | undefined): string {
  return periodo ? `${periodo.gradoNumero}.° grado · Sección ${periodo.seccion}` : 'Sin matrícula registrada'
}

/** Consultas del portal del apoderado. El back limita todo a los hijos vinculados a su cuenta. */
export function usePortalFamilia() {
  const { solicitar } = useApi()
  const autenticacion = useAutenticacionStore()
  const configuracion = useRuntimeConfig()

  function listarHijos(): Promise<HijoVinculado[]> {
    return solicitar<HijoVinculado[]>('/api/v1/apoderados/mis-estudiantes')
  }

  /** Las clases que el docente aún no marca no son asistencia todavía, así que no se muestran. */
  async function consultarAsistencia(
    estudianteId: number,
    desde: string,
    hasta: string,
  ): Promise<RegistroAsistencia[]> {
    const registros = await solicitar<RegistroAsistencia[]>(
      `/api/v1/asistencias-estudiantes/${estudianteId}/historial?desde=${desde}&hasta=${hasta}`,
    )
    return registros.filter((registro) => ESTADOS_ASISTENCIA.includes(registro.estado))
  }

  function justificarAsistencia(asistenciaId: number, motivo: string, documento: File) {
    const formulario = new FormData()
    formulario.append('motivo', motivo)
    formulario.append('documento', documento, documento.name)
    return solicitar<RespuestaJustificacionAsistencia>(
      `/api/v1/asistencias-estudiantes/${asistenciaId}/justificacion`,
      { metodo: 'PATCH', cuerpo: formulario },
    )
  }

  /** El documento pide el token de sesión, así que se descarga con fetch y no con un enlace directo. */
  async function descargarDocumento(registro: Pick<RegistroAsistencia, 'asistenciaId'>): Promise<Blob> {
    const base = String(configuracion.public.apiBase || '').replace(/\/+$/, '')
    const respuesta = await fetch(
      `${base}/api/v1/asistencias-estudiantes/${registro.asistenciaId}/justificacion/documento`,
      {
        headers: autenticacion.token ? { Authorization: `Bearer ${autenticacion.token}` } : {},
        cache: 'no-store',
      },
    )
    if (!respuesta.ok) {
      if (respuesta.status === 401) autenticacion.cerrarSesion()
      const detalle: unknown = await respuesta.json().catch(() => null)
      const mensaje = detalle && typeof detalle === 'object' && 'message' in detalle ? detalle.message : null
      throw new Error(typeof mensaje === 'string' ? mensaje : 'No se pudo descargar el documento.')
    }
    return respuesta.blob()
  }

  return { listarHijos, consultarAsistencia, justificarAsistencia, descargarDocumento }
}
