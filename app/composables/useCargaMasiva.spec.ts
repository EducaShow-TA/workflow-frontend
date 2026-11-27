import { describe, expect, it } from 'vitest'
import { revisarCsv } from '~/composables/useCargaMasiva'

describe('revisarCsv usernames', () => {
  it('advierte si una columna username contiene símbolos o un correo', () => {
    const csv = [
      'rol,dni,nombres,apellido_paterno,apellido_materno,correo,username',
      'APODERADO,12345678,Ana,Perez,Diaz,ana@example.test,ana@example.test',
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

  it('rechaza username ingresado manualmente para docentes', () => {
    const csv = [
      'rol,dni,nombres,apellido_paterno,apellido_materno,correo,username',
      'DOCENTE,12345678,Ana,Perez,Diaz,ana@example.test,anaperez',
    ].join('\n')

    const revision = revisarCsv('docentes.csv', 150, csv, 'DOCENTE')

    expect(revision.errores).toContain('No ingreses username para docentes; el sistema lo genera automáticamente.')
  })

  it('acepta plantillas Excel y rechaza filas de otro rol en una carga específica', () => {
    const csv = [
      'rol,dni,nombres,apellido_paterno,apellido_materno,correo',
      'DOCENTE,12345678,Ana,Perez,Diaz,ana@example.test',
    ].join('\n')

    const revision = revisarCsv('plantilla.xlsx', 150, csv, 'ALUMNO')

    expect(revision.errores).toContain('1 fila no corresponde al rol ALUMNO.')
  })

  it('exige un vínculo y username automático para la carga específica de apoderados y alumnos', () => {
    const alumno = [
      'rol,dni,nombres,apellido_paterno,apellido_materno,correo,dni_apoderado,parentesco,username',
      'ALUMNO,12345678,Ana,Perez,Diaz,ana@example.test,87654321,MADRE,ana123',
    ].join('\n')
    const apoderado = [
      'rol,dni,nombres,apellido_paterno,apellido_materno,correo,dni_alumno,parentesco,es_principal',
      'APODERADO,87654321,Luz,Perez,Diaz,luz@example.test,12345678,MADRE,SI',
    ].join('\n')
    const apoderadoSinVinculo = [
      'rol,dni,nombres,apellido_paterno,apellido_materno,correo,dni_alumno,parentesco,es_principal',
      'APODERADO,87654322,Sol,Perez,Diaz,sol@example.test,,,',
    ].join('\n')

    const revisionAlumno = revisarCsv('alumnos.csv', 200, alumno, 'ALUMNO')
    const revisionApoderado = revisarCsv('apoderados.csv', 200, apoderado, 'APODERADO')
    const revisionApoderadoSinVinculo = revisarCsv('apoderados.csv', 200, apoderadoSinVinculo, 'APODERADO')

    expect(revisionAlumno.errores).toContain('No ingreses username para alumnos; el sistema lo genera automáticamente.')
    expect(revisionApoderado.errores).toEqual([])
    expect(revisionApoderadoSinVinculo.errores).toContain('1 fila de apoderado no tiene dni_alumno.')
  })
})
