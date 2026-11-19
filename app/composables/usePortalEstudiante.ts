import { useApi } from '~/composables/useApi'
import { NOMBRES_ESTADO, resumirAsistencia } from '~/composables/usePortalFamilia'
import type { RegistroAsistencia, ResumenAsistencia } from '~/types/familia'
import type {
  CeldaCalendarioEstudiante,
  ClaseEstudiante,
  EstadoClaseEstudiante,
  FichaEstudiante,
  IncidenciaEstudiante,
} from '~/types/portalEstudiante'

const MESES_ESTUDIANTE = [
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

const DIAS_ESTUDIANTE = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export const SIMBOLOS_CLASE: Record<EstadoClaseEstudiante, string> = {
  PRESENTE: '✓',
  TARDANZA: 'T',
  AUSENTE: '✕',
  JUSTIFICADA: 'J',
  PENDIENTE_MARCAJE: '',
}

export const NOMBRES_CLASE: Record<EstadoClaseEstudiante, string> = {
  ...NOMBRES_ESTADO,
  AUSENTE: 'Falta',
  PENDIENTE_MARCAJE: 'Sin marcar',
}

function fechaLocal(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio ?? 1970, (mes ?? 1) - 1, dia ?? 1)
}

function fechaIso(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function plural(cantidad: number, singular: string, varios: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`
}

/** "2026-11" → primer y último día del mes. */
export function limitesMesEstudiante(mes: string): { desde: string; hasta: string } {
  const [anio, numero] = mes.split('-').map(Number) as [number, number]
  return { desde: fechaIso(anio, numero, 1), hasta: fechaIso(anio, numero, new Date(anio, numero, 0).getDate()) }
}

/** "2026-11" → "Noviembre 2026". */
export function nombrarMesEstudiante(mes: string, conAnio = true): string {
  const nombre = MESES_ESTUDIANTE[Number(mes.slice(5, 7)) - 1] ?? ''
  const capitalizado = nombre.charAt(0).toUpperCase() + nombre.slice(1)
  return conAnio ? `${capitalizado} ${mes.slice(0, 4)}` : nombre
}

/** "2026-11-16" → "Lunes 16 de noviembre". */
export function nombrarFechaEstudiante(fecha: string): string {
  const dia = DIAS_ESTUDIANTE[fechaLocal(fecha).getDay()] ?? ''
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${Number(fecha.slice(8, 10))} de ${nombrarMesEstudiante(fecha.slice(0, 7), false)}`
}

/** Meses ("yyyy-MM") cubiertos por los periodos del alumno, sin repetir y en orden. */
export function mesesDeLaFicha(ficha: FichaEstudiante): string[] {
  const meses = new Set<string>()
  for (const periodo of ficha.periodos) {
    const fin = periodo.fechaFin.slice(0, 7)
    let [anio, mes] = periodo.fechaInicio.split('-').map(Number) as [number, number]
    while (fechaIso(anio, mes, 1).slice(0, 7) <= fin) {
      meses.add(fechaIso(anio, mes, 1).slice(0, 7))
      mes++
      if (mes > 12) {
        mes = 1
        anio++
      }
    }
  }
  return [...meses].sort()
}

/** Mes con el que abre la pantalla: el actual si está en el año escolar; si no, el más cercano. */
export function mesInicialEstudiante(meses: string[], hoy: string): string | null {
  const actual = hoy.slice(0, 7)
  if (!meses.length) return null
  if (meses.includes(actual)) return actual
  const anteriores = meses.filter((mes) => mes < actual)
  return anteriores.at(-1) ?? meses[0] ?? null
}

/** Solo las clases ya marcadas cuentan en los totales. */
export function resumirClasesEstudiante(clases: ClaseEstudiante[]): ResumenAsistencia {
  return resumirAsistencia(clases.filter((clase): clase is RegistroAsistencia => clase.estado !== 'PENDIENTE_MARCAJE'))
}

/** Semanas de lunes a viernes del mes, con las clases de cada día ordenadas por hora. */
export function armarCalendarioEstudiante(
  mes: string,
  clases: ClaseEstudiante[],
  hoy: string,
): CeldaCalendarioEstudiante[] {
  const { hasta } = limitesMesEstudiante(mes)
  const ultimo = Number(hasta.slice(8, 10))
  const [anio, numero] = mes.split('-').map(Number) as [number, number]
  const porDia = new Map<string, ClaseEstudiante[]>()

  for (const clase of clases) {
    porDia.set(clase.fecha, [...(porDia.get(clase.fecha) ?? []), clase])
  }

  const celdas: CeldaCalendarioEstudiante[] = []
  for (let dia = 1; dia <= ultimo; dia++) {
    const fecha = fechaIso(anio, numero, dia)
    const diaSemana = fechaLocal(fecha).getDay()
    if (diaSemana === 0 || diaSemana === 6) continue
    if (!celdas.length) {
      for (let relleno = 1; relleno < diaSemana; relleno++) celdas.push(null)
    }
    celdas.push({
      fecha,
      numero: dia,
      clases: [...(porDia.get(fecha) ?? [])].sort((primera, segunda) =>
        primera.horaInicio.localeCompare(segunda.horaInicio),
      ),
      esHoy: fecha === hoy,
      esFuturo: fecha > hoy,
    })
  }
  return celdas
}

export function tieneIncidenciasClases(clases: ClaseEstudiante[]): boolean {
  return clases.some((clase) => clase.estado !== 'PRESENTE' && clase.estado !== 'PENDIENTE_MARCAJE')
}

/** Texto corto bajo los círculos del día: vacío si todo estuvo bien. */
export function resumirDiaEstudiante(clases: ClaseEstudiante[]): string {
  const resumen = resumirClasesEstudiante(clases)
  const pendientes = clases.filter((clase) => clase.estado === 'PENDIENTE_MARCAJE').length
  const partes = [
    resumen.AUSENTE ? plural(resumen.AUSENTE, 'falta', 'faltas') : '',
    resumen.TARDANZA ? plural(resumen.TARDANZA, 'tardanza', 'tardanzas') : '',
    resumen.JUSTIFICADA ? `${resumen.JUSTIFICADA} justif.` : '',
  ].filter(Boolean)
  if (partes.length) return partes.join(' · ')
  return pendientes ? `${pendientes} por marcar` : ''
}

/** Lectura completa del día para lectores de pantalla y el título emergente. */
export function describirDiaEstudiante(fecha: string, clases: ClaseEstudiante[]): string {
  const resumen = resumirClasesEstudiante(clases)
  const pendientes = clases.filter((clase) => clase.estado === 'PENDIENTE_MARCAJE').length
  const partes = [
    resumen.AUSENTE ? plural(resumen.AUSENTE, 'falta', 'faltas') : '',
    resumen.TARDANZA ? plural(resumen.TARDANZA, 'tardanza', 'tardanzas') : '',
    resumen.JUSTIFICADA ? plural(resumen.JUSTIFICADA, 'justificada', 'justificadas') : '',
    resumen.PRESENTE ? plural(resumen.PRESENTE, 'presente', 'presentes') : '',
    pendientes ? plural(pendientes, 'sin marcar', 'sin marcar') : '',
  ].filter(Boolean)
  return `${nombrarFechaEstudiante(fecha)}: ${partes.length ? partes.join(', ') : 'sin clases'}`
}

/** Faltas, tardanzas y justificaciones del más reciente al más antiguo. */
export function agruparIncidenciasEstudiante(clases: ClaseEstudiante[]): IncidenciaEstudiante[] {
  const incidencias: IncidenciaEstudiante[] = []
  const ordenadas = [...clases]
    .filter((clase) => clase.estado !== 'PRESENTE' && clase.estado !== 'PENDIENTE_MARCAJE')
    .sort(
      (primera, segunda) =>
        segunda.fecha.localeCompare(primera.fecha) || primera.horaInicio.localeCompare(segunda.horaInicio),
    )

  for (const clase of ordenadas) {
    const estado = clase.estado as IncidenciaEstudiante['estado']
    const motivo = clase.motivoJustificacion?.trim() || null
    const grupo =
      estado === 'JUSTIFICADA'
        ? incidencias.find(
            (incidencia) =>
              incidencia.estado === 'JUSTIFICADA' && incidencia.fecha === clase.fecha && incidencia.motivo === motivo,
          )
        : undefined
    if (grupo) {
      grupo.clases.push(clase)
    } else {
      incidencias.push({ clave: `${clase.asistenciaId}`, fecha: clase.fecha, estado, clases: [clase], motivo })
    }
  }
  return incidencias
}

/** "4 clases" o el nombre del área cuando la incidencia es de una sola clase. */
export function tituloIncidenciaEstudiante(incidencia: IncidenciaEstudiante): string {
  return incidencia.clases.length === 1
    ? (incidencia.clases[0]?.areaNombre ?? '')
    : plural(incidencia.clases.length, 'clase', 'clases')
}

/** Consultas del portal del estudiante. El back solo devuelve los datos del alumno autenticado. */
export function usePortalEstudiante() {
  const { solicitar } = useApi()

  function obtenerFicha(): Promise<FichaEstudiante> {
    return solicitar<FichaEstudiante>('/api/v1/estudiantes/mi-ficha')
  }

  function consultarClases(estudianteId: number, desde: string, hasta: string): Promise<ClaseEstudiante[]> {
    return solicitar<ClaseEstudiante[]>(
      `/api/v1/asistencias-estudiantes/${estudianteId}/historial?desde=${desde}&hasta=${hasta}`,
    )
  }

  return { obtenerFicha, consultarClases }
}
