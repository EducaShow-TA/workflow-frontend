import { useApi } from '~/composables/useApi'
import { copiarDatos, crearErrorPrueba, esperarLatencia, usarDatosPrueba } from '~/composables/useDatosPrueba'
import { obtenerPrimerError } from '~/composables/useValidacion'
import type {
  AmbitoFiltro,
  Area,
  Competencia,
  ErroresArea,
  ErroresCompetencia,
  FiltroEstado,
  SolicitudArea,
  SolicitudCompetencia,
  SolicitudNuevaArea,
} from '~/types/competencia'

const RUTA_AREAS = '/api/v1/areas'
const RUTA_COMPETENCIAS = '/api/v1/competencias'

export const LONGITUD_MAXIMA_NOMBRE = 150
export const LONGITUD_MAXIMA_DESCRIPCION = 500

/** Quita espacios repetidos al inicio, al final y entre palabras. */
export function limpiarTexto(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}

/** Version del texto para comparar nombres sin distinguir mayusculas, tildes ni espacios repetidos. */
export function normalizarParaComparar(texto: string): string {
  return limpiarTexto(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function existeAreaConNombre(nombre: string, areas: Area[], idEnEdicion: number | null = null): boolean {
  const buscado = normalizarParaComparar(nombre)
  return areas.some((area) => area.id !== idEnEdicion && normalizarParaComparar(area.nombre) === buscado)
}

/** Los nombres de competencia son unicos dentro de cada area; en areas distintas pueden repetirse. */
export function existeCompetenciaEnArea(
  nombre: string,
  area: Pick<Area, 'competencias'>,
  idEnEdicion: number | null = null,
): boolean {
  const buscado = normalizarParaComparar(nombre)
  return area.competencias.some(
    (competencia) => competencia.id !== idEnEdicion && normalizarParaComparar(competencia.nombre) === buscado,
  )
}

function validarTexto(valor: string, etiqueta: string, longitudMaxima: number, obligatorio: boolean): string {
  const limpio = limpiarTexto(valor)

  if (obligatorio && !limpio) {
    return `${etiqueta} es obligatorio.`
  }

  if (limpio.length > longitudMaxima) {
    return `${etiqueta} no puede superar los ${longitudMaxima} caracteres.`
  }

  return ''
}

export function validarArea(
  solicitud: SolicitudArea,
  areasExistentes: Area[] = [],
  idEnEdicion: number | null = null,
): ErroresArea {
  const errores: ErroresArea = {}

  const errorNombre = validarTexto(solicitud.nombre, 'El nombre del área', LONGITUD_MAXIMA_NOMBRE, true)

  if (errorNombre) {
    errores.nombre = errorNombre
  } else if (existeAreaConNombre(solicitud.nombre, areasExistentes, idEnEdicion)) {
    const buscado = normalizarParaComparar(solicitud.nombre)
    const existente = areasExistentes.find((area) => normalizarParaComparar(area.nombre) === buscado)
    errores.nombre = `Ya existe el área «${existente?.nombre ?? limpiarTexto(solicitud.nombre)}».`
  }

  const errorDescripcion = validarTexto(solicitud.descripcion, 'La descripción', LONGITUD_MAXIMA_DESCRIPCION, false)

  if (errorDescripcion) {
    errores.descripcion = errorDescripcion
  }

  return errores
}

export function validarCompetencia(
  solicitud: SolicitudCompetencia,
  area: Pick<Area, 'nombre' | 'competencias'> | null = null,
  idEnEdicion: number | null = null,
): ErroresCompetencia {
  const errores: ErroresCompetencia = {}

  const errorNombre = validarTexto(solicitud.nombre, 'El nombre de la competencia', LONGITUD_MAXIMA_NOMBRE, true)

  if (errorNombre) {
    errores.nombre = errorNombre
  } else if (area && existeCompetenciaEnArea(solicitud.nombre, area, idEnEdicion)) {
    errores.nombre = `Esta competencia ya existe en el área ${area.nombre}.`
  }

  const errorDescripcion = validarTexto(solicitud.descripcion, 'La descripción', LONGITUD_MAXIMA_DESCRIPCION, false)

  if (errorDescripcion) {
    errores.descripcion = errorDescripcion
  }

  return errores
}

/** Minimo de competencias con el que se crea un area (multiplicidad 1..* de la asociacion "agrupa"). */
export const MINIMO_COMPETENCIAS_POR_AREA = 1

/** Mensaje si ninguna competencia de la lista tiene nombre; cadena vacia si hay al menos una. */
export function validarMinimoCompetencias(competencias: SolicitudCompetencia[]): string {
  const registradas = competencias.filter((competencia) => limpiarTexto(competencia.nombre)).length

  return registradas >= MINIMO_COMPETENCIAS_POR_AREA
    ? ''
    : 'Debes registrar como mínimo una competencia para crear el área.'
}

/**
 * Valida las competencias que se registran junto con un area nueva.
 * Devuelve un objeto de errores por cada competencia, en el mismo orden; los nombres no se pueden repetir
 * dentro de la lista, porque todas perteneceran a la misma area.
 */
export function validarCompetenciasNuevas(competencias: SolicitudCompetencia[]): ErroresCompetencia[] {
  return competencias.map((competencia, indice) => {
    const errores = validarCompetencia(competencia)

    if (errores.nombre) {
      return errores
    }

    const buscado = normalizarParaComparar(competencia.nombre)
    const posicionAnterior = competencias
      .slice(0, indice)
      .findIndex((anterior) => normalizarParaComparar(anterior.nombre) === buscado)

    if (posicionAnterior !== -1) {
      errores.nombre = `Competencia repetida: es igual a la competencia ${posicionAnterior + 1}.`
    }

    return errores
  })
}

/**
 * Motivo por el que una competencia no se puede eliminar, o cadena vacia si se puede.
 * - Con notas registradas solo se puede desactivar (US-3.5, criterio 2).
 * - La ultima competencia de un area no se elimina, porque toda area agrupa al menos una (1..*).
 */
export function obtenerMotivoNoEliminable(
  competencia: Pick<Competencia, 'tieneNotasRegistradas'>,
  cantidadCompetenciasArea: number,
): string {
  if (competencia.tieneNotasRegistradas) {
    return 'Tiene notas registradas: solo se puede desactivar.'
  }

  if (cantidadCompetenciasArea <= 1) {
    return 'Es la única competencia del área; toda área debe tener al menos una.'
  }

  return ''
}

function cumpleEstado(activo: boolean, estado: FiltroEstado): boolean {
  if (estado === 'ACTIVOS') {
    return activo
  }

  return estado === 'INACTIVOS' ? !activo : true
}

function coincideTexto(nombre: string, buscado: string): boolean {
  return !buscado || normalizarParaComparar(nombre).includes(buscado)
}

/** Ambito "Areas": el texto y el estado se aplican al area, que se muestra con todas sus competencias. */
function filtrarPorArea(areas: Area[], buscado: string, estado: FiltroEstado): Area[] {
  return areas.filter((area) => coincideTexto(area.nombre, buscado) && cumpleEstado(area.activo, estado))
}

/** Ambito "Competencias": el texto y el estado se aplican a cada competencia, agrupada bajo su area. */
function filtrarPorCompetencia(areas: Area[], buscado: string, estado: FiltroEstado): Area[] {
  return areas
    .map((area) => ({
      ...area,
      competencias: area.competencias.filter(
        (competencia) => coincideTexto(competencia.nombre, buscado) && cumpleEstado(competencia.activo, estado),
      ),
    }))
    .filter((area) => area.competencias.length > 0)
}

/**
 * Ambito "Ambas": un area aparece completa si ella cumple el texto y el estado; si no, aparece solo con
 * las competencias que los cumplen. Asi "Inactivos" muestra las areas inactivas y las competencias
 * inactivas de areas activas.
 */
function filtrarPorAmbas(areas: Area[], buscado: string, estado: FiltroEstado): Area[] {
  const resultado: Area[] = []

  for (const area of areas) {
    if (coincideTexto(area.nombre, buscado) && cumpleEstado(area.activo, estado)) {
      const competencias =
        estado === 'TODOS' || !area.activo
          ? area.competencias
          : area.competencias.filter((competencia) => cumpleEstado(competencia.activo, estado))
      resultado.push({ ...area, competencias })
      continue
    }

    const competencias = area.competencias.filter(
      (competencia) =>
        (coincideTexto(area.nombre, buscado) || coincideTexto(competencia.nombre, buscado)) &&
        cumpleEstado(competencia.activo, estado) &&
        (estado !== 'ACTIVOS' || area.activo),
    )

    if (competencias.length > 0) {
      resultado.push({ ...area, competencias })
    }
  }

  return resultado
}

/** Filtra el catalogo por texto y estado, aplicados a areas, a competencias o a ambas. */
export function filtrarAreas(areas: Area[], texto: string, estado: FiltroEstado, ambito: AmbitoFiltro): Area[] {
  const buscado = normalizarParaComparar(texto)

  if (ambito === 'AREAS') {
    return filtrarPorArea(areas, buscado, estado)
  }

  if (ambito === 'COMPETENCIAS') {
    return filtrarPorCompetencia(areas, buscado, estado)
  }

  return filtrarPorAmbas(areas, buscado, estado)
}

export function calcularResumenCatalogo(areas: Area[]): {
  areasActivas: number
  areasInactivas: number
  competenciasActivas: number
  competenciasInactivas: number
} {
  const competencias = areas.flatMap((area) => area.competencias)

  return {
    areasActivas: areas.filter((area) => area.activo).length,
    areasInactivas: areas.filter((area) => !area.activo).length,
    competenciasActivas: competencias.filter((competencia) => competencia.activo).length,
    competenciasInactivas: competencias.filter((competencia) => !competencia.activo).length,
  }
}

export function ordenarAreas(areas: Area[]): Area[] {
  return [...areas].sort((primera, segunda) => primera.nombre.localeCompare(segunda.nombre, 'es'))
}

function limpiarSolicitudCompetencia(solicitud: SolicitudCompetencia): SolicitudCompetencia {
  return { nombre: limpiarTexto(solicitud.nombre), descripcion: limpiarTexto(solicitud.descripcion) }
}

// Datos de prueba basados en el Curriculo Nacional de Educacion Basica (CNEB), nivel secundaria.
let siguienteIdArea = 6
let siguienteIdCompetencia = 15

function crearCompetenciaPrueba(
  id: number,
  areaId: number,
  nombre: string,
  descripcion: string,
  tieneNotasRegistradas = false,
  activo = true,
): Competencia {
  return { id, areaId, nombre, descripcion, activo, tieneNotasRegistradas }
}

const areasPrueba: Area[] = [
  {
    id: 1,
    nombre: 'Matemática',
    descripcion: 'Desarrolla el pensamiento matemático para resolver problemas en diversos contextos.',
    activo: true,
    competencias: [
      crearCompetenciaPrueba(
        1,
        1,
        'Resuelve problemas de cantidad',
        'Traduce cantidades a expresiones numéricas y usa estrategias de cálculo.',
        true,
      ),
      crearCompetenciaPrueba(
        2,
        1,
        'Resuelve problemas de regularidad, equivalencia y cambio',
        'Traduce datos y condiciones a expresiones algebraicas y gráficas.',
        true,
      ),
      crearCompetenciaPrueba(
        3,
        1,
        'Resuelve problemas de forma, movimiento y localización',
        'Modela objetos con formas geométricas y sus transformaciones.',
      ),
      crearCompetenciaPrueba(
        4,
        1,
        'Resuelve problemas de gestión de datos e incertidumbre',
        'Representa datos con gráficos y medidas estadísticas o probabilísticas.',
      ),
    ],
  },
  {
    id: 2,
    nombre: 'Comunicación',
    descripcion: 'Desarrolla las competencias comunicativas en la lengua materna.',
    activo: true,
    competencias: [
      crearCompetenciaPrueba(
        5,
        2,
        'Se comunica oralmente en su lengua materna',
        'Obtiene, infiere e interpreta información de textos orales.',
        true,
      ),
      crearCompetenciaPrueba(
        6,
        2,
        'Lee diversos tipos de textos escritos en su lengua materna',
        'Obtiene información del texto escrito y reflexiona sobre su forma y contenido.',
      ),
      crearCompetenciaPrueba(
        7,
        2,
        'Escribe diversos tipos de textos en su lengua materna',
        'Adecúa, organiza y desarrolla ideas de forma coherente y cohesionada.',
      ),
    ],
  },
  {
    id: 3,
    nombre: 'Inglés como lengua extranjera',
    descripcion: 'Desarrolla la comunicación en inglés como lengua extranjera.',
    activo: true,
    competencias: [
      crearCompetenciaPrueba(
        8,
        3,
        'Se comunica oralmente en inglés como lengua extranjera',
        'Interactúa estratégicamente con distintos interlocutores en inglés.',
      ),
      crearCompetenciaPrueba(
        9,
        3,
        'Lee diversos tipos de textos escritos en inglés como lengua extranjera',
        'Infiere e interpreta información de textos escritos en inglés.',
      ),
      crearCompetenciaPrueba(
        10,
        3,
        'Escribe diversos tipos de textos en inglés como lengua extranjera',
        'Organiza y desarrolla ideas en textos escritos en inglés.',
        false,
        false,
      ),
    ],
  },
  {
    id: 4,
    nombre: 'Ciencia y Tecnología',
    descripcion: 'Desarrolla la indagación científica y la alfabetización tecnológica.',
    activo: true,
    competencias: [
      crearCompetenciaPrueba(
        11,
        4,
        'Indaga mediante métodos científicos para construir sus conocimientos',
        'Problematiza situaciones, diseña estrategias y analiza datos.',
      ),
      crearCompetenciaPrueba(
        12,
        4,
        'Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo',
        'Comprende y usa conocimientos científicos para explicar fenómenos.',
      ),
      crearCompetenciaPrueba(
        13,
        4,
        'Diseña y construye soluciones tecnológicas para resolver problemas de su entorno',
        'Determina, diseña, implementa y evalúa alternativas de solución tecnológica.',
      ),
    ],
  },
  {
    id: 5,
    nombre: 'Educación para el Trabajo',
    descripcion: 'Desarrolla capacidades para el emprendimiento económico o social.',
    activo: false,
    competencias: [
      crearCompetenciaPrueba(
        14,
        5,
        'Gestiona proyectos de emprendimiento económico o social',
        'Crea propuestas de valor y trabaja cooperativamente para lograr objetivos.',
      ),
    ],
  },
]

function buscarAreaPrueba(id: number, ruta: string): Area {
  const area = areasPrueba.find((actual) => actual.id === id)

  if (!area) {
    throw crearErrorPrueba('El área no existe.', 404, ruta)
  }

  return area
}

function buscarCompetenciaPrueba(id: number, ruta: string): { area: Area; competencia: Competencia } {
  for (const area of areasPrueba) {
    const competencia = area.competencias.find((actual) => actual.id === id)

    if (competencia) {
      return { area, competencia }
    }
  }

  throw crearErrorPrueba('La competencia no existe.', 404, ruta)
}

function lanzarErroresPrueba(errores: Record<string, string | undefined>, esDuplicado: boolean, ruta: string): void {
  const primerError = obtenerPrimerError(errores)

  if (primerError) {
    throw crearErrorPrueba(primerError, esDuplicado ? 409 : 422, ruta)
  }
}

/** Acceso al catalogo de areas curriculares y competencias (US-3.5). */
export function useCompetencias() {
  const { solicitar } = useApi()

  async function listarAreas(): Promise<Area[]> {
    if (usarDatosPrueba()) {
      await esperarLatencia()
      return ordenarAreas(copiarDatos(areasPrueba))
    }

    return ordenarAreas(await solicitar<Area[]>(RUTA_AREAS))
  }

  async function registrarArea(solicitud: SolicitudNuevaArea): Promise<Area> {
    const cuerpo: SolicitudNuevaArea = {
      nombre: limpiarTexto(solicitud.nombre),
      descripcion: limpiarTexto(solicitud.descripcion),
      competencias: solicitud.competencias.map(limpiarSolicitudCompetencia),
    }

    if (usarDatosPrueba()) {
      await esperarLatencia()

      const errorMinimo = validarMinimoCompetencias(cuerpo.competencias)

      if (errorMinimo) {
        throw crearErrorPrueba(errorMinimo, 422, RUTA_AREAS)
      }

      lanzarErroresPrueba(validarArea(cuerpo, areasPrueba), existeAreaConNombre(cuerpo.nombre, areasPrueba), RUTA_AREAS)
      const erroresCompetencias = validarCompetenciasNuevas(cuerpo.competencias)
      // Una competencia repetida dentro de la misma solicitud es un dato invalido (422), no un conflicto (409).
      erroresCompetencias.forEach((errores) => lanzarErroresPrueba(errores, false, RUTA_AREAS))

      const idArea = siguienteIdArea++
      const nueva: Area = {
        id: idArea,
        nombre: cuerpo.nombre,
        descripcion: cuerpo.descripcion,
        activo: true,
        competencias: cuerpo.competencias.map((competencia) =>
          crearCompetenciaPrueba(siguienteIdCompetencia++, idArea, competencia.nombre, competencia.descripcion),
        ),
      }

      areasPrueba.push(nueva)
      return copiarDatos(nueva)
    }

    return solicitar<Area>(RUTA_AREAS, { metodo: 'POST', cuerpo })
  }

  async function actualizarArea(id: number, solicitud: SolicitudArea): Promise<Area> {
    const ruta = `${RUTA_AREAS}/${id}`
    const cuerpo: SolicitudArea = {
      nombre: limpiarTexto(solicitud.nombre),
      descripcion: limpiarTexto(solicitud.descripcion),
    }

    if (usarDatosPrueba()) {
      await esperarLatencia()

      const area = buscarAreaPrueba(id, ruta)
      lanzarErroresPrueba(
        validarArea(cuerpo, areasPrueba, id),
        existeAreaConNombre(cuerpo.nombre, areasPrueba, id),
        ruta,
      )

      area.nombre = cuerpo.nombre
      area.descripcion = cuerpo.descripcion
      return copiarDatos(area)
    }

    return solicitar<Area>(ruta, { metodo: 'PUT', cuerpo })
  }

  async function cambiarEstadoArea(id: number, activo: boolean): Promise<Area> {
    const ruta = `${RUTA_AREAS}/${id}/estado`

    if (usarDatosPrueba()) {
      await esperarLatencia()

      const area = buscarAreaPrueba(id, ruta)
      area.activo = activo
      return copiarDatos(area)
    }

    return solicitar<Area>(ruta, { metodo: 'PATCH', cuerpo: { activo } })
  }

  async function registrarCompetencia(areaId: number, solicitud: SolicitudCompetencia): Promise<Competencia> {
    const ruta = `${RUTA_AREAS}/${areaId}/competencias`
    const cuerpo = limpiarSolicitudCompetencia(solicitud)

    if (usarDatosPrueba()) {
      await esperarLatencia()

      const area = buscarAreaPrueba(areaId, ruta)
      lanzarErroresPrueba(validarCompetencia(cuerpo, area), existeCompetenciaEnArea(cuerpo.nombre, area), ruta)

      const nueva = crearCompetenciaPrueba(siguienteIdCompetencia++, areaId, cuerpo.nombre, cuerpo.descripcion)
      area.competencias.push(nueva)
      return copiarDatos(nueva)
    }

    return solicitar<Competencia>(ruta, { metodo: 'POST', cuerpo })
  }

  async function actualizarCompetencia(id: number, solicitud: SolicitudCompetencia): Promise<Competencia> {
    const ruta = `${RUTA_COMPETENCIAS}/${id}`
    const cuerpo = limpiarSolicitudCompetencia(solicitud)

    if (usarDatosPrueba()) {
      await esperarLatencia()

      const { area, competencia } = buscarCompetenciaPrueba(id, ruta)
      lanzarErroresPrueba(validarCompetencia(cuerpo, area, id), existeCompetenciaEnArea(cuerpo.nombre, area, id), ruta)

      competencia.nombre = cuerpo.nombre
      competencia.descripcion = cuerpo.descripcion
      return copiarDatos(competencia)
    }

    return solicitar<Competencia>(ruta, { metodo: 'PUT', cuerpo })
  }

  async function cambiarEstadoCompetencia(id: number, activo: boolean): Promise<Competencia> {
    const ruta = `${RUTA_COMPETENCIAS}/${id}/estado`

    if (usarDatosPrueba()) {
      await esperarLatencia()

      const { competencia } = buscarCompetenciaPrueba(id, ruta)
      competencia.activo = activo
      return copiarDatos(competencia)
    }

    return solicitar<Competencia>(ruta, { metodo: 'PATCH', cuerpo: { activo } })
  }

  async function eliminarCompetencia(id: number): Promise<void> {
    const ruta = `${RUTA_COMPETENCIAS}/${id}`

    if (usarDatosPrueba()) {
      await esperarLatencia()

      const { area, competencia } = buscarCompetenciaPrueba(id, ruta)
      const motivo = obtenerMotivoNoEliminable(competencia, area.competencias.length)

      if (motivo) {
        throw crearErrorPrueba(motivo, 409, ruta)
      }

      area.competencias = area.competencias.filter((actual) => actual.id !== id)
      return
    }

    await solicitar<unknown>(ruta, { metodo: 'DELETE' })
  }

  return {
    listarAreas,
    registrarArea,
    actualizarArea,
    cambiarEstadoArea,
    registrarCompetencia,
    actualizarCompetencia,
    cambiarEstadoCompetencia,
    eliminarCompetencia,
  }
}
