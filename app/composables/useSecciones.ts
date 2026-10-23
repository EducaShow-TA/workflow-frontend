import { useApi } from '~/composables/useApi'
import { obtenerPrimerError } from '~/composables/useValidacion'
import type { VarianteInsignia } from '~/types/interfaz'
import type {
  ErroresSeccion,
  EstadoCupos,
  Seccion,
  SolicitudActualizarVacantes,
  SolicitudSeccion,
} from '~/types/seccion'

const RUTA_SECCIONES = '/api/v1/secciones'

export const GRADOS_SECUNDARIA = [1, 2, 3, 4, 5] as const

/** Con esta cantidad de vacantes o menos, la seccion se muestra como "Pocos cupos". */
export const UMBRAL_POCAS_VACANTES = 2

const FORMATO_NOMBRE_SECCION = /^[A-Z]{1,2}$/

/** Equivale a Seccion.getVacantesDisponibles(): capacidad maxima - alumnos matriculados (US-1.7, criterio 3). */
export function calcularVacantesDisponibles(
  seccion: Pick<Seccion, 'vacantesTotales' | 'cantidadMatriculados'>,
): number {
  return Math.max(0, seccion.vacantesTotales - seccion.cantidadMatriculados)
}

export function calcularPorcentajeOcupacion(
  seccion: Pick<Seccion, 'vacantesTotales' | 'cantidadMatriculados'>,
): number {
  if (seccion.vacantesTotales <= 0) {
    return 0
  }

  return Math.min(100, Math.round((seccion.cantidadMatriculados / seccion.vacantesTotales) * 100))
}

export function obtenerEstadoCupos(vacantesDisponibles: number): EstadoCupos {
  if (vacantesDisponibles <= 0) {
    return 'agotado'
  }

  return vacantesDisponibles <= UMBRAL_POCAS_VACANTES ? 'limitado' : 'disponible'
}

export function obtenerEtiquetaEstadoCupos(estado: EstadoCupos): string {
  const etiquetas: Record<EstadoCupos, string> = {
    disponible: 'Disponible',
    limitado: 'Pocos cupos',
    agotado: 'Sin vacantes',
  }

  return etiquetas[estado]
}

export function obtenerVarianteEstadoCupos(estado: EstadoCupos): VarianteInsignia {
  const variantes: Record<EstadoCupos, VarianteInsignia> = {
    disponible: 'exito',
    limitado: 'advertencia',
    agotado: 'error',
  }

  return variantes[estado]
}

/** Convierte Grado.numero en el texto usado en pantalla, igual que en la pantalla de matricula. */
export function obtenerNombreGrado(gradoNumero: number): string {
  const ordinales: Record<number, string> = { 1: '1ro', 2: '2do', 3: '3ro', 4: '4to', 5: '5to' }
  return `${ordinales[gradoNumero] ?? `${gradoNumero}.º`} Secundaria`
}

function esEnteroPositivo(valor: number): boolean {
  return Number.isInteger(valor) && valor > 0
}

/**
 * La nueva capacidad no puede ser menor que los alumnos ya matriculados (US-1.7, criterio 2).
 * Devuelve el mensaje de error o una cadena vacia si es valida.
 */
export function validarNuevaCapacidad(nuevaCapacidad: number, cantidadMatriculados: number): string {
  if (!esEnteroPositivo(nuevaCapacidad)) {
    return 'La capacidad debe ser un número entero mayor que cero.'
  }

  if (nuevaCapacidad < cantidadMatriculados) {
    return `La capacidad no puede ser menor que los ${cantidadMatriculados} alumnos ya matriculados.`
  }

  return ''
}

export function existeSeccion(
  solicitud: Pick<SolicitudSeccion, 'gradoNumero' | 'nombre'>,
  seccionesExistentes: Seccion[],
): boolean {
  return seccionesExistentes.some(
    (seccion) => seccion.gradoNumero === solicitud.gradoNumero && seccion.nombre === solicitud.nombre,
  )
}

export function validarSeccion(solicitud: SolicitudSeccion, seccionesExistentes: Seccion[] = []): ErroresSeccion {
  const errores: ErroresSeccion = {}

  if (!(GRADOS_SECUNDARIA as readonly number[]).includes(solicitud.gradoNumero)) {
    errores.gradoNumero = 'Selecciona un grado de 1ro a 5to de secundaria.'
  }

  if (!FORMATO_NOMBRE_SECCION.test(solicitud.nombre)) {
    errores.nombre = 'La sección debe ser una o dos letras mayúsculas, por ejemplo A.'
  } else if (existeSeccion(solicitud, seccionesExistentes)) {
    errores.nombre = `La sección ${solicitud.nombre} ya existe en ${obtenerNombreGrado(solicitud.gradoNumero)}.`
  }

  if (!esEnteroPositivo(solicitud.vacantesTotales)) {
    errores.vacantesTotales = 'La capacidad debe ser un número entero mayor que cero.'
  }

  return errores
}

export function ordenarSecciones(secciones: Seccion[]): Seccion[] {
  return [...secciones].sort(
    (primera, segunda) => primera.gradoNumero - segunda.gradoNumero || primera.nombre.localeCompare(segunda.nombre),
  )
}

/** Acceso a las secciones y sus vacantes (US-1.7). */
export function useSecciones() {
  const { solicitar } = useApi()

  async function listarSecciones(): Promise<Seccion[]> {
    return ordenarSecciones(await solicitar<Seccion[]>(RUTA_SECCIONES))
  }

  async function registrarSeccion(solicitud: SolicitudSeccion): Promise<Seccion> {
    return solicitar<Seccion>(RUTA_SECCIONES, { metodo: 'POST', cuerpo: solicitud })
  }

  /** Equivale a Seccion.actualizarVacantes(nuevasVacantes) (US-1.7, criterio 2). */
  async function actualizarVacantes(id: number, solicitud: SolicitudActualizarVacantes): Promise<Seccion> {
    const ruta = `${RUTA_SECCIONES}/${id}`

    return solicitar<Seccion>(ruta, { metodo: 'PATCH', cuerpo: solicitud })
  }

  return {
    listarSecciones,
    registrarSeccion,
    actualizarVacantes,
  }
}
