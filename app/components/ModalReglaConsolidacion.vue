<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  useReglasConsolidacion,
  validarUmbralesConsolidacion,
  type UmbralesConsolidacion,
} from '~/composables/useReglasConsolidacion'
import type { Competencia } from '~/types/competencia'

const propiedades = defineProps<{
  competencia: Competencia | null
}>()

const emitir = defineEmits<{
  cerrar: []
  guardada: [nombreCompetencia: string]
}>()

const { obtener, guardar } = useReglasConsolidacion()
const abierta = computed(() => propiedades.competencia !== null)
const cargando = ref(false)
const guardando = ref(false)
const errorCarga = ref('')
const errorGuardado = ref('')
const errorValidacion = ref('')
const umbralB = ref('')
const umbralA = ref('')
const umbralAd = ref('')
let secuenciaCarga = 0

function cargarValores(regla: { umbralB: number; umbralA: number; umbralAd: number }): void {
  umbralB.value = String(regla.umbralB)
  umbralA.value = String(regla.umbralA)
  umbralAd.value = String(regla.umbralAd)
}

async function cargarRegla(codigo: string): Promise<void> {
  const secuencia = ++secuenciaCarga
  cargando.value = true
  errorCarga.value = ''
  errorGuardado.value = ''
  errorValidacion.value = ''

  try {
    const regla = await obtener(codigo)
    if (secuencia === secuenciaCarga) {
      cargarValores(regla)
    }
  } catch (error: unknown) {
    if (secuencia === secuenciaCarga) {
      errorCarga.value = obtenerMensajeError(error, 'No se pudo cargar la regla de consolidación.')
    }
  } finally {
    if (secuencia === secuenciaCarga) {
      cargando.value = false
    }
  }
}

watch(
  () => propiedades.competencia?.codigo,
  (codigo) => {
    if (codigo) {
      void cargarRegla(codigo)
      return
    }

    secuenciaCarga += 1
    cargando.value = false
    errorCarga.value = ''
    errorGuardado.value = ''
    errorValidacion.value = ''
  },
  { immediate: true },
)

async function guardarRegla(): Promise<void> {
  const competencia = propiedades.competencia

  if (!competencia || guardando.value || cargando.value || errorCarga.value) {
    return
  }

  const umbrales: UmbralesConsolidacion = {
    umbralB: Number(umbralB.value),
    umbralA: Number(umbralA.value),
    umbralAd: Number(umbralAd.value),
  }
  errorValidacion.value = validarUmbralesConsolidacion(umbrales)

  if (errorValidacion.value) {
    return
  }

  guardando.value = true
  errorGuardado.value = ''

  try {
    await guardar(competencia.codigo, umbrales)
    emitir('guardada', competencia.nombre)
    emitir('cerrar')
  } catch (error: unknown) {
    errorGuardado.value = obtenerMensajeError(error, 'No se pudo guardar la regla de consolidación.')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    titulo="Regla de consolidación"
    :descripcion="propiedades.competencia ? `Competencia: ${propiedades.competencia.nombre}` : ''"
    :bloqueada="guardando"
    @cerrar="emitir('cerrar')"
  >
    <div v-if="cargando" class="estado-cargando" role="status">Cargando la regla configurada…</div>

    <div v-else-if="errorCarga" class="contenido-regla">
      <AvisoMensaje :mensaje="errorCarga" tipo="error" />
      <BotonAccion
        variante="secundario"
        @click="propiedades.competencia && cargarRegla(propiedades.competencia.codigo)"
      >
        Reintentar
      </BotonAccion>
    </div>

    <form v-else id="formulario-regla-consolidacion" class="contenido-regla" novalidate @submit.prevent="guardarRegla">
      <p class="ayuda">
        Define el puntaje mínimo para alcanzar B, A y AD. El nivel C se asigna a los puntajes inferiores al umbral B.
        Guardar los cambios actualiza los logros de los períodos abiertos.
      </p>

      <div class="campos-umbrales">
        <div class="campo">
          <label for="umbral-b">Puntaje mínimo para B</label>
          <input
            id="umbral-b"
            v-model="umbralB"
            type="number"
            min="1.01"
            max="4"
            step="0.01"
            inputmode="decimal"
            :disabled="guardando"
            aria-describedby="ayuda-umbrales"
            @input="errorValidacion = ''"
          />
        </div>

        <div class="campo">
          <label for="umbral-a">Puntaje mínimo para A</label>
          <input
            id="umbral-a"
            v-model="umbralA"
            type="number"
            min="1.01"
            max="4"
            step="0.01"
            inputmode="decimal"
            :disabled="guardando"
            aria-describedby="ayuda-umbrales"
            @input="errorValidacion = ''"
          />
        </div>

        <div class="campo">
          <label for="umbral-ad">Puntaje mínimo para AD</label>
          <input
            id="umbral-ad"
            v-model="umbralAd"
            type="number"
            min="1.01"
            max="4"
            step="0.01"
            inputmode="decimal"
            :disabled="guardando"
            aria-describedby="ayuda-umbrales"
            @input="errorValidacion = ''"
          />
        </div>
      </div>

      <p id="ayuda-umbrales" class="nota-validacion">Los valores deben estar entre 1 y 4 y en orden creciente.</p>
      <AvisoMensaje v-if="errorValidacion" :mensaje="errorValidacion" tipo="error" />
      <AvisoMensaje v-if="errorGuardado" :mensaje="errorGuardado" tipo="error" />
    </form>

    <template #pie>
      <BotonAccion variante="secundario" :deshabilitado="guardando" @click="emitir('cerrar')"> Cancelar </BotonAccion>
      <BotonAccion
        v-if="!errorCarga"
        tipo="submit"
        form="formulario-regla-consolidacion"
        :deshabilitado="cargando || guardando"
      >
        {{ guardando ? 'Guardando…' : 'Guardar regla' }}
      </BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.contenido-regla {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.estado-cargando {
  padding: 8px 0;
  color: #434655;
  font-size: 14px;
}

.ayuda,
.nota-validacion {
  margin: 0;
  color: #434655;
  font-size: 13px;
  line-height: 1.5;
}

.campos-umbrales {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
}

.campo label {
  color: #191c1e;
  font-size: 13px;
  font-weight: 600;
}

.campo input {
  width: 100%;
  min-height: 42px;
  padding: 9px 10px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font-size: 14px;
}

.campo input:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.campo input:disabled {
  background: #f2f4f6;
}

.nota-validacion {
  margin-top: -10px;
  color: #737686;
  font-size: 12px;
}

@media (max-width: 520px) {
  .campos-umbrales {
    grid-template-columns: 1fr;
  }
}
</style>
