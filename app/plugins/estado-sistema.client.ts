import { useEstadoSistema } from '~/composables/useParametrosSistema'
import { useAutenticacionStore } from '~/stores/autenticacion'

export default defineNuxtPlugin(() => {
  const autenticacion = useAutenticacionStore()
  const { cargarEstado, limpiarEstado } = useEstadoSistema()

  watch(
    () => autenticacion.token,
    (token) => {
      if (token) void cargarEstado(true)
      else limpiarEstado()
    },
    { immediate: true },
  )

  useRouter().afterEach(() => {
    if (autenticacion.token) void cargarEstado()
  })
})
