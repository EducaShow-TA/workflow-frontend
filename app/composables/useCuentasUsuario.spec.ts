import { describe, expect, it } from 'vitest'
import { crearFormularioVacio, validarCuenta } from '~/composables/useCuentasUsuario'

describe('validarCuenta con credenciales generadas', () => {
  it('no exige username ni contraseña manual para docentes', () => {
    const formulario = crearFormularioVacio()
    Object.assign(formulario, {
      dni: '12345678',
      nombre: 'Ana',
      apellidoPaterno: 'Perez',
      apellidoMaterno: 'Diaz',
      correo: 'ana@example.test',
      rol: 'DOCENTE',
    })

    const errores = validarCuenta(formulario, [])

    expect(errores.username).toBeUndefined()
    expect(errores.password).toBeUndefined()
    expect(errores.confirmacionPassword).toBeUndefined()
    expect(errores.dni).toBeUndefined()
    expect(errores.correo).toBeUndefined()
  })

  it('conserva la validación manual de credenciales para otros roles', () => {
    const formulario = crearFormularioVacio()
    Object.assign(formulario, {
      dni: '12345678',
      nombre: 'Ana',
      apellidoPaterno: 'Perez',
      apellidoMaterno: 'Diaz',
      correo: 'ana@example.test',
      rol: 'APODERADO',
    })

    const errores = validarCuenta(formulario, [])

    expect(errores.username).toBeDefined()
    expect(errores.password).toBe('La contraseña es obligatoria.')
  })
})
