import { describe, expect, it } from 'vitest'
import {
  calcularPorcentajeOcupacion,
  calcularVacantesDisponibles,
  obtenerEstadoCupos,
  validarNuevaCapacidad,
  validarSeccion,
} from './useSecciones'
import type { Seccion } from '~/types/seccion'

const seccion: Seccion = {
  id: 1,
  gradoNumero: 1,
  nombre: 'A',
  vacantesTotales: 30,
  cantidadMatriculados: 28,
}

describe('lógica de vacantes y secciones', () => {
  it('calcula vacantes disponibles sin devolver valores negativos', () => {
    expect(calcularVacantesDisponibles(seccion)).toBe(2)
    expect(calcularVacantesDisponibles({ ...seccion, cantidadMatriculados: 32 })).toBe(0)
  })

  it('calcula ocupación redondeada y limitada al 100 por ciento', () => {
    expect(calcularPorcentajeOcupacion(seccion)).toBe(93)
    expect(calcularPorcentajeOcupacion({ ...seccion, cantidadMatriculados: 32 })).toBe(100)
    expect(calcularPorcentajeOcupacion({ ...seccion, vacantesTotales: 0 })).toBe(0)
  })

  it('clasifica secciones agotadas, con pocos cupos y disponibles', () => {
    expect(obtenerEstadoCupos(0)).toBe('agotado')
    expect(obtenerEstadoCupos(2)).toBe('limitado')
    expect(obtenerEstadoCupos(3)).toBe('disponible')
  })

  it('impide reducir capacidad por debajo de los matriculados', () => {
    expect(validarNuevaCapacidad(27, 28)).toContain('no puede ser menor')
    expect(validarNuevaCapacidad(28, 28)).toBe('')
    expect(validarNuevaCapacidad(0, 0)).toContain('entero mayor que cero')
  })

  it('valida grado, formato, duplicados y capacidad al crear una sección', () => {
    expect(validarSeccion({ gradoNumero: 6, nombre: 'A', vacantesTotales: 30 })).toHaveProperty('gradoNumero')
    expect(validarSeccion({ gradoNumero: 1, nombre: 'a', vacantesTotales: 30 })).toHaveProperty('nombre')
    expect(validarSeccion({ gradoNumero: 1, nombre: 'A', vacantesTotales: 30 }, [seccion])).toHaveProperty('nombre')
    expect(validarSeccion({ gradoNumero: 1, nombre: 'B', vacantesTotales: -1 })).toHaveProperty('vacantesTotales')
    expect(validarSeccion({ gradoNumero: 1, nombre: 'B', vacantesTotales: 30 })).toEqual({})
  })
})
