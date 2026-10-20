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
  ) {
    super(mensaje)
    this.name = 'ErrorSolicitudApi'
  }
}
