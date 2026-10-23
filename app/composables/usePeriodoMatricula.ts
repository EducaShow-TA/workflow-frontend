import type { VarianteInsignia } from '~/types/interfaz'
import type {
  ErroresPeriodoMatricula,
  EstadoPeriodo,
  PeriodoMatricula,
  SolicitudPeriodoMatricula,
} from '~/types/periodoMatricula'
import { useApi } from '~/composables/useApi'
import { copiarDatos, crearErrorPrueba, esperarLatencia, usarDatosPrueba } from '~/composables/useDatosPrueba'
import { esFechaIsoValida, formatearFecha, obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerPrimerError } from '~/composables/useValidacion'

const RUTA_PERIODOS = '/api/v1/periodos-matricula'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic']

/**
 * Equivale a PeriodoMatricula.getEstado() (US-1.1, criterio 3).
 * Las fechas son yyyy-MM-dd, por eso la comparacion de textos respeta el orden cronologico.
 * La fecha limite es inclusiva: el ultimo dia todavia se puede matricular.
 */
export function calcularEstadoPeriodo(fechaInicio: string, fechaLimite: string, fechaHoy: string): EstadoPeriodo {
  if (fechaHoy < fechaInicio) {
    return 'PENDIENTE'
  }

  return fechaHoy > fechaLimite ? 'VENCIDO' : 'VIGENTE'
}

export function obtenerEtiquetaEstadoPeriodo(estado: EstadoPeriodo): string {
  const etiquetas: Record<EstadoPeriodo, string> = {
    PENDIENTE: 'Pendiente',
    VIGENTE: 'Vigente',
    VENCIDO: 'Vencido',
  }

  return etiquetas[estado]
}

export function obtenerVarianteEstadoPeriodo(estado: EstadoPeriodo): VarianteInsignia {
  const variantes: Record<EstadoPeriodo, VarianteInsignia> = {
    PENDIENTE: 'informacion',
    VIGENTE: 'exito',
    VENCIDO: 'neutro',
  }

  return variantes[estado]
}

/** Equivale a PeriodoMatricula.estaVigente(). Solo en este estado se permiten matriculas (criterio 4). */
export function estaPeriodoVigente(periodo: Pick<PeriodoMatricula, 'estado'>): boolean {
  return periodo.estado === 'VIGENTE'
}

/** Nombre corto del periodo a partir de sus fechas, por ejemplo "Dic 2026 – Feb 2027" o "Ene – Feb 2026". */
export function describirPeriodo(periodo: Pick<PeriodoMatricula, 'fechaInicio' | 'fechaLimite'>): string {
  const [anhioInicio, mesInicio] = periodo.fechaInicio.split('-').map(Number) as [number, number]
  const [anhioLimite, mesLimite] = periodo.fechaLimite.split('-').map(Number) as [number, number]
  const inicio = MESES[mesInicio - 1]
  const limite = MESES[mesLimite - 1]

  if (anhioInicio !== anhioLimite) {
    return `${inicio} ${anhioInicio} – ${limite} ${anhioLimite}`
  }

  return mesInicio === mesLimite ? `${inicio} ${anhioInicio}` : `${inicio} – ${limite} ${anhioInicio}`
}

/** Un periodo vencido con matriculas es historia: no se edita, aunque si se puede desactivar. */
export function obtenerMotivoNoEditable(periodo: Pick<PeriodoMatricula, 'estado' | 'tieneMatriculas'>): string {
  return periodo.estado === 'VENCIDO' && periodo.tieneMatriculas
    ? 'Tiene matrículas registradas: no se puede modificar.'
    : ''
}

/** Periodo activo cuyas fechas se cruzan con las indicadas (ambas inclusivas), sin contar el que se edita. */
export function buscarCruce(
  solicitud: SolicitudPeriodoMatricula,
  periodosExistentes: PeriodoMatricula[],
  idEnEdicion: number | null = null,
): PeriodoMatricula | undefined {
  return periodosExistentes.find(
    (periodo) =>
      periodo.id !== idEnEdicion &&
      periodo.fechaInicio <= solicitud.fechaLimite &&
      periodo.fechaLimite >= solicitud.fechaInicio,
  )
}

/**
 * Equivale a PeriodoMatricula.validarFechas() mas la regla de no cruzarse con otro periodo.
 * El backend vuelve a validar; esta validacion solo evita enviar datos que seguro seran rechazados.
 */
export function validarPeriodoMatricula(
  solicitud: SolicitudPeriodoMatricula,
  periodosExistentes: PeriodoMatricula[] = [],
  idEnEdicion: number | null = null,
): ErroresPeriodoMatricula {
  const errores: ErroresPeriodoMatricula = {}

  if (!esFechaIsoValida(solicitud.fechaInicio)) {
    errores.fechaInicio = 'La fecha de inicio es obligatoria.'
  }

  if (!esFechaIsoValida(solicitud.fechaLimite)) {
    errores.fechaLimite = 'La fecha límite es obligatoria.'
  } else if (!errores.fechaInicio && solicitud.fechaLimite <= solicitud.fechaInicio) {
    errores.fechaLimite = 'La fecha límite debe ser posterior a la fecha de inicio.'
  }

  if (!errores.fechaInicio && !errores.fechaLimite) {
    const cruce = buscarCruce(solicitud, periodosExistentes, idEnEdicion)

    if (cruce) {
      errores.fechaInicio = `Se cruza con el periodo del ${formatearFecha(cruce.fechaInicio)} al ${formatearFecha(cruce.fechaLimite)}. Elige fechas que no se superpongan.`
    }
  }

  return errores
}

// Datos de prueba: se usan solo si NUXT_PUBLIC_DATOS_PRUEBA incluye "periodos-matricula".
let siguienteIdPrueba = 3

const periodosPrueba: Omit<PeriodoMatricula, 'estado'>[] = [
  { id: 1, fechaInicio: '2026-01-05', fechaLimite: '2026-02-27', tieneMatriculas: true },
  { id: 2, fechaInicio: '2026-12-01', fechaLimite: '2027-02-26', tieneMatriculas: false },
]

function completarEstado(periodo: Omit<PeriodoMatricula, 'estado'>): PeriodoMatricula {
  return {
    ...periodo,
    estado: calcularEstadoPeriodo(periodo.fechaInicio, periodo.fechaLimite, obtenerFechaHoyIso()),
  }
}

function listarPeriodosPrueba(): PeriodoMatricula[] {
  return copiarDatos(periodosPrueba)
    .map(completarEstado)
    .sort((primero, segundo) => segundo.fechaInicio.localeCompare(primero.fechaInicio))
}

function validarEnPrueba(solicitud: SolicitudPeriodoMatricula, idEnEdicion: number | null, ruta: string): void {
  const periodos = listarPeriodosPrueba()
  const errores = validarPeriodoMatricula(solicitud, periodos, idEnEdicion)
  const primerError = obtenerPrimerError(errores)

  if (primerError) {
    throw crearErrorPrueba(primerError, buscarCruce(solicitud, periodos, idEnEdicion) ? 409 : 422, ruta)
  }
}

function buscarIndicePrueba(id: number, ruta: string): number {
  const indice = periodosPrueba.findIndex((periodo) => periodo.id === id)

  if (indice === -1) {
    throw crearErrorPrueba('No existe el periodo de matrícula', 404, ruta)
  }

  return indice
}

/** Acceso a los periodos de matricula (US-1.1). */
export function usePeriodoMatricula() {
  const { solicitar } = useApi()

  async function listarPeriodos(): Promise<PeriodoMatricula[]> {
    if (usarDatosPrueba('periodos-matricula')) {
      await esperarLatencia()
      return listarPeriodosPrueba()
    }

    return solicitar<PeriodoMatricula[]>(RUTA_PERIODOS)
  }

  async function registrarPeriodo(solicitud: SolicitudPeriodoMatricula): Promise<PeriodoMatricula> {
    if (usarDatosPrueba('periodos-matricula')) {
      await esperarLatencia()
      validarEnPrueba(solicitud, null, RUTA_PERIODOS)

      const nuevo = { id: siguienteIdPrueba++, ...solicitud, tieneMatriculas: false }
      periodosPrueba.push(nuevo)
      return completarEstado(copiarDatos(nuevo))
    }

    return solicitar<PeriodoMatricula>(RUTA_PERIODOS, { metodo: 'POST', cuerpo: solicitud })
  }

  async function actualizarPeriodo(id: number, solicitud: SolicitudPeriodoMatricula): Promise<PeriodoMatricula> {
    const ruta = `${RUTA_PERIODOS}/${id}`

    if (usarDatosPrueba('periodos-matricula')) {
      await esperarLatencia()
      const indice = buscarIndicePrueba(id, ruta)
      const motivo = obtenerMotivoNoEditable(completarEstado(periodosPrueba[indice]!))

      if (motivo) {
        throw crearErrorPrueba(motivo, 422, ruta)
      }

      validarEnPrueba(solicitud, id, ruta)
      periodosPrueba[indice] = { ...periodosPrueba[indice]!, ...solicitud }
      return completarEstado(copiarDatos(periodosPrueba[indice]!))
    }

    return solicitar<PeriodoMatricula>(ruta, { metodo: 'PUT', cuerpo: solicitud })
  }

  async function desactivarPeriodo(id: number): Promise<void> {
    const ruta = `${RUTA_PERIODOS}/${id}`

    if (usarDatosPrueba('periodos-matricula')) {
      await esperarLatencia()
      periodosPrueba.splice(buscarIndicePrueba(id, ruta), 1)
      return
    }

    await solicitar<unknown>(ruta, { metodo: 'DELETE' })
  }

  async function obtenerPeriodoVigente(): Promise<PeriodoMatricula | null> {
    const periodos = await listarPeriodos()
    return periodos.find(estaPeriodoVigente) ?? null
  }

  return {
    listarPeriodos,
    registrarPeriodo,
    actualizarPeriodo,
    desactivarPeriodo,
    obtenerPeriodoVigente,
  }
}
