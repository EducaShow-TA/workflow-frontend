<script setup lang="ts">
withDefaults(
  defineProps<{
    titulo: string
    descripcion: string
    icono?: string
  }>(),
  { icono: '/icons/menu-competencias.svg' },
)
</script>

<template>
  <div class="docente-vacio" role="status">
    <div class="docente-vacio__icono"><img :src="icono" alt="" /></div>
    <strong>{{ titulo }}</strong>
    <p>{{ descripcion }}</p>
    <slot />
  </div>
</template>
