<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EnviarCargaAsistencia, ResultadoCargaAsistencia } from '~/types/cargaMasivaAsistencia'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { descargarArchivo } from '~/composables/useCargaMasiva'
import { resumirResultadoCarga, validarArchivoCsv } from '~/composables/useCargaMasivaAsistencia'

const propiedades = defineProps<{
  abierta: boolean
  titulo: string
  descripcion: string
  /** Columnas que debe traer el archivo, en texto para mostrar al usuario. */
  columnas: string
  enviar: EnviarCargaAsistencia
  obtenerPlantilla: () => Promise<string>
  nombrePlantilla: string
}>()

const emitir = defineEmits<{
  cerrar: []
  guardado: [resultado: ResultadoCargaAsistencia]
}>()

const archivo = ref<File | null>(null)
const resultado = ref<ResultadoCargaAsistencia | null>(null)
const procesando = ref(false)
const error = ref('')

// Solo se guarda lo que se validó sin errores: si cambia el archivo, hay que validar de nuevo.
const puedeGuardar = computed(
  () => !!archivo.value && !!resultado.value && resultado.value.soloValidacion && resultado.value.errores.length === 0,
)

function reiniciar(): void {
  archivo.value = null
  resultado.value = null
  error.value = ''
}

watch(
  () => propiedades.abierta,
  (abierta) => {
    if (!abierta) reiniciar()
  },
)

function elegirArchivo(evento: Event): void {
  const elegido = (evento.target as HTMLInputElement).files?.[0] ?? null
  resultado.value = null
  archivo.value = null
  error.value = elegido ? validarArchivoCsv(elegido) : ''
  if (elegido && !error.value) archivo.value = elegido
}

async function procesar(soloValidar: boolean): Promise<void> {
  if (!archivo.value || procesando.value) return
  procesando.value = true
  error.value = ''

  try {
    const respuesta = await propiedades.enviar(archivo.value, soloValidar)
    if (respuesta.guardado) {
      emitir('guardado', respuesta)
      return
    }
    resultado.value = respuesta
  } catch (fallo: unknown) {
    resultado.value = null
    error.value = obtenerMensajeError(fallo, 'No se pudo procesar el archivo.')
  } finally {
    procesando.value = false
  }
}

async function descargarPlantilla(): Promise<void> {
  error.value = ''
  try {
    descargarArchivo(propiedades.nombrePlantilla, await propiedades.obtenerPlantilla())
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo descargar la plantilla.')
  }
}
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    :titulo="titulo"
    :descripcion="descripcion"
    :bloqueada="procesando"
    ancho="amplia"
    @cerrar="emitir('cerrar')"
  >
    <div class="carga">
      <p class="columnas">
        {{ columnas }}
        <button type="button" class="enlace" :disabled="procesando" @click="descargarPlantilla">
          Descargar plantilla
        </button>
      </p>

      <div class="campo">
        <label for="archivo-carga-asistencia">Archivo CSV</label>
        <input
          id="archivo-carga-asistencia"
          type="file"
          accept=".csv,text/csv"
          :disabled="procesando"
          @change="elegirArchivo"
        />
      </div>

      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />

      <template v-if="resultado">
        <AvisoMensaje
          :mensaje="resumirResultadoCarga(resultado)"
          :tipo="resultado.errores.length ? 'error' : 'exito'"
        />

        <div v-if="resultado.errores.length" class="contenedor-tabla">
          <table>
            <caption class="solo-lectores">
              Errores de validación por fila
            </caption>
            <thead>
              <tr>
                <th scope="col">Fila</th>
                <th scope="col">Campo</th>
                <th scope="col">Detalle</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(problema, indice) in resultado.errores" :key="`${problema.fila}-${problema.campo}-${indice}`">
                <td>{{ problema.fila }}</td>
                <td>{{ problema.campo }}</td>
                <td>{{ problema.mensaje }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <template #pie>
      <BotonAccion variante="secundario" :deshabilitado="procesando" @click="emitir('cerrar')">Cancelar</BotonAccion>
      <BotonAccion variante="secundario" :deshabilitado="!archivo || procesando" @click="procesar(true)">
        {{ procesando && !puedeGuardar ? 'Validando...' : 'Validar archivo' }}
      </BotonAccion>
      <BotonAccion :deshabilitado="!puedeGuardar || procesando" @click="procesar(false)">
        {{ procesando && puedeGuardar ? 'Guardando...' : 'Guardar asistencia' }}
      </BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.carga {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.columnas {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.enlace {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
}

.enlace:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.campo label {
  font-size: 14px;
  font-weight: 600;
}

.contenedor-tabla {
  max-height: 260px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th,
td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}

th {
  position: sticky;
  top: 0;
  background: var(--color-background);
}

.solo-lectores {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip: rect(0 0 0 0);
}
</style>
