<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type {
  ErroresPlantilla,
  FormularioPlantilla,
  PlantillaHorario,
  SolicitudPlantillaHorario,
} from '~/types/plantillaHorario'
import {
  CANTIDAD_MAXIMA_BLOQUES,
  CANTIDAD_MAXIMA_RECREOS,
  DURACION_MAXIMA_MINUTOS,
  DURACION_RECREO_POR_DEFECTO,
  LONGITUD_MAXIMA_NOMBRE_PLANTILLA,
  TURNOS,
  calcularBloques,
  construirSolicitudPlantilla,
  formatearMinutos,
  obtenerNombreTurno,
  resumirBloques,
  validarPlantilla,
} from '~/composables/usePlantillasHorario'

const propiedades = withDefaults(
  defineProps<{
    formularioInicial: FormularioPlantilla
    existentes?: PlantillaHorario[]
    idEnEdicion?: number | null
    guardando?: boolean
    /** Error del backend para mostrar en un campo, por ejemplo un nombre repetido (409). */
    erroresServidor?: ErroresPlantilla
  }>(),
  {
    existentes: () => [],
    idEnEdicion: null,
    guardando: false,
    erroresServidor: () => ({}),
  },
)

const emitir = defineEmits<{
  guardar: [solicitud: SolicitudPlantillaHorario]
}>()

const formulario = reactive<FormularioPlantilla>({
  ...propiedades.formularioInicial,
  recreos: propiedades.formularioInicial.recreos.map((recreo) => ({ ...recreo })),
})
const errores = reactive<ErroresPlantilla>({})

watch(
  () => propiedades.erroresServidor,
  (nuevos) => Object.assign(errores, nuevos),
)

const erroresEnVivo = computed(() => validarPlantilla(formulario, propiedades.existentes, propiedades.idEnEdicion))
const resumen = computed(() => resumirBloques(calcularBloques(formulario), formulario.horaInicio, formulario.horaFin))
const horasDisponibles = computed(() =>
  Array.from(
    { length: Math.min(formulario.cantidadBloquesPedagogicos ?? 1, CANTIDAD_MAXIMA_BLOQUES) },
    (_, i) => i + 1,
  ),
)
const detalleResumen = computed(() => {
  const recreos = resumen.value.cantidadRecreos === 1 ? '1 recreo' : `${resumen.value.cantidadRecreos} recreos`
  const sinUsar = resumen.value.minutosSinUsar > 0 ? ` · ${resumen.value.minutosSinUsar} min sin usar` : ''
  return `${formulario.cantidadBloquesPedagogicos} horas de ${formulario.duracionHoraPedagogicaMinutos} min y ${recreos}${sinUsar}.`
})
const errorVistaPrevia = computed(
  () =>
    erroresEnVivo.value.jornada ??
    erroresEnVivo.value.turno ??
    erroresEnVivo.value.horaFin ??
    erroresEnVivo.value.recreos ??
    '',
)

function limpiarError(campo: keyof ErroresPlantilla): void {
  errores[campo] = undefined
}

function cambiarNumero(campo: 'duracionHoraPedagogicaMinutos' | 'cantidadBloquesPedagogicos', evento: Event): void {
  const valor = (evento.target as HTMLInputElement).value
  formulario[campo] = valor === '' ? null : Number(valor)
  limpiarError(campo === 'duracionHoraPedagogicaMinutos' ? 'duracion' : 'cantidad')
}

function agregarRecreo(): void {
  const libre = horasDisponibles.value.find(
    (hora) => !formulario.recreos.some((recreo) => recreo.despuesDeBloque === hora),
  )
  formulario.recreos.push({ despuesDeBloque: libre ?? 1, duracionMinutos: DURACION_RECREO_POR_DEFECTO })
  limpiarError('recreos')
}

function quitarRecreo(indice: number): void {
  formulario.recreos.splice(indice, 1)
  limpiarError('recreos')
}

function guardar(): void {
  const encontrados = erroresEnVivo.value
  for (const clave of Object.keys(errores) as (keyof ErroresPlantilla)[]) {
    errores[clave] = undefined
  }
  Object.assign(errores, encontrados)

  if (Object.values(encontrados).some(Boolean)) {
    return
  }

  emitir('guardar', construirSolicitudPlantilla(formulario))
}
</script>

<template>
  <form id="formulario-plantilla" class="cuadricula" novalidate @submit.prevent="guardar">
    <section class="tarjeta" aria-labelledby="titulo-datos">
      <h2 id="titulo-datos">Datos de la plantilla</h2>

      <div class="campos">
        <div class="campo ancho-completo">
          <label for="nombre-plantilla">Nombre <span class="obligatorio">*</span></label>
          <input
            id="nombre-plantilla"
            v-model="formulario.nombre"
            type="text"
            :maxlength="LONGITUD_MAXIMA_NOMBRE_PLANTILLA"
            placeholder="Ej. Jornada regular mañana"
            autocomplete="off"
            :aria-invalid="Boolean(errores.nombre)"
            :aria-describedby="errores.nombre ? 'error-nombre-plantilla' : 'ayuda-nombre-plantilla'"
            @input="limpiarError('nombre')"
          />
          <small v-if="errores.nombre" id="error-nombre-plantilla" class="error">{{ errores.nombre }}</small>
          <small v-else id="ayuda-nombre-plantilla" class="ayuda">No se puede repetir dentro del mismo turno.</small>
        </div>

        <fieldset class="campo ancho-completo">
          <legend>Turno <span class="obligatorio">*</span></legend>
          <div class="selector-turno" role="radiogroup" aria-label="Turno">
            <button
              v-for="turno in TURNOS"
              :key="turno"
              type="button"
              role="radio"
              :aria-checked="formulario.turno === turno"
              :class="{ seleccionado: formulario.turno === turno }"
              @click="((formulario.turno = turno), limpiarError('turno'), limpiarError('nombre'))"
            >
              {{ obtenerNombreTurno(turno) }}
            </button>
          </div>
          <small v-if="errores.turno" class="error">{{ errores.turno }}</small>
        </fieldset>

        <div class="campo">
          <label for="hora-inicio">Hora de inicio <span class="obligatorio">*</span></label>
          <input
            id="hora-inicio"
            v-model="formulario.horaInicio"
            type="time"
            :aria-invalid="Boolean(errores.horaInicio)"
            @input="(limpiarError('horaInicio'), limpiarError('turno'), limpiarError('jornada'))"
          />
          <small v-if="errores.horaInicio" class="error">{{ errores.horaInicio }}</small>
        </div>

        <div class="campo">
          <label for="hora-fin">Hora de fin <span class="obligatorio">*</span></label>
          <input
            id="hora-fin"
            v-model="formulario.horaFin"
            type="time"
            :aria-invalid="Boolean(errores.horaFin)"
            @input="(limpiarError('horaFin'), limpiarError('jornada'))"
          />
          <small v-if="errores.horaFin" class="error">{{ errores.horaFin }}</small>
        </div>

        <div class="campo">
          <label for="duracion-hora">Duración de la hora pedagógica <span class="obligatorio">*</span></label>
          <input
            id="duracion-hora"
            :value="formulario.duracionHoraPedagogicaMinutos ?? ''"
            type="number"
            min="1"
            :max="DURACION_MAXIMA_MINUTOS"
            inputmode="numeric"
            :aria-invalid="Boolean(errores.duracion)"
            @input="cambiarNumero('duracionHoraPedagogicaMinutos', $event)"
          />
          <small v-if="errores.duracion" class="error">{{ errores.duracion }}</small>
          <small v-else class="ayuda">En minutos, de 1 a {{ DURACION_MAXIMA_MINUTOS }}.</small>
        </div>

        <div class="campo">
          <label for="cantidad-horas">Horas pedagógicas <span class="obligatorio">*</span></label>
          <input
            id="cantidad-horas"
            :value="formulario.cantidadBloquesPedagogicos ?? ''"
            type="number"
            min="1"
            :max="CANTIDAD_MAXIMA_BLOQUES"
            inputmode="numeric"
            :aria-invalid="Boolean(errores.cantidad)"
            @input="cambiarNumero('cantidadBloquesPedagogicos', $event)"
          />
          <small v-if="errores.cantidad" class="error">{{ errores.cantidad }}</small>
          <small v-else class="ayuda">De 1 a {{ CANTIDAD_MAXIMA_BLOQUES }}.</small>
        </div>

        <fieldset class="campo ancho-completo">
          <legend>Recreos</legend>

          <p v-if="formulario.recreos.length === 0" class="ayuda">Sin recreos.</p>

          <div v-for="(recreo, indice) in formulario.recreos" :key="indice" class="recreo">
            <label :for="`recreo-hora-${indice}`">Después de la</label>
            <select
              :id="`recreo-hora-${indice}`"
              v-model.number="recreo.despuesDeBloque"
              @change="(limpiarError('recreos'), limpiarError('jornada'))"
            >
              <option v-for="hora in horasDisponibles" :key="hora" :value="hora">{{ hora }}.ª hora</option>
              <option v-if="recreo.despuesDeBloque > horasDisponibles.length" :value="recreo.despuesDeBloque">
                {{ recreo.despuesDeBloque }}.ª hora (no existe)
              </option>
            </select>
            <label :for="`recreo-duracion-${indice}`">dura</label>
            <input
              :id="`recreo-duracion-${indice}`"
              v-model.number="recreo.duracionMinutos"
              type="number"
              min="1"
              :max="DURACION_MAXIMA_MINUTOS"
              inputmode="numeric"
              @input="(limpiarError('recreos'), limpiarError('jornada'))"
            />
            <span class="unidad">min</span>
            <button
              type="button"
              class="quitar"
              :aria-label="`Quitar el recreo después de la ${recreo.despuesDeBloque}.ª hora`"
              @click="quitarRecreo(indice)"
            >
              ×
            </button>
          </div>

          <small v-if="errores.recreos" class="error">{{ errores.recreos }}</small>

          <button
            type="button"
            class="boton-agregar"
            :disabled="formulario.recreos.length >= Math.min(CANTIDAD_MAXIMA_RECREOS, horasDisponibles.length)"
            @click="agregarRecreo"
          >
            + Agregar recreo
          </button>
        </fieldset>
      </div>
    </section>

    <section class="tarjeta vista-previa" aria-labelledby="titulo-vista-previa">
      <h2 id="titulo-vista-previa">Vista previa de los bloques</h2>

      <LineaTiempoBloques
        v-if="resumen.bloques.length > 0"
        :bloques="resumen.bloques"
        :fin-jornada="formulario.horaFin ? resumen.finJornada : null"
      />
      <p v-else class="ayuda">Completa la hora de inicio, la duración y la cantidad de horas para ver los bloques.</p>

      <p v-if="errorVistaPrevia" class="resumen error-resumen" role="alert">{{ errorVistaPrevia }}</p>
      <p v-else-if="resumen.bloques.length > 0" class="resumen correcto" aria-live="polite">
        Termina a las <strong>{{ formatearMinutos(resumen.finBloques) }}</strong> · {{ detalleResumen }}
      </p>

      <BotonAccion tipo="submit" :deshabilitado="guardando">
        {{ guardando ? 'Guardando...' : 'Guardar plantilla' }}
      </BotonAccion>
    </section>
  </form>
</template>

<style scoped>
.cuadricula {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  align-items: start;
  gap: 24px;
}

.tarjeta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.tarjeta h2 {
  margin: 0;
  padding-bottom: 14px;
  border-bottom: 1px solid #e5e7eb;
  color: #191c1e;
  font-size: 17px;
}

.vista-previa {
  position: sticky;
  top: 16px;
}

.campos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
}

.ancho-completo {
  grid-column: 1 / -1;
}

.campo > label,
.campo legend {
  margin-bottom: 6px;
  padding: 0;
  color: #191c1e;
  font-size: 13px;
  font-weight: 500;
}

.campo input,
.campo select {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #f2f4f6;
  color: #191c1e;
  font-size: 14px;
}

.campo input:focus,
.campo select:focus {
  border-color: #004ac6;
  outline: 2px solid rgb(0 74 198 / 15%);
}

.campo input[aria-invalid='true'] {
  border-color: #ba1a1a;
}

.obligatorio,
.error {
  color: #ba1a1a;
}

.error,
.ayuda {
  margin: 0;
  font-size: 12px;
}

.ayuda {
  color: #737686;
}

.selector-turno {
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
}

.selector-turno button {
  min-height: 42px;
  border: 0;
  background: white;
  color: #434655;
  font-size: 14px;
  cursor: pointer;
}

.selector-turno button.seleccionado {
  background: var(--color-primary);
  color: white;
  font-weight: 600;
}

.selector-turno button:focus-visible {
  outline: 3px solid var(--color-primary-light);
  outline-offset: -3px;
}

.recreo {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto 90px auto auto;
  align-items: center;
  gap: 8px;
  color: #434655;
  font-size: 13px;
}

.recreo select,
.recreo input {
  min-height: 38px;
  padding: 6px 10px;
}

.quitar {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #ba1a1a;
  font-size: 20px;
  cursor: pointer;
}

.quitar:hover {
  background: #fef2f2;
}

.boton-agregar {
  align-self: flex-start;
  padding: 7px 14px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.boton-agregar:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.resumen {
  margin: 0;
  padding: 12px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.correcto {
  border-color: #a7f3d0;
  background: #ecfdf5;
  color: #065f46;
}

.error-resumen {
  border-color: #fecaca;
  background: #fef2f2;
  color: #991b1b;
}

@media (max-width: 1100px) {
  .cuadricula {
    grid-template-columns: 1fr;
  }

  .vista-previa {
    position: static;
  }
}

@media (max-width: 560px) {
  .campos {
    grid-template-columns: 1fr;
  }

  .recreo {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
}
</style>
