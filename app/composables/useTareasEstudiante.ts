import { useApi } from '~/composables/useApi'
import { ahoraSistema } from '~/composables/useFechas'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { CuentaRegresivaTarea, GrupoTareasEstudiante, TareaEstudiante } from '~/types/tareaEstudiante'

const RUTA = '/api/v1/estudiantes/mis-tareas'
const DIAS_CORTOS_TAREA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES_CORTOS_TAREA = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
const COLORES_AREA_TAREA = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#ea580c', '#ca8a04']

export const TAMANIO_MAXIMO_TAREA = 10 * 1024 * 1024
export const EXTENSIONES_TAREA_ESTUDIANTE = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'jpg',
  'jpeg',
  'png',
  'zip',
]
export const TIPOS_ARCHIVO_TAREA = 'PDF, Word, Excel, PowerPoint, JPG, PNG o ZIP'

function aFecha(valor: string): Date {
  const [fecha = '', hora = '00:00'] = valor.split('T')
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [horas, minutos] = hora.split(':').map(Number)
  return new Date(anio ?? 1970, (mes ?? 1) - 1, dia ?? 1, horas ?? 0, minutos ?? 0)
}

function inicioDelDia(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime()
}

function diasCalendario(desde: Date, hasta: Date): number {
  return Math.round((inicioDelDia(hasta) - inicioDelDia(desde)) / 86_400_000)
}

function hora(fecha: Date): string {
  return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`
}

/** "hoy, 23:59", "mañana, 18:00" o "vie 21 nov, 18:00". */
export function formatearFechaTarea(valor: string, ahora: Date = ahoraSistema()): string {
  const fecha = aFecha(valor)
  const dias = diasCalendario(ahora, fecha)
  if (dias === 0) return `hoy, ${hora(fecha)}`
  if (dias === 1) return `mañana, ${hora(fecha)}`
  if (dias === -1) return `ayer, ${hora(fecha)}`
  return `${DIAS_CORTOS_TAREA[fecha.getDay()]} ${fecha.getDate()} ${MESES_CORTOS_TAREA[fecha.getMonth()]}, ${hora(fecha)}`
}

/** "miércoles 19 de noviembre, 18:42" para el comprobante de entrega. */
export function formatearFechaLargaTarea(valor: string): string {
  const fecha = aFecha(valor)
  const dia = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(fecha)
    .replace(',', '')
  return `${dia}, ${hora(fecha)}`
}

/** Cuenta regresiva: horas el mismo día, "Mañana", días hasta una semana y luego "Vence en N días". */
export function cuentaRegresivaTarea(valor: string, ahora: Date = ahoraSistema()): CuentaRegresivaTarea {
  const fecha = aFecha(valor)
  const restante = fecha.getTime() - ahora.getTime()
  if (restante < 0) return { texto: 'Vencida', nivel: 'vencida' }
  const dias = diasCalendario(ahora, fecha)
  if (dias === 0) {
    const horas = Math.floor(restante / 3_600_000)
    return {
      texto: horas >= 1 ? `Quedan ${horas} h` : `Quedan ${Math.max(1, Math.ceil(restante / 60_000))} min`,
      nivel: 'hoy',
    }
  }
  if (dias === 1) return { texto: 'Mañana', nivel: 'dias' }
  if (dias <= 7) return { texto: `En ${dias} días`, nivel: 'dias' }
  return { texto: `En ${dias} días`, nivel: 'lejos' }
}

/** Agrupa las tareas por entregar en "Vence hoy", "Esta semana" y "Más adelante". */
export function agruparTareasPorEntregar(
  tareas: TareaEstudiante[],
  ahora: Date = ahoraSistema(),
): GrupoTareasEstudiante[] {
  const grupos: GrupoTareasEstudiante[] = [
    { cercania: 'hoy', titulo: 'Vence hoy', tareas: [] },
    { cercania: 'semana', titulo: 'Esta semana', tareas: [] },
    { cercania: 'adelante', titulo: 'Más adelante', tareas: [] },
  ]
  for (const tarea of ordenarTareasPorFecha(tareas)) {
    const dias = diasCalendario(ahora, aFecha(tarea.fechaLimite))
    grupos[dias <= 0 ? 0 : dias <= 7 ? 1 : 2]!.tareas.push(tarea)
  }
  return grupos.filter((grupo) => grupo.tareas.length)
}

export function ordenarTareasPorFecha(tareas: TareaEstudiante[], descendente = false): TareaEstudiante[] {
  const orden = descendente ? -1 : 1
  return [...tareas].sort((a, b) => orden * a.fechaLimite.localeCompare(b.fechaLimite) || a.id - b.id)
}

export function formatearTamanioArchivo(bytes: number | null | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Valida el archivo antes de subirlo; devuelve el mensaje de error o una cadena vacía. */
export function validarArchivoTarea(archivo: File): string {
  const extension = archivo.name.includes('.') ? archivo.name.split('.').pop()!.toLowerCase() : ''
  if (!EXTENSIONES_TAREA_ESTUDIANTE.includes(extension)) {
    return `"${archivo.name}" no es un tipo permitido. Usa ${TIPOS_ARCHIVO_TAREA}.`
  }
  if (archivo.size > TAMANIO_MAXIMO_TAREA) {
    return `El archivo pesa ${formatearTamanioArchivo(archivo.size)} y el máximo es 10 MB. Comprímelo o súbelo a Drive y entrega un PDF con el enlace.`
  }
  if (!archivo.size) return 'El archivo está vacío.'
  return ''
}

/** Color estable por área para reconocerla de un vistazo. */
export function colorAreaTarea(codigo: string | null): string {
  if (!codigo) return '#64748b'
  let suma = 0
  for (const caracter of codigo) suma = (suma * 31 + caracter.charCodeAt(0)) % 997
  return COLORES_AREA_TAREA[suma % COLORES_AREA_TAREA.length]!
}

export function extensionArchivoTarea(nombre: string | null): string {
  return nombre?.includes('.') ? nombre.split('.').pop()!.slice(0, 4).toUpperCase() : 'ARCH'
}

export function useTareasEstudiante() {
  const { solicitar } = useApi()
  const configuracion = useRuntimeConfig()
  const autenticacion = useAutenticacionStore()
  const base = () => String(configuracion.public.apiBase || '').replace(/\/+$/, '')

  function listar(): Promise<TareaEstudiante[]> {
    return solicitar<TareaEstudiante[]>(RUTA)
  }

  function obtener(tareaId: number): Promise<TareaEstudiante> {
    return solicitar<TareaEstudiante>(`${RUTA}/${tareaId}`)
  }

  function mensajeDe(texto: string, porDefecto: string): string {
    try {
      const detalle: unknown = JSON.parse(texto)
      const mensaje = detalle && typeof detalle === 'object' && 'message' in detalle ? detalle.message : null
      return typeof mensaje === 'string' && mensaje ? mensaje : porDefecto
    } catch {
      return porDefecto
    }
  }

  /** Sube el archivo con progreso (0 a 100). */
  function entregar(
    tareaId: number,
    archivo: File,
    alProgresar?: (porcentaje: number) => void,
  ): Promise<TareaEstudiante> {
    return new Promise((resolver, rechazar) => {
      const datos = new FormData()
      datos.append('archivo', archivo)
      const solicitud = new XMLHttpRequest()
      solicitud.open('POST', `${base()}${RUTA}/${tareaId}/entrega`)
      if (autenticacion.token) solicitud.setRequestHeader('Authorization', `Bearer ${autenticacion.token}`)
      solicitud.upload.onprogress = (evento) => {
        if (evento.lengthComputable) alProgresar?.(Math.round((evento.loaded / evento.total) * 100))
      }
      solicitud.onload = () => {
        if (solicitud.status >= 200 && solicitud.status < 300) {
          resolver(JSON.parse(solicitud.responseText) as TareaEstudiante)
          return
        }
        if (solicitud.status === 401) autenticacion.cerrarSesion()
        const porDefecto =
          solicitud.status === 413 ? 'El archivo supera el máximo de 10 MB.' : 'No se pudo entregar la tarea.'
        rechazar(new Error(mensajeDe(solicitud.responseText, porDefecto)))
      }
      solicitud.onerror = () => rechazar(new Error('No hay conexión con el servidor. Intenta de nuevo.'))
      solicitud.send(datos)
    })
  }

  async function descargarArchivo(tareaId: number, nombre: string): Promise<void> {
    const respuesta = await fetch(`${base()}${RUTA}/${tareaId}/entrega/archivo`, {
      headers: autenticacion.token ? { Authorization: `Bearer ${autenticacion.token}` } : {},
      cache: 'no-store',
    })
    if (!respuesta.ok) {
      if (respuesta.status === 401) autenticacion.cerrarSesion()
      throw new Error(mensajeDe(await respuesta.text(), 'No se pudo descargar el archivo.'))
    }
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(await respuesta.blob())
    enlace.download = nombre
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  }

  return { listar, obtener, entregar, descargarArchivo }
}
