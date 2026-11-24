import { useApi } from '~/composables/useApi'
import { fijarDesfaseSistema } from '~/composables/useFechas'
import type { EstadoSistema, ParametrosSistema, SolicitudFechaSistema } from '~/types/parametrosSistema'

const RUTA = '/api/v1/parametros-sistema'
const VIGENCIA_ESTADO_MS = 60 * 1000

let ultimaConsultaEstado = 0

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'setiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** Convierte "2026-04-01T07:50:00" en Date local sin pasar por UTC. */
export function leerFechaHoraSistema(valor: string): Date {
  const [fecha = '', hora = '00:00:00'] = valor.split('T')
  const [anhio, mes, dia] = fecha.split('-').map(Number) as [number, number, number]
  const [horas = 0, minutos = 0, segundos = 0] = hora.split(':').map((parte) => Math.trunc(Number(parte)))
  return new Date(anhio, mes - 1, dia, horas, minutos, segundos)
}

/** "miércoles 1 de abril de 2026, 07:50" */
export function describirFechaSistema(fecha: Date): string {
  const hora = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`
  return `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}, ${hora}`
}

export function useEstadoSistema() {
  const { solicitar } = useApi()
  const estado = useState<EstadoSistema | null>('estado-sistema', () => null)

  function aplicar(nuevo: EstadoSistema) {
    estado.value = nuevo
    fijarDesfaseSistema(nuevo.fechaSimulada ? leerFechaHoraSistema(nuevo.fechaSistema).getTime() - Date.now() : 0)
    ultimaConsultaEstado = Date.now()
  }

  async function cargarEstado(forzar = false) {
    if (!forzar && Date.now() - ultimaConsultaEstado < VIGENCIA_ESTADO_MS) return
    try {
      aplicar(await solicitar<EstadoSistema>(`${RUTA}/estado`))
    } catch {
      ultimaConsultaEstado = Date.now()
    }
  }

  function limpiarEstado() {
    estado.value = null
    fijarDesfaseSistema(0)
    ultimaConsultaEstado = 0
  }

  return { estado, cargarEstado, limpiarEstado }
}

export function useParametrosSistema() {
  const { solicitar } = useApi()
  const { cargarEstado } = useEstadoSistema()

  async function despues<T>(promesa: Promise<T>): Promise<T> {
    const resultado = await promesa
    await cargarEstado(true)
    return resultado
  }

  return {
    obtener: () => solicitar<ParametrosSistema>(RUTA),
    simularFecha: (solicitud: SolicitudFechaSistema) =>
      despues(solicitar<ParametrosSistema>(`${RUTA}/fecha`, { metodo: 'PUT', cuerpo: solicitud })),
    volverAFechaReal: () => despues(solicitar<ParametrosSistema>(`${RUTA}/fecha`, { metodo: 'DELETE' })),
    configurarPagoEnLinea: (activo: boolean) =>
      despues(solicitar<ParametrosSistema>(`${RUTA}/pago-en-linea`, { metodo: 'PUT', cuerpo: { activo } })),
  }
}
