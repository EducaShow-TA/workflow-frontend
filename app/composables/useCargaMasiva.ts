import type { VarianteInsignia } from '~/types/interfaz'
import type {
  CsvLeido,
  EstadoFilaCarga,
  FilaCsv,
  FilaResumenCarga,
  ResultadoCargaMasiva,
  RevisionCsv,
} from '~/types/cargaMasiva'
import { ErrorSolicitudApi } from '~/types/api'
import { useApi } from '~/composables/useApi'

const RUTA_CARGA = '/api/v1/cuentas-usuario/carga-masiva'

// Reflejan LectorCsvUsuarios y la configuración multipart del backend.
export const COLUMNAS_OBLIGATORIAS = ['rol', 'dni', 'nombres', 'apellido_paterno', 'apellido_materno', 'correo']
export const COLUMNAS_OPCIONALES = ['telefono', 'fecha_nacimiento', 'dni_apoderado', 'parentesco']
export const ROLES_CARGA = ['DOCENTE', 'ALUMNO', 'APODERADO']
export const MAXIMO_FILAS = 500
export const MAXIMO_BYTES = 10 * 1024 * 1024

/** Igual que el backend: si la cabecera tiene más ";" que ",", ese es el separador (CSV de Excel en español). */
export function detectarSeparador(texto: string): ',' | ';' {
  const cabecera = texto.split('\n', 1)[0] ?? ''
  const puntoYComa = cabecera.split(';').length - 1
  const comas = cabecera.split(',').length - 1
  return puntoYComa > comas ? ';' : ','
}

/** Lector CSV con comillas dobles (RFC 4180). Omite líneas vacías, como el backend, para numerar igual las filas. */
export function leerCsv(texto: string): CsvLeido {
  const limpio = texto.startsWith('﻿') ? texto.slice(1) : texto
  const separador = detectarSeparador(limpio)
  const registros: string[][] = []
  let registro: string[] = []
  let campo = ''
  let entreComillas = false

  for (let i = 0; i < limpio.length; i++) {
    const caracter = limpio[i]!

    if (entreComillas) {
      if (caracter === '"' && limpio[i + 1] === '"') {
        campo += '"'
        i++
      } else if (caracter === '"') {
        entreComillas = false
      } else {
        campo += caracter
      }
    } else if (caracter === '"') {
      entreComillas = true
    } else if (caracter === separador) {
      registro.push(campo)
      campo = ''
    } else if (caracter === '\n' || caracter === '\r') {
      if (caracter === '\r' && limpio[i + 1] === '\n') {
        i++
      }
      registro.push(campo)
      registros.push(registro)
      registro = []
      campo = ''
    } else {
      campo += caracter
    }
  }

  if (campo || registro.length > 0) {
    registro.push(campo)
    registros.push(registro)
  }

  const noVacios = registros.filter((fila) => !(fila.length === 1 && fila[0]!.trim() === ''))
  const cabecera = (noVacios[0] ?? []).map((nombre) => nombre.trim().toLowerCase())
  const filas: FilaCsv[] = noVacios.slice(1).map((valores, indice) => ({
    fila: indice + 1,
    valores: Object.fromEntries(cabecera.map((nombre, columna) => [nombre, (valores[columna] ?? '').trim()])),
  }))

  return { cabecera, filas }
}

/** Excel en Windows suele guardar en ANSI: si UTF-8 deja caracteres inválidos, se lee como windows-1252 (igual que el backend). */
export function decodificarArchivo(contenido: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(contenido)
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(contenido) : utf8
}

function plural(cantidad: number, singular: string, varios: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`
}

/** Revisión previa en el navegador. Lo que depende de la base de datos lo valida el backend al procesar. */
export function revisarCsv(nombreArchivo: string, tamano: number, texto: string): RevisionCsv {
  const errores: string[] = []
  const advertencias: string[] = []
  const csv = leerCsv(texto)
  const conteoPorRol: Record<string, number> = {}

  if (!nombreArchivo.toLowerCase().endsWith('.csv')) {
    errores.push('El archivo debe tener extensión .csv.')
  }
  if (tamano > MAXIMO_BYTES) {
    errores.push('El archivo supera los 10 MB.')
  }
  if (csv.cabecera.length === 0) {
    errores.push('El archivo está vacío.')
    return { errores, advertencias, csv, conteoPorRol }
  }

  const faltantes = COLUMNAS_OBLIGATORIAS.filter((columna) => !csv.cabecera.includes(columna))
  if (faltantes.length > 0) {
    errores.push(`Faltan columnas obligatorias: ${faltantes.join(', ')}.`)
  }
  if (csv.filas.length === 0) {
    errores.push('El archivo no tiene filas de datos.')
  }
  if (csv.filas.length > MAXIMO_FILAS) {
    errores.push(`El archivo tiene ${csv.filas.length} filas; el máximo es ${MAXIMO_FILAS}.`)
  }

  let filasIncompletas = 0
  let rolesInvalidos = 0
  let alumnosSinApoderado = 0

  for (const { valores } of csv.filas) {
    const rol = (valores.rol ?? '').toUpperCase()
    conteoPorRol[rol || 'SIN ROL'] = (conteoPorRol[rol || 'SIN ROL'] ?? 0) + 1

    if (COLUMNAS_OBLIGATORIAS.some((columna) => csv.cabecera.includes(columna) && !valores[columna])) {
      filasIncompletas++
    }
    if (rol && !ROLES_CARGA.includes(rol)) {
      rolesInvalidos++
    }
    if (rol === 'ALUMNO' && (!valores.dni_apoderado || !valores.parentesco)) {
      alumnosSinApoderado++
    }
  }

  if (filasIncompletas > 0) {
    advertencias.push(`${plural(filasIncompletas, 'fila tiene', 'filas tienen')} datos obligatorios vacíos.`)
  }
  if (rolesInvalidos > 0) {
    advertencias.push(
      `${plural(rolesInvalidos, 'fila tiene', 'filas tienen')} un rol distinto de DOCENTE, ALUMNO o APODERADO.`,
    )
  }
  if (alumnosSinApoderado > 0) {
    advertencias.push(
      `${plural(alumnosSinApoderado, 'alumno no tiene', 'alumnos no tienen')} dni_apoderado o parentesco.`,
    )
  }

  return { errores, advertencias, csv, conteoPorRol }
}

export function describirConteoRoles(conteo: Record<string, number>): string {
  const nombres: Record<string, [string, string]> = {
    DOCENTE: ['docente', 'docentes'],
    ALUMNO: ['alumno', 'alumnos'],
    APODERADO: ['apoderado', 'apoderados'],
  }

  return Object.entries(conteo)
    .map(([rol, cantidad]) => {
      const [singular, varios] = nombres[rol] ?? [`con rol "${rol.toLowerCase()}"`, `con rol "${rol.toLowerCase()}"`]
      return plural(cantidad, singular, varios)
    })
    .join(', ')
}

export function obtenerEtiquetaEstadoFila(estado: FilaResumenCarga['estado']): string {
  const etiquetas: Record<FilaResumenCarga['estado'], string> = {
    CREADO: 'Creado',
    CREADO_Y_VINCULADO: 'Creado y vinculado',
    ACTUALIZADO: 'Actualizado',
    ACTUALIZADO_Y_VINCULADO: 'Actualizado y vinculado',
    VINCULADO: 'Vinculado',
    SIN_CAMBIOS: 'Sin cambios',
    RECHAZADA: 'Rechazada',
  }

  return etiquetas[estado]
}

export function obtenerVarianteEstadoFila(estado: FilaResumenCarga['estado']): VarianteInsignia {
  if (estado === 'RECHAZADA') return 'error'
  if (estado === 'SIN_CAMBIOS') return 'neutro'
  if (estado.startsWith('CREADO')) return 'exito'
  return 'informacion'
}

/** Une las filas procesadas y las rechazadas en una sola lista ordenada por número de fila. */
export function combinarFilas(resultado: ResultadoCargaMasiva, csv: CsvLeido | null): FilaResumenCarga[] {
  const porFila = new Map<number, FilaResumenCarga>()

  for (const procesada of resultado.resultados) {
    porFila.set(procesada.fila, { ...procesada, estado: procesada.estado as EstadoFilaCarga, motivos: [] })
  }

  for (const error of resultado.errores) {
    const existente = porFila.get(error.fila)
    if (existente) {
      existente.motivos.push(error)
      continue
    }

    const original = csv?.filas.find((fila) => fila.fila === error.fila)?.valores ?? {}
    porFila.set(error.fila, {
      fila: error.fila,
      rol: (original.rol ?? '').toUpperCase(),
      dni: original.dni ?? '',
      username: original.correo ?? '',
      estado: 'RECHAZADA',
      motivos: [error],
    })
  }

  return [...porFila.values()].sort((primera, segunda) => primera.fila - segunda.fila)
}

function escaparCsv(valor: string): string {
  return /[",;\n\r]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor
}

export function generarCsv(filas: string[][]): string {
  return filas.map((fila) => fila.map(escaparCsv).join(',')).join('\r\n')
}

export function generarCsvCredenciales(resultado: ResultadoCargaMasiva): string {
  return generarCsv([
    ['fila', 'rol', 'dni', 'usuario', 'contrasena_temporal'],
    ...resultado.cuentas.map((cuenta) => [
      String(cuenta.fila),
      cuenta.rol,
      cuenta.dni,
      cuenta.username,
      cuenta.contrasenhaTemporal,
    ]),
  ])
}

/** Las filas rechazadas tal como venían, más la columna "motivo", para corregirlas y volver a subirlas. */
export function generarCsvRechazadas(resultado: ResultadoCargaMasiva, csv: CsvLeido): string {
  const motivos = new Map<number, string[]>()
  for (const error of resultado.errores) {
    motivos.set(error.fila, [...(motivos.get(error.fila) ?? []), `${error.campo}: ${error.mensaje}`])
  }

  return generarCsv([
    [...csv.cabecera, 'motivo'],
    ...csv.filas
      .filter((fila) => motivos.has(fila.fila))
      .map((fila) => [
        ...csv.cabecera.map((columna) => fila.valores[columna] ?? ''),
        motivos.get(fila.fila)!.join(' | '),
      ]),
  ])
}

/** El BOM hace que Excel abra el archivo con tildes y eñes correctas. */
export function descargarArchivo(nombre: string, contenido: string): void {
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(new Blob(['﻿', contenido], { type: 'text/csv;charset=utf-8' }))
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}

function esResultadoCarga(datos: unknown): datos is ResultadoCargaMasiva {
  return typeof datos === 'object' && datos !== null && 'totalFilas' in datos && 'errores' in datos
}

/** Carga masiva de cuentas desde CSV (US-5.9). */
export function useCargaMasiva() {
  const { solicitar } = useApi()

  function obtenerPlantilla(): Promise<string> {
    return solicitar<string>(`${RUTA_CARGA}/plantilla`)
  }

  /** El backend responde 422 cuando rechaza todas las filas, pero igual envía el resumen: se devuelve como resultado. */
  async function cargarArchivo(archivo: File): Promise<ResultadoCargaMasiva> {
    const formulario = new FormData()
    formulario.append('archivo', archivo)

    try {
      return await solicitar<ResultadoCargaMasiva>(RUTA_CARGA, { metodo: 'POST', cuerpo: formulario })
    } catch (error: unknown) {
      if (error instanceof ErrorSolicitudApi && error.estado === 422 && esResultadoCarga(error.datos)) {
        return error.datos
      }
      throw error
    }
  }

  return { obtenerPlantilla, cargarArchivo }
}
