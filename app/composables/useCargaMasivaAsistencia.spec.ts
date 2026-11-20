import { describe, expect, it } from 'vitest'
import {
  MAXIMO_BYTES_ASISTENCIA,
  esResultadoCargaAsistencia,
  resumirResultadoCarga,
  validarArchivoCsv,
} from '~/composables/useCargaMasivaAsistencia'
import type { ResultadoCargaAsistencia } from '~/types/cargaMasivaAsistencia'

function resultado(cambios: Partial<ResultadoCargaAsistencia> = {}): ResultadoCargaAsistencia {
  return {
    guardado: false,
    soloValidacion: true,
    totalFilas: 3,
    filasValidas: 3,
    filasRechazadas: 0,
    registrosNuevos: 2,
    registrosActualizados: 1,
    errores: [],
    ...cambios,
  }
}

describe('validarArchivoCsv', () => {
  it('acepta un .csv con contenido sin importar mayúsculas', () => {
    expect(validarArchivoCsv({ name: 'ASISTENCIA.CSV', size: 120 })).toBe('')
  })

  it('rechaza otras extensiones, archivos vacíos y archivos muy grandes', () => {
    expect(validarArchivoCsv({ name: 'asistencia.xlsx', size: 120 })).toContain('.csv')
    expect(validarArchivoCsv({ name: 'asistencia.csv', size: 0 })).toContain('vacío')
    expect(validarArchivoCsv({ name: 'asistencia.csv', size: MAXIMO_BYTES_ASISTENCIA + 1 })).toContain('2 MB')
  })
})

describe('esResultadoCargaAsistencia', () => {
  it('reconoce el resumen del backend y descarta un error genérico', () => {
    expect(esResultadoCargaAsistencia(resultado())).toBe(true)
    expect(esResultadoCargaAsistencia({ message: 'Faltan columnas obligatorias: fecha' })).toBe(false)
    expect(esResultadoCargaAsistencia(null)).toBe(false)
  })
})

describe('resumirResultadoCarga', () => {
  it('informa que no se guardó nada cuando hay filas con errores', () => {
    const texto = resumirResultadoCarga(
      resultado({
        filasRechazadas: 1,
        errores: [{ fila: 2, campo: 'dni_docente', mensaje: 'No existe un docente activo con ese DNI' }],
      }),
    )

    expect(texto).toBe('1 fila tiene errores de 3. No se guardó nada: corrígelas y vuelve a validar.')
  })

  it('distingue la validación exitosa de la carga guardada', () => {
    expect(resumirResultadoCarga(resultado())).toBe(
      'Archivo válido: 3 filas listas para guardar (2 registros nuevos y 1 actualización).',
    )
    expect(resumirResultadoCarga(resultado({ guardado: true, soloValidacion: false }))).toBe(
      'Asistencia guardada: 2 registros nuevos y 1 actualización.',
    )
  })
})
