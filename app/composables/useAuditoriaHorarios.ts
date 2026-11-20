import type { FiltrosAuditoriaHorario, RegistroAuditoriaHorario, TipoVigenciaHorario } from '~/types/auditoriaHorario'
import { useApi } from '~/composables/useApi'

const RUTA = '/api/v1/horarios/auditoria'

const NOMBRES_VIGENCIA: Record<TipoVigenciaHorario, string> = {
  PERMANENTE: 'Permanente',
  TEMPORAL: 'Temporal',
}

export function rutaAuditoriaHorarios(filtros: FiltrosAuditoriaHorario): string {
  const parametros = new URLSearchParams()
  if (filtros.horarioId !== undefined) parametros.append('horarioId', String(filtros.horarioId))
  parametros.append('desde', filtros.desde)
  parametros.append('hasta', filtros.hasta)
  return `${RUTA}?${parametros.toString()}`
}

export function describirResponsable(registro: Pick<RegistroAuditoriaHorario, 'usuarioCuentaId'>): string {
  return registro.usuarioCuentaId === null ? 'Sin cuenta asociada' : `Cuenta #${registro.usuarioCuentaId}`
}

export function nombreVigencia(tipo: TipoVigenciaHorario): string {
  return NOMBRES_VIGENCIA[tipo]
}

// Se parte el texto en vez de usar new Date(): "2026-11-19" se interpretaría en UTC y en Lima
// se mostraría como el 18/11.
function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

export function describirRangoVigencia(
  registro: Pick<RegistroAuditoriaHorario, 'vigenteDesde' | 'vigenteHasta'>,
): string {
  if (!registro.vigenteDesde) return ''
  const fin = registro.vigenteHasta ? formatearFecha(registro.vigenteHasta) : 'sin fin'
  return `${formatearFecha(registro.vigenteDesde)} – ${fin}`
}

/** "2026-11-18T10:42:13" → "18/11/2026 10:42". */
export function formatearFechaHora(fechaHora: string): string {
  const [fecha = '', hora = ''] = fechaHora.split('T')
  return `${formatearFecha(fecha)} ${hora.slice(0, 5)}`
}

export function useAuditoriaHorarios() {
  const { solicitar } = useApi()

  return {
    listar: (filtros: FiltrosAuditoriaHorario) => solicitar<RegistroAuditoriaHorario[]>(rutaAuditoriaHorarios(filtros)),
  }
}
