import { describe, expect, it } from 'vitest'
import { describirAccionAuditoria, describirCambioAuditoria } from './useAuditoriaCalificaciones'
import type { RegistroAuditoriaCalificacion } from '~/types/auditoriaCalificacion'

const registro: RegistroAuditoriaCalificacion = {
  id: 1,
  fechaHora: '2026-11-12T15:19:00',
  usuario: 'admin01',
  rolUsuario: 'ADMINISTRADOR',
  accion: 'REGISTRAR_O_ACTUALIZAR',
  tipoCalificacion: 'FINAL',
  periodoId: 1,
  matriculaId: 1,
  estudianteId: 1,
  competenciaCodigo: 'COMP-1',
  evaluacionId: null,
  notaAnterior: null,
  notaNueva: 'A',
  puntajeAnterior: null,
  puntajeNuevo: null,
  consolidadaAnterior: false,
  consolidadaNueva: false,
  justificadaAnterior: null,
  justificadaNueva: null,
  observacionAnterior: null,
  observacionNueva: '',
}

describe('presentación amigable de auditoría de calificaciones', () => {
  it('describe el registro y la actualización sin exponer códigos internos de acción', () => {
    expect(describirAccionAuditoria(registro)).toBe('Calificación de la competencia registrada')
    expect(describirAccionAuditoria({ ...registro, notaAnterior: 'B' })).toBe(
      'Calificación de la competencia actualizada',
    )
    expect(describirAccionAuditoria({ ...registro, accion: 'RECALCULAR_REGLA' })).toBe(
      'Logro de la competencia recalculado por un cambio en la regla',
    )
  })

  it('explica valores sin dato y evita flechas para observaciones vacías o valores iguales', () => {
    expect(describirCambioAuditoria(null, 'A', 'nota')).toBe('Sin calificación → A')
    expect(describirCambioAuditoria(false, false, 'booleano')).toBe('Sin cambios (No)')
    expect(describirCambioAuditoria(null, '', 'observacion')).toBe('Sin observación')
  })
})
