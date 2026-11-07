export type TipoDocumento = 'DNI' | 'PASAPORTE'

export interface ApoderadoRegistro {
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  parentesco: string
  tipoDocumento: TipoDocumento
  numeroDocumento: string
  celular: string
  correoElectronico: string
  esPrincipal: boolean
}

export interface RegistroEstudiante {
  username: string
  password: string
  tipoDocumento: TipoDocumento
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  numeroDocumento: string
  fechaNacimiento: string
  genero: string
  nacionalidad: string
  correoElectronico: string
  celular: string
  direccion: string
  apoderados: ApoderadoRegistro[]
}
