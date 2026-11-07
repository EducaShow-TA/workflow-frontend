// Tipos de US-3.5. Siguen las clases Area y Competencia del diagrama de clases (asociacion "agrupa", 1 a 1..*).
// "activo" corresponde a EntidadBase.active; se nombra en espanol segun el estandar (seccion 2.4).

/** Competencia dentro de la respuesta de GET /api/v1/areas. */
export interface Competencia {
  id: number
  areaId: number
  nombre: string
  descripcion: string
  activo: boolean
  /** Calculado por el backend: true si ya tiene evaluaciones o logros registrados (US-3.5, criterio 2). */
  tieneNotasRegistradas: boolean
}

/** Respuesta de GET /api/v1/areas: cada area con sus competencias. */
export interface Area {
  id: number
  nombre: string
  descripcion: string
  activo: boolean
  competencias: Competencia[]
}

/** Cuerpo de POST /api/v1/areas/{id}/competencias y PUT /api/v1/competencias/{id}. */
export interface SolicitudCompetencia {
  nombre: string
  descripcion: string
}

/** Cuerpo de PUT /api/v1/areas/{id}. */
export interface SolicitudArea {
  nombre: string
  descripcion: string
}

/** Cuerpo de POST /api/v1/areas: toda area se crea con al menos una competencia (multiplicidad 1..*). */
export interface SolicitudNuevaArea extends SolicitudArea {
  competencias: SolicitudCompetencia[]
}

/** Cuerpo de PATCH /api/v1/areas/{id}/estado y PATCH /api/v1/competencias/{id}/estado. */
export interface SolicitudCambioEstado {
  activo: boolean
}

export type FiltroEstado = 'TODOS' | 'ACTIVOS' | 'INACTIVOS'

/** A que se aplican la busqueda y el filtro de estado. */
export type AmbitoFiltro = 'AREAS' | 'COMPETENCIAS' | 'AMBAS'

export type ErroresArea = Partial<Record<keyof SolicitudArea, string>>

export type ErroresCompetencia = Partial<Record<keyof SolicitudCompetencia, string>>
