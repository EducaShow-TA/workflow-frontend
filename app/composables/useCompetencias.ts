import { useApi } from '~/composables/useApi'
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

/** Acceso al catalogo de areas curriculares y competencias (US-3.5). */
export function useCompetencias() {
  const { solicitar } = useApi()

  async function listarAreas(): Promise<Area[]> {
    return ordenarAreas(await solicitar<Area[]>(RUTA_AREAS))
  }

  async function registrarArea(solicitud: SolicitudNuevaArea): Promise<Area> {
    const cuerpo: SolicitudNuevaArea = {
      nombre: limpiarTexto(solicitud.nombre),
      descripcion: limpiarTexto(solicitud.descripcion),
      competencias: solicitud.competencias.map(limpiarSolicitudCompetencia),
    }
    return solicitar<Area>(RUTA_AREAS, { metodo: 'POST', cuerpo })
  }

  async function actualizarArea(id: number, solicitud: SolicitudArea): Promise<Area> {
    const cuerpo: SolicitudArea = {
      nombre: limpiarTexto(solicitud.nombre),
      descripcion: limpiarTexto(solicitud.descripcion),
    }
    return solicitar<Area>(`${RUTA_AREAS}/${id}`, { metodo: 'PUT', cuerpo })
  }

  async function cambiarEstadoArea(id: number, activo: boolean): Promise<Area> {
    return solicitar<Area>(`${RUTA_AREAS}/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } })
  }

  async function registrarCompetencia(areaId: number, solicitud: SolicitudCompetencia): Promise<Competencia> {
    return solicitar<Competencia>(`${RUTA_AREAS}/${areaId}/competencias`, {
      metodo: 'POST',
      cuerpo: limpiarSolicitudCompetencia(solicitud),
    })
  }

  async function actualizarCompetencia(id: number, solicitud: SolicitudCompetencia): Promise<Competencia> {
    return solicitar<Competencia>(`${RUTA_COMPETENCIAS}/${id}`, {
      metodo: 'PUT',
      cuerpo: limpiarSolicitudCompetencia(solicitud),
    })
  }

  async function cambiarEstadoCompetencia(id: number, activo: boolean): Promise<Competencia> {
    return solicitar<Competencia>(`${RUTA_COMPETENCIAS}/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } })
  }

  return {
    listarAreas,
    registrarArea,
    actualizarArea,
    cambiarEstadoArea,
    registrarCompetencia,
    actualizarCompetencia,
    cambiarEstadoCompetencia,
  }
}