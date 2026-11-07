<script setup lang="ts">
import type { ResumenPlantilla } from '~/types/plantillaHorario'
import { describirBloque, formatearMinutos } from '~/composables/usePlantillasHorario'

defineProps<{
  resumen: ResumenPlantilla
}>()
</script>

<template>
  <div class="franja" role="img" :aria-label="`Jornada de ${resumen.bloques.length} bloques`">
    <i
      v-for="bloque in resumen.bloques"
      :key="`${bloque.tipo}-${bloque.inicio}`"
      :class="bloque.tipo.toLowerCase()"
      :style="{ flexGrow: bloque.fin - bloque.inicio }"
      :title="`${describirBloque(bloque)}: ${formatearMinutos(bloque.inicio)} – ${formatearMinutos(bloque.fin)}`"
    />
    <i
      v-if="resumen.minutosSinUsar > 0"
      class="sin-usar"
      :style="{ flexGrow: resumen.minutosSinUsar }"
      :title="`Sin usar: ${resumen.minutosSinUsar} min`"
    />
  </div>
</template>

<style scoped>
.franja {
  display: flex;
  height: 22px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.franja i {
  flex-basis: 0;
  border-right: 1px solid white;
}

.franja i:last-child {
  border-right: 0;
}

.pedagogico {
  background: #bfdbfe;
}

.recreo {
  background: #fde68a;
}

.sin-usar {
  background: repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 4px, #e5e7eb 4px, #e5e7eb 8px);
}
</style>
