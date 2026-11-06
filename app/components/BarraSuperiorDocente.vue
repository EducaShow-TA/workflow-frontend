<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAutenticacionStore } from '~/stores/autenticacion'

const ruta = useRoute()
const autenticacion = useAutenticacionStore()
const perfilAbierto = ref(false)
const titulos: Record<string, string> = {
  '/docente': 'Mi panel',
  '/docente/tareas': 'Gestión de tareas',
  '/docente/calificaciones': 'Calificaciones y evidencias',
  '/docente/asistencia': 'Asistencia de alumnos',
  '/docente/marcaje': 'Mi marcaje',
  '/docente/horario': 'Mi horario',
}
const titulo = computed(
  () =>
    titulos[ruta.path] ??
    (ruta.path.startsWith('/docente/asistencia/') ? titulos['/docente/asistencia'] : undefined) ??
    'Portal docente',
)
const iniciales = computed(() => {
  const palabras = (autenticacion.usuario?.nombreCompleto ?? 'Docente').trim().split(/\s+/)
  return palabras
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('')
})

async function salir(): Promise<void> {
  perfilAbierto.value = false
  autenticacion.cerrarSesion()
  await navigateTo('/login')
}
</script>

<template>
  <header class="docente-superior" @keydown.esc="perfilAbierto = false">
    <div class="docente-superior__barra">
      <div class="docente-superior__identidad">
        <span class="docente-superior__identificador">Portal Docente</span>
        <span class="docente-superior__separador" aria-hidden="true">/</span>
        <strong>{{ titulo }}</strong>
      </div>
      <div class="docente-superior__acciones">
        <span class="docente-superior__rol">{{
          autenticacion.usuario?.rol === 'ADMINISTRADOR' ? 'Vista de administrador' : 'Docente'
        }}</span>
        <button
          type="button"
          class="docente-superior__perfil"
          aria-label="Abrir opciones de usuario"
          aria-haspopup="menu"
          :aria-expanded="perfilAbierto"
          @click="perfilAbierto = !perfilAbierto"
        >
          {{ iniciales }}
        </button>
        <div v-if="perfilAbierto" class="docente-superior__menu" role="menu" aria-label="Opciones del usuario">
          <strong>{{ autenticacion.usuario?.nombreCompleto ?? 'Usuario' }}</strong>
          <small>{{ autenticacion.usuario?.username }}</small>
          <button type="button" role="menuitem" @click="salir">Cerrar sesión</button>
        </div>
      </div>
    </div>
    <nav class="docente-superior__migas" aria-label="Ruta de navegación">
      <NuxtLink to="/docente">Inicio</NuxtLink>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{{ titulo }}</span>
    </nav>
  </header>
</template>
