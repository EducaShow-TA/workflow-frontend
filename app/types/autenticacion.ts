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
