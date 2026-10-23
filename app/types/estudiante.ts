export type EstadoEstudiante = 'REGISTRADO'

export interface EstudianteListado {
  codigo: string
  nombres: string
  apellidos: string
  correoElectronico: string
  numeroDocumento: string
  grado: string
  seccion: string
  estado: EstadoEstudiante
  avatar?: string
}
