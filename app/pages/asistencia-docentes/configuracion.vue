<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { ConfiguracionMarcajeDocente } from '~/types/asistenciaDocente'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useAsistenciaDocente } from '~/composables/useAsistenciaDocente'

definePageMeta({ middleware: 'autenticacion' })

const { obtenerConfiguracionMarcaje, actualizarConfiguracionMarcaje } = useAsistenciaDocente()
const configuracion = reactive<ConfiguracionMarcajeDocente>({
  toleranciaMinutos: 15,
  ventanaAntesMinutos: 30,
  ventanaDespuesMinutos: 30,
})
const cargando = ref(true)
const configuracionCargada = ref(false)
const guardando = ref(false)
const error = ref('')
const aviso = ref('')

const valoresValidos = computed(() =>
  [configuracion.toleranciaMinutos, configuracion.ventanaAntesMinutos, configuracion.ventanaDespuesMinutos].every(
    (valor) => Number.isInteger(valor) && valor >= 0 && valor <= 240,
  ),
)
const toleranciaDentroDeVentana = computed(() => configuracion.toleranciaMinutos <= configuracion.ventanaDespuesMinutos)

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    Object.assign(configuracion, await obtenerConfiguracionMarcaje())
    configuracionCargada.value = true
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar la configuración del marcaje docente.')
  } finally {
    cargando.value = false
  }
}

async function guardar(): Promise<void> {
  error.value = ''
  aviso.value = ''
  if (!valoresValidos.value) {
    error.value = 'Ingresa valores enteros entre 0 y 240 minutos.'
    return
  }
  if (!toleranciaDentroDeVentana.value) {
    error.value = 'La tolerancia no puede superar la ventana disponible después del inicio de jornada.'
    return
  }

  guardando.value = true
  try {
    Object.assign(configuracion, await actualizarConfiguracionMarcaje({ ...configuracion }))
    aviso.value = 'La configuración de marcaje se actualizó para todos los docentes.'
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo guardar la configuración de marcaje.')
  } finally {
    guardando.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <main class="pagina-marcaje-configuracion">
    <EncabezadoPagina
      titulo="Configuración del marcaje docente"
      descripcion="Define la ventana de entrada y la tolerancia que se aplican a todos los docentes."
    >
      <template #acciones>
        <NuxtLink class="enlace-volver" to="/asistencia-docentes">Volver a asistencia</NuxtLink>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" cerrable @cerrar="aviso = ''" />
    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />

    <p v-if="cargando" class="estado-carga" role="status">Cargando configuración…</p>

    <div v-else-if="!configuracionCargada" class="reintentar-configuracion">
      <p>No se pudo cargar la configuración actual. Vuelve a intentarlo.</p>
      <button type="button" @click="cargar">Reintentar</button>
    </div>

    <form v-else class="tarjeta-configuracion" @submit.prevent="guardar">
      <header class="tarjeta-configuracion__cabecera">
        <div>
          <span class="etiqueta-global">Configuración global</span>
          <h2>Ventana de marcado y tolerancia</h2>
          <p>Los mismos valores rigen para la entrada de cada docente según la primera clase de su jornada.</p>
        </div>
        <span class="aplica-todos">Todos los docentes</span>
      </header>

      <div class="campos-configuracion">
        <label class="campo-configuracion" for="tolerancia-minutos">
          <span>Tolerancia de entrada</span>
          <span class="campo-configuracion__control">
            <input
              id="tolerancia-minutos"
              v-model.number="configuracion.toleranciaMinutos"
              type="number"
              min="0"
              max="240"
              step="1"
              required
              :disabled="guardando"
            />
            <span>minutos</span>
          </span>
          <small>Hasta este tiempo después del inicio de la primera clase, el ingreso se considera puntual.</small>
        </label>

        <label class="campo-configuracion" for="ventana-antes-minutos">
          <span>Habilitar marcado antes de la primera clase</span>
          <span class="campo-configuracion__control">
            <input
              id="ventana-antes-minutos"
              v-model.number="configuracion.ventanaAntesMinutos"
              type="number"
              min="0"
              max="240"
              step="1"
              required
              :disabled="guardando"
            />
            <span>minutos antes</span>
          </span>
          <small>Indica cuánto antes del inicio de jornada se habilita el botón de entrada.</small>
        </label>

        <label class="campo-configuracion" for="ventana-despues-minutos">
          <span>Cerrar marcado después de la primera clase</span>
          <span class="campo-configuracion__control">
            <input
              id="ventana-despues-minutos"
              v-model.number="configuracion.ventanaDespuesMinutos"
              type="number"
              min="0"
              max="240"
              step="1"
              required
              :disabled="guardando"
            />
            <span>minutos después</span>
          </span>
          <small>El docente ya no podrá marcar su entrada cuando cierre este plazo.</small>
        </label>
      </div>

      <p v-if="!valoresValidos" class="error-validacion" role="alert">
        Los valores deben ser números enteros entre 0 y 240 minutos.
      </p>
      <p v-else-if="!toleranciaDentroDeVentana" class="error-validacion" role="alert">
        La tolerancia debe caber dentro de la ventana habilitada después del inicio de jornada.
      </p>

      <footer class="pie-configuracion">
        <p>Configuración inicial: 15 minutos de tolerancia y ventanas de 30 minutos antes y después.</p>
        <button type="submit" :disabled="guardando || !valoresValidos || !toleranciaDentroDeVentana">
          {{ guardando ? 'Guardando…' : 'Guardar configuración' }}
        </button>
      </footer>
    </form>
  </main>
</template>

<style scoped>
.pagina-marcaje-configuracion {
  display: flex;
  width: 100%;
  max-width: 1100px;
  flex-direction: column;
  gap: 20px;
  margin: 0 auto;
  padding: 32px;
}
.enlace-volver {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  padding: 9px 14px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  color: #234486;
  background: white;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.tarjeta-configuracion {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}
.tarjeta-configuracion__cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 24px;
  border-bottom: 1px solid #e5e7eb;
}
.tarjeta-configuracion__cabecera h2 {
  margin: 8px 0 5px;
  color: #191c1e;
  font-size: 20px;
}
.tarjeta-configuracion__cabecera p,
.pie-configuracion p {
  margin: 0;
  color: #434655;
  font-size: 13px;
  line-height: 1.55;
}
.etiqueta-global,
.aplica-todos {
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border-radius: 999px;
  color: #234486;
  background: #eef3ff;
  font-size: 12px;
  font-weight: 700;
}
.aplica-todos {
  flex: none;
  color: #166534;
  background: #ecfdf3;
}
.campos-configuracion {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  padding: 24px;
}
.campo-configuracion {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}
.campo-configuracion__control {
  display: flex;
  align-items: center;
  gap: 10px;
}
.campo-configuracion input {
  width: 120px;
  min-height: 44px;
  padding: 9px 11px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  color: #191c1e;
  background: white;
  font: inherit;
  font-size: 16px;
}
.campo-configuracion__control > span {
  color: #434655;
  font-size: 13px;
  font-weight: 400;
}
.campo-configuracion small {
  max-width: 440px;
  color: #64748b;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
}
.error-validacion {
  margin: 0 24px 16px;
  color: #b91c1c;
  font-size: 13px;
}
.pie-configuracion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px;
  border-top: 1px solid #e5e7eb;
  background: #fafbfc;
}
.pie-configuracion button {
  min-height: 42px;
  padding: 9px 16px;
  border: 1px solid #234486;
  border-radius: 8px;
  color: white;
  background: #234486;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.pie-configuracion button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.estado-carga {
  color: #434655;
}
.reintentar-configuracion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}
.reintentar-configuracion p {
  margin: 0;
  color: #434655;
}
.reintentar-configuracion button {
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid #234486;
  border-radius: 8px;
  color: white;
  background: #234486;
  cursor: pointer;
}
@media (max-width: 700px) {
  .pagina-marcaje-configuracion {
    padding: 20px 14px;
  }
  .campos-configuracion {
    grid-template-columns: 1fr;
    padding: 18px;
  }
  .tarjeta-configuracion__cabecera,
  .pie-configuracion {
    flex-direction: column;
    align-items: stretch;
    padding: 18px;
  }
  .aplica-todos {
    align-self: flex-start;
  }
}
</style>
