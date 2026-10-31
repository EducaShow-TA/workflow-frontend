import { describe, expect, it } from 'vitest'
import { revisarCsv } from '~/composables/useCargaMasiva'

describe('revisarCsv usernames', () => {
  it('advierte si una columna username contiene símbolos o un correo', () => {
    const csv = [
      'rol,dni,nombres,apellido_paterno,apellido_materno,correo,username',
      'DOCENTE,12345678,Ana,Perez,Diaz,ana@example.test,ana@example.test',
    ].join('\n')

    const revision = revisarCsv('usuarios.csv', 150, csv)

    expect(revision.errores).toEqual([])
    expect(revision.advertencias).toContain('1 fila tiene username inválido; usa solo letras y números.')
  })

  it('permite omitir username para generar uno desde el documento', () => {
    const csv = [
      'rol,dni,nombres,apellido_paterno,apellido_materno,correo',
      'DOCENTE,12345678,Ana,Perez,Diaz,ana@example.test',
    ].join('\n')

    const revision = revisarCsv('usuarios.csv', 120, csv)

    expect(revision.errores).toEqual([])
    expect(revision.advertencias).toEqual([])
  })
})
