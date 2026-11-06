import { useApi } from '~/composables/useApi'
import type { PlantillaHorario } from '~/types/plantillaHorario'
import type { Seccion } from '~/types/seccion'
import type {
  Aula,
  DiaSemana,
  HorarioSeccion,
  SesionHorario,
  SolicitudAula,
  SolicitudSesionHorario,
  TipoConflicto,
  ValidacionSesion,
} from '~/types/horarioSeccion'

const RUTA = '/api/v1/horarios/secciones'

const NOMBRES_DIA: Record<DiaSemana, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
}

const ETIQUETAS_CONFLICTO: Record<TipoConflicto, string> = {
  CELDA: 'Bloque ocupado',
  DOCENTE: 'Cruce de docente',
  AULA: 'Aula ocupada',
  CAPACIDAD: 'Aforo excedido',
}

export function nombreDia(dia: DiaSemana): string {
  return NOMBRES_DIA[dia]
}

export function etiquetaConflicto(tipo: TipoConflicto): string {
  return ETIQUETAS_CONFLICTO[tipo]
}

/** HU 4.1, 4.2 y 4.4: horario semanal por sección con validación de cruces y aforo. */
export function useHorarioSeccion() {
  const { solicitar } = useApi()

  return {
    listarSecciones: () => solicitar<Seccion[]>('/api/v1/secciones'),
    listarPlantillas: () => solicitar<PlantillaHorario[]>('/api/v1/horarios/plantillas'),
    listarAulas: () => solicitar<Aula[]>('/api/v1/aulas'),
    crearAula: (solicitud: SolicitudAula) =>
      solicitar<Aula>('/api/v1/aulas', {
        metodo: 'POST',
        cuerpo: { ...solicitud, descripcion: solicitud.descripcion || null },
      }),
    obtener: (seccionId: number, anio: number) =>
      solicitar<HorarioSeccion>(`${RUTA}?seccionId=${seccionId}&anio=${anio}`),
    crear: (seccionId: number, anio: number, plantillaId: number) =>
      solicitar<HorarioSeccion>(RUTA, { metodo: 'POST', cuerpo: { seccionId, anio, plantillaId } }),
    validar: (horarioId: number, solicitud: SolicitudSesionHorario, excluirSesionId?: number) =>
      solicitar<ValidacionSesion>(
        `${RUTA}/${horarioId}/sesiones/validar${excluirSesionId ? `?excluirSesionId=${excluirSesionId}` : ''}`,
        { metodo: 'POST', cuerpo: solicitud },
      ),
    agregar: (horarioId: number, solicitud: SolicitudSesionHorario) =>
      solicitar<SesionHorario>(`${RUTA}/${horarioId}/sesiones`, { metodo: 'POST', cuerpo: solicitud }),
    actualizar: (horarioId: number, sesionId: number, solicitud: SolicitudSesionHorario) =>
      solicitar<SesionHorario>(`${RUTA}/${horarioId}/sesiones/${sesionId}`, { metodo: 'PUT', cuerpo: solicitud }),
    eliminar: (horarioId: number, sesionId: number) =>
      solicitar<unknown>(`${RUTA}/${horarioId}/sesiones/${sesionId}`, { metodo: 'DELETE' }),
  }
}
