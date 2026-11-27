import { describe, expect, it } from 'vitest'
import {
  describirRangoVigencia,
  describirResponsableHorario,
  formatearFechaHora,
  nombreVigencia,
  rutaAuditoriaHorarios,
} from '~/composables/useAuditoriaHorarios'

describe('auditoría de cambios de horario', () => {
  it('consulta el rango de fechas elegido', () => {
    expect(rutaAuditoriaHorarios({ desde: '2026-01-01', hasta: '2026-11-20' })).toBe(
      '/api/v1/horarios/auditoria?desde=2026-01-01&hasta=2026-11-20',
    )
  })

  it('puede limitar la consulta a un horario', () => {
    expect(rutaAuditoriaHorarios({ horarioId: 7, desde: '2026-01-01', hasta: '2026-11-20' })).toBe(
      '/api/v1/horarios/auditoria?horarioId=7&desde=2026-01-01&hasta=2026-11-20',
    )
  })

  it('no muestra "Cuenta #null" cuando el cambio no tiene una cuenta asociada', () => {
    expect(describirResponsableHorario({ usuarioCuentaId: 12 })).toBe('Cuenta #12')
    expect(describirResponsableHorario({ usuarioCuentaId: null })).toBe('Sin cuenta asociada')
  })

  it('nombra el tipo de vigencia en lenguaje común', () => {
    expect(nombreVigencia('PERMANENTE')).toBe('Permanente')
    expect(nombreVigencia('TEMPORAL')).toBe('Temporal')
  })

  it('muestra el rango de vigencia sin desfase de zona horaria', () => {
    expect(describirRangoVigencia({ vigenteDesde: '2026-11-19', vigenteHasta: null })).toBe('19/11/2026 – sin fin')
    expect(describirRangoVigencia({ vigenteDesde: '2026-11-23', vigenteHasta: '2026-11-27' })).toBe(
      '23/11/2026 – 27/11/2026',
    )
    expect(describirRangoVigencia({ vigenteDesde: null, vigenteHasta: null })).toBe('')
  })

  it('muestra la fecha y hora del registro', () => {
    expect(formatearFechaHora('2026-11-18T10:42:13')).toBe('18/11/2026 10:42')
  })
})
