import { useApi } from '~/composables/useApi'
import { copiarDatos, crearErrorPrueba, esperarLatencia, usarDatosPrueba } from '~/composables/useDatosPrueba'
import type { FiltrosRegistroError, NivelLog, PaginaRegistrosError, RegistroError } from '~/types/registroError'

const RUTA_REGISTROS = '/api/v1/logs/errores'

export const TAMANIO_PAGINA_REGISTROS = 12

export const NIVELES_LOG: { valor: NivelLog; etiqueta: string }[] = [
  { valor: 'INFO', etiqueta: 'Info' },
  { valor: 'ADVERTENCIA', etiqueta: 'Advertencia' },
  { valor: 'ERROR', etiqueta: 'Error' },
  { valor: 'CRITICO', etiqueta: 'Crítico' },
]

export function obtenerEtiquetaNivel(nivel: NivelLog): string {
  return NIVELES_LOG.find((opcion) => opcion.valor === nivel)?.etiqueta ?? nivel
}

/** Muestra la fecha del backend (yyyy-MM-ddTHH:mm:ss.SSS) sin convertir zona horaria. */
export function formatearFechaHoraLog(fechaHora: string): string {
  return fechaHora.replace('T', ' ').slice(0, 23)
}

export function describirUsuarioLog(registro: Pick<RegistroError, 'idUsuario'>): string {
  return registro.idUsuario ? `Usuario #${registro.idUsuario}` : 'Sistema'
}

function construirRuta(filtros: FiltrosRegistroError, pagina: number): string {
  const parametros = new URLSearchParams({ page: String(pagina), size: String(TAMANIO_PAGINA_REGISTROS) })
  const texto = filtros.texto.trim()

  if (texto) {
    parametros.set('texto', texto)
  }

  if (filtros.nivel) {
    parametros.set('nivel', filtros.nivel)
  }

  if (filtros.fecha) {
    parametros.set('desde', filtros.fecha)
    parametros.set('hasta', filtros.fecha)
  }

  return `${RUTA_REGISTROS}?${parametros.toString()}`
}

const TRAZA_PRUEBA = `java.lang.IllegalStateException: Conexión cerrada
\tat pe.edu.pucp.colegio.common.service.SeccionService.listar(SeccionService.java:48)
\tat pe.edu.pucp.colegio.common.controller.SeccionController.listar(SeccionController.java:31)
\tat org.springframework.web.servlet.FrameworkServlet.service(FrameworkServlet.java:885)`

const PLANTILLAS_PRUEBA: Omit<RegistroError, 'id' | 'fechaHora'>[] = [
  {
    nivel: 'ADVERTENCIA',
    codigoError: 'AUTH_401',
    modulo: 'auth',
    metodoHttp: 'POST',
    endpoint: '/api/v1/auth/login',
    codigoEstado: 401,
    mensaje: 'Credenciales inválidas',
  },
  {
    nivel: 'ADVERTENCIA',
    codigoError: 'NEG_409',
    modulo: 'secciones',
    idUsuario: 1,
    metodoHttp: 'POST',
    endpoint: '/api/v1/secciones',
    codigoEstado: 409,
    mensaje: 'Ya existe esa sección en el grado',
  },
  {
    nivel: 'INFO',
    codigoError: 'VAL_400',
    modulo: 'areas',
    idUsuario: 1,
    metodoHttp: 'POST',
    endpoint: '/api/v1/areas',
    codigoEstado: 400,
    mensaje: 'El nombre es obligatorio',
  },
  {
    nivel: 'ERROR',
    codigoError: 'SIS_500',
    modulo: 'secciones',
    idUsuario: 1,
    metodoHttp: 'GET',
    endpoint: '/api/v1/secciones',
    codigoEstado: 500,
    mensaje: 'Ocurrió un error interno',
    stackTrace: TRAZA_PRUEBA,
  },
  {
    nivel: 'ADVERTENCIA',
    codigoError: 'AUTH_403',
    modulo: 'cuentas-usuario',
    idUsuario: 7,
    metodoHttp: 'GET',
    endpoint: '/api/v1/cuentas-usuario',
    codigoEstado: 403,
    mensaje: 'No tiene permiso para este recurso',
  },
  {
    nivel: 'INFO',
    codigoError: 'RES_404',
    modulo: 'competencias',
    idUsuario: 1,
    metodoHttp: 'PUT',
    endpoint: '/api/v1/competencias/14',
    codigoEstado: 404,
    mensaje: 'Competencia no encontrada',
  },
  {
    nivel: 'CRITICO',
    codigoError: 'SIS_500',
    modulo: 'sistema',
    codigoEstado: 500,
    mensaje: 'No se pudo conectar con la base de datos',
    stackTrace: TRAZA_PRUEBA,
  },
  {
    nivel: 'ADVERTENCIA',
    codigoError: 'NEG_422',
    modulo: 'secciones',
    idUsuario: 1,
    metodoHttp: 'PATCH',
    endpoint: '/api/v1/secciones/3',
    codigoEstado: 422,
    mensaje: 'La capacidad no puede ser menor que los matriculados',
  },
]

function crearRegistrosPrueba(): RegistroError[] {
  const ahora = Date.now()

  return Array.from({ length: 40 }, (_, indice) => {
    const fecha = new Date(ahora - indice * 47 * 60 * 1000 - indice * 1234)
    const desfase = fecha.getTimezoneOffset() * 60 * 1000
    const fechaHora = new Date(fecha.getTime() - desfase).toISOString().replace('Z', '')

    return { id: 40 - indice, fechaHora, ...PLANTILLAS_PRUEBA[indice % PLANTILLAS_PRUEBA.length]! }
  })
}

const registrosPrueba = crearRegistrosPrueba()

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function consultarPrueba(filtros: FiltrosRegistroError, pagina: number): PaginaRegistrosError {
  const texto = normalizar(filtros.texto.trim())

  const filtrados = registrosPrueba.filter((registro) => {
    const coincideTexto =
      !texto ||
      normalizar(registro.mensaje ?? '').includes(texto) ||
      normalizar(registro.endpoint ?? '').includes(texto) ||
      String(registro.idUsuario ?? '') === texto
    const coincideNivel = !filtros.nivel || registro.nivel === filtros.nivel
    const coincideFecha = !filtros.fecha || registro.fechaHora.startsWith(filtros.fecha)

    return coincideTexto && coincideNivel && coincideFecha
  })

  const inicio = pagina * TAMANIO_PAGINA_REGISTROS
  const contenido = filtrados
    .slice(inicio, inicio + TAMANIO_PAGINA_REGISTROS)
    .map(({ stackTrace: _traza, ...resumen }) => resumen)

  return {
    content: copiarDatos(contenido),
    page: {
      size: TAMANIO_PAGINA_REGISTROS,
      number: pagina,
      totalElements: filtrados.length,
      totalPages: Math.ceil(filtrados.length / TAMANIO_PAGINA_REGISTROS),
    },
  }
}

/** Consulta del log de errores del sistema (US-5.5). */
export function useRegistrosError() {
  const { solicitar } = useApi()

  async function consultarRegistros(filtros: FiltrosRegistroError, pagina: number): Promise<PaginaRegistrosError> {
    if (usarDatosPrueba('logs')) {
      await esperarLatencia()
      return consultarPrueba(filtros, pagina)
    }

    return solicitar<PaginaRegistrosError>(construirRuta(filtros, pagina))
  }

  async function obtenerRegistro(id: number): Promise<RegistroError> {
    const ruta = `${RUTA_REGISTROS}/${id}`

    if (usarDatosPrueba('logs')) {
      await esperarLatencia()
      const registro = registrosPrueba.find((actual) => actual.id === id)

      if (!registro) {
        throw crearErrorPrueba('Registro de error no encontrado', 404, ruta)
      }

      return copiarDatos(registro)
    }

    return solicitar<RegistroError>(ruta)
  }

  return {
    consultarRegistros,
    obtenerRegistro,
  }
}
