// Contrato de /api/v1/auth: refleja LoginRequestDTO, AuthResponseDTO y UsuarioPerfilDTO del backend.

export type RolUsuario = 'ADMINISTRADOR' | 'DOCENTE' | 'ALUMNO' | 'APODERADO'

export interface SolicitudInicioSesion {
  username: string
  password: string
}

export interface UsuarioPerfil {
  id: number
  username: string
  rol: RolUsuario
  nombreCompleto: string
  dni: string
}

export interface RespuestaInicioSesion {
  token: string
  tokenType: string
  expiresIn: number
  usuario: UsuarioPerfil
}

/** Cuerpo de POST /api/v1/auth/forgot-password. */
export interface SolicitudRecuperacion {
  correo: string
}

/** Cuerpo de POST /api/v1/auth/reset-password. */
export interface SolicitudRestablecimiento {
  token: string
  password: string
}

export interface RespuestaMensaje {
  message: string
}

export interface FuerzaContrasena {
  /** 0 = vacía; 1 a 4 = débil, media, buena, fuerte. */
  nivel: 0 | 1 | 2 | 3 | 4
  etiqueta: string
}

export interface ErroresRestablecimiento {
  contrasena?: string
  confirmacion?: string
}
