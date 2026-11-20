<script setup lang="ts">
import { computed } from 'vue'
import { formatearSolesFamilia } from '~/composables/usePagosFamilia'
import type { DeudaFamilia } from '~/types/familia'

const propiedades = defineProps<{
  abierta: boolean
  deudas: DeudaFamilia[]
  titular?: string
}>()

const emitir = defineEmits<{ cerrar: [] }>()

const total = computed(() => propiedades.deudas.reduce((suma, deuda) => suma + deuda.boleta.montoTotal, 0))
</script>

<template>
  <VentanaModal
    :abierta="propiedades.abierta"
    :titulo="propiedades.deudas.length === 1 ? 'Pago en línea' : 'Pagos en línea'"
    :descripcion="`${propiedades.deudas.length} ${propiedades.deudas.length === 1 ? 'boleta seleccionada' : 'boletas seleccionadas'} · ${formatearSolesFamilia(total)}`"
    @cerrar="emitir('cerrar')"
  >
    <p class="aviso-pago">
      El pago en línea no está disponible en este momento. Comunícate con el colegio para conocer los medios de pago
      habilitados.
    </p>

    <template #pie>
      <BotonAccion @click="emitir('cerrar')">Entendido</BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.aviso-pago {
  margin: 0;
  padding: 16px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 14px;
  line-height: 1.6;
}
</style>
