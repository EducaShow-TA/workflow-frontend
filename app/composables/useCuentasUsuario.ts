import type { RolUsuario } from '~/types/autenticacion'
import type {
  ConteoEstadoCuentas,
  CuentaUsuario,
  ErroresCuenta,
  ErroresEdicion,
  FiltroEstadoCuenta,
  FiltroRol,
  FormularioCuenta,
  SolicitudActualizarCuenta,
  SolicitudCrearCuenta,
} from '~/types/cuentaUsuario'
import { ErrorSolicitudApi } from '~/types/api'
import { useApi } from '~/composables/useApi'
import { normalizarCorreo, normalizarDocumento, normalizarNombre } from '~/composables/useMascarasFormulario'
import { ROLES } from '~/composables/usePermisosRol'

export const RUTA_CUENTAS = '/api/v1/cuentas-usuario'
export const LONGITUD_DNI = 8
export const LONGITUD_MAXIMA_CORREO = 254
export const LONGITUD_MAXIMA_USUARIO = 50
export const LONGITUD_MAXIMA_NOMBRE_PERSONA = 100
export const LONGITUD_MINIMA_PASSWORD = 8
export const CUENTAS_POR_PAGINA = 10

export const MOTIVO_ROL_FIJO = 'El rol se define al crear la cuenta y no se modifica.'

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function crearFormularioVacio(): FormularioCuenta {
  return {
    dni: '',
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    username: '',
    correo: '',
    password: '',
    confirmacionPassword: '',
    rol: '',
  }
}

export function crearFormularioEdicion(cuenta: CuentaUsuario): SolicitudActualizarCuenta {
  return {
    nombre: cuenta.nombre ?? '',
    apellidoPaterno: cuenta.apellidoPaterno ?? '',
    apellidoMaterno: cuenta.apellidoMaterno ?? '',
    username: cuenta.username,
    correo: cuenta.correo ?? '',
  }
}

export function tieneNombreSeparado(cuenta: CuentaUsuario): boolean {
  return Boolean(cuenta.nombre && cuenta.apellidoPaterno && cuenta.apellidoMaterno)
}

export function existeUsuario(cuentas: CuentaUsuario[], username: string, idExcluido?: number): boolean {
  const buscado = username.trim().toLocaleLowerCase()
  return cuentas.some((cuenta) => cuenta.id !== idExcluido && cuenta.username.trim().toLocaleLowerCase() === buscado)
}

export function existeCorreo(cuentas: CuentaUsuario[], correo: string, idExcluido?: number): boolean {
  const buscado = normalizarCorreo(correo)
  return cuentas.some((cuenta) => cuenta.id !== idExcluido && normalizarCorreo(cuenta.correo ?? '') === buscado)
}

export function existeDni(cuentas: CuentaUsuario[], dni: string): boolean {
  return cuentas.some((cuenta) => cuenta.dni === dni)
}

function validarNombre(valor: string, etiqueta: string): string | undefined {
  const limpio = normalizarNombre(valor)

  if (!limpio) {
    return `${etiqueta} es obligatorio.`
  }

  if (limpio.length > LONGITUD_MAXIMA_NOMBRE_PERSONA) {
    return `${etiqueta} no debe superar los ${LONGITUD_MAXIMA_NOMBRE_PERSONA} caracteres.`
  }

  return undefined
}

function validarUsuario(valor: string, cuentas: CuentaUsuario[], idExcluido?: number): string | undefined {
  const username = valor.trim()
  if (!username) return 'El usuario es obligatorio.'
  if (username.length > LONGITUD_MAXIMA_USUARIO) return `El usuario no debe superar los ${LONGITUD_MAXIMA_USUARIO} caracteres.`
  if (existeUsuario(cuentas, username, idExcluido)) return 'Ya existe ese usuario.'
  return undefined
}

function validarCorreo(valor: string, cuentas: CuentaUsuario[], idExcluido?: number): string | undefined {
  const correo = normalizarCorreo(valor)

  if (!correo) {
    return 'El correo es obligatorio.'
  }

  if (!FORMATO_CORREO.test(correo)) {
    return 'Ingresa un correo válido, por ejemplo nombre@colegio.edu.pe.'
  }

  if (correo.length > LONGITUD_MAXIMA_CORREO) {
    return `El correo no debe superar los ${LONGITUD_MAXIMA_CORREO} caracteres.`
  }

  if (existeCorreo(cuentas, correo, idExcluido)) {
    return 'Ya existe una cuenta con ese correo.'
  }

  return undefined
}

function validarDatosPersonales(
  formulario: SolicitudActualizarCuenta,
  cuentas: CuentaUsuario[],
  idExcluido?: number,
): ErroresEdicion {
  return {
    nombre: validarNombre(formulario.nombre, 'El nombre'),
    apellidoPaterno: validarNombre(formulario.apellidoPaterno, 'El apellido paterno'),
    apellidoMaterno: validarNombre(formulario.apellidoMaterno, 'El apellido materno'),
    username: validarUsuario(formulario.username, cuentas, idExcluido),
    correo: validarCorreo(formulario.correo, cuentas, idExcluido),
  }
}

export function validarCuenta(formulario: FormularioCuenta, cuentas: CuentaUsuario[]): ErroresCuenta {
  const errores: ErroresCuenta = {}
  const dni = normalizarDocumento(formulario.dni, 'DNI')

  if (!dni) {
    errores.dni = 'El DNI es obligatorio.'
  } else if (dni.length !== LONGITUD_DNI) {
    errores.dni = `El DNI debe tener ${LONGITUD_DNI} dígitos.`
  } else if (existeDni(cuentas, dni)) {
    errores.dni = 'Ya existe una cuenta con ese DNI.'
  }

  Object.assign(errores, validarDatosPersonales(formulario, cuentas))

  if (!formulario.password) {
    errores.password = 'La contraseña es obligatoria.'
  } else if (formulario.password.length < LONGITUD_MINIMA_PASSWORD) {
    errores.password = `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`
  }

  if (formulario.password && formulario.confirmacionPassword !== formulario.password) {
    errores.confirmacionPassword = 'Las contraseñas no coinciden.'
  }

  if (!formulario.rol) {
    errores.rol = 'Selecciona un rol.'
  }

  return errores
}

export function validarEdicion(
  formulario: SolicitudActualizarCuenta,
  cuentas: CuentaUsuario[],
  idCuenta: number,
): ErroresEdicion {
  return validarDatosPersonales(formulario, cuentas, idCuenta)
}

export function construirSolicitud(formulario: FormularioCuenta, rol: RolUsuario): SolicitudCrearCuenta {
  return {
    dni: normalizarDocumento(formulario.dni, 'DNI'),
    ...construirSolicitudEdicion(formulario),
    password: formulario.password,
    rol,
  }
}

export function construirSolicitudEdicion(formulario: SolicitudActualizarCuenta): SolicitudActualizarCuenta {
  return {
    nombre: normalizarNombre(formulario.nombre),
    apellidoPaterno: normalizarNombre(formulario.apellidoPaterno),
    apellidoMaterno: normalizarNombre(formulario.apellidoMaterno),
    username: formulario.username.trim(),
    correo: normalizarCorreo(formulario.correo),
  }
}

export function estaActiva(cuenta: Pick<CuentaUsuario, 'activo'>): boolean {
  return cuenta.activo !== false
}

export function esCuentaPropia(cuenta: Pick<CuentaUsuario, 'username'>, usernameActual: string): boolean {
  return normalizarCorreo(cuenta.username) === normalizarCorreo(usernameActual)
}

export function contarAdministradoresActivos(cuentas: CuentaUsuario[]): number {
  return cuentas.filter((cuenta) => cuenta.rol === 'ADMINISTRADOR' && estaActiva(cuenta)).length
}

/** Motivo por el que no se puede cambiar el estado de la cuenta, o cadena vacía si se puede. */
export function obtenerMotivoProteccion(
  cuenta: CuentaUsuario,
  cuentas: CuentaUsuario[],
  usernameActual: string,
): string {
  if (esCuentaPropia(cuenta, usernameActual)) {
    return 'Es tu propia cuenta: no puedes desactivarla.'
  }

  if (cuenta.rol === 'ADMINISTRADOR' && estaActiva(cuenta) && contarAdministradoresActivos(cuentas) <= 1) {
    return 'Es el único administrador activo: el sistema debe tener al menos uno.'
  }

  return ''
}

function normalizarParaBuscar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function filtrarCuentas(
  cuentas: CuentaUsuario[],
  texto: string,
  rol: FiltroRol,
  estado: FiltroEstadoCuenta = 'TODOS',
): CuentaUsuario[] {
  const buscado = normalizarParaBuscar(texto)

  return cuentas.filter((cuenta) => {
    const coincideRol = rol === 'TODOS' || cuenta.rol === rol
    const coincideEstado = estado === 'TODOS' || (estado === 'ACTIVOS') === estaActiva(cuenta)
    const coincideTexto =
      !buscado ||
      normalizarParaBuscar(cuenta.nombreCompleto).includes(buscado) ||
      normalizarParaBuscar(cuenta.username).includes(buscado) ||
      normalizarParaBuscar(cuenta.correo ?? '').includes(buscado) ||
      cuenta.dni.includes(buscado)

    return coincideRol && coincideEstado && coincideTexto
  })
}

export function contarPorEstado(cuentas: CuentaUsuario[]): ConteoEstadoCuentas {
  const activos = cuentas.filter(estaActiva).length
  return { activos, inactivos: cuentas.length - activos }
}

export function ordenarCuentas(cuentas: CuentaUsuario[]): CuentaUsuario[] {
  return [...cuentas].sort((primera, segunda) => primera.nombreCompleto.localeCompare(segunda.nombreCompleto, 'es'))
}

export function contarPorRol(cuentas: CuentaUsuario[]): Record<RolUsuario, number> {
  const conteo = Object.fromEntries(ROLES.map((rol) => [rol, 0])) as Record<RolUsuario, number>

  for (const cuenta of cuentas) {
    conteo[cuenta.rol] += 1
  }

  return conteo
}

export function calcularTotalPaginas(totalCuentas: number): number {
  return Math.max(1, Math.ceil(totalCuentas / CUENTAS_POR_PAGINA))
}

export function obtenerPagina(cuentas: CuentaUsuario[], pagina: number): CuentaUsuario[] {
  const inicio = (pagina - 1) * CUENTAS_POR_PAGINA
  return cuentas.slice(inicio, inicio + CUENTAS_POR_PAGINA)
}

export function obtenerIniciales(nombreCompleto: string): string {
  return nombreCompleto
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('')
}

export function useCuentasUsuario() {
  const { solicitar } = useApi()

  async function listarCuentas(): Promise<CuentaUsuario[]> {
    return ordenarCuentas(await solicitar<CuentaUsuario[]>(RUTA_CUENTAS))
  }

  async function obtenerCuenta(id: number): Promise<CuentaUsuario> {
    const cuenta = (await listarCuentas()).find((existente) => existente.id === id)

    if (!cuenta) {
      throw new ErrorSolicitudApi('No existe la cuenta de usuario indicada.', 404, `${RUTA_CUENTAS}/${id}`)
    }

    return cuenta
  }

  async function crearCuenta(solicitud: SolicitudCrearCuenta): Promise<CuentaUsuario> {
    return solicitar<CuentaUsuario>(RUTA_CUENTAS, { metodo: 'POST', cuerpo: solicitud })
  }

  async function actualizarCuenta(id: number, solicitud: SolicitudActualizarCuenta): Promise<CuentaUsuario> {
    return solicitar<CuentaUsuario>(`${RUTA_CUENTAS}/${id}`, { metodo: 'PUT', cuerpo: solicitud })
  }

  async function cambiarEstadoCuenta(id: number, activo: boolean): Promise<CuentaUsuario> {
    return solicitar<CuentaUsuario>(`${RUTA_CUENTAS}/${id}/estado`, { metodo: 'PATCH', cuerpo: { activo } })
  }

  return {
    listarCuentas,
    obtenerCuenta,
    crearCuenta,
    actualizarCuenta,
    cambiarEstadoCuenta,
  }
}
