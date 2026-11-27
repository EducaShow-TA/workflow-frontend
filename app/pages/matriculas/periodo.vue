<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { PeriodoMatricula, SolicitudPeriodoMatricula } from '~/types/periodoMatricula'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { formatearFecha, obtenerFechaHoyIso } from '~/composables/useFechas'
import {
  estaPeriodoVigente,
  obtenerEtiquetaEstadoPeriodo,
  obtenerVarianteEstadoPeriodo,
  usePeriodoMatricula,
} from '~/composables/usePeriodoMatricula'

definePageMeta({
  middleware: 'autenticacion',
})

const { listarPeriodos, registrarPeriodo, actualizarPeriodo, desactivarPeriodo } = usePeriodoMatricula()

const periodos = ref<PeriodoMatricula[]>([])
const cargando = ref(true)
const errorCarga = ref('')
const mensajeExito = ref('')

const fechaHoy = obtenerFechaHoyIso()

const periodoVigente = computed(() => periodos.value.find(estaPeriodoVigente) ?? null)

const proximoPeriodo = computed(() =>
  periodos.value
    .filter((periodo) => periodo.estado === 'PENDIENTE')
    .sort((primero, segundo) => primero.fechaInicio.localeCompare(segundo.fechaInicio))
    .at(0),
)

const anhioVacantes = computed(() => (periodoVigente.value ?? proximoPeriodo.value)?.anhioEscolar ?? null)

async function cargarPeriodos(): Promise<void> {
  cargando.value = true
  errorCarga.value = ''

  try {
    periodos.value = await listarPeriodos()
  } catch (error: unknown) {
    errorCarga.value = obtenerMensajeError(error, 'No se pudieron cargar los periodos de matrícula.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargarPeriodos)

// Formulario de registro y edicion
const modalAbierto = ref(false)
const guardando = ref(false)
const errorGuardado = ref('')
const idEnEdicion = ref<number | null>(null)

const anhioFormulario = ref(fechaHoy.slice(0, 4))
const montoMatriculaFormulario = ref<number | null>(null)
const montoPensionFormulario = ref<number | null>(null)

// Un periodo vigente ya abrió la matrícula: su año escolar no se puede cambiar.
const periodoEnEdicion = computed(
  () => periodos.value.find((periodo) => periodo.id !== null && periodo.id === idEnEdicion.value) ?? null,
)
const anhioPrevisto = computed(() => {
  const anhio = Number(anhioFormulario.value)
  if (!Number.isInteger(anhio) || anhio < 2000 || anhio > 2100) return null

  return {
    anhio,
    fechaInicio: periodoEnEdicion.value?.fechaInicio ?? fechaHoy,
  }
})

function limpiarErrores(): void {
  errorGuardado.value = ''
}

function abrirRegistro(): void {
  idEnEdicion.value = null
  let anhioDisponible = Number(fechaHoy.slice(0, 4))
  const anhiosRegistrados = new Set(periodos.value.map((periodo) => periodo.anhioEscolar))
  while (anhiosRegistrados.has(anhioDisponible) && anhioDisponible < 2100) {
    anhioDisponible += 1
  }
  anhioFormulario.value = String(anhioDisponible)
  montoMatriculaFormulario.value = null
  montoPensionFormulario.value = null
  limpiarErrores()
  modalAbierto.value = true
}

function abrirEdicion(periodo: PeriodoMatricula): void {
  idEnEdicion.value = periodo.id
  anhioFormulario.value = String(periodo.anhioEscolar)
  montoMatriculaFormulario.value = periodo.montoMatricula
  montoPensionFormulario.value = periodo.montoPension
  limpiarErrores()
  modalAbierto.value = true
}

function cerrarModal(): void {
  modalAbierto.value = false
}

async function guardarPeriodo(): Promise<void> {
  limpiarErrores()
  const anhio = Number(anhioFormulario.value)
  if (!Number.isInteger(anhio) || anhio < 2000 || anhio > 2100) {
    errorGuardado.value = 'Indica un año escolar válido.'
    return
  }
  if (anhio < Number(fechaHoy.slice(0, 4))) {
    errorGuardado.value = 'No se puede configurar matrícula para un año anterior.'
    return
  }
  if (!(Number(montoMatriculaFormulario.value) > 0) || !(Number(montoPensionFormulario.value) > 0)) {
    errorGuardado.value = 'Indica una tarifa de matrícula y una pensión mensual mayores que cero.'
    return
  }

  guardando.value = true

  try {
    const solicitud: SolicitudPeriodoMatricula = {
      anhioEscolar: anhio,
      montoMatricula: montoMatriculaFormulario.value ?? undefined,
      montoPension: montoPensionFormulario.value ?? undefined,
    }
    const esEdicion = idEnEdicion.value !== null

    if (esEdicion) {
      await actualizarPeriodo(idEnEdicion.value as number, solicitud)
    } else {
      await registrarPeriodo(solicitud)
    }

    modalAbierto.value = false
    mensajeExito.value = esEdicion
      ? `La apertura de matrícula ${anhio} y sus tarifas se actualizaron.`
      : `La matrícula ${anhio} quedó abierta hasta que la desactives.`
    await cargarPeriodos()
  } catch (error: unknown) {
    errorGuardado.value = obtenerMensajeError(error, 'No se pudo guardar el periodo de matrícula.')
  } finally {
    guardando.value = false
  }
}

// Desactivar es una baja lógica: el periodo deja de aparecer, pero su historia se conserva.
const periodoPorDesactivar = ref<PeriodoMatricula | null>(null)
const desactivando = ref(false)
const errorDesactivacion = ref('')

const mensajeDesactivacion = computed(() => {
  const periodo = periodoPorDesactivar.value

  if (!periodo) {
    return ''
  }

  return `¿Desactivar la apertura de matrícula ${periodo.anhioEscolar}? Se cerrará de inmediato y no se podrán registrar más matrículas. Las matrículas ya registradas se conservan.`
})

function solicitarDesactivacion(periodo: PeriodoMatricula): void {
  errorDesactivacion.value = ''
  periodoPorDesactivar.value = periodo
}

async function confirmarDesactivacion(): Promise<void> {
  const periodo = periodoPorDesactivar.value

  if (!periodo) {
    return
  }

  desactivando.value = true

  try {
    await desactivarPeriodo(periodo.id)
    periodoPorDesactivar.value = null
    mensajeExito.value = `La matrícula ${periodo.anhioEscolar} fue cerrada.`
    await cargarPeriodos()
  } catch (error: unknown) {
    errorDesactivacion.value = obtenerMensajeError(error, 'No se pudo desactivar el periodo.')
  } finally {
    desactivando.value = false
  }
}
</script>

<template>
  <main class="pagina-periodo">
    <EncabezadoPagina
      titulo="Periodo de Matrícula"
      descripcion="El administrador abre cada matrícula anual después de preparar el año académico y sus tarifas. La apertura permanece activa hasta desactivarla."
    >
      <template #acciones>
        <BotonAccion
          variante="secundario"
          :destino="anhioVacantes ? `/secciones?anhio=${anhioVacantes}` : '/secciones'"
        >
          {{ anhioVacantes ? `Ver vacantes de ${anhioVacantes}` : 'Vacantes por sección' }}
        </BotonAccion>
        <BotonAccion @click="abrirRegistro">+ Nuevo periodo</BotonAccion>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="mensajeExito" :mensaje="mensajeExito" tipo="exito" cerrable @cerrar="mensajeExito = ''" />

    <PanelEstadoCarga :cargando="cargando" :error="errorCarga" @reintentar="cargarPeriodos">
      <section class="tarjeta" aria-labelledby="titulo-situacion">
        <div class="encabezado-tarjeta">
          <h2 id="titulo-situacion">Situación actual</h2>
        </div>

        <div class="contenido-tarjeta">
          <div v-if="periodoVigente" class="situacion">
            <InsigniaEstado :texto="`Matrícula ${periodoVigente.anhioEscolar} abierta`" variante="exito" />

            <p>
              Matrícula para el <strong>año escolar {{ periodoVigente.anhioEscolar }}</strong> · periodo abierta desde
              <strong>{{ formatearFecha(periodoVigente.fechaInicio) }}</strong> y activa hasta que el administrador la
              desactive. Matrícula: <strong>{{ formatearSoles(periodoVigente.montoMatricula) }}</strong>; pensión
              mensual: <strong>{{ formatearSoles(periodoVigente.montoPension) }}</strong>.
            </p>
          </div>

          <div v-else class="situacion">
            <InsigniaEstado texto="Matrícula cerrada" variante="advertencia" />

            <p>
              No hay un periodo de matrícula vigente, por lo que no se pueden registrar matrículas.
              <template v-if="proximoPeriodo">
                Hay una apertura registrada para el año {{ proximoPeriodo.anhioEscolar }}, pero todavía no está activa.
              </template>
              La matrícula no se habilita automáticamente por la fecha: el administrador debe abrirla.
            </p>
          </div>
        </div>
      </section>

      <section class="panel-tabla" aria-label="Periodos de matrícula disponibles">
        <div class="tabla-desplazable">
          <table>
            <thead>
              <tr>
                <th scope="col">Año escolar</th>
                <th scope="col">Apertura</th>
                <th scope="col">Matrícula</th>
                <th scope="col">Pensión mensual</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="periodo in periodos" :key="periodo.id">
                <td class="dato-destacado">{{ periodo.anhioEscolar }}</td>
                <td>{{ formatearFecha(periodo.fechaInicio) }}</td>
                <td>{{ formatearSoles(periodo.montoMatricula) }}</td>
                <td>{{ formatearSoles(periodo.montoPension) }}</td>
                <td>
                  <InsigniaEstado
                    :texto="obtenerEtiquetaEstadoPeriodo(periodo.estado)"
                    :variante="obtenerVarianteEstadoPeriodo(periodo.estado)"
                  />
                </td>
                <td>
                  <p v-if="periodo.tieneMatriculas" class="solo-lectura">
                    <span aria-hidden="true">🔒</span> Tarifas bloqueadas: tiene matrículas registradas
                  </p>
                  <div v-else class="acciones-fila">
                    <button
                      type="button"
                      class="boton-tabla"
                      :aria-label="`Editar matrícula ${periodo.anhioEscolar}`"
                      :disabled="periodo.tieneMatriculas"
                      @click="abrirEdicion(periodo)"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      class="boton-tabla"
                      :aria-label="`Desactivar matrícula ${periodo.anhioEscolar}`"
                      @click="solicitarDesactivacion(periodo)"
                    >
                      Desactivar
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="periodos.length === 0">
                <td colspan="6" class="sin-resultados">
                  Aún no hay aperturas de matrícula registradas. Usa «Nuevo periodo» después de preparar el año
                  académico.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </PanelEstadoCarga>

    <VentanaModal
      :abierta="modalAbierto"
      :titulo="idEnEdicion === null ? 'Nuevo periodo de matrícula' : 'Editar periodo de matrícula'"
      descripcion="La matrícula se abre inmediatamente y permanece activa hasta que el administrador la desactive."
      :bloqueada="guardando"
      @cerrar="cerrarModal"
    >
      <form id="formulario-periodo" class="formulario" novalidate @submit.prevent="guardarPeriodo">
        <div v-if="periodoEnEdicion?.tieneMatriculas" class="reglas-fechas" role="note">
          Este año ya tiene matrículas registradas. Las tarifas no se pueden modificar.
        </div>

        <div class="cuadricula-fechas">
          <div class="campo">
            <label for="anhio-matricula">Año de matrícula <span class="obligatorio">*</span></label>
            <input
              id="anhio-matricula"
              v-model.number="anhioFormulario"
              type="number"
              min="2000"
              max="2100"
              :disabled="Boolean(periodoEnEdicion)"
            />
            <small class="ayuda"> La apertura empieza hoy y sigue activa hasta que la desactives. </small>
          </div>
          <div class="campo">
            <label for="monto-matricula">Tarifa de matrícula (S/) <span class="obligatorio">*</span></label>
            <input
              id="monto-matricula"
              v-model.number="montoMatriculaFormulario"
              type="number"
              min="0.01"
              step="0.01"
            />
          </div>
          <div class="campo">
            <label for="monto-pension">Pensión mensual (S/) <span class="obligatorio">*</span></label>
            <input id="monto-pension" v-model.number="montoPensionFormulario" type="number" min="0.01" step="0.01" />
          </div>
        </div>

        <p v-if="anhioPrevisto" class="vista-previa" role="status">
          La matrícula del <strong>año escolar {{ anhioPrevisto.anhio }}</strong> quedará abierta desde hoy ({{
            formatearFecha(anhioPrevisto.fechaInicio)
          }}) y se cerrará solo al desactivarla.
        </p>

        <AvisoMensaje v-if="errorGuardado" :mensaje="errorGuardado" tipo="error" />
      </form>

      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="guardando" @click="cerrarModal">Cancelar</BotonAccion>
        <BotonAccion tipo="submit" form="formulario-periodo" :deshabilitado="guardando">
          {{ guardando ? 'Guardando...' : 'Guardar periodo' }}
        </BotonAccion>
      </template>
    </VentanaModal>

    <VentanaConfirmacion
      :abierta="periodoPorDesactivar !== null"
      titulo="Desactivar periodo"
      :mensaje="mensajeDesactivacion"
      texto-confirmar="Desactivar periodo"
      :procesando="desactivando"
      :error="errorDesactivacion"
      @confirmar="confirmarDesactivacion"
      @cancelar="periodoPorDesactivar = null"
    />
  </main>
</template>

<style scoped>
.pagina-periodo {
  display: flex;
  width: 100%;
  max-width: 1000px;
  flex-direction: column;
  gap: 24px;
  margin: 0 auto;
  padding: 32px;
}

.tarjeta {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.encabezado-tarjeta {
  margin: 0 24px;
  padding: 20px 0 16px;
  border-bottom: 1px solid #e5e7eb;
}

.encabezado-tarjeta h2 {
  margin: 0;
  color: #191c1e;
  font-size: 20px;
}

.contenido-tarjeta {
  padding: 24px;
}

.situacion {
  display: flex;
  align-items: center;
  gap: 16px;
}

.situacion p {
  margin: 0;
  color: #434655;
  font-size: 14px;
  line-height: 1.6;
}

.panel-tabla {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.tabla-desplazable {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

thead {
  background: #f2f4f6;
}

th {
  padding: 12px 14px;
  color: #434655;
  font-size: 12px;
  font-weight: 600;
}

td {
  padding: 12px 14px;
  border-top: 1px solid #e5e7eb;
  color: #191c1e;
  font-size: 13px;
}

.dato-destacado {
  font-weight: 600;
}

.solo-lectura {
  margin: 0;
  color: #434655;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.reglas-fechas {
  margin-bottom: 4px;
  padding: 12px 14px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 13px;
  line-height: 1.5;
}

.reglas-fechas ul {
  margin: 4px 0 0;
  padding-left: 18px;
}

.boton-tabla {
  padding: 6px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 7px;
  background: white;
  color: #004ac6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.boton-tabla:hover:not(:disabled) {
  background: #eef2ff;
}

.boton-tabla:disabled {
  border-color: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
}

.acciones-fila {
  display: flex;
  gap: 8px;
}

.sin-resultados {
  padding: 48px 16px;
  color: #737686;
  text-align: center;
}

.formulario {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cuadricula-fechas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.campo label {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.campo select,
.campo input {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font-size: 14px;
}

.campo select:focus-visible,
.campo input:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.campo [aria-invalid='true'] {
  border-color: #dc2626;
}

.obligatorio,
.error {
  color: #dc2626;
}

.error {
  font-size: 12px;
}

.ayuda {
  color: #434655;
  font-size: 12px;
}

.campo input:disabled {
  background: #f2f4f6;
  color: #6b7280;
  cursor: not-allowed;
}

.vista-previa {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  color: #434655;
  font-size: 14px;
}

@media (max-width: 600px) {
  .pagina-periodo {
    padding: 20px 14px;
  }

  .situacion {
    align-items: flex-start;
    flex-direction: column;
  }

  .cuadricula-fechas {
    grid-template-columns: 1fr;
  }

  table {
    min-width: 640px;
  }
}
</style>
