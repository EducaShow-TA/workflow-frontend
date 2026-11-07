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
      <strong>EducaShow · Portal del apoderado</strong><span>{{ autenticacion.usuario?.nombreCompleto }}</span
      ><button type="button" @click="salir">Cerrar sesión</button>
    </header>
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
</style>
