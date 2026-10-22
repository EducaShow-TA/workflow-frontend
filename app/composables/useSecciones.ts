import { useApi } from '~/composables/useApi'
import { copiarDatos, crearErrorPrueba, esperarLatencia, usarDatosPrueba } from '~/composables/useDatosPrueba'
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

// Datos de prueba: mismas secciones y cantidades que usa la pantalla de matricula, para que coincidan.
let siguienteIdPrueba = 11

const seccionesPrueba: Seccion[] = [
  { id: 1, gradoNumero: 1, nombre: 'A', vacantesTotales: 30, cantidadMatriculados: 28 },
  { id: 2, gradoNumero: 1, nombre: 'B', vacantesTotales: 30, cantidadMatriculados: 30 },
  { id: 3, gradoNumero: 2, nombre: 'A', vacantesTotales: 30, cantidadMatriculados: 24 },
  { id: 4, gradoNumero: 2, nombre: 'B', vacantesTotales: 30, cantidadMatriculados: 27 },
  { id: 5, gradoNumero: 3, nombre: 'A', vacantesTotales: 30, cantidadMatriculados: 28 },
  { id: 6, gradoNumero: 3, nombre: 'B', vacantesTotales: 30, cantidadMatriculados: 30 },
  { id: 7, gradoNumero: 4, nombre: 'A', vacantesTotales: 30, cantidadMatriculados: 20 },
  { id: 8, gradoNumero: 4, nombre: 'B', vacantesTotales: 30, cantidadMatriculados: 29 },
  { id: 9, gradoNumero: 5, nombre: 'A', vacantesTotales: 30, cantidadMatriculados: 26 },
  { id: 10, gradoNumero: 5, nombre: 'B', vacantesTotales: 30, cantidadMatriculados: 25 },
]

/** Acceso a las secciones y sus vacantes (US-1.7). */
export function useSecciones() {
  const { solicitar } = useApi()

  async function listarSecciones(): Promise<Seccion[]> {
    if (usarDatosPrueba('secciones')) {
      await esperarLatencia()
      return ordenarSecciones(copiarDatos(seccionesPrueba))
    }

    return ordenarSecciones(await solicitar<Seccion[]>(RUTA_SECCIONES))
  }

  async function registrarSeccion(solicitud: SolicitudSeccion): Promise<Seccion> {
    if (usarDatosPrueba('secciones')) {
      await esperarLatencia()

      const errores = validarSeccion(solicitud, seccionesPrueba)
      const primerError = obtenerPrimerError(errores)

      if (existeSeccion(solicitud, seccionesPrueba)) {
        throw crearErrorPrueba(primerError, 409, RUTA_SECCIONES)
      }

      if (primerError) {
        throw crearErrorPrueba(primerError, 422, RUTA_SECCIONES)
      }

      const nueva: Seccion = { id: siguienteIdPrueba++, ...solicitud, cantidadMatriculados: 0 }
      seccionesPrueba.push(nueva)
      return copiarDatos(nueva)
    }

    return solicitar<Seccion>(RUTA_SECCIONES, { metodo: 'POST', cuerpo: solicitud })
  }

  /** Equivale a Seccion.actualizarVacantes(nuevasVacantes) (US-1.7, criterio 2). */
  async function actualizarVacantes(id: number, solicitud: SolicitudActualizarVacantes): Promise<Seccion> {
    const ruta = `${RUTA_SECCIONES}/${id}`

    if (usarDatosPrueba('secciones')) {
      await esperarLatencia()

      const seccion = seccionesPrueba.find((actual) => actual.id === id)

      if (!seccion) {
        throw crearErrorPrueba('La sección no existe.', 404, ruta)
      }

      const error = validarNuevaCapacidad(solicitud.vacantesTotales, seccion.cantidadMatriculados)

      if (error) {
        throw crearErrorPrueba(error, 422, ruta)
      }

      seccion.vacantesTotales = solicitud.vacantesTotales
      return copiarDatos(seccion)
    }

    return solicitar<Seccion>(ruta, { metodo: 'PATCH', cuerpo: solicitud })
  }

  return {
    listarSecciones,
    registrarSeccion,
    actualizarVacantes,
  }
}
