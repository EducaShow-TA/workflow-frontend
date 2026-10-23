import { useApi } from '~/composables/useApi'
import { obtenerNombreRol } from '~/composables/usePermisosRol'
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

/** Correo de la cuenta; si ya no existe, su ID; sin usuario, la petición fue anónima (por ejemplo, un login fallido). */
export function describirUsuarioLog(registro: Pick<RegistroError, 'idUsuario' | 'usuario'>): string {
  if (registro.usuario) return registro.usuario
  return registro.idUsuario ? `Cuenta #${registro.idUsuario} (ya no existe)` : 'Sin sesión'
}

export function describirContextoLog(registro: Pick<RegistroError, 'rolUsuario' | 'modulo'>): string {
  return [registro.rolUsuario ? obtenerNombreRol(registro.rolUsuario) : '', registro.modulo ?? '']
    .filter(Boolean)
    .join(' · ')
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

/** Consulta del log de errores del sistema (US-5.5). */
export function useRegistrosError() {
  const { solicitar } = useApi()

  async function consultarRegistros(filtros: FiltrosRegistroError, pagina: number): Promise<PaginaRegistrosError> {
    return solicitar<PaginaRegistrosError>(construirRuta(filtros, pagina))
  }

  async function obtenerRegistro(id: number): Promise<RegistroError> {
    return solicitar<RegistroError>(`${RUTA_REGISTROS}/${id}`)
  }

  return { consultarRegistros, obtenerRegistro }
}