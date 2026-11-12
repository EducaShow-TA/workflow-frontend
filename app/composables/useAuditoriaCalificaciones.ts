import type { RegistroAuditoriaCalificacion } from '~/types/auditoriaCalificacion'

export type CampoAuditoria = 'nota' | 'puntaje' | 'booleano' | 'observacion'

type ValorAuditoria = string | number | boolean | null

function mostrarValor(valor: ValorAuditoria, campo: CampoAuditoria): string {
  if (campo === 'nota') {
    return valor === null ? 'Sin calificación' : String(valor)
  }

  if (campo === 'puntaje') {
    return typeof valor === 'number'
      ? valor.toLocaleString('es-PE', { maximumFractionDigits: 4 })
      : 'Aún no hay puntaje calculado'
  }

  if (campo === 'booleano') {
    return typeof valor === 'boolean' ? (valor ? 'Sí' : 'No') : 'No disponible'
  }

  return typeof valor === 'string' && valor.trim() ? valor.trim() : 'Sin observación'
}

function valoresEquivalentes(anterior: ValorAuditoria, nuevo: ValorAuditoria, campo: CampoAuditoria): boolean {
  if (campo === 'observacion') {
    return (typeof anterior === 'string' ? anterior.trim() : '') === (typeof nuevo === 'string' ? nuevo.trim() : '')
  }

  return Object.is(anterior, nuevo)
}

export function describirCambioAuditoria(
  anterior: ValorAuditoria,
  nuevo: ValorAuditoria,
  campo: CampoAuditoria,
): string {
  const valorNuevo = mostrarValor(nuevo, campo)

  if (valoresEquivalentes(anterior, nuevo, campo)) {
    if (
      (anterior === null && nuevo === null) ||
      (campo === 'observacion' &&
        !(typeof anterior === 'string' && anterior.trim()) &&
        !(typeof nuevo === 'string' && nuevo.trim()))
    ) {
      return valorNuevo
    }

    return `Sin cambios (${valorNuevo})`
  }

  return `${mostrarValor(anterior, campo)} → ${valorNuevo}`
}

export function describirAccionAuditoria(registro: RegistroAuditoriaCalificacion): string {
  const tipo =
    registro.tipoCalificacion === 'FINAL' ? 'Calificación de la competencia' : 'Calificación parcial de la competencia'

  switch (registro.accion) {
    case 'REGISTRAR_O_ACTUALIZAR':
      return `${tipo} ${registro.notaAnterior === null ? 'registrada' : 'actualizada'}`
    case 'RECALCULAR_REGLA':
      return 'Logro de la competencia recalculado por un cambio en la regla'
    case 'RECALCULAR_EVALUACION':
      return 'Logro de la competencia recalculado por un cambio en una evaluación'
    case 'RECALCULAR_NOTA_PARCIAL':
      return 'Logro de la competencia recalculado después de actualizar una nota parcial'
    case 'RECALCULO_MANUAL':
      return 'Logro de la competencia recalculado manualmente'
    case 'CIERRE_ACTAS':
      return 'Logro de la competencia actualizado al cerrar actas'
    case 'DESACTIVAR_EVALUACION':
      return 'Nota parcial actualizada al desactivar una evaluación'
    case 'COMPLETAR_FALTANTE_CIERRE_ACTAS':
      return 'Nota parcial completada al cerrar actas'
    default:
      return `Cambio en ${tipo.toLowerCase()}`
  }
}
