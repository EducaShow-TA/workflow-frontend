<script setup lang="ts">
import { ref } from 'vue'
import type { AccionRapidaPanel } from '~/types/panel'
import { useResumenPanel } from '~/composables/useResumenPanel'
import { useResumenFinanciero } from '~/composables/useResumenFinanciero'

definePageMeta({
  middleware: 'autenticacion',
})

const { acciones, metricas } = useResumenPanel()
const { estadoFinanciero, tendenciaPagos, escalaMaxima } = useResumenFinanciero()

const mensajeReporte = ref('')

function informarReporte(): void {
  mensajeReporte.value = 'El reporte financiero completo estará disponible cuando se implemente el módulo de finanzas.'
}

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

    <MetricasPanel :metricas="metricas" />

    <section class="seccion-financiera" aria-label="Resumen financiero">
      <EstadoFinanciero :resumen="estadoFinanciero" @ver-reporte="informarReporte" />

      <TendenciaPagos :pagos="tendenciaPagos" :escala-maxima="escalaMaxima" />
    </section>

    <p v-if="mensajeReporte" class="aviso-accion" role="status">
      {{ mensajeReporte }}
    </p>

    <p class="nota-demostracion">
      Indicadores de demostración basados en Figma. No representan datos reales del colegio.
    </p>
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

.nota-demostracion {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.seccion-financiera {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2.05fr);
  gap: 16px;
}

@media (max-width: 1100px) {
  .seccion-financiera {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 600px) {
  .pagina-panel {
    padding: 16px;
  }
}
</style>
