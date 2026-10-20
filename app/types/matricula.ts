export interface CupoSeccion {
  grado: string
  seccion: string
  capacidadMaxima: number
  matriculados: number
}

export function calcularVacantes(cupo: CupoSeccion): number {
  return Math.max(0, cupo.capacidadMaxima - cupo.matriculados)
}

export function porcentajeOcupacion(cupo: CupoSeccion): number {
  if (cupo.capacidadMaxima === 0) {
    return 0
  }

  return Math.min(100, Math.round((cupo.matriculados / cupo.capacidadMaxima) * 100))
}
