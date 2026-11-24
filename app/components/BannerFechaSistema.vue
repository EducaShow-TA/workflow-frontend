<script setup lang="ts">
import { ahoraSistema } from '~/composables/useFechas'
import { describirFechaSistema, useEstadoSistema } from '~/composables/useParametrosSistema'

const { estado } = useEstadoSistema()
const ruta = useRoute()

const fecha = computed(() => {
  void ruta.fullPath
  return estado.value?.fechaSimulada ? describirFechaSistema(ahoraSistema()) : ''
})
</script>

<template>
  <div v-if="fecha" class="banner-fecha" role="status">
    <span aria-hidden="true">🕒</span>
    <span>
      Fecha del sistema: <strong>{{ fecha }}</strong> · simulada para la demostración
    </span>
  </div>
</template>

<style scoped>
.banner-fecha {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 32px;
  border-bottom: 1px solid #fcd34d;
  background: #fef3c7;
  color: #78350f;
  font-size: 13px;
}
</style>
