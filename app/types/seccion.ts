// Tipos de US-1.7. Siguen las clases Grado (numero) y Seccion (nombre, vacantesTotales) del diagrama de clases.

/** Respuesta de GET /api/v1/secciones. */
export interface Seccion {
  id: number
  /** Grado.numero: 1 a 5 de secundaria. */
  gradoNumero: number
  nombre: string
  /** Capacidad maxima de la seccion. */
  vacantesTotales: number
  /** Equivale a Seccion.getCantidadMatriculados(). */
  cantidadMatriculados: number
}

/** Cuerpo de POST /api/v1/secciones. */
export interface SolicitudSeccion {
  gradoNumero: number
  nombre: string
  vacantesTotales: number
}

/** Cuerpo de PATCH /api/v1/secciones/{id}. Equivale a Seccion.actualizarVacantes(nuevasVacantes). */
export interface SolicitudActualizarVacantes {
  vacantesTotales: number
}

export type EstadoCupos = 'disponible' | 'limitado' | 'agotado'

export type ErroresSeccion = Partial<Record<keyof SolicitudSeccion, string>>
