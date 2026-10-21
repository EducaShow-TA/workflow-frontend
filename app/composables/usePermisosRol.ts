import { computed } from 'vue'
import type { RolUsuario } from '~/types/autenticacion'
import type { ModuloPermisos, Permiso, ReglaRuta } from '~/types/permiso'
import { useAutenticacionStore } from '~/stores/autenticacion'

export const ROLES: RolUsuario[] = ['ADMINISTRADOR', 'DOCENTE', 'ALUMNO', 'APODERADO']

const NOMBRES_ROL: Record<RolUsuario, string> = {
  ADMINISTRADOR: 'Administrador',
  DOCENTE: 'Docente',
  ALUMNO: 'Alumno',
  APODERADO: 'Apoderado',
}

const DESCRIPCIONES_ROL: Record<RolUsuario, string> = {
  ADMINISTRADOR: 'Gestiona la matrícula, la estructura académica y las cuentas de usuario del colegio.',
  DOCENTE: 'Registrará asistencia y calificaciones de sus secciones (sprints 2 y 3).',
  ALUMNO: 'Consultará su horario, asistencia y calificaciones (sprints 2 y 3).',
  APODERADO: 'Consultará las boletas, pagos y el avance de sus hijos (sprints 2 y 3).',
}

export const PERMISOS: Permiso[] = [
  {
    codigo: 'PANEL_VER',
    modulo: 'Panel',
    nombre: 'Ver panel',
    descripcion: 'Consultar los indicadores generales del colegio.',
    sensible: false,
  },
  {
    codigo: 'ESTUDIANTE_VER',
    modulo: 'Estudiantes',
    nombre: 'Ver estudiantes',
    descripcion: 'Consultar el listado de estudiantes registrados.',
    sensible: false,
  },
  {
    codigo: 'ESTUDIANTE_REGISTRAR',
    modulo: 'Estudiantes',
    nombre: 'Registrar estudiantes',
    descripcion: 'Registrar estudiantes nuevos y sus apoderados.',
    sensible: false,
  },
  {
    codigo: 'MATRICULA_REGISTRAR',
    modulo: 'Matrícula',
    nombre: 'Registrar matrículas',
    descripcion: 'Asignar grado y sección a un estudiante.',
    sensible: false,
  },
  {
    codigo: 'MATRICULA_ELIMINAR',
    modulo: 'Matrícula',
    nombre: 'Eliminar matrículas',
    descripcion: 'Quitar la matrícula de un estudiante en un periodo.',
    sensible: true,
  },
  {
    codigo: 'PERIODO_CONFIGURAR',
    modulo: 'Matrícula',
    nombre: 'Configurar periodo',
    descripcion: 'Definir la fecha de inicio y la fecha límite de la matrícula.',
    sensible: false,
  },
  {
    codigo: 'SECCION_VER',
    modulo: 'Grados y secciones',
    nombre: 'Ver vacantes',
    descripcion: 'Consultar la capacidad y las vacantes de cada sección.',
    sensible: false,
  },
  {
    codigo: 'SECCION_GESTIONAR',
    modulo: 'Grados y secciones',
    nombre: 'Gestionar secciones',
    descripcion: 'Agregar secciones y modificar su capacidad máxima.',
    sensible: false,
  },
  {
    codigo: 'COMPETENCIA_VER',
    modulo: 'Competencias',
    nombre: 'Ver catálogo',
    descripcion: 'Consultar las áreas curriculares y sus competencias.',
    sensible: false,
  },
  {
    codigo: 'COMPETENCIA_GESTIONAR',
    modulo: 'Competencias',
    nombre: 'Gestionar catálogo',
    descripcion: 'Crear, editar, activar y desactivar áreas y competencias.',
    sensible: false,
  },
  {
    codigo: 'COMPETENCIA_ELIMINAR',
    modulo: 'Competencias',
    nombre: 'Eliminar competencias',
    descripcion: 'Eliminar competencias sin notas registradas.',
    sensible: true,
  },
  {
    codigo: 'USUARIO_VER',
    modulo: 'Usuarios y permisos',
    nombre: 'Ver usuarios',
    descripcion: 'Consultar las cuentas de usuario y su rol.',
    sensible: false,
  },
  {
    codigo: 'USUARIO_CREAR',
    modulo: 'Usuarios y permisos',
    nombre: 'Crear usuarios',
    descripcion: 'Crear cuentas y asignarles un rol.',
    sensible: false,
  },
  {
    codigo: 'USUARIO_EDITAR',
    modulo: 'Usuarios y permisos',
    nombre: 'Editar usuarios',
    descripcion: 'Corregir los nombres, apellidos y correo de una cuenta.',
    sensible: false,
  },
  {
    codigo: 'PERMISO_VER',
    modulo: 'Usuarios y permisos',
    nombre: 'Ver roles y permisos',
    descripcion: 'Consultar qué puede hacer cada rol.',
    sensible: false,
  },
]

export const PERMISOS_POR_ROL: Record<RolUsuario, string[]> = {
  ADMINISTRADOR: PERMISOS.map((permiso) => permiso.codigo),
  DOCENTE: [],
  ALUMNO: [],
  APODERADO: [],
}

export const REGLAS_RUTA: ReglaRuta[] = [
  { prefijo: '/panel', permiso: 'PANEL_VER' },
  { prefijo: '/estudiantes', permiso: 'ESTUDIANTE_VER' },
  { prefijo: '/estudiantes/nuevo', permiso: 'ESTUDIANTE_REGISTRAR' },
  { prefijo: '/matriculas/nueva', permiso: 'MATRICULA_REGISTRAR' },
  { prefijo: '/matriculas/periodo', permiso: 'PERIODO_CONFIGURAR' },
  { prefijo: '/secciones', permiso: 'SECCION_VER' },
  { prefijo: '/competencias', permiso: 'COMPETENCIA_VER' },
  { prefijo: '/usuarios', permiso: 'USUARIO_VER' },
  { prefijo: '/usuarios/nuevo', permiso: 'USUARIO_CREAR' },
  { prefijo: '/usuarios/*/editar', permiso: 'USUARIO_EDITAR' },
  { prefijo: '/roles-permisos', permiso: 'PERMISO_VER' },
]

export const RUTAS_LIBRES = ['/', '/login', '/acceso-denegado']

export function obtenerNombreRol(rol: RolUsuario): string {
  return NOMBRES_ROL[rol]
}

export function obtenerDescripcionRol(rol: RolUsuario): string {
  return DESCRIPCIONES_ROL[rol]
}

export function tienePermiso(rol: RolUsuario, codigo: string): boolean {
  return PERMISOS_POR_ROL[rol].includes(codigo)
}

function contarSegmentos(ruta: string): number {
  return ruta.split('/').filter(Boolean).length
}

function coincidePrefijo(ruta: string, prefijo: string): boolean {
  const segmentosRuta = ruta.split('/').filter(Boolean)
  const segmentosPrefijo = prefijo.split('/').filter(Boolean)

  return (
    segmentosRuta.length >= segmentosPrefijo.length &&
    segmentosPrefijo.every((segmento, indice) => segmento === '*' || segmento === segmentosRuta[indice])
  )
}

export function buscarReglaRuta(ruta: string): ReglaRuta | undefined {
  return REGLAS_RUTA.filter((regla) => coincidePrefijo(ruta, regla.prefijo)).sort(
    (primera, segunda) => contarSegmentos(segunda.prefijo) - contarSegmentos(primera.prefijo),
  )[0]
}

export function puedeAcceder(rol: RolUsuario, ruta: string): boolean {
  if (RUTAS_LIBRES.includes(ruta)) {
    return true
  }

  const regla = buscarReglaRuta(ruta)

  // Una ruta sin regla queda solo para el administrador: lo no registrado nace cerrado.
  return regla ? tienePermiso(rol, regla.permiso) : rol === 'ADMINISTRADOR'
}

export function agruparPorModulo(permisos: Permiso[]): ModuloPermisos[] {
  const grupos: ModuloPermisos[] = []

  for (const permiso of permisos) {
    const grupo = grupos.find((existente) => existente.modulo === permiso.modulo)

    if (grupo) {
      grupo.permisos.push(permiso)
    } else {
      grupos.push({ modulo: permiso.modulo, permisos: [permiso] })
    }
  }

  return grupos
}

export function listarPermisosPorModulo(rol: RolUsuario): ModuloPermisos[] {
  return agruparPorModulo(PERMISOS.filter((permiso) => tienePermiso(rol, permiso.codigo)))
}

export function listarModulosPermitidos(rol: RolUsuario): string[] {
  return listarPermisosPorModulo(rol).map((grupo) => grupo.modulo)
}

export function usePermisosRol() {
  const autenticacion = useAutenticacionStore()

  const rolActual = computed<RolUsuario | null>(() => autenticacion.usuario?.rol ?? null)

  function puede(codigo: string): boolean {
    return rolActual.value !== null && tienePermiso(rolActual.value, codigo)
  }

  return {
    rolActual,
    puede,
  }
}
