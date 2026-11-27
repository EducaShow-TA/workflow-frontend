import type { CredencialTemporal } from '~/types/credencial'

export type ParentescoApoderado = 'PADRE' | 'MADRE' | 'TUTOR_LEGAL' | 'OTRO'
export type TipoDocumentoApoderado = 'DNI' | 'PASAPORTE'

/** Vínculo de un apoderado con el estudiante (API /api/v1/estudiantes/{id}/apoderados). */
export interface VinculoApoderado {
  apoderadoId: number
  tipoDocumento: TipoDocumentoApoderado
  numeroDocumento: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  celular: string | null
  correoElectronico: string | null
  parentesco: ParentescoApoderado
  esPrincipal: boolean
  username: string | null
  contrasenhaTemporal: string | null
}

/** Resultado de verificar un documento antes de vincularlo (contacto enmascarado por el back). */
export interface VerificacionApoderado {
  existe: boolean
  puedeVincularse: boolean
  motivo: string | null
  nombreCompleto: string | null
  celularEnmascarado: string | null
  correoEnmascarado: string | null
  tieneCuenta: boolean
}

export interface SolicitudVincularApoderado {
  tipoDocumento: TipoDocumentoApoderado
  numeroDocumento: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  celular: string
  correoElectronico: string
  parentesco: ParentescoApoderado | ''
  esPrincipal: boolean
}

export interface SolicitudEditarApoderado {
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  celular: string
  correoElectronico: string
  parentesco: ParentescoApoderado
  esPrincipal: boolean
}

/** Credenciales temporales de una cuenta de apoderado. */
export type CredencialApoderado = CredencialTemporal
