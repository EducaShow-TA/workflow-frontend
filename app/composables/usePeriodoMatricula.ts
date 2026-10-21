import type { VarianteInsignia } from '~/types/interfaz'
import type {
  ErroresPeriodoMatricula,
  EstadoPeriodo,
  PeriodoMatricula,
  SolicitudPeriodoMatricula,
} from '~/types/periodoMatricula'
import { useApi } from '~/composables/useApi'
import { copiarDatos, crearErrorPrueba, esperarLatencia, usarDatosPrueba } from '~/composables/useDatosPrueba'
import { esFechaIsoValida, obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerPrimerError } from '~/composables/useValidacion'

const RUTA_PERIODOS = '/api/v1/periodos-matricula'

/**
 * Equivale a PeriodoMatricula.getEstado() (US-1.1, criterio 3).
 * Las fechas son yyyy-MM-dd, por eso la comparacion de textos respeta el orden cronologico.
 * La fecha limite es inclusiva: el ultimo dia todavia se puede matricular.
 */
export function calcularEstadoPeriodo(fechaInicio: string, fechaFin: string, fechaHoy: string): EstadoPeriodo {
  if (fechaHoy < fechaInicio) {
    return 'PENDIENTE'
  }

  return fechaHoy > fechaFin ? 'VENCIDO' : 'VIGENTE'
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

export function existePeriodoParaAnhio(
  anhio: number,
  periodosExistentes: PeriodoMatricula[],
  idEnEdicion: number | null = null,
): boolean {
  return periodosExistentes.some((periodo) => periodo.anhio === anhio && periodo.id !== idEnEdicion)
}

/**
 * Equivale a PeriodoMatricula.validarFechas() mas las reglas propias del formulario.
 * El backend vuelve a validar; esta validacion solo evita enviar datos que seguro seran rechazados.
 */
export function validarPeriodoMatricula(
  solicitud: SolicitudPeriodoMatricula,
  periodosExistentes: PeriodoMatricula[] = [],
  idEnEdicion: number | null = null,
): ErroresPeriodoMatricula {
  const errores: ErroresPeriodoMatricula = {}

  if (!Number.isInteger(solicitud.anhio) || solicitud.anhio < 2000 || solicitud.anhio > 2100) {
    errores.anhio = 'Selecciona un año escolar válido.'
  } else if (existePeriodoParaAnhio(solicitud.anhio, periodosExistentes, idEnEdicion)) {
    // La asociacion "habilitado por" del diagrama permite un solo periodo de matricula por anio escolar.
    errores.anhio = `Ya existe un periodo de matrícula para el año ${solicitud.anhio}.`
  }

  if (!esFechaIsoValida(solicitud.fechaInicio)) {
    errores.fechaInicio = 'La fecha de inicio es obligatoria.'
  }

  if (!esFechaIsoValida(solicitud.fechaFin)) {
    errores.fechaFin = 'La fecha límite es obligatoria.'
  } else if (!errores.fechaInicio && solicitud.fechaFin <= solicitud.fechaInicio) {
    errores.fechaFin = 'La fecha límite debe ser posterior a la fecha de inicio.'
  }

  return errores
}

// Datos de prueba: se usan mientras no exista el endpoint en Spring Boot (ver usarDatosPrueba).
let siguienteIdPrueba = 3

const periodosPrueba: Omit<PeriodoMatricula, 'estado'>[] = [
  { id: 1, anhio: 2026, fechaInicio: '2026-01-05', fechaFin: '2026-02-27' },
  { id: 2, anhio: 2027, fechaInicio: '2026-12-01', fechaFin: '2027-02-26' },
]

function completarEstado(periodo: Omit<PeriodoMatricula, 'estado'>): PeriodoMatricula {
  return {
    ...periodo,
    estado: calcularEstadoPeriodo(periodo.fechaInicio, periodo.fechaFin, obtenerFechaHoyIso()),
  }
}

function listarPeriodosPrueba(): PeriodoMatricula[] {
  return copiarDatos(periodosPrueba)
    .map(completarEstado)
    .sort((primero, segundo) => segundo.anhio - primero.anhio)
}

function validarEnPrueba(solicitud: SolicitudPeriodoMatricula, idEnEdicion: number | null, ruta: string): void {
  const periodos = listarPeriodosPrueba()
  const primerError = obtenerPrimerError(validarPeriodoMatricula(solicitud, periodos, idEnEdicion))

  if (existePeriodoParaAnhio(solicitud.anhio, periodos, idEnEdicion)) {
    throw crearErrorPrueba(primerError, 409, ruta)
  }

  if (primerError) {
    throw crearErrorPrueba(primerError, 422, ruta)
  }
}

/** Acceso a los periodos de matricula (US-1.1). */
export function usePeriodoMatricula() {
  const { solicitar } = useApi()

  async function listarPeriodos(): Promise<PeriodoMatricula[]> {
    if (usarDatosPrueba()) {
      await esperarLatencia()
      return listarPeriodosPrueba()
    }

    return solicitar<PeriodoMatricula[]>(RUTA_PERIODOS)
  }

  async function registrarPeriodo(solicitud: SolicitudPeriodoMatricula): Promise<PeriodoMatricula> {
    if (usarDatosPrueba()) {
      await esperarLatencia()
      validarEnPrueba(solicitud, null, RUTA_PERIODOS)

      const nuevo = { id: siguienteIdPrueba++, ...solicitud }
      periodosPrueba.push(nuevo)
      return completarEstado(copiarDatos(nuevo))
    }

    return solicitar<PeriodoMatricula>(RUTA_PERIODOS, { metodo: 'POST', cuerpo: solicitud })
  }

  async function actualizarPeriodo(id: number, solicitud: SolicitudPeriodoMatricula): Promise<PeriodoMatricula> {
    const ruta = `${RUTA_PERIODOS}/${id}`

    if (usarDatosPrueba()) {
      await esperarLatencia()

      const indice = periodosPrueba.findIndex((periodo) => periodo.id === id)

      if (indice === -1) {
        throw crearErrorPrueba('El periodo de matrícula no existe.', 404, ruta)
      }

      validarEnPrueba(solicitud, id, ruta)

      periodosPrueba[indice] = { id, ...solicitud }
      return completarEstado(copiarDatos(periodosPrueba[indice]!))
    }

    return solicitar<PeriodoMatricula>(ruta, { metodo: 'PUT', cuerpo: solicitud })
  }

  /**
   * Periodo vigente o null si no hay ninguno. Lo usara la pantalla de matricula para permitir
   * registrar matriculas solo durante el periodo vigente (US-1.1, criterio 4).
   */
  async function obtenerPeriodoVigente(): Promise<PeriodoMatricula | null> {
    const periodos = await listarPeriodos()
    return periodos.find(estaPeriodoVigente) ?? null
  }

  return {
    listarPeriodos,
    registrarPeriodo,
    actualizarPeriodo,
    obtenerPeriodoVigente,
  }
}
