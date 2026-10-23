import type { VarianteInsignia } from '~/types/interfaz'
import type {
  ErroresAperturaAnhio,
  EstadoPeriodoAcademico,
  PeriodoAcademico,
  ResumenAnhioEscolar,
  SolicitudAperturaAnhio,
} from '~/types/periodoAcademico'
import type { PeriodoMatricula } from '~/types/periodoMatricula'
import type { Seccion } from '~/types/seccion'
import { esFechaIsoValida } from '~/composables/useFechas'

export function obtenerAnhio(fechaIso: string): number {
  return Number(fechaIso.slice(0, 4))
}

/**
 * Año escolar que deben mostrar las pantallas de matrícula y vacantes, sin años fijos en el código:
 * 1) el de la fecha límite de la ventana de matrícula vigente o, si no hay, de la próxima;
 * 2) si no hay ventanas, el año más reciente que tenga periodos;
 * 3) si tampoco, el año del calendario.
 */
export function determinarAnhioEscolar(
  ventanas: PeriodoMatricula[],
  anhiosAbiertos: number[],
  fechaHoy: string,
): number {
  const vigente = ventanas.find((ventana) => ventana.estado === 'VIGENTE')
  const proxima = ventanas
    .filter((ventana) => ventana.estado === 'PENDIENTE')
    .sort((primera, segunda) => primera.fechaInicio.localeCompare(segunda.fechaInicio))[0]
  const ventana = vigente ?? proxima

  if (ventana) {
    return obtenerAnhio(ventana.fechaLimite)
  }

  return anhiosAbiertos.length > 0 ? Math.max(...anhiosAbiertos) : obtenerAnhio(fechaHoy)
}

export function obtenerAnhiosAbiertos(periodos: PeriodoAcademico[]): number[] {
  return [...new Set(periodos.map((periodo) => obtenerAnhio(periodo.fechaInicio)))].sort(
    (primero, segundo) => segundo - primero,
  )
}

export function calcularEstadoAnhio(fechaInicio: string, fechaFin: string, fechaHoy: string): EstadoPeriodoAcademico {
  if (fechaHoy < fechaInicio) {
    return 'PLANIFICADO'
  }

  return fechaHoy > fechaFin ? 'FINALIZADO' : 'EN_CURSO'
}

/** Fechas de clases del año: desde el primer inicio hasta el último fin de sus periodos. */
export function resumirAnhio(
  anhio: number,
  periodosDelAnhio: PeriodoAcademico[],
  fechaHoy: string,
): ResumenAnhioEscolar | null {
  if (periodosDelAnhio.length === 0) {
    return null
  }

  const fechaInicio = periodosDelAnhio.map((periodo) => periodo.fechaInicio).sort()[0]!
  const fechaFin = periodosDelAnhio
    .map((periodo) => periodo.fechaFin)
    .sort()
    .at(-1)!

  return { anhio, fechaInicio, fechaFin, estado: calcularEstadoAnhio(fechaInicio, fechaFin, fechaHoy) }
}

export function obtenerEtiquetaEstadoAnhio(estado: EstadoPeriodoAcademico): string {
  const etiquetas: Record<EstadoPeriodoAcademico, string> = {
    PLANIFICADO: 'Planificado',
    EN_CURSO: 'En curso',
    FINALIZADO: 'Finalizado',
  }

  return etiquetas[estado]
}

export function obtenerVarianteEstadoAnhio(estado: EstadoPeriodoAcademico): VarianteInsignia {
  const variantes: Record<EstadoPeriodoAcademico, VarianteInsignia> = {
    PLANIFICADO: 'informacion',
    EN_CURSO: 'exito',
    FINALIZADO: 'neutro',
  }

  return variantes[estado]
}

/**
 * Vacantes de cada sección en el año. Una sección puede tener más de un periodo en el mismo año,
 * pero el backend ya cuenta sus matrículas por año, así que basta una fila por sección.
 */
export function convertirEnSecciones(periodosDelAnhio: PeriodoAcademico[]): Seccion[] {
  const porSeccion = new Map<number, Seccion>()

  for (const periodo of periodosDelAnhio) {
    if (!porSeccion.has(periodo.seccionId)) {
      porSeccion.set(periodo.seccionId, {
        id: periodo.seccionId,
        gradoNumero: periodo.numeroGrado,
        nombre: periodo.seccion,
        vacantesTotales: periodo.vacantesTotales,
        cantidadMatriculados: periodo.matriculasActivas,
      })
    }
  }

  return [...porSeccion.values()].sort(
    (primera, segunda) => primera.gradoNumero - segunda.gradoNumero || primera.nombre.localeCompare(segunda.nombre),
  )
}

/** Secciones activas que todavía no tienen periodo en el año: son las que creará "Abrir año escolar". */
export function obtenerSeccionesPendientes(secciones: Seccion[], periodosDelAnhio: PeriodoAcademico[]): Seccion[] {
  const conPeriodo = new Set(periodosDelAnhio.map((periodo) => periodo.seccionId))
  return secciones.filter((seccion) => !conPeriodo.has(seccion.id))
}

export function validarAperturaAnhio(solicitud: SolicitudAperturaAnhio): ErroresAperturaAnhio {
  const errores: ErroresAperturaAnhio = {}

  if (!esFechaIsoValida(solicitud.fechaInicio)) {
    errores.fechaInicio = 'La fecha de inicio de clases es obligatoria.'
  } else if (obtenerAnhio(solicitud.fechaInicio) !== solicitud.anhio) {
    errores.fechaInicio = `Las clases deben empezar en ${solicitud.anhio}.`
  }

  if (!esFechaIsoValida(solicitud.fechaFin)) {
    errores.fechaFin = 'La fecha de fin de clases es obligatoria.'
  } else if (!errores.fechaInicio && solicitud.fechaFin <= solicitud.fechaInicio) {
    errores.fechaFin = 'El fin de clases debe ser posterior al inicio.'
  }

  return errores
}
