import { useApi } from '~/composables/useApi'
import type {
  ParentescoApoderado,
  SolicitudEditarApoderado,
  SolicitudVincularApoderado,
  TipoDocumentoApoderado,
  VerificacionApoderado,
  VinculoApoderado,
} from '~/types/apoderado'

export const NOMBRES_PARENTESCO: Record<ParentescoApoderado, string> = {
  PADRE: 'Padre',
  MADRE: 'Madre',
  TUTOR_LEGAL: 'Tutor legal',
  OTRO: 'Otro',
}

export type ErroresApoderado = Partial<Record<keyof SolicitudVincularApoderado, string>>

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validarDocumentoApoderado(tipo: TipoDocumentoApoderado, numero: string): string {
  const limpio = numero.trim().toUpperCase()
  if (!limpio) return 'Ingresa el número de documento.'
  if (tipo === 'DNI' && !/^\d{8}$/.test(limpio)) return 'El DNI debe tener 8 dígitos.'
  if (tipo === 'PASAPORTE' && !/^[A-Z0-9]{6,12}$/.test(limpio)) {
    return 'El pasaporte debe tener de 6 a 12 letras o números.'
  }
  return ''
}

/** Mismas reglas que el alta de estudiantes; los datos personales solo se piden si la persona es nueva. */
export function validarApoderado(solicitud: SolicitudVincularApoderado, esNuevo: boolean): ErroresApoderado {
  const errores: ErroresApoderado = {}

  if (!solicitud.parentesco) errores.parentesco = 'Selecciona el parentesco.'
  if (!esNuevo) return errores

  if (!solicitud.nombres.trim()) errores.nombres = 'Ingresa los nombres.'
  if (!solicitud.apellidoPaterno.trim()) errores.apellidoPaterno = 'Ingresa el apellido paterno.'
  if (!solicitud.apellidoMaterno.trim()) errores.apellidoMaterno = 'Ingresa el apellido materno.'
  if (!/^9\d{8}$/.test(solicitud.celular.trim())) {
    errores.celular = 'El celular debe tener 9 dígitos y comenzar en 9.'
  }
  if (solicitud.correoElectronico.trim() && !PATRON_CORREO.test(solicitud.correoElectronico.trim())) {
    errores.correoElectronico = 'Ingresa un correo válido.'
  }
  return errores
}

export function validarEdicionApoderado(
  solicitud: SolicitudEditarApoderado,
): Partial<Record<keyof SolicitudEditarApoderado, string>> {
  const errores: Partial<Record<keyof SolicitudEditarApoderado, string>> = {}

  if (!solicitud.nombres.trim()) errores.nombres = 'Ingresa los nombres.'
  if (!solicitud.apellidoPaterno.trim()) errores.apellidoPaterno = 'Ingresa el apellido paterno.'
  if (!solicitud.apellidoMaterno.trim()) errores.apellidoMaterno = 'Ingresa el apellido materno.'
  if (!/^9\d{8}$/.test(solicitud.celular.trim())) {
    errores.celular = 'El celular debe tener 9 dígitos y comenzar en 9.'
  }
  if (solicitud.correoElectronico.trim() && !PATRON_CORREO.test(solicitud.correoElectronico.trim())) {
    errores.correoElectronico = 'Ingresa un correo válido.'
  }
  return errores
}

export function solicitudDesdeVinculo(
  vinculo: VinculoApoderado,
  esPrincipal = vinculo.esPrincipal,
): SolicitudEditarApoderado {
  return {
    nombres: vinculo.nombres,
    apellidoPaterno: vinculo.apellidoPaterno,
    apellidoMaterno: vinculo.apellidoMaterno,
    celular: vinculo.celular ?? '',
    correoElectronico: vinculo.correoElectronico ?? '',
    parentesco: vinculo.parentesco,
    esPrincipal,
  }
}

export function nombreApoderado(vinculo: VinculoApoderado): string {
  return `${vinculo.nombres} ${vinculo.apellidoPaterno} ${vinculo.apellidoMaterno}`.trim()
}

export function formatearCelularApoderado(celular: string | null): string {
  if (!celular) return 'Sin celular'
  return /^9\d{8}$/.test(celular) ? `${celular.slice(0, 3)} ${celular.slice(3, 6)} ${celular.slice(6)}` : celular
}

/** Apoderados de un estudiante. Solo el administrador puede usar estas rutas. */
export function useApoderadosEstudiante() {
  const { solicitar } = useApi()
  const ruta = (estudianteId: number) => `/api/v1/estudiantes/${estudianteId}/apoderados`

  function listar(estudianteId: number): Promise<VinculoApoderado[]> {
    return solicitar<VinculoApoderado[]>(ruta(estudianteId))
  }

  function verificar(
    estudianteId: number,
    tipoDocumento: TipoDocumentoApoderado,
    numeroDocumento: string,
  ): Promise<VerificacionApoderado> {
    return solicitar<VerificacionApoderado>(`${ruta(estudianteId)}/verificacion`, {
      metodo: 'POST',
      cuerpo: { tipoDocumento, numeroDocumento: numeroDocumento.trim().toUpperCase() },
    })
  }

  function vincular(
    estudianteId: number,
    solicitud: SolicitudVincularApoderado,
    esNuevo: boolean,
  ): Promise<VinculoApoderado> {
    const base = {
      tipoDocumento: solicitud.tipoDocumento,
      numeroDocumento: solicitud.numeroDocumento.trim().toUpperCase(),
      parentesco: solicitud.parentesco,
      esPrincipal: solicitud.esPrincipal,
    }
    const cuerpo = esNuevo
      ? {
          ...base,
          nombres: solicitud.nombres.trim(),
          apellidoPaterno: solicitud.apellidoPaterno.trim(),
          apellidoMaterno: solicitud.apellidoMaterno.trim(),
          celular: solicitud.celular.trim(),
          correoElectronico: solicitud.correoElectronico.trim() || null,
        }
      : base
    return solicitar<VinculoApoderado>(ruta(estudianteId), { metodo: 'POST', cuerpo })
  }

  function actualizar(
    estudianteId: number,
    apoderadoId: number,
    solicitud: SolicitudEditarApoderado,
  ): Promise<VinculoApoderado> {
    return solicitar<VinculoApoderado>(`${ruta(estudianteId)}/${apoderadoId}`, {
      metodo: 'PUT',
      cuerpo: {
        parentesco: solicitud.parentesco,
        esPrincipal: solicitud.esPrincipal,
        nombres: solicitud.nombres.trim() || null,
        apellidoPaterno: solicitud.apellidoPaterno.trim() || null,
        apellidoMaterno: solicitud.apellidoMaterno.trim() || null,
        celular: solicitud.celular.trim() || null,
        correoElectronico: solicitud.correoElectronico.trim() || null,
      },
    })
  }

  return { listar, verificar, vincular, actualizar }
}
