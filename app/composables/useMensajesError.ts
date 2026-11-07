import { ErrorSolicitudApi } from '~/types/api'

export function obtenerMensajeError(error: unknown, mensajePorDefecto: string): string {
  if (error instanceof ErrorSolicitudApi || error instanceof Error) {
    return error.message || mensajePorDefecto
  }

  return mensajePorDefecto
}
