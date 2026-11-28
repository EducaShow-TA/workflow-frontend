<script setup lang="ts">
import { obtenerFechaHoyIso } from '~/composables/useFechas'
import { computed, ref, watch } from 'vue'
import type { AreaOpcion, DocenteOpcion } from '~/types/sesionClase'
import type {
  Aula,
  DisponibilidadDocenteHorario,
  DiaSemana,
  SesionHorario,
  SolicitudSesionHorario,
  ValidacionSesion,
} from '~/types/horarioSeccion'
import { etiquetaConflicto, nombreDia, useHorarioSeccion } from '~/composables/useHorarioSeccion'
import { obtenerMensajeError } from '~/composables/useMensajesError'

const propiedades = defineProps<{
  abierta: boolean
  horarioId: number
  bloqueId: number
  dia: DiaSemana
  franja: string
  sesion: SesionHorario | null
  areas: AreaOpcion[]
  docentes: DocenteOpcion[]
  aulas: Aula[]
  alumnos: number
  anio: number
}>()

const emitir = defineEmits<{
  cerrar: []
  guardada: [mensaje: string, sesionQuitadaId?: number]
}>()

const api = useHorarioSeccion()

const areaCodigo = ref('')
const docenteId = ref<number | ''>('')
const aulaId = ref<number | ''>('')
const tipoVigencia = ref<'PERMANENTE' | 'TEMPORAL'>('PERMANENTE')
const vigenteDesde = ref('')
const vigenteHasta = ref('')
const validacion = ref<ValidacionSesion | null>(null)
const validando = ref(false)
const guardando = ref(false)
const confirmarEliminar = ref(false)
const error = ref('')
const disponibilidad = ref<DisponibilidadDocenteHorario[]>([])
const cargandoDisponibilidad = ref(false)
let consulta = 0

const solicitud = computed<SolicitudSesionHorario | null>(() =>
  areaCodigo.value &&
  docenteId.value &&
  aulaId.value &&
  (tipoVigencia.value === 'PERMANENTE' ||
    Boolean(vigenteDesde.value && vigenteHasta.value && vigenteDesde.value <= vigenteHasta.value))
    ? {
        bloqueId: propiedades.bloqueId,
        dia: propiedades.dia,
        areaCodigo: areaCodigo.value,
        docenteId: docenteId.value,
        aulaId: aulaId.value,
        tipoVigencia: tipoVigencia.value,
        vigenteDesde: tipoVigencia.value === 'TEMPORAL' ? vigenteDesde.value : null,
        vigenteHasta: tipoVigencia.value === 'TEMPORAL' ? vigenteHasta.value : null,
      }
    : null,
)
const aulasActivas = computed(() => propiedades.aulas.filter((aula) => aula.activo))
const sinCambios = computed(
  () =>
    propiedades.sesion !== null &&
    propiedades.sesion.areaCodigo === areaCodigo.value &&
    propiedades.sesion.docenteId === docenteId.value &&
    propiedades.sesion.aulaId === aulaId.value,
)
const puedeGuardar = computed(
  () =>
    Boolean(solicitud.value) &&
    validacion.value?.valida === true &&
    !validando.value &&
    !sinCambios.value &&
    (tipoVigencia.value === 'PERMANENTE' ||
      Boolean(vigenteDesde.value && vigenteHasta.value && vigenteDesde.value <= vigenteHasta.value)),
)

watch(
  () => propiedades.abierta,
  (abierta) => {
    if (!abierta) return
    areaCodigo.value = propiedades.sesion?.areaCodigo ?? ''
    docenteId.value = propiedades.sesion?.docenteId ?? ''
    aulaId.value = propiedades.sesion?.aulaId ?? ''
    tipoVigencia.value = 'PERMANENTE'
    vigenteDesde.value = ''
    vigenteHasta.value = ''
    validacion.value = null
    confirmarEliminar.value = false
    error.value = ''
  },
)

watch(solicitud, async (actual) => {
  validacion.value = null
  error.value = ''
  if (!actual || !propiedades.abierta) return
  const numero = ++consulta
  validando.value = true
  try {
    const resultado = await api.validar(propiedades.horarioId, actual, propiedades.sesion?.id)
    if (numero === consulta) validacion.value = resultado
  } catch (fallo: unknown) {
    if (numero === consulta) error.value = obtenerMensajeError(fallo, 'No se pudo validar la asignación.')
  } finally {
    if (numero === consulta) validando.value = false
  }
})

watch(docenteId, async (id) => {
  disponibilidad.value = []
  if (!id) return
  cargandoDisponibilidad.value = true
  try {
    disponibilidad.value = await api.listarDisponibilidadDocente(Number(id), propiedades.anio)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo consultar la disponibilidad del docente.')
  } finally {
    cargandoDisponibilidad.value = false
  }
})

function textoAula(aula: Aula): string {
  const insuficiente = propiedades.alumnos > aula.capacidad ? ' · aforo insuficiente' : ''
  return `${aula.codigo} · ${aula.capacidad} personas${insuficiente}`
}

async function guardar(): Promise<void> {
  if (!solicitud.value || !puedeGuardar.value) return
  guardando.value = true
  error.value = ''
  try {
    if (propiedades.sesion) {
      const actualizada = await api.actualizar(propiedades.horarioId, propiedades.sesion.id, solicitud.value)
      const desdeManana = tipoVigencia.value === 'PERMANENTE' && (actualizada.vigenteDesde ?? '') > obtenerFechaHoyIso()
      emitir(
        'guardada',
        `Se actualizó la clase del ${nombreDia(propiedades.dia)} ${propiedades.franja}.` +
          (desdeManana ? ' La clase de hoy ya empezó: el cambio rige desde mañana.' : ''),
      )
    } else {
      await api.agregar(propiedades.horarioId, solicitud.value)
      emitir('guardada', `Se asignó la clase del ${nombreDia(propiedades.dia)} ${propiedades.franja}.`)
    }
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo guardar la asignación.')
  } finally {
    guardando.value = false
  }
}

async function eliminar(): Promise<void> {
  if (!propiedades.sesion) return
  guardando.value = true
  error.value = ''
  try {
    await api.eliminar(propiedades.horarioId, propiedades.sesion.id)
    emitir(
      'guardada',
      `Se quitó la clase del ${nombreDia(propiedades.dia)} ${propiedades.franja}.`,
      propiedades.sesion.id,
    )
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo quitar la clase.')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    :titulo="sesion ? 'Editar clase' : 'Asignar clase'"
    :descripcion="`${nombreDia(dia)} · ${franja}`"
    :bloqueada="guardando"
    @cerrar="emitir('cerrar')"
  >
    <form id="formulario-sesion-horario" class="formulario" novalidate @submit.prevent="guardar">
      <div class="campo">
        <label for="sesion-area">Curso <span class="obligatorio">*</span></label>
        <select id="sesion-area" v-model="areaCodigo" :disabled="guardando">
          <option value="">Selecciona un curso</option>
          <option v-for="area in areas" :key="area.codigo" :value="area.codigo">{{ area.nombre }}</option>
        </select>
      </div>
      <div class="campo">
        <label for="sesion-docente">Docente <span class="obligatorio">*</span></label>
        <select id="sesion-docente" v-model.number="docenteId" :disabled="guardando">
          <option value="">Selecciona un docente</option>
          <option v-for="docente in docentes" :key="docente.id" :value="docente.id">
            {{ docente.nombreCompleto }}
          </option>
        </select>
        <small v-if="cargandoDisponibilidad" class="ayuda">Consultando disponibilidad…</small>
        <div v-else-if="disponibilidad.length" class="disponibilidad-docente" role="note">
          <strong>Horas ya asignadas en {{ anio }}:</strong>
          <ul>
            <li v-for="(ocupada, indice) in disponibilidad" :key="indice">
              {{ nombreDia(ocupada.dia) }} {{ ocupada.horaInicio }}–{{ ocupada.horaFin }} · {{ ocupada.seccion }} ·
              {{ ocupada.area }}
            </li>
          </ul>
        </div>
        <small v-else-if="docenteId" class="ayuda">Sin clases asignadas en el año.</small>
      </div>
      <div class="campo">
        <label for="sesion-aula">Aula <span class="obligatorio">*</span></label>
        <select id="sesion-aula" v-model.number="aulaId" :disabled="guardando">
          <option value="">Selecciona un aula</option>
          <option v-for="aula in aulasActivas" :key="aula.id" :value="aula.id">{{ textoAula(aula) }}</option>
        </select>
        <small class="ayuda">La sección tiene {{ alumnos }} alumnos matriculados.</small>
      </div>

      <div v-if="sesion" class="campo">
        <label for="sesion-vigencia">Vigencia del cambio</label>
        <select id="sesion-vigencia" v-model="tipoVigencia" :disabled="guardando">
          <option value="PERMANENTE">Permanente desde hoy</option>
          <option value="TEMPORAL">Temporal por rango de fechas</option>
        </select>
        <small v-if="tipoVigencia === 'PERMANENTE'" class="ayuda"
          >Si la clase de hoy ya empezó, el cambio rige desde mañana.</small
        >
      </div>
      <div v-if="sesion && tipoVigencia === 'TEMPORAL'" class="fechas-vigencia">
        <label class="campo" for="vigente-desde"
          >Desde<input id="vigente-desde" v-model="vigenteDesde" type="date" :disabled="guardando"
        /></label>
        <label class="campo" for="vigente-hasta"
          >Hasta<input id="vigente-hasta" v-model="vigenteHasta" type="date" :min="vigenteDesde" :disabled="guardando"
        /></label>
        <small class="ayuda">Al terminar el rango se restaura la asignación original.</small>
      </div>

      <div class="validacion" role="status" aria-live="polite">
        <p v-if="!solicitud" class="neutro">Completa curso, docente y aula para revisar cruces y aforo.</p>
        <p v-else-if="validando" class="neutro">Revisando cruces de horario y aforo…</p>
        <p v-else-if="sinCambios" class="neutro">Sin cambios respecto a la clase actual.</p>
        <p v-else-if="validacion?.valida" class="ok">
          Sin conflictos: el docente y el aula están libres y el aforo alcanza.
        </p>
        <ul v-else-if="validacion" class="conflictos">
          <li v-for="(conflicto, indice) in validacion.conflictos" :key="indice">
            <strong>{{ etiquetaConflicto(conflicto.tipo) }}</strong>
            <span>{{ conflicto.mensaje }}</span>
          </li>
        </ul>
      </div>

      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />

      <div v-if="confirmarEliminar" class="confirmar" role="alert">
        <span>¿Quitar esta clase del horario?</span>
        <BotonAccion variante="secundario" :deshabilitado="guardando" @click="confirmarEliminar = false"
          >No</BotonAccion
        >
        <BotonAccion :deshabilitado="guardando" @click="eliminar">Sí, quitar</BotonAccion>
      </div>
    </form>

    <template #pie>
      <BotonAccion
        v-if="sesion && !confirmarEliminar"
        variante="secundario"
        :deshabilitado="guardando"
        class="quitar"
        @click="confirmarEliminar = true"
      >
        Quitar clase
      </BotonAccion>
      <BotonAccion variante="secundario" :deshabilitado="guardando" @click="emitir('cerrar')">Cancelar</BotonAccion>
      <BotonAccion tipo="submit" form="formulario-sesion-horario" :deshabilitado="guardando || !puedeGuardar">
        {{ guardando ? 'Guardando...' : sesion ? 'Guardar cambios' : 'Asignar' }}
      </BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.disponibilidad-docente {
  padding: 8px 10px;
  border-radius: 8px;
  background: #f1f5f9;
  color: #334155;
  font-size: 12px;
}
.disponibilidad-docente ul {
  margin: 4px 0 0;
  padding-left: 18px;
}
.formulario {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.campo select {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  font: inherit;
  font-size: 14px;
}

.obligatorio {
  color: #dc2626;
}

.ayuda {
  color: #434655;
  font-size: 12px;
}

.validacion p {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.neutro {
  background: #f7f9fb;
  color: #434655;
}

.ok {
  border: 1px solid #a7f3d0;
  background: #ecfdf5;
  color: #065f46;
}

.conflictos {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.conflictos li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-left: 4px solid #b91c1c;
  border-radius: 8px;
  background: #fef2f2;
  color: #7f1d1d;
  font-size: 13px;
}

.confirmar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff7ed;
  color: #7c2d12;
  font-size: 13px;
  font-weight: 600;
}

.confirmar span {
  flex: 1 1 auto;
}

.quitar {
  margin-right: auto;
}
</style>
