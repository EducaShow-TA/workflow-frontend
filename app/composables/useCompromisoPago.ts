import type {
  CuotaCronograma,
  ErroresCompromisoPago,
  FormularioCompromisoPago,
  SolicitudCompromisoPago,
} from '~/types/compromisoPago'
import { esFechaIsoValida } from '~/composables/useFechas'

// Límites de CompromisoPagoRequest y FinanzasService.validarTerminos.
export const CUOTAS_MAXIMAS = 24
export const DIA_VENCIMIENTO_MAXIMO = 28
export const LONGITUD_MAXIMA_CONCEPTO = 100

const CUOTAS_SUGERIDAS = 10
const DIA_SUGERIDO = 28
const MES_INICIO_CLASES = 3

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic']

function aIso(anhio: number, mes: number, dia: number): string {
  return `${anhio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Suma meses a una fecha ISO manteniendo el día (válido porque el día nunca pasa de 28). */
function sumarMeses(fechaIso: string, meses: number): string {
  const [anhio, mes, dia] = fechaIso.split('-').map(Number) as [number, number, number]
  const indice = anhio * 12 + (mes - 1) + meses
  return aIso(Math.floor(indice / 12), (indice % 12) + 1, dia)
}

/** Primer vencimiento sugerido: el 28 de marzo del año escolar, o el siguiente 28 que no haya pasado. */
export function sugerirPrimerVencimiento(anhioEscolar: number, fechaHoy: string): string {
  let sugerido = aIso(anhioEscolar, MES_INICIO_CLASES, DIA_SUGERIDO)

  while (sugerido < fechaHoy) {
    sugerido = sumarMeses(sugerido, 1)
  }

  return sugerido
}

/** Cuotas que caben desde el primer vencimiento hasta diciembre del año escolar (alumnos que entran a mitad de año). */
export function cuotasHastaDiciembre(primerVencimiento: string, anhioEscolar: number): number {
  const [anhio, mes] = primerVencimiento.split('-').map(Number) as [number, number]
  return Math.max(0, (anhioEscolar - anhio) * 12 + (12 - mes) + 1)
}

export function crearFormularioCompromiso(anhioEscolar: number, fechaHoy: string): FormularioCompromisoPago {
  const primerVencimiento = sugerirPrimerVencimiento(anhioEscolar, fechaHoy)
  return {
    concepto: `Pensión escolar ${anhioEscolar}`,
    montoTotal: null,
    numeroCuotas: Math.max(1, Math.min(CUOTAS_SUGERIDAS, cuotasHastaDiciembre(primerVencimiento, anhioEscolar))),
    primerVencimiento,
  }
}

export function validarCompromiso(
  formulario: FormularioCompromisoPago,
  fechaHoy: string,
  anhioEscolar?: number,
): ErroresCompromisoPago {
  const errores: ErroresCompromisoPago = {}
  const concepto = formulario.concepto.trim()

  if (!concepto) {
    errores.concepto = 'El concepto es obligatorio.'
  } else if (concepto.length > LONGITUD_MAXIMA_CONCEPTO) {
    errores.concepto = `El concepto no puede superar los ${LONGITUD_MAXIMA_CONCEPTO} caracteres.`
  }

  if (formulario.montoTotal === null || !(formulario.montoTotal >= 0.01)) {
    errores.montoTotal = 'Ingresa un monto mayor que cero.'
  } else if (Math.round(formulario.montoTotal * 100) !== formulario.montoTotal * 100) {
    errores.montoTotal = 'Usa como máximo dos decimales.'
  }

  const cuotas = formulario.numeroCuotas
  if (cuotas === null || !Number.isInteger(cuotas) || cuotas < 1 || cuotas > CUOTAS_MAXIMAS) {
    errores.numeroCuotas = `Ingresa un número entero de 1 a ${CUOTAS_MAXIMAS}.`
  } else if (anhioEscolar && esFechaIsoValida(formulario.primerVencimiento)) {
    const caben = cuotasHastaDiciembre(formulario.primerVencimiento, anhioEscolar)
    if (cuotas > caben) {
      errores.numeroCuotas = `Las pensiones terminan en diciembre de ${anhioEscolar}: con este primer vencimiento caben ${caben} cuotas.`
    }
  }

  if (!esFechaIsoValida(formulario.primerVencimiento)) {
    errores.primerVencimiento = 'El primer vencimiento es obligatorio.'
  } else if (formulario.primerVencimiento < fechaHoy) {
    errores.primerVencimiento = 'El primer vencimiento no puede ser una fecha pasada.'
  } else if (Number(formulario.primerVencimiento.slice(8, 10)) > DIA_VENCIMIENTO_MAXIMO) {
    errores.primerVencimiento = `Elige un día del 1 al ${DIA_VENCIMIENTO_MAXIMO}: algunos meses no tienen días 29 a 31.`
  }

  return errores
}

/** Mismo reparto que CompromisoPago.getMontoCuota: partes iguales y la última cuota absorbe los céntimos. */
export function calcularCronograma(formulario: FormularioCompromisoPago): CuotaCronograma[] {
  const cuotas = formulario.numeroCuotas
  const monto = formulario.montoTotal

  if (
    monto === null ||
    !(monto > 0) ||
    cuotas === null ||
    !Number.isInteger(cuotas) ||
    cuotas < 1 ||
    cuotas > CUOTAS_MAXIMAS ||
    !esFechaIsoValida(formulario.primerVencimiento)
  ) {
    return []
  }

  const totalCentimos = Math.round(monto * 100)
  const base = Math.floor(totalCentimos / cuotas)

  return Array.from({ length: cuotas }, (_, indice) => ({
    numero: indice + 1,
    vencimiento: sumarMeses(formulario.primerVencimiento, indice),
    montoCentimos: indice === cuotas - 1 ? totalCentimos - base * (cuotas - 1) : base,
  }))
}

export function describirMes(fechaIso: string): string {
  return `${MESES[Number(fechaIso.slice(5, 7)) - 1]} ${fechaIso.slice(0, 4)}`
}

export function formatearSoles(centimos: number): string {
  return `S/ ${(centimos / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function construirSolicitudCompromiso(formulario: FormularioCompromisoPago): SolicitudCompromisoPago {
  return {
    concepto: formulario.concepto.trim(),
    montoTotal: formulario.montoTotal ?? 0,
    numeroCuotas: formulario.numeroCuotas ?? 0,
    primerVencimiento: formulario.primerVencimiento,
    diaVencimiento: Number(formulario.primerVencimiento.slice(8, 10)),
  }
}
