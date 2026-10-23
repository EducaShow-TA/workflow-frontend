import type { RolUsuario } from '~/types/autenticacion'

// Tipos de US-5.5. Reflejan RegistroErrorResponseDTO y NivelLog del backend; los campos nulos no se envian.

export type NivelLog = 'INFO' | 'ADVERTENCIA' | 'ERROR' | 'CRITICO'

export interface RegistroError {
  id: number
  fechaHora: string
  nivel: NivelLog
  codigoError?: string
  modulo?: string
  idUsuario?: number
  /** Correo de la cuenta que hizo la petición; no llega si fue anónima o la cuenta ya no existe. */
  usuario?: string
  rolUsuario?: RolUsuario
  metodoHttp?: string
  endpoint?: string
  codigoEstado?: number
  mensaje?: string
  /** Solo llega en el detalle (GET /api/v1/logs/errores/{id}). */
  stackTrace?: string
}

export interface FiltrosRegistroError {
  texto: string
  nivel: NivelLog | ''
  /** yyyy-MM-dd; se envia como desde y hasta. */
  fecha: string
}

/** Respuesta paginada de Spring (PagedModel). */
export interface PaginaRegistrosError {
  content: RegistroError[]
  page: {
    size: number
    number: number
    totalElements: number
    totalPages: number
  }
}
