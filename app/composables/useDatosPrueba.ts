import type { ModuloDatosPrueba } from '~/types/datosPrueba'
import { ErrorSolicitudApi } from '~/types/api'

/** Latencia simulada para que las pantallas muestren su estado de carga igual que con el backend real. */
const LATENCIA_SIMULADA_MS = 350

export function usarDatosPrueba(modulo: ModuloDatosPrueba): boolean {
  const configuracion = useRuntimeConfig()
  return String(configuracion.public.datosPrueba || '')
    .split(',')
    .map((valor) => valor.trim())
    .includes(modulo)
}

export function esperarLatencia(milisegundos: number = LATENCIA_SIMULADA_MS): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, milisegundos))
}

/** Crea el mismo error que produciria useApi ante una respuesta de error del backend. */
export function crearErrorPrueba(mensaje: string, estado: number, ruta: string): ErrorSolicitudApi {
  return new ErrorSolicitudApi(mensaje, estado, ruta)
}

export function obtenerMensajeError(error: unknown, mensajePorDefecto: string): string {
  if (error instanceof ErrorSolicitudApi || error instanceof Error) {
    return error.message || mensajePorDefecto
  }

  return mensajePorDefecto
}

/** Copia profunda simple para que las paginas no modifiquen los datos de prueba por referencia. */
export function copiarDatos<T>(datos: T): T {
  return JSON.parse(JSON.stringify(datos)) as T
}
