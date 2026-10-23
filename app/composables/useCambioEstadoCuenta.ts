import { ref } from 'vue'
import type { CuentaUsuario } from '~/types/cuentaUsuario'
import { useCuentasUsuario } from '~/composables/useCuentasUsuario'
import { obtenerMensajeError } from '~/composables/useDatosPrueba'

/** Activar se aplica directamente; desactivar pide confirmación porque impide iniciar sesión (US-5.1). */
export function useCambioEstadoCuenta(alActualizar: (cuenta: CuentaUsuario, mensaje: string) => void) {
  const { cambiarEstadoCuenta } = useCuentasUsuario()

  const cuentaPorDesactivar = ref<CuentaUsuario | null>(null)
  const idProcesando = ref<number | null>(null)
  const errorConfirmacion = ref('')
  const errorEstado = ref('')

  async function aplicar(cuenta: CuentaUsuario, activo: boolean): Promise<boolean> {
    idProcesando.value = cuenta.id

    try {
      const actualizada = await cambiarEstadoCuenta(cuenta.id, activo)
      alActualizar(actualizada, `Cuenta de ${actualizada.nombreCompleto} ${activo ? 'activada' : 'desactivada'}.`)
      return true
    } catch (error: unknown) {
      const mensaje = obtenerMensajeError(error, 'No se pudo cambiar el estado de la cuenta.')

      if (cuentaPorDesactivar.value) {
        errorConfirmacion.value = mensaje
      } else {
        errorEstado.value = mensaje
      }

      return false
    } finally {
      idProcesando.value = null
    }
  }

  async function solicitarCambio(cuenta: CuentaUsuario, activo: boolean): Promise<void> {
    errorEstado.value = ''

    if (activo) {
      await aplicar(cuenta, true)
      return
    }

    errorConfirmacion.value = ''
    cuentaPorDesactivar.value = cuenta
  }

  async function confirmarDesactivacion(): Promise<void> {
    const cuenta = cuentaPorDesactivar.value

    if (cuenta && (await aplicar(cuenta, false))) {
      cuentaPorDesactivar.value = null
    }
  }

  function cancelarDesactivacion(): void {
    cuentaPorDesactivar.value = null
  }

  return {
    cuentaPorDesactivar,
    idProcesando,
    errorConfirmacion,
    errorEstado,
    solicitarCambio,
    confirmarDesactivacion,
    cancelarDesactivacion,
  }
}
