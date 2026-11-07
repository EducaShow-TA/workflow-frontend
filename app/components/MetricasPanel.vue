<script setup lang="ts">
import type { MetricaPanel } from '~/types/panel'

defineProps<{
  metricas: MetricaPanel[]
}>()
</script>

<template>
  <section class="metricas-panel" aria-label="Indicadores del colegio">
    <article v-for="metrica in metricas" :key="metrica.id" class="tarjeta-metrica">
      <div class="encabezado-metrica">
        <span class="titulo-metrica">
          {{ metrica.titulo }}
        </span>

        <img :src="metrica.icono" alt="" />
      </div>

      <strong class="valor-metrica">
        {{ metrica.valor }}
      </strong>

      <div class="pie-metrica" :class="`detalle-${metrica.colorDetalle}`">
        <template v-if="metrica.porcentajeProgreso !== undefined">
          <span>{{ metrica.detalle }}</span>

          <div
            class="barra-progreso"
            role="progressbar"
            :aria-label="metrica.titulo"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="metrica.porcentajeProgreso"
          >
            <span class="progreso" :style="{ width: `${metrica.porcentajeProgreso}%` }" />
          </div>
        </template>

        <template v-else>
          <img v-if="metrica.iconoDetalle" :src="metrica.iconoDetalle" alt="" />

          <span>{{ metrica.detalle }}</span>
        </template>
      </div>
    </article>
  </section>
</template>

<style scoped>
.metricas-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.tarjeta-metrica {
  display: flex;
  min-width: 0;
  min-height: 122px;
  flex-direction: column;
  justify-content: space-between;
  padding: 17px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background-color: var(--color-surface);
}

.encabezado-metrica {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 4px;
}

.titulo-metrica {
  color: #434655;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.6px;
  line-height: 16px;
}

.valor-metrica {
  color: #191c1e;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.32px;
  line-height: 40px;
}

.pie-metrica {
  display: flex;
  min-height: 24px;
  align-items: flex-end;
  gap: 4px;
  padding-top: 8px;
  font-size: 12px;
  font-weight: 600;
}

.detalle-negativo {
  color: #ba1a1a;
}

.detalle-positivo {
  color: #004ac6;
}

.detalle-neutro {
  color: #434655;
}

.tarjeta-metrica:last-child .detalle-positivo {
  color: #16a34a;
}

.barra-progreso {
  width: 101px;
  max-width: 50%;
  height: 8px;
  margin: 4px 0;
  margin-left: auto;
  overflow: hidden;
  border-radius: 999px;
  background: #e0e3e5;
}

.progreso {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #004ac6;
}

@media (max-width: 1180px) {
  .metricas-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .metricas-panel {
    grid-template-columns: 1fr;
  }
}
</style>
