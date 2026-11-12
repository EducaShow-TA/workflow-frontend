export const LONGITUD_MINIMA_CONTRASENA = 8
export const LONGITUD_MAXIMA_BYTES_CONTRASENA = 72

export interface RequisitosContrasena {
  longitud: boolean
  minuscula: boolean
  mayuscula: boolean
  numero: boolean
  simbolo: boolean
  limiteBytes: boolean
}

export function evaluarRequisitosContrasena(contrasena: string): RequisitosContrasena {
  return {
    longitud: Array.from(contrasena).length >= LONGITUD_MINIMA_CONTRASENA,
    minuscula: /\p{Ll}/u.test(contrasena),
    mayuscula: /\p{Lu}/u.test(contrasena),
    numero: /\p{Nd}/u.test(contrasena),
    simbolo: /[^\p{L}\p{N}]/u.test(contrasena),
    limiteBytes: new TextEncoder().encode(contrasena).length <= LONGITUD_MAXIMA_BYTES_CONTRASENA,
  }
}

export function validarPoliticaContrasena(contrasena: string): string | undefined {
  const requisitos = evaluarRequisitosContrasena(contrasena)
  if (!requisitos.longitud) return `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`
  if (!requisitos.minuscula || !requisitos.mayuscula || !requisitos.numero || !requisitos.simbolo) {
    return 'Incluye al menos una minúscula, una mayúscula, un número y un símbolo.'
  }
  if (!requisitos.limiteBytes) return 'La contraseña no puede superar los 72 bytes UTF-8.'
  return undefined
}
