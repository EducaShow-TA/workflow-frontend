<script setup lang="ts">
import type { EstadoFinancieroPanel } from '~/types/finanzas'

defineProps<{
  resumen: EstadoFinancieroPanel
}>()

const emitir = defineEmits<{
  verReporte: []
}>()

const formateadorMoneda = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function formatearMonto(monto: number): string {
  return formateadorMoneda.format(monto)
}
</script>

<template>
  <article class="estado-financiero">
    <h2>Estado Financiero</h2>

    <div class="resumen-pagos">
      <div class="tarjeta-pago pendientes">
        <h3>Pagos Pendientes</h3>

        <div class="detalle-pago">
          <strong>{{ formatearMonto(resumen.pagosPendientes) }}</strong>
          <span>{{ resumen.alumnosPendientes }} alumnos</span>
        </div>
      </div>

      <div class="tarjeta-pago vencidos">
        <h3>Pagos Vencidos</h3>

        <div class="detalle-pago">
          <strong>{{ formatearMonto(resumen.pagosVencidos) }}</strong>
          <span>{{ resumen.alumnosVencidos }} alumnos</span>
        </div>
      </div>
    </div>

    <button type="button" class="boton-reporte" @click="emitir('verReporte')">Ver Reporte Completo</button>
  </article>
</template>

<style scoped>
.estado-financiero {
  display: flex;
  min-width: 0;
  min-height: 288px;
  flex-direction: column;
  padding: 17px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background-color: var(--color-surface);
}

h2 {
  margin: 0 0 16px;
  color: #191c1e;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.resumen-pagos {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
}

.tarjeta-pago {
  padding: 9px;
  border: 1px solid rgb(195 198 215 / 50%);
  border-radius: 8px;
}

.pendientes {
  background-color: #f7f9fb;
}

.vencidos {
  border-color: rgb(186 26 26 / 20%);
  background-color: rgb(255 218 214 / 20%);
  color: #ba1a1a;
}

.tarjeta-pago h3 {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.pendientes h3 {
  color: #434655;
}

.detalle-pago {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
}

.detalle-pago strong {
  font-size: 24px;
  line-height: 32px;
}

.detalle-pago span {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.pendientes .detalle-pago span {
  color: #434655;
}

.boton-reporte {
  width: 100%;
  min-height: 38px;
  margin-top: 16px;
  padding: 9px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background-color: white;
  color: #191c1e;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.boton-reporte:hover {
  border-color: var(--color-primary);
  background-color: #f7f9fb;
}

.boton-reporte:focus-visible {
  outline: 3px solid var(--color-primary-light);
  outline-offset: 2px;
}
</style>
