// Contrato de /api/v1/horarios/secciones y /api/v1/aulas (HU 4.1, 4.2 y 4.4).
import type { TurnoEscolar } from '~/types/plantillaHorario'

export type DiaSemana = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY'

export type TipoConflicto = 'CELDA' | 'DOCENTE' | 'AULA' | 'CAPACIDAD'

export interface SesionHorario {
  id: number
  bloqueId: number
  dia: DiaSemana
  areaCodigo: string
  areaNombre: string
  docenteId: number
  docenteNombre: string
  aulaId: number
  aulaCodigo: string
}

export interface BloqueGrilla {
  id: number
  orden: number
  tipo: 'PEDAGOGICO' | 'RECREO'
  horaInicio: string
  horaFin: string
  sesiones: SesionHorario[]
}

export interface HorarioSeccion {
  id: number
  seccionId: number
  seccionNombre: string
  anio: number
  plantillaId: number
  plantillaNombre: string
  turno: TurnoEscolar
  dias: DiaSemana[]
  bloques: BloqueGrilla[]
}

export interface SolicitudSesionHorario {
  bloqueId: number
  dia: DiaSemana
  areaCodigo: string
  docenteId: number
  aulaId: number
}

export interface ConflictoSesion {
  tipo: TipoConflicto
  mensaje: string
}

export interface ValidacionSesion {
  valida: boolean
  conflictos: ConflictoSesion[]
}

export interface Aula {
  id: number
  codigo: string
  capacidad: number
  descripcion: string | null
  activo: boolean
}

export interface SolicitudAula {
  codigo: string
  capacidad: number
  descripcion: string
}
