export type TipoDocumento = 'DNI' | 'PASAPORTE'

export interface ApoderadoRegistro {
  nombres: string
  apellidos: string
  parentesco: string
  tipoDocumento: TipoDocumento
  numeroDocumento: string
  celular: string
  correoElectronico: string
  esPrincipal: boolean
}

export interface RegistroEstudiante {
  tipoDocumento: TipoDocumento
  nombres: string
  apellidos: string
  numeroDocumento: string
  fechaNacimiento: string
  genero: string
  nacionalidad: string
  correoElectronico: string
  celular: string
  direccion: string
  apoderados: ApoderadoRegistro[]
}
