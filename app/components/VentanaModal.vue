<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const propiedades = withDefaults(
  defineProps<{
    abierta: boolean
    titulo: string
    descripcion?: string
    /** Mientras se guarda no se permite cerrar, para no perder la respuesta del servidor. */
    bloqueada?: boolean
  }>(),
  {
    descripcion: '',
    bloqueada: false,
  },
)

const emitir = defineEmits<{
  cerrar: []
}>()

const SELECTOR_ENFOCABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'

const idTitulo = useId()
const idDescripcion = useId()
const ventana = ref<HTMLElement | null>(null)
let elementoEnfocadoAntes: HTMLElement | null = null

function obtenerEnfocables(): HTMLElement[] {
  return ventana.value ? Array.from(ventana.value.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES)) : []
}

function solicitarCierre(): void {
  if (!propiedades.bloqueada) {
    emitir('cerrar')
  }
}

// Mantiene el foco dentro de la ventana mientras esta abierta (patron de dialogo modal accesible).
function manejarTeclado(evento: KeyboardEvent): void {
  if (evento.key === 'Escape') {
    evento.preventDefault()
    solicitarCierre()
    return
  }

  if (evento.key !== 'Tab') {
    return
  }

  const enfocables = obtenerEnfocables()
  const primero = enfocables[0]
  const ultimo = enfocables[enfocables.length - 1]

  if (!primero || !ultimo) {
    return
  }

  if (evento.shiftKey && document.activeElement === primero) {
    evento.preventDefault()
    ultimo.focus()
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault()
    primero.focus()
  }
}

watch(
  () => propiedades.abierta,
  async (abierta) => {
    if (abierta) {
      elementoEnfocadoAntes = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      await nextTick()
      // Se enfoca el primer campo del contenido; si no hay, el primer control de la ventana.
      const primerCampo = ventana.value?.querySelector<HTMLElement>(`.contenido-modal :is(${SELECTOR_ENFOCABLES})`)
      ;(primerCampo ?? obtenerEnfocables()[0])?.focus()
      return
    }

    document.body.style.overflow = ''
    elementoEnfocadoAntes?.focus()
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="abierta" class="fondo-modal" @click.self="solicitarCierre">
      <section
        ref="ventana"
        class="ventana-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="idTitulo"
        :aria-describedby="descripcion ? idDescripcion : undefined"
        @keydown="manejarTeclado"
      >
        <header class="encabezado-modal">
          <div>
            <h2 :id="idTitulo">{{ titulo }}</h2>

            <p v-if="descripcion" :id="idDescripcion">{{ descripcion }}</p>
          </div>

          <button
            type="button"
            class="boton-cerrar"
            aria-label="Cerrar ventana"
            :disabled="bloqueada"
            @click="solicitarCierre"
          >
            ×
          </button>
        </header>

        <div class="contenido-modal">
          <slot />
        </div>

        <footer v-if="$slots.pie" class="pie-modal">
          <slot name="pie" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.fondo-modal {
  position: fixed;
  z-index: 50;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgb(15 23 42 / 45%);
}

.ventana-modal {
  display: flex;
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 32px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
  box-shadow: 0 20px 40px rgb(0 0 0 / 18%);
}

.encabezado-modal {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin: 0 24px;
  padding: 20px 0 16px;
  border-bottom: 1px solid #e5e7eb;
}

.encabezado-modal h2 {
  margin: 0;
  color: #191c1e;
  font-size: 20px;
}

.encabezado-modal p {
  margin: 6px 0 0;
  color: #434655;
  font-size: 14px;
}

.boton-cerrar {
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: #434655;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.contenido-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding: 24px;
}

.pie-modal {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f7f9fb;
}

@media (max-width: 520px) {
  .pie-modal {
    flex-direction: column-reverse;
  }
}
</style>
