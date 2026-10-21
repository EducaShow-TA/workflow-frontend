import type { CupoSeccion } from '~/types/matricula'

const cuposDemostracion: CupoSeccion[] = [
  { grado: '1ro Secundaria', seccion: 'A', capacidadMaxima: 30, matriculados: 28 },
  { grado: '1ro Secundaria', seccion: 'B', capacidadMaxima: 30, matriculados: 30 },
  { grado: '2do Secundaria', seccion: 'A', capacidadMaxima: 30, matriculados: 24 },
  { grado: '2do Secundaria', seccion: 'B', capacidadMaxima: 30, matriculados: 27 },
  { grado: '3ro Secundaria', seccion: 'A', capacidadMaxima: 30, matriculados: 28 },
  { grado: '3ro Secundaria', seccion: 'B', capacidadMaxima: 30, matriculados: 30 },
  { grado: '4to Secundaria', seccion: 'A', capacidadMaxima: 30, matriculados: 20 },
  { grado: '4to Secundaria', seccion: 'B', capacidadMaxima: 30, matriculados: 29 },
  { grado: '5to Secundaria', seccion: 'A', capacidadMaxima: 30, matriculados: 26 },
  { grado: '5to Secundaria', seccion: 'B', capacidadMaxima: 30, matriculados: 25 },
]

export function useVacantesDemo(): CupoSeccion[] {
  return cuposDemostracion.map((cupo) => ({ ...cupo }))
}
