import type { TipoDocumento } from '~/types/registroEstudiante'

export function normalizarDocumento(valor: string, tipo: TipoDocumento): string {
  if (tipo === 'DNI') {
    return valor.replace(/\D/g, '').slice(0, 8)
  }

  return valor
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
}

export function normalizarCelular(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 9)
}

export function formatearCelular(valor: string): string {
  const digitos = normalizarCelular(valor)
  return digitos.match(/.{1,3}/g)?.join(' ') ?? ''
}

export function normalizarCorreo(valor: string): string {
  return valor.trim().toLowerCase()
}

export function normalizarNombre(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ')
}
