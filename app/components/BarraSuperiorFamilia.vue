<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAutenticacionStore } from '~/stores/autenticacion'

const ruta = useRoute()
const autenticacion = useAutenticacionStore()
const perfilAbierto = ref(false)
const titulos: Record<string, string> = {
  '/familia': 'Panel',
  '/familia/asistencia': 'Asistencia',
  '/familia/matricula': 'Matrícula anual',
  '/familia/reporte-anual': 'Reporte anual de notas',
  '/familia/pagos': 'Pagos',
  '/familia/horario': 'Horario de mi hijo',
  '/libretas': 'Progreso académico',
}
const titulo = computed(() => titulos[ruta.path] ?? 'Portal del apoderado')
const iniciales = computed(() => {
  const palabras = (autenticacion.usuario?.nombreCompleto ?? 'Apoderado').trim().split(/\s+/)
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
        <span class="docente-superior__identificador">Portal del apoderado</span>
        <span class="docente-superior__separador" aria-hidden="true">/</span>
        <strong>{{ titulo }}</strong>
      </div>
      <div class="docente-superior__acciones">
        <span class="docente-superior__rol">Apoderado</span>
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
  </header>
</template>
