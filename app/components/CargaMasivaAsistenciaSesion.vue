<script setup lang="ts">
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { guardarArchivo } from '~/composables/useReporteAsistencia'
import { useCargaMasivaAsistenciaSesion } from '~/composables/useCargaMasivaAsistenciaSesion'

const propiedades = defineProps<{ sesionId: number }>()
const emitir = defineEmits<{
  actualizada: [resumen: { nuevos: number; actualizados: number }]
}>()

const { descargarPlantilla, cargar } = useCargaMasivaAsistenciaSesion()
const entradaArchivo = ref<HTMLInputElement | null>(null)
const archivo = ref<File | null>(null)
const resultado = ref<Awaited<ReturnType<typeof cargar>> | null>(null)
const error = ref('')
const descargando = ref(false)
const validando = ref(false)
const guardando = ref(false)

function seleccionarArchivo(evento: Event): void {
  archivo.value = (evento.target as HTMLInputElement).files?.[0] ?? null
  resultado.value = null
  error.value = ''
}

async function bajarPlantilla(formato: 'csv' | 'xlsx'): Promise<void> {
  descargando.value = true
  error.value = ''
  try {
    const archivo = await descargarPlantilla(propiedades.sesionId, formato)
    guardarArchivo(archivo, `plantilla-asistencia-sesion-${propiedades.sesionId}.${formato}`)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo descargar la plantilla de esta sesión.')
  } finally {
    descargando.value = false
  }
}

async function validar(): Promise<void> {
  if (!archivo.value) return
  validando.value = true
  resultado.value = null
  error.value = ''
  try {
    resultado.value = await cargar(propiedades.sesionId, archivo.value, true)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo validar el archivo CSV.')
  } finally {
    validando.value = false
  }
}

async function guardarLote(): Promise<void> {
  if (!archivo.value || !resultado.value || resultado.value.errores.length) return
  guardando.value = true
  error.value = ''
  try {
    const guardado = await cargar(propiedades.sesionId, archivo.value, false)
    resultado.value = guardado
    if (!guardado.guardado) return
    archivo.value = null
    if (entradaArchivo.value) entradaArchivo.value.value = ''
    emitir('actualizada', { nuevos: guardado.registrosNuevos, actualizados: guardado.registrosActualizados })
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo guardar el lote de asistencia.')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <details class="carga-csv">
    <summary>Cargar asistencia desde CSV</summary>
    <div class="contenido">
      <p>
        Descarga la plantilla de esta sesión en CSV o Excel, completa el estado de cada alumno y valida antes de
        guardar. Se aceptan PRESENTE, TARDANZA y AUSENTE; máximo 500 filas.
      </p>
      <div class="acciones">
        <button
          type="button"
          class="boton secundario"
          :disabled="descargando || validando || guardando"
          @click="bajarPlantilla('csv')"
        >
          {{ descargando ? 'Descargando…' : 'Plantilla CSV' }}
        </button>
        <button
          type="button"
          class="boton secundario"
          :disabled="descargando || validando || guardando"
          @click="bajarPlantilla('xlsx')"
        >
          {{ descargando ? 'Descargando…' : 'Plantilla Excel' }}
        </button>
      </div>

      <label for="archivo-csv-asistencia">Archivo CSV o Excel</label>
      <input
        id="archivo-csv-asistencia"
        ref="entradaArchivo"
        type="file"
        accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        :disabled="validando || guardando"
        @change="seleccionarArchivo"
      />
      <small v-if="archivo">Seleccionado: {{ archivo.name }}</small>

      <div class="acciones">
        <button type="button" class="boton" :disabled="!archivo || validando || guardando" @click="validar">
          {{ validando ? 'Validando…' : 'Validar archivo' }}
        </button>
        <button
          v-if="resultado && !resultado.errores.length && !resultado.guardado"
          type="button"
          class="boton confirmar"
          :disabled="guardando || validando"
          @click="guardarLote"
        >
          {{ guardando ? 'Guardando…' : 'Guardar lote validado' }}
        </button>
      </div>

      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />

      <section v-if="resultado" class="resultado" role="status" aria-live="polite">
        <p>
          <strong>{{ resultado.guardado ? 'Carga guardada.' : 'Resultado de validación.' }}</strong>
          {{ resultado.filasValidas }} de {{ resultado.totalFilas }} filas válidas;
          {{ resultado.filasRechazadas }} rechazadas.
          <template v-if="resultado.guardado">
            {{ resultado.registrosNuevos }} registros nuevos y {{ resultado.registrosActualizados }} actualizados.
          </template>
        </p>
        <div v-if="resultado.errores.length" class="tabla-errores">
          <table>
            <thead>
              <tr>
                <th scope="col">Fila</th>
                <th scope="col">Campo</th>
                <th scope="col">Error</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(fila, indice) in resultado.errores" :key="`${fila.fila}-${indice}`">
                <td>{{ fila.fila }}</td>
                <td>{{ fila.campo }}</td>
                <td>{{ fila.mensaje }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else-if="!resultado.guardado">Validación aprobada. Guarda el lote para aplicar los cambios.</p>
      </section>
    </div>
  </details>
</template>

<style scoped>
.carga-csv {
  border: 1px solid #c3c6d7;
  border-radius: 10px;
  background: white;
}

summary {
  padding: 14px 16px;
  color: #234486;
  font-weight: 700;
  cursor: pointer;
}

.contenido {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 0 16px 16px;
}

p,
small {
  margin: 0;
  color: #434655;
  font-size: 13px;
  line-height: 1.5;
}

label {
  font-size: 14px;
  font-weight: 600;
}

input[type='file'] {
  max-width: 100%;
  padding: 8px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.boton {
  min-height: 40px;
  padding: 8px 13px;
  border: 1px solid #234486;
  border-radius: 8px;
  color: white;
  background: #234486;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.boton.secundario {
  color: #234486;
  background: white;
}

.boton.confirmar {
  border-color: #167545;
  background: #167545;
}

.boton:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.resultado {
  display: grid;
  width: 100%;
  gap: 10px;
  padding: 12px;
  border: 1px solid #d9dee8;
  border-radius: 8px;
  background: #f9fafb;
}

.tabla-errores {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
}

table {
  width: 100%;
  min-width: 480px;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 9px 11px;
  border-bottom: 1px solid #eef0f2;
  text-align: left;
}
</style>
