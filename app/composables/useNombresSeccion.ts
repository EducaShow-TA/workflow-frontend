// Formato único de grado y sección para todas las pantallas (ortografía de la RAE: 1.º).

const NIVELES: Record<string, string> = { INICIAL: 'inicial', PRIMARIA: 'primaria', SECUNDARIA: 'secundaria' }

function nombreNivel(nivel = 'SECUNDARIA'): string {
  return NIVELES[nivel.toUpperCase()] ?? nivel.toLowerCase()
}

/** «1.º de secundaria»: filtros por grado y ocupación. */
export function formatearGrado(numero: number, nivel?: string): string {
  return `${numero}.º de ${nombreNivel(nivel)}`
}

/** «1.º A»: columnas de tablas, chips y tarjetas pequeñas. */
export function formatearSeccion(numero: number, seccion: string): string {
  return `${numero}.º ${seccion}`
}

/** «1.º de secundaria A»: el nombre de la sección en selectores, títulos, fichas y documentos. */
export function formatearSeccionCompleta(numero: number, seccion: string, nivel?: string): string {
  return `${formatearGrado(numero, nivel)} ${seccion}`
}

/** Agrega el año solo donde se listan periodos de varios años. */
export function conAnhio(texto: string, anhio: number | string): string {
  return `${texto} · ${anhio}`
}
