import type {
  ErroresRestablecimiento,
  FuerzaContrasena,
  RespuestaMensaje,
  SolicitudRecuperacion,
  SolicitudRestablecimiento,
} from '~/types/autenticacion'
import { useApi } from '~/composables/useApi'

const RUTA_AUTENTICACION = '/api/v1/auth'

// Reflejan los valores por defecto del backend (application.yml): password-reset.expiration-minutes,
// security.max-login-attempts y security.lock-time-duration-minutes.
export const MINUTOS_VIGENCIA_ENLACE = 15
export const INTENTOS_ANTES_DE_BLOQUEO = 3
export const MINUTOS_BLOQUEO = 15

// Mismos límites que RestablecerPasswordRequestDTO. Las reglas de complejidad corresponden a la US-5.7.
export const LONGITUD_MINIMA_CONTRASENA = 8
export const LONGITUD_MAXIMA_CONTRASENA = 72

export const SEGUNDOS_ESPERA_REENVIO = 30

const ETIQUETAS_FUERZA = ['', 'Débil', 'Media', 'Buena', 'Fuerte'] as const

/** Solo orienta al usuario: la longitud pesa más que mezclar tipos de caracteres. */
export function evaluarFuerzaContrasena(contrasena: string): FuerzaContrasena {
  if (!contrasena) {
    return { nivel: 0, etiqueta: '' }
  }

  const tiposDeCaracter = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((patron) => patron.test(contrasena)).length
  let puntos = 1

  if (contrasena.length >= LONGITUD_MINIMA_CONTRASENA) puntos += 1
  if (contrasena.length >= 12) puntos += 1
  if (contrasena.length >= 16 || (contrasena.length >= LONGITUD_MINIMA_CONTRASENA && tiposDeCaracter >= 3)) puntos += 1

  const nivel = Math.min(4, puntos) as FuerzaContrasena['nivel']
  return { nivel, etiqueta: ETIQUETAS_FUERZA[nivel] }
}

export function validarRestablecimiento(contrasena: string, confirmacion: string): ErroresRestablecimiento {
  const errores: ErroresRestablecimiento = {}

  if (!contrasena) {
    errores.contrasena = 'La nueva contraseña es obligatoria.'
  } else if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
    errores.contrasena = `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`
  } else if (contrasena.length > LONGITUD_MAXIMA_CONTRASENA) {
    errores.contrasena = `La contraseña no puede superar los ${LONGITUD_MAXIMA_CONTRASENA} caracteres.`
  }

  if (!confirmacion) {
    errores.confirmacion = 'Confirma la nueva contraseña.'
  } else if (confirmacion !== contrasena) {
    errores.confirmacion = 'Las contraseñas no coinciden.'
  }

  return errores
}

/** Recuperación de contraseña por correo (US-5.6, criterio 2). */
export function useRecuperacionContrasena() {
  const { solicitar } = useApi()

  function solicitarRecuperacion(solicitud: SolicitudRecuperacion): Promise<RespuestaMensaje> {
    return solicitar<RespuestaMensaje>(`${RUTA_AUTENTICACION}/forgot-password`, { metodo: 'POST', cuerpo: solicitud })
  }

  function restablecerContrasena(solicitud: SolicitudRestablecimiento): Promise<RespuestaMensaje> {
    return solicitar<RespuestaMensaje>(`${RUTA_AUTENTICACION}/reset-password`, { metodo: 'POST', cuerpo: solicitud })
  }

  return { solicitarRecuperacion, restablecerContrasena }
}
