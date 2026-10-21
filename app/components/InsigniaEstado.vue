<script setup lang="ts">
import type { VarianteInsignia } from '~/types/interfaz'

withDefaults(
  defineProps<{
    texto: string
    variante?: VarianteInsignia
  }>(),
  {
    variante: 'neutro',
  },
)
</script>

<template>
  <span class="insignia-estado" :class="variante">{{ texto }}</span>
</template>

<style scoped>
.insignia-estado {
  display: inline-flex;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.exito {
  background: #dcfce7;
  color: #166534;
}

.advertencia {
  background: #fef3c7;
  color: #92400e;
}

.error {
  background: #fee2e2;
  color: #991b1b;
}

.informacion {
  background: #eef2ff;
  color: #1e40af;
}

.neutro {
  background: #e5e7eb;
  color: #374151;
}
</style>
