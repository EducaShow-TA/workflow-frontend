import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface UsuarioAutenticado {
  nombre: string
  correoElectronico: string
  rol: 'ADMINISTRADOR'
}

interface ResultadoAutenticacion {
  exito: boolean
  mensaje: string
}

export const useAutenticacionStore = defineStore('autenticacion', () => {
  const usuario = ref<UsuarioAutenticado | null>(null)

  const autenticado = computed(() => usuario.value !== null)

  function iniciarSesion(correoElectronico: string, contrasenia: string): ResultadoAutenticacion {
    if (!import.meta.dev) {
      return {
        exito: false,
        mensaje: 'La autenticación de prueba no está disponible.',
      }
    }

    const correoValido = correoElectronico.toLowerCase() === 'admin@educashow.com'
    const contraseniaValida = contrasenia === 'Admin12345'

    if (!correoValido || !contraseniaValida) {
      return {
        exito: false,
        mensaje: 'Correo electrónico o contraseña incorrectos.',
      }
    }

    usuario.value = {
      nombre: 'Administrador',
      correoElectronico: 'admin@educashow.com',
      rol: 'ADMINISTRADOR',
    }

    return {
      exito: true,
      mensaje: '',
    }
  }

  function cerrarSesion(): void {
    usuario.value = null
  }

  return {
    usuario,
    autenticado,
    iniciarSesion,
    cerrarSesion,
  }
})
