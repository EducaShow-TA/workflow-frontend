<script setup lang="ts">
import type { BloqueCalculado } from '~/types/plantillaHorario'
import { describirBloque, formatearMinutos } from '~/composables/usePlantillasHorario'

withDefaults(
  defineProps<{
    bloques: BloqueCalculado[]
    /** Si se indica y sobra tiempo, se muestra el tramo sin usar hasta el fin de la jornada. */
    finJornada?: number | null
  }>(),
  {
    finJornada: null,
  },
)
</script>

<template>
  <ol class="linea-tiempo">
    <li v-for="bloque in bloques" :key="`${bloque.tipo}-${bloque.inicio}`" :class="bloque.tipo.toLowerCase()">
      <span class="horas">{{ formatearMinutos(bloque.inicio) }} – {{ formatearMinutos(bloque.fin) }}</span>
      <span class="etiqueta">{{ describirBloque(bloque) }}</span>
    </li>
    <li v-if="finJornada !== null && bloques.length > 0 && bloques.at(-1)!.fin < finJornada" class="sin-usar">
      <span class="horas">{{ formatearMinutos(bloques.at(-1)!.fin) }} – {{ formatearMinutos(finJornada) }}</span>
      <span class="etiqueta">Sin usar · {{ finJornada - bloques.at(-1)!.fin }} min</span>
    </li>
  </ol>
</template>

<style scoped>
.linea-tiempo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.linea-tiempo li {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.horas {
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}

.etiqueta {
  padding: 8px 12px;
  border: 1px solid;
  border-radius: 8px;
  font-weight: 600;
}

.pedagogico .etiqueta {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1e3a8a;
}

.recreo .etiqueta {
  border-color: #fde68a;
  background: #fffbeb;
  color: #92400e;
}

.sin-usar .etiqueta {
  border-style: dashed;
  border-color: #d1d5db;
  background: repeating-linear-gradient(45deg, #f9fafb, #f9fafb 6px, #f3f4f6 6px, #f3f4f6 12px);
  color: #6b7280;
  font-weight: 500;
}
</style>
