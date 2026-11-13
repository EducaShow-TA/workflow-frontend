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
    <div class="contenido-familia">
      <nav aria-label="Menú del portal">
        <NuxtLink v-if="autenticacion.usuario?.rol === 'APODERADO'" to="/libretas">Libretas e informes</NuxtLink>
        <NuxtLink to="/asistencia">Historial de asistencia</NuxtLink>
      </nav>
      <div class="pagina-familia"><slot /></div>
    </div>
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
.contenido-familia {
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  min-height: calc(100vh - 80px);
}
nav {
  padding: 16px 12px;
  background: #075b99;
}
nav a {
  display: block;
  padding: 11px 12px;
  border-radius: 8px;
  color: white;
  text-decoration: none;
}
nav a.router-link-exact-active {
  color: #142651;
  background: #b4c2ff;
  font-weight: 600;
}
@media (max-width: 700px) {
  .contenido-familia {
    grid-template-columns: minmax(0, 1fr);
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}
</style>
