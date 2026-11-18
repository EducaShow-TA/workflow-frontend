<script setup lang="ts">
import { useAutenticacionStore } from '~/stores/autenticacion'
const autenticacion = useAutenticacionStore()
async function salir(): Promise<void> {
  autenticacion.cerrarSesion()
  await navigateTo('/login')
}
</script>
<template>
  <div class="portal-familia">
    <header>
      <strong
        >EducaShow ·
        {{ autenticacion.usuario?.rol === 'ALUMNO' ? 'Portal del alumno' : 'Portal del apoderado' }}</strong
      ><span>{{ autenticacion.usuario?.nombreCompleto }}</span
      ><button type="button" @click="salir">Cerrar sesión</button>
    </header>
    <nav class="navegacion-familia" aria-label="Navegación académica">
      <NuxtLink v-if="autenticacion.usuario?.rol === 'APODERADO'" to="/libretas">Libretas</NuxtLink>
      <NuxtLink to="/mi-horario">Horario de clases</NuxtLink>
    </nav>
    <slot />
  </div>
</template>
<style scoped>
.portal-familia {
  min-height: 100vh;
  background: #f5f6fa;
}
header {
  display: flex;
  gap: 20px;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: center;
  padding: 20px 32px;
  background: white;
  border-bottom: 1px solid #dce3ed;
}
strong {
  color: #075b99;
}
button {
  border: 1px solid #c9d4e5;
  border-radius: 7px;
  padding: 10px 16px;
  background: white;
  cursor: pointer;
}
.navegacion-familia {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 32px 0;
}
.navegacion-familia a {
  color: #1e40af;
  text-decoration: none;
  font-weight: 600;
  padding: 10px 16px;
  border-radius: 8px;
  background: white;
  border: 1px solid #dce3ed;
}
.navegacion-familia a.router-link-active {
  background: #dbeafe;
}
</style>
