<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string
    etiqueta: string
    valor: string
    tipo?: 'text' | 'email' | 'password'
    marcador?: string
    autocompletado?: string
    error?: string
  }>(),
  {
    tipo: 'text',
    marcador: '',
    autocompletado: 'off',
    error: '',
  },
)

const emitir = defineEmits<{
  'update:valor': [valor: string]
}>()

function actualizarValor(evento: Event): void {
  const elemento = evento.target as HTMLInputElement
  emitir('update:valor', elemento.value)
}
</script>

<template>
  <div class="campo-formulario">
    <label :for="id">
      {{ etiqueta }}
    </label>

    <div class="contenedor-campo">
      <input
        :id="id"
        :type="tipo"
        :value="valor"
        :placeholder="marcador"
        :autocomplete="autocompletado"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? `${id}-error` : undefined"
        :class="{ 'con-sufijo': $slots.derecha }"
        @input="actualizarValor"
      />

      <slot name="derecha" />
    </div>

    <p v-if="error" :id="`${id}-error`" class="mensaje-error">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.campo-formulario {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.contenedor-campo {
  position: relative;
  width: 100%;
}

input {
  width: 100%;
  min-height: 42px;
  padding: 10px 12px;
  border: 1px solid #bbc5ce;
  border-radius: var(--radius-sm);
  outline: none;
  background-color: var(--color-surface);
  color: var(--color-text);
  font-size: 14px;
  transition: border-color 0.2s;
}

input::placeholder {
  color: #98a2b3;
}

input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgb(30 64 175 / 12%);
}

input[aria-invalid='true'] {
  border-color: var(--color-error);
}

input.con-sufijo {
  padding-right: 90px;
}

.mensaje-error {
  margin: 0;
  color: var(--color-error);
  font-size: 12px;
}
</style>
