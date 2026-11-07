export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RespuestaErrorApi {
  timestamp: string
  status: number
  error: string
  message: string
  path: string
}

export class ErrorSolicitudApi extends Error {
  constructor(
    mensaje: string,
    public readonly estado: number,
    public readonly ruta: string = '',
    /** Cuerpo completo de la respuesta, para errores que traen más que un mensaje (por ejemplo, un 422 con resultados). */
    public readonly datos: unknown = undefined,
  ) {
    super(mensaje)
    this.name = 'ErrorSolicitudApi'
  }
}
