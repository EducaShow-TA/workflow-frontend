<script setup lang="ts">
import { computed } from 'vue'

const propiedades = withDefaults(
  defineProps<{
    activo?: boolean
    etiqueta: string
    /** Si tiene texto, el interruptor queda bloqueado y lo muestra como motivo. */
    motivo?: string
    procesando?: boolean
  }>(),
  {
    activo: undefined,
    motivo: '',
    procesando: false,
  },
)

const emitir = defineEmits<{
  cambiar: [activo: boolean]
}>()

const bloqueado = computed(() => Boolean(propiedades.motivo) || propiedades.activo === undefined)
const estadoAccesible = computed(() => (propiedades.activo === undefined ? 'mixed' : propiedades.activo))
const posicion = computed(() =>
  propiedades.activo === undefined ? 'sin-dato' : propiedades.activo ? 'encendido' : 'apagado',
)

function alternar(): void {
  if (!bloqueado.value && !propiedades.procesando) {
    emitir('cambiar', !propiedades.activo)
  }
}
</script>

<template>
  <button
    type="button"
    role="switch"
    class="interruptor-estado"
    :class="[posicion, { bloqueado, procesando }]"
    :aria-checked="estadoAccesible"
    :aria-label="etiqueta"
    :aria-disabled="bloqueado || procesando"
    :aria-busy="procesando"
    :title="motivo || undefined"
    @click="alternar"
  >
    <span class="perilla">
      <svg v-if="bloqueado" width="10" height="10" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
        <path
          d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm296.5-223.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z"
        />
      </svg>
    </span>
  </button>
</template>

<style scoped>
.interruptor-estado {
  position: relative;
  width: 40px;
  height: 22px;
  flex: 0 0 40px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #e1e3ea;
  cursor: pointer;
  transition: background 0.15s ease;
}

.interruptor-estado.encendido {
  background: #22c55e;
}

.interruptor-estado.apagado {
  background: #c9ccd6;
}

.interruptor-estado.bloqueado {
  cursor: not-allowed;
}

.interruptor-estado.bloqueado.encendido {
  background: #86b89a;
}

.interruptor-estado.bloqueado.apagado {
  background: #e1e3ea;
}

.interruptor-estado.procesando {
  cursor: progress;
  opacity: 0.6;
}

.interruptor-estado:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.perilla {
  position: absolute;
  top: 3px;
  left: 11px;
  display: flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
  color: #8a8e9c;
  transition: left 0.15s ease;
}

.encendido .perilla {
  left: 21px;
}

.apagado .perilla {
  left: 3px;
}
</style>
