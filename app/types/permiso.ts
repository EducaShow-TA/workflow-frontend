export interface Permiso {
  codigo: string
  modulo: string
  nombre: string
  descripcion: string
  sensible: boolean
}

export interface ReglaRuta {
  prefijo: string
  permiso: string
}

export interface ModuloPermisos {
  modulo: string
  permisos: Permiso[]
}
