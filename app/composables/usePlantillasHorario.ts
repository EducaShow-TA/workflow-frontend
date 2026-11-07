import type {
  BloqueCalculado,
  ErroresPlantilla,
  FiltroEstadoPlantilla,
  FiltroTurno,
  FormularioPlantilla,
  PlantillaHorario,
  ResumenPlantilla,
  SolicitudPlantillaHorario,
  TurnoEscolar,
} from '~/types/plantillaHorario'
import { useApi } from '~/composables/useApi'

const RUTA_PLANTILLAS = '/api/v1/horarios/plantillas'

// Límites de PlantillaHorarioRequest y RecreoHorarioRequest.
export const LONGITUD_MAXIMA_NOMBRE_PLANTILLA = 100
export const DURACION_MAXIMA_MINUTOS = 240
export const CANTIDAD_MAXIMA_BLOQUES = 20
export const CANTIDAD_MAXIMA_RECREOS = 20
export const DURACION_RECREO_POR_DEFECTO = 15

/** El turno mañana empieza antes del mediodía y el de la tarde desde el mediodía. */
const MEDIODIA = 12 * 60

export const TURNOS: TurnoEscolar[] = ['MANANA', 'TARDE']

export function obtenerNombreTurno(turno: TurnoEscolar): string {
  return turno === 'MANANA' ? 'Mañana' : 'Tarde'
}

/** "07:30" o "07:30:00" a minutos desde las 00:00. */
export function convertirAMinutos(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number) as [number, number]
  return horas * 60 + minutos
}

export function formatearMinutos(totalMinutos: number): string {
  const horas = Math.floor(totalMinutos / 60)
  const minutos = totalMinutos % 60
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

/** El backend devuelve "HH:mm:ss"; el input de tipo time trabaja con "HH:mm". */
export function recortarHora(hora: string): string {
  return hora.slice(0, 5)
}

export function crearPlantillaVacia(): FormularioPlantilla {
  return {
    nombre: '',
    turno: 'MANANA',
    horaInicio: '07:30',
    horaFin: '13:15',
    duracionHoraPedagogicaMinutos: 45,
    cantidadBloquesPedagogicos: 7,
    recreos: [
      { despuesDeBloque: 3, duracionMinutos: DURACION_RECREO_POR_DEFECTO },
      { despuesDeBloque: 5, duracionMinutos: DURACION_RECREO_POR_DEFECTO },
    ],
  }
}

/** El backend no devuelve los recreos por separado: se reconstruyen contando las horas antes de cada recreo. */
export function crearFormularioDesdePlantilla(plantilla: PlantillaHorario): FormularioPlantilla {
  const recreos: FormularioPlantilla['recreos'] = []
  let horasPrevias = 0

  for (const bloque of [...plantilla.bloques].sort((primero, segundo) => primero.orden - segundo.orden)) {
    if (bloque.tipo === 'PEDAGOGICO') {
      horasPrevias += 1
    } else {
      recreos.push({
        despuesDeBloque: horasPrevias,
        duracionMinutos: convertirAMinutos(bloque.horaFin) - convertirAMinutos(bloque.horaInicio),
      })
    }
  }

  return {
    nombre: plantilla.nombre,
    turno: plantilla.turno,
    horaInicio: recortarHora(plantilla.horaInicio),
    horaFin: recortarHora(plantilla.horaFin),
    duracionHoraPedagogicaMinutos: plantilla.duracionHoraPedagogicaMinutos,
    cantidadBloquesPedagogicos: plantilla.cantidadBloquesPedagogicos,
    recreos,
  }
}

function esEnteroEntre(valor: number | null, minimo: number, maximo: number): valor is number {
  return valor !== null && Number.isInteger(valor) && valor >= minimo && valor <= maximo
}

/** Mismo cálculo que PlantillaHorarioService.generarBloques: horas seguidas y un recreo después de la hora indicada. */
export function calcularBloques(formulario: FormularioPlantilla): BloqueCalculado[] {
  const duracion = formulario.duracionHoraPedagogicaMinutos
  const cantidad = formulario.cantidadBloquesPedagogicos

  if (
    !formulario.horaInicio ||
    !esEnteroEntre(duracion, 1, DURACION_MAXIMA_MINUTOS) ||
    !esEnteroEntre(cantidad, 1, CANTIDAD_MAXIMA_BLOQUES)
  ) {
    return []
  }

  const recreosPorHora = new Map(
    formulario.recreos
      .filter((recreo) => recreo.duracionMinutos > 0)
      .map((recreo) => [recreo.despuesDeBloque, recreo.duracionMinutos]),
  )
  const bloques: BloqueCalculado[] = []
  let inicio = convertirAMinutos(formulario.horaInicio)

  for (let numero = 1; numero <= cantidad; numero++) {
    bloques.push({ tipo: 'PEDAGOGICO', numero, inicio, fin: inicio + duracion })
    inicio += duracion

    const recreo = recreosPorHora.get(numero)
    if (recreo) {
      bloques.push({ tipo: 'RECREO', numero, inicio, fin: inicio + recreo })
      inicio += recreo
    }
  }

  return bloques
}

export function convertirBloquesDelBackend(plantilla: PlantillaHorario): BloqueCalculado[] {
  let horasPrevias = 0

  return [...plantilla.bloques]
    .sort((primero, segundo) => primero.orden - segundo.orden)
    .map((bloque) => {
      if (bloque.tipo === 'PEDAGOGICO') {
        horasPrevias += 1
      }

      return {
        tipo: bloque.tipo,
        numero: horasPrevias,
        inicio: convertirAMinutos(bloque.horaInicio),
        fin: convertirAMinutos(bloque.horaFin),
      }
    })
}

export function resumirBloques(bloques: BloqueCalculado[], horaInicio: string, horaFin: string): ResumenPlantilla {
  const inicioJornada = horaInicio ? convertirAMinutos(horaInicio) : 0
  const finJornada = horaFin ? convertirAMinutos(horaFin) : 0
  const finBloques = bloques.at(-1)?.fin ?? inicioJornada

  return {
    bloques,
    inicioJornada,
    finJornada,
    finBloques,
    minutosSinUsar: Math.max(0, finJornada - finBloques),
    cantidadRecreos: bloques.filter((bloque) => bloque.tipo === 'RECREO').length,
  }
}

export function resumirPlantilla(plantilla: PlantillaHorario): ResumenPlantilla {
  return resumirBloques(convertirBloquesDelBackend(plantilla), plantilla.horaInicio, plantilla.horaFin)
}

export function describirBloque(bloque: BloqueCalculado): string {
  return bloque.tipo === 'PEDAGOGICO' ? `${bloque.numero}.ª hora` : `Recreo · ${bloque.fin - bloque.inicio} min`
}

/** Validaciones de PlantillaHorarioRequest y generarBloques, para no enviar lo que el backend rechazará. */
export function validarPlantilla(
  formulario: FormularioPlantilla,
  existentes: PlantillaHorario[] = [],
  idEnEdicion: number | null = null,
): ErroresPlantilla {
  const errores: ErroresPlantilla = {}
  const nombre = formulario.nombre.trim()

  if (!nombre) {
    errores.nombre = 'El nombre es obligatorio.'
  } else if (nombre.length > LONGITUD_MAXIMA_NOMBRE_PLANTILLA) {
    errores.nombre = `El nombre no puede superar los ${LONGITUD_MAXIMA_NOMBRE_PLANTILLA} caracteres.`
  } else if (
    existentes.some(
      (plantilla) =>
        plantilla.id !== idEnEdicion &&
        plantilla.turno === formulario.turno &&
        plantilla.nombre.trim().toLowerCase() === nombre.toLowerCase(),
    )
  ) {
    errores.nombre = `Ya existe una plantilla con ese nombre en el turno ${obtenerNombreTurno(formulario.turno).toLowerCase()}.`
  }

  if (!formulario.horaInicio) {
    errores.horaInicio = 'La hora de inicio es obligatoria.'
  } else if (formulario.turno === 'MANANA' && convertirAMinutos(formulario.horaInicio) >= MEDIODIA) {
    errores.turno = 'El turno mañana debe iniciar antes de las 12:00.'
  } else if (formulario.turno === 'TARDE' && convertirAMinutos(formulario.horaInicio) < MEDIODIA) {
    errores.turno = 'El turno tarde debe iniciar desde las 12:00.'
  }

  if (!formulario.horaFin) {
    errores.horaFin = 'La hora de fin es obligatoria.'
  } else if (
    formulario.horaInicio &&
    convertirAMinutos(formulario.horaInicio) >= convertirAMinutos(formulario.horaFin)
  ) {
    errores.horaFin = 'La hora de fin debe ser posterior a la hora de inicio.'
  }

  if (!esEnteroEntre(formulario.duracionHoraPedagogicaMinutos, 1, DURACION_MAXIMA_MINUTOS)) {
    errores.duracion = `Ingresa un número entero de 1 a ${DURACION_MAXIMA_MINUTOS} minutos.`
  }

  if (!esEnteroEntre(formulario.cantidadBloquesPedagogicos, 1, CANTIDAD_MAXIMA_BLOQUES)) {
    errores.cantidad = `Ingresa un número entero de 1 a ${CANTIDAD_MAXIMA_BLOQUES}.`
  }

  const horasConRecreo = new Set<number>()
  for (const recreo of formulario.recreos) {
    if (!esEnteroEntre(recreo.duracionMinutos, 1, DURACION_MAXIMA_MINUTOS)) {
      errores.recreos = `Cada recreo debe durar de 1 a ${DURACION_MAXIMA_MINUTOS} minutos.`
    } else if (horasConRecreo.has(recreo.despuesDeBloque)) {
      errores.recreos = 'No puede haber dos recreos después de la misma hora.'
    } else if (
      formulario.cantidadBloquesPedagogicos !== null &&
      recreo.despuesDeBloque > formulario.cantidadBloquesPedagogicos
    ) {
      errores.recreos = 'Hay un recreo después de una hora que no existe.'
    }
    horasConRecreo.add(recreo.despuesDeBloque)
  }

  if (!errores.horaInicio && !errores.horaFin && !errores.duracion && !errores.cantidad && !errores.recreos) {
    const resumen = resumirBloques(calcularBloques(formulario), formulario.horaInicio, formulario.horaFin)

    if (resumen.finBloques > resumen.finJornada) {
      errores.jornada = `Las horas y recreos terminan a las ${formatearMinutos(resumen.finBloques)}: superan el fin de la jornada por ${resumen.finBloques - resumen.finJornada} min.`
    }
  }

  return errores
}

export function construirSolicitudPlantilla(formulario: FormularioPlantilla): SolicitudPlantillaHorario {
  return {
    nombre: formulario.nombre.trim(),
    turno: formulario.turno,
    horaInicio: formulario.horaInicio,
    horaFin: formulario.horaFin,
    duracionHoraPedagogicaMinutos: formulario.duracionHoraPedagogicaMinutos ?? 0,
    cantidadBloquesPedagogicos: formulario.cantidadBloquesPedagogicos ?? 0,
    recreos: [...formulario.recreos].sort((primero, segundo) => primero.despuesDeBloque - segundo.despuesDeBloque),
  }
}

export function filtrarPlantillas(
  plantillas: PlantillaHorario[],
  turno: FiltroTurno,
  estado: FiltroEstadoPlantilla,
): PlantillaHorario[] {
  return plantillas.filter(
    (plantilla) =>
      (turno === 'TODOS' || plantilla.turno === turno) &&
      (estado === 'TODAS' || plantilla.activo === (estado === 'ACTIVAS')),
  )
}

/** Acceso a las plantillas de bloques horarios (US-4.3). */
export function usePlantillasHorario() {
  const { solicitar } = useApi()

  function listarPlantillas(): Promise<PlantillaHorario[]> {
    return solicitar<PlantillaHorario[]>(RUTA_PLANTILLAS)
  }

  function obtenerPlantilla(id: number): Promise<PlantillaHorario> {
    return solicitar<PlantillaHorario>(`${RUTA_PLANTILLAS}/${id}`)
  }

  function crearPlantilla(solicitud: SolicitudPlantillaHorario): Promise<PlantillaHorario> {
    return solicitar<PlantillaHorario>(RUTA_PLANTILLAS, { metodo: 'POST', cuerpo: solicitud })
  }

  function actualizarPlantilla(id: number, solicitud: SolicitudPlantillaHorario): Promise<PlantillaHorario> {
    return solicitar<PlantillaHorario>(`${RUTA_PLANTILLAS}/${id}`, { metodo: 'PUT', cuerpo: solicitud })
  }

  function cambiarEstadoPlantilla(id: number, activo: boolean): Promise<PlantillaHorario> {
    return solicitar<PlantillaHorario>(`${RUTA_PLANTILLAS}/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } })
  }

  return {
    listarPlantillas,
    obtenerPlantilla,
    crearPlantilla,
    actualizarPlantilla,
    cambiarEstadoPlantilla,
  }
}
