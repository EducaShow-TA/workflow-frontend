import { useAutenticacionStore } from '~/stores/autenticacion'
import { puedeAcceder } from '~/composables/usePermisosRol'

export default defineNuxtRouteMiddleware((destino) => {
  const autenticacion = useAutenticacionStore()
  const rol = autenticacion.usuario?.rol

  if (!autenticacion.autenticado || !rol) {
    return
  }

  if (!puedeAcceder(rol, destino.path)) {
    return navigateTo({ path: '/acceso-denegado', query: { ruta: destino.path } })
  }
})
