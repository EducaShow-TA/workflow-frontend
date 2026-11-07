import { useAutenticacionStore } from '~/stores/autenticacion'

export default defineNuxtRouteMiddleware(() => {
  const autenticacion = useAutenticacionStore()

  if (!autenticacion.autenticado) {
    return navigateTo('/login')
  }
})
