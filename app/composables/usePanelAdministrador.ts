import { useApi } from '~/composables/useApi'
import type { CobranzaMesPanel, PanelAdministrador } from '~/types/panelAdministrador'

export interface PendientePanel {
  cantidad: number
  tono: 'ambar' | 'rojo' | 'azul' | 'gris'
  titulo: string
  detalle: string
  enlace: string
  destino: string
}

const MESES_PANEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic']
const solesPanel = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 })

export function fechaLocalPanel(valor: string): Date {
  const [fecha = '', hora = '00:00:00'] = valor.split('T')
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number)
  const [h = 0, m = 0, s = 0] = hora.split(':').map((parte) => Number.parseFloat(parte))
  return new Date(anio, mes - 1, dia, h, m, Math.floor(s))
}

export function formatearSolesPanel(monto: number): string {
  return solesPanel.format(monto)
}

export function porcentajePanel(parte: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((parte / total) * 1000) / 10) : 0
}

export function saludoPanel(ahora: Date, nombreCompleto?: string | null): string {
  const hora = ahora.getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const nombre = nombreCompleto?.trim().split(/\s+/)[0]
  return nombre ? `${saludo}, ${nombre}` : saludo
}

export function fechaTituloPanel(fecha: string, anio: number): string {
  const texto = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    fechaLocalPanel(fecha),
  )
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1).replace(',', '')} · Año escolar ${anio}`
}

export function diasEntrePanel(desde: string, hasta: string): number {
  return Math.round((fechaLocalPanel(hasta).getTime() - fechaLocalPanel(desde).getTime()) / 86_400_000)
}

export function tiempoRelativoPanel(fecha: string, ahora: Date): string {
  const momento = fechaLocalPanel(fecha)
  const minutos = Math.round((ahora.getTime() - momento.getTime()) / 60_000)
  if (minutos < 1) return 'hace un momento'
  if (minutos < 60) return `hace ${minutos} min`
  if (minutos < 24 * 60 && momento.getDate() === ahora.getDate()) return `hace ${Math.floor(minutos / 60)} h`
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    .format(momento)
    .replace(',', '')
}

export function nombreMesPanel(mes: number): string {
  return MESES_PANEL[mes - 1] ?? String(mes)
}

export function mesesCobranzaPanel(cobranza: CobranzaMesPanel[]): CobranzaMesPanel[] {
  const porMes = new Map(cobranza.map((fila) => [fila.mes, fila]))
  const meses = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, ...porMes.keys()])
  return [...meses].sort((a, b) => a - b).map((mes) => porMes.get(mes) ?? { mes, pagado: 0, vencido: 0, porVencer: 0 })
}

export function listarPendientesPanel(panel: PanelAdministrador): PendientePanel[] {
  const { pendientes: p, indicadores: i } = panel
  const lista: PendientePanel[] = [
    {
      cantidad: p.matriculasPorConfirmar,
      tono: 'ambar',
      titulo: p.matriculasPorConfirmar === 1 ? 'Matrícula por confirmar' : 'Matrículas por confirmar',
      detalle: 'Registradas y aún no confirmadas',
      enlace: 'Revisar',
      destino: '/matriculas',
    },
    {
      cantidad: p.familiasEnMora,
      tono: 'rojo',
      titulo: p.familiasEnMora === 1 ? 'Familia con boletas en mora' : 'Familias con boletas en mora',
      detalle: `${formatearSolesPanel(p.montoEnMora)} pendientes de cobro`,
      enlace: 'Ver reporte',
      destino: '/reportes/boletas',
    },
    {
      cantidad: p.docentesSinMarcar,
      tono: 'azul',
      titulo: p.docentesSinMarcar === 1 ? 'Docente sin marcar entrada hoy' : 'Docentes sin marcar entrada hoy',
      detalle: `De ${i.docentesConClaseHoy} con clases programadas hoy`,
      enlace: 'Ver marcajes',
      destino: '/asistencia-docentes',
    },
    {
      cantidad: p.erroresUltimas24h,
      tono: 'gris',
      titulo: p.erroresUltimas24h === 1 ? 'Error del sistema en 24 h' : 'Errores del sistema en 24 h',
      detalle: p.erroresCriticos24h ? `${p.erroresCriticos24h} de nivel crítico` : 'Ninguno de nivel crítico',
      enlace: 'Ver logs',
      destino: '/logs-sistema',
    },
  ]
  return lista.filter((pendiente) => pendiente.cantidad > 0)
}

export function usePanelAdministrador() {
  const { solicitar } = useApi()

  function consultar(): Promise<PanelAdministrador> {
    return solicitar<PanelAdministrador>('/api/v1/panel/administrador')
  }

  return { consultar }
}
