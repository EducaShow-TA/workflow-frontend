<script setup lang="ts">
withDefaults(
  defineProps<{
    abierta: boolean
    titulo: string
    mensaje: string
    textoConfirmar?: string
    /** "peligro" se usa para acciones que no se pueden deshacer, como eliminar. */
    variante?: 'normal' | 'peligro'
    procesando?: boolean
    error?: string
  }>(),
  {
    textoConfirmar: 'Confirmar',
    variante: 'normal',
    procesando: false,
    error: '',
  },
)

const emitir = defineEmits<{
  confirmar: []
  cancelar: []
}>()
</script>

<template>
  <VentanaModal :abierta="abierta" :titulo="titulo" :bloqueada="procesando" @cerrar="emitir('cancelar')">
    <p class="mensaje">{{ mensaje }}</p>

    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />

    <template #pie>
      <BotonAccion variante="secundario" :deshabilitado="procesando" @click="emitir('cancelar')">
        Cancelar
      </BotonAccion>

      <button
        type="button"
        class="boton-confirmar"
        :class="variante"
        :disabled="procesando"
        @click="emitir('confirmar')"
      >
        {{ procesando ? 'Procesando...' : textoConfirmar }}
      </button>
    </template>
  </VentanaModal>
</template>

<style scoped>
.mensaje {
  margin: 0;
  color: #434655;
  font-size: 14px;
  line-height: 1.6;
}

.boton-confirmar {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border: 0;
  border-radius: 8px;
  background: #004ac6;
  color: white;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.boton-confirmar:hover:not(:disabled) {
  background: #003e9f;
}

.boton-confirmar.peligro {
  background: #dc2626;
}

.boton-confirmar.peligro:hover:not(:disabled) {
  background: #b91c1c;
}

.boton-confirmar:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.boton-confirmar:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
