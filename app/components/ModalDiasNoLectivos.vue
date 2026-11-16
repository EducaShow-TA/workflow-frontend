<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { MAXIMO_DESCRIPCION_DIA, useDiasNoLectivos, validarDiaNoLectivo } from '~/composables/useDiasNoLectivos'
import type { ErroresDiaNoLectivo } from '~/composables/useDiasNoLectivos'
import { formatearFecha, obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import type { DiaNoLectivo, SolicitudDiaNoLectivo } from '~/types/sesionClase'

const propiedades = defineProps<{
  abierta: boolean
  anhio: number
}>()

const emitir = defineEmits<{
  cerrar: []
}>()

const { listar, crear, eliminar } = useDiasNoLectivos()

const fechaHoy = obtenerFechaHoyIso()
const dias = ref<DiaNoLectivo[]>([])
const formulario = reactive<SolicitudDiaNoLectivo>({ fecha: '', descripcion: '' })
const errores = ref<ErroresDiaNoLectivo>({})
const cargando = ref(false)
const guardando = ref(false)
const eliminandoId = ref<number | null>(null)
const error = ref('')
const aviso = ref('')

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''

  try {
    dias.value = await listar(`${propiedades.anhio}-01-01`, `${propiedades.anhio}-12-31`)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar los días no lectivos.')
  } finally {
    cargando.value = false
  }
}

async function agregar(): Promise<void> {
  aviso.value = ''
  error.value = ''
  errores.value = validarDiaNoLectivo(formulario, dias.value, fechaHoy)
  if (!errores.value.fecha && !formulario.fecha.startsWith(String(propiedades.anhio))) {
    errores.value.fecha = `Elige una fecha de ${propiedades.anhio}.`
  }
  if (Object.keys(errores.value).length) return

  guardando.value = true
  try {
    const dia = await crear(formulario)
    dias.value = [...dias.value, dia].sort((primero, segundo) => primero.fecha.localeCompare(segundo.fecha))
    aviso.value = `Se agregó el ${formatearFecha(dia.fecha)}. Si ese día ya tenía clases generadas, quedaron canceladas.`
    formulario.fecha = ''
    formulario.descripcion = ''
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo agregar el día no lectivo.')
  } finally {
    guardando.value = false
  }
}

async function quitar(dia: DiaNoLectivo): Promise<void> {
  aviso.value = ''
  error.value = ''
  eliminandoId.value = dia.id

  try {
    await eliminar(dia.id)
    dias.value = dias.value.filter((item) => item.id !== dia.id)
    aviso.value =
      dia.fecha >= fechaHoy
        ? `Se quitó el ${formatearFecha(dia.fecha)}. Las clases que se habían cancelado por ese día vuelven a estar activas.`
        : `Se quitó el ${formatearFecha(dia.fecha)}.`
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo quitar el día no lectivo.')
  } finally {
    eliminandoId.value = null
  }
}

function limpiarError(campo: keyof SolicitudDiaNoLectivo): void {
  errores.value = { ...errores.value, [campo]: undefined }
}

watch(
  () => propiedades.abierta,
  (abierta) => {
    if (!abierta) return
    formulario.fecha = ''
    formulario.descripcion = ''
    errores.value = {}
    aviso.value = ''
    void cargar()
  },
  { immediate: true },
)
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    :titulo="`Días no lectivos ${anhio}`"
    descripcion="Feriados y días sin clases de todo el colegio. Al generar sesiones de clase, estos días se saltan."
    :bloqueada="guardando || eliminandoId !== null"
    @cerrar="emitir('cerrar')"
  >
    <div class="contenido">
      <form class="formulario" novalidate @submit.prevent="agregar">
        <div class="campo">
          <label for="dia-fecha">Fecha</label>
          <input
            id="dia-fecha"
            v-model="formulario.fecha"
            type="date"
            :min="fechaHoy > `${anhio}-01-01` ? fechaHoy : `${anhio}-01-01`"
            :max="`${anhio}-12-31`"
            :aria-invalid="Boolean(errores.fecha)"
            @input="limpiarError('fecha')"
          />
          <small v-if="errores.fecha" class="error">{{ errores.fecha }}</small>
        </div>
        <div class="campo ancho">
          <label for="dia-descripcion">Motivo</label>
          <input
            id="dia-descripcion"
            v-model="formulario.descripcion"
            type="text"
            :maxlength="MAXIMO_DESCRIPCION_DIA"
            placeholder="Ej.: Inmaculada Concepción"
            :aria-invalid="Boolean(errores.descripcion)"
            @input="limpiarError('descripcion')"
          />
          <small v-if="errores.descripcion" class="error">{{ errores.descripcion }}</small>
        </div>
        <BotonAccion tipo="submit" :deshabilitado="guardando">{{ guardando ? 'Agregando…' : 'Agregar' }}</BotonAccion>
      </form>
      <p class="ayuda">
        No se aceptan fechas pasadas: corregir el calendario hacia atrás requiere una corrección auditada.
      </p>

      <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" />
      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />

      <p v-if="cargando" class="ayuda" role="status">Cargando días no lectivos…</p>
      <p v-else-if="!dias.length" class="vacio">Aún no hay días no lectivos registrados en {{ anhio }}.</p>
      <ul v-else class="lista">
        <li v-for="dia in dias" :key="dia.id">
          <span class="fecha">{{ formatearFecha(dia.fecha) }}</span>
          <span class="motivo">
            {{ dia.descripcion }}
            <small v-if="dia.fecha < fechaHoy" class="pasado">· ya pasó</small>
          </span>
          <button type="button" class="boton-quitar" :disabled="eliminandoId !== null" @click="quitar(dia)">
            {{ eliminandoId === dia.id ? 'Quitando…' : 'Quitar' }}
          </button>
        </li>
      </ul>
    </div>

    <template #pie>
      <BotonAccion variante="secundario" :deshabilitado="guardando || eliminandoId !== null" @click="emitir('cerrar')">
        Cerrar
      </BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.contenido {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.formulario {
  display: grid;
  grid-template-columns: minmax(0, 170px) minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
}

.formulario > :deep(.boton-accion) {
  margin-top: 26px;
}

.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.campo label {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.campo input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 14px;
}

.campo [aria-invalid='true'] {
  border-color: #dc2626;
}

.error {
  color: #dc2626;
  font-size: 12px;
}

.ayuda {
  margin: 0;
  color: #434655;
  font-size: 12px;
}

.vacio {
  margin: 0;
  color: #434655;
  font-size: 14px;
}

.lista {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  list-style: none;
}

.lista li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  font-size: 14px;
}

.lista li + li {
  border-top: 1px solid #e5e7eb;
}

.fecha {
  flex: none;
  width: 92px;
  font-weight: 600;
}

.motivo {
  flex: 1;
  min-width: 0;
}

.pasado {
  color: #434655;
}

.boton-quitar {
  min-height: 36px;
  padding: 6px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.boton-quitar:hover:not(:disabled) {
  border-color: #dc2626;
  color: #dc2626;
}

.boton-quitar:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .formulario {
    grid-template-columns: minmax(0, 1fr);
  }

  .formulario > :deep(.boton-accion) {
    margin-top: 0;
  }

  .fecha {
    width: auto;
  }
}
</style>
