import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { RespuestaInicioSesion, SolicitudInicioSesion, UsuarioPerfil } from '~/types/autenticacion'
import { ErrorSolicitudApi } from '~/types/api'

interface ResultadoAutenticacion {
  exito: boolean
  mensaje: string
  estado?: number
}

export const useAutenticacionStore = defineStore('autenticacion', () => {
  // El token vive solo en memoria: al recargar la página se pide iniciar sesión otra vez.
  // Persistirlo ("Recordar sesión") es una decisión de seguridad pendiente del equipo.
  const token = ref<string | null>(null)
  const usuario = ref<UsuarioPerfil | null>(null)

  const autenticado = computed(() => token.value !== null && usuario.value !== null)

  async function iniciarSesion(correoElectronico: string, contrasenia: string): Promise<ResultadoAutenticacion> {
    const { solicitar } = useApi()
    const cuerpo: SolicitudInicioSesion = { username: correoElectronico, password: contrasenia }

    try {
      const respuesta = await solicitar<RespuestaInicioSesion>('/api/v1/auth/login', { metodo: 'POST', cuerpo })
      token.value = respuesta.token
      usuario.value = respuesta.usuario
      return { exito: true, mensaje: '' }
    } catch (error: unknown) {
      if (error instanceof ErrorSolicitudApi) {
        return { exito: false, mensaje: error.message, estado: error.estado }
      }

      return { exito: false, mensaje: 'No se pudo iniciar sesión.' }
    }
  }

  function cerrarSesion(): void {
    token.value = null
    usuario.value = null
  }

  // El token identifica al usuario por su correo: si lo cambia, debe volver a iniciar sesión con el nuevo.
  const correoActualizado = ref('')

  function cerrarSesionPorCambioDeCorreo(nuevoCorreo: string): void {
    cerrarSesion()
    correoActualizado.value = nuevoCorreo
  }

  function tomarCorreoActualizado(): string {
    const correo = correoActualizado.value
    correoActualizado.value = ''
    return correo
  }

  return {
    token,
    usuario,
    autenticado,
    iniciarSesion,
    cerrarSesion,
    cerrarSesionPorCambioDeCorreo,
    tomarCorreoActualizado,
  }
})
