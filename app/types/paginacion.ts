/** Contrato del servidor. number empieza en cero; totalElements cuenta todo el filtro. */
export interface PaginaRespuesta<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
