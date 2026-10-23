// Tipos de US-4.3. Siguen PlantillaHorarioRequest/Response y BloqueHorarioResponse del backend.

export type TurnoEscolar = 'MANANA' | 'TARDE'

export type TipoBloqueHorario = 'PEDAGOGICO' | 'RECREO'

export type FiltroTurno = TurnoEscolar | 'TODOS'

export type FiltroEstadoPlantilla = 'ACTIVAS' | 'INACTIVAS' | 'TODAS'

/** Bloque generado por el backend; las horas llegan como "HH:mm:ss". */
export interface BloqueHorario {
  id: number
  orden: number
  tipo: TipoBloqueHorario
  horaInicio: string
  horaFin: string
}

/** Respuesta de GET /api/v1/horarios/plantillas. */
export interface PlantillaHorario {
  id: number
  nombre: string
  turno: TurnoEscolar
  horaInicio: string
  horaFin: string
  duracionHoraPedagogicaMinutos: number
  cantidadBloquesPedagogicos: number
  activo: boolean
  bloques: BloqueHorario[]
}

export interface RecreoHorario {
  despuesDeBloque: number
  duracionMinutos: number
}

/** Cuerpo de POST y PUT /api/v1/horarios/plantillas. */
export interface SolicitudPlantillaHorario {
  nombre: string
  turno: TurnoEscolar
  horaInicio: string
  horaFin: string
  duracionHoraPedagogicaMinutos: number
  cantidadBloquesPedagogicos: number
  recreos: RecreoHorario[]
}

/** Estado del formulario: las horas se manejan como "HH:mm", igual que el input de tipo time. */
export interface FormularioPlantilla {
  nombre: string
  turno: TurnoEscolar
  horaInicio: string
  horaFin: string
  duracionHoraPedagogicaMinutos: number | null
  cantidadBloquesPedagogicos: number | null
  recreos: RecreoHorario[]
}

export type ErroresPlantilla = Partial<
  Record<'nombre' | 'turno' | 'horaInicio' | 'horaFin' | 'duracion' | 'cantidad' | 'recreos' | 'jornada', string>
>

/** Bloque calculado en el front para la vista previa (o leído del backend), en minutos desde las 00:00. */
export interface BloqueCalculado {
  tipo: TipoBloqueHorario
  /** Número de hora pedagógica; en los recreos, la hora después de la que van. */
  numero: number
  inicio: number
  fin: number
}

export interface ResumenPlantilla {
  bloques: BloqueCalculado[]
  inicioJornada: number
  finJornada: number
  /** Minuto en que termina el último bloque. */
  finBloques: number
  minutosSinUsar: number
  cantidadRecreos: number
}
