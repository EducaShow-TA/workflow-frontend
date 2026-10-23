<script setup lang="ts">
import { ref } from 'vue'
import type { AccionRapidaPanel } from '~/types/panel'

definePageMeta({
  middleware: 'autenticacion',
})

const acciones = [
  { id: 'registrar-estudiante', titulo: 'Registrar Estudiante', icono: '/icons/accion-estudiante.svg', colorFondo: '#004ac61a' },
  { id: 'crear-matricula', titulo: 'Crear Matrícula', icono: '/icons/accion-matricula.svg', colorFondo: '#4059aa1a' },
  { id: 'registrar-pago', titulo: 'Registrar Pago', icono: '/icons/accion-pago.svg', colorFondo: '#196fc01a' },
  { id: 'gestionar-horarios', titulo: 'Gestionar Horarios', icono: '/icons/accion-horarios.svg', colorFondo: '#7376861a' },
]

const mensajeAccion = ref('')

async function seleccionarAccion(accion: AccionRapidaPanel): Promise<void> {
  if (accion.id === 'registrar-estudiante') {
    await navigateTo('/estudiantes/nuevo')
    return
  }

  mensajeAccion.value = `La opción "${accion.titulo}" estará disponible cuando se implemente su módulo.`
}
</script>

<template>
  <main class="pagina-panel">
    <AccionesRapidas :acciones="acciones" @seleccionar="seleccionarAccion" />

    <p v-if="mensajeAccion" class="aviso-accion" role="status">
      {{ mensajeAccion }}
    </p>

    <section class="estado-resumen" aria-label="Estado de los indicadores">
      <h1>Resumen del colegio</h1>
      <p>Los indicadores aparecerán aquí cuando el sistema cuente con datos reales para mostrarlos.</p>
    </section>

  </main>
</template>

<style scoped>
.pagina-panel {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 24px;
  padding: 32px;
}

.aviso-accion {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 14px;
}

.estado-resumen {
  padding: 24px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.estado-resumen h1 {
  margin: 0 0 8px;
  color: #191c1e;
  font-size: 20px;
}

.estado-resumen p {
  margin: 0;
  color: #434655;
  font-size: 14px;
}
@media (max-width: 600px) {
  .pagina-panel {
    padding: 16px;
  }
}
</style>
