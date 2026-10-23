<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { ErroresPeriodoMatricula, PeriodoMatricula, SolicitudPeriodoMatricula } from '~/types/periodoMatricula'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { calcularDiasEntre, formatearFecha, obtenerFechaHoyIso } from '~/composables/useFechas'
import {
  calcularEstadoPeriodo,
  describirPeriodo,
  estaPeriodoVigente,
  obtenerEtiquetaEstadoPeriodo,
  obtenerMotivoNoEditable,
  obtenerVarianteEstadoPeriodo,
  usePeriodoMatricula,
  validarPeriodoMatricula,
} from '~/composables/usePeriodoMatricula'
import { obtenerAnhio } from '~/composables/useAnhioEscolar'
import { tieneErrores } from '~/composables/useValidacion'

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

// La matrícula de Dic 2026 – Feb 2027 llena las vacantes del año escolar 2027.
const anhioVacantes = computed(() => {
  const periodo = periodoVigente.value ?? proximoPeriodo.value
  return periodo ? obtenerAnhio(periodo.fechaLimite) : null
})

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

function describirDuracion(periodo: PeriodoMatricula): string {
  const dias = calcularDiasEntre(periodo.fechaInicio, periodo.fechaLimite) + 1
  return `${dias} ${dias === 1 ? 'día' : 'días'}`
}

function describirDiasHasta(fecha: string): string {
  const dias = calcularDiasEntre(fechaHoy, fecha)

  if (dias === 0) {
    return 'hoy'
  }

  return dias === 1 ? 'mañana' : `en ${dias} días`
}

// Formulario de registro y edicion
const modalAbierto = ref(false)
const guardando = ref(false)
const errorGuardado = ref('')
const idEnEdicion = ref<number | null>(null)

const formulario = reactive<SolicitudPeriodoMatricula>({
  fechaInicio: '',
  fechaLimite: '',
})

const errores = reactive<ErroresPeriodoMatricula>({})

// Vista previa del estado con las fechas ingresadas, antes de guardar.
const estadoPrevisto = computed(() => {
  if (!formulario.fechaInicio || !formulario.fechaLimite || formulario.fechaLimite <= formulario.fechaInicio) {
    return null
  }

  return calcularEstadoPeriodo(formulario.fechaInicio, formulario.fechaLimite, fechaHoy)
})

function limpiarErrores(): void {
  errores.fechaInicio = undefined
  errores.fechaLimite = undefined
  errorGuardado.value = ''
}

function abrirRegistro(): void {
  idEnEdicion.value = null
  formulario.fechaInicio = ''
  formulario.fechaLimite = ''
  limpiarErrores()
  modalAbierto.value = true
}

function abrirEdicion(periodo: PeriodoMatricula): void {
  idEnEdicion.value = periodo.id
  formulario.fechaInicio = periodo.fechaInicio
  formulario.fechaLimite = periodo.fechaLimite
  limpiarErrores()
  modalAbierto.value = true
}

function cerrarModal(): void {
  modalAbierto.value = false
}

async function guardarPeriodo(): Promise<void> {
  limpiarErrores()
  Object.assign(errores, validarPeriodoMatricula(formulario, periodos.value, idEnEdicion.value))

  if (tieneErrores(errores)) {
    return
  }

  guardando.value = true

  try {
    const solicitud: SolicitudPeriodoMatricula = { ...formulario }
    const esEdicion = idEnEdicion.value !== null

    if (esEdicion) {
      await actualizarPeriodo(idEnEdicion.value as number, solicitud)
    } else {
      await registrarPeriodo(solicitud)
    }

    modalAbierto.value = false
    mensajeExito.value = `Periodo ${describirPeriodo(solicitud)} ${esEdicion ? 'actualizado' : 'registrado'} correctamente.`
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

  const rango = `del ${formatearFecha(periodo.fechaInicio)} al ${formatearFecha(periodo.fechaLimite)}`
  const cierre = estaPeriodoVigente(periodo) ? ' La matrícula se cerrará de inmediato.' : ''
  return `¿Desactivar el periodo ${rango}? Dejará de aparecer en la lista y no se podrán registrar matrículas con él. Las matrículas ya registradas se conservan.${cierre}`
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
    mensajeExito.value = `Periodo ${describirPeriodo(periodo)} desactivado.`
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
      descripcion="Define las fechas en las que se pueden registrar matrículas."
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
            <InsigniaEstado texto="Matrícula abierta" variante="exito" />

            <p>
              Periodo <strong>{{ describirPeriodo(periodoVigente) }}</strong
              >: del <strong>{{ formatearFecha(periodoVigente.fechaInicio) }}</strong> al
              <strong>{{ formatearFecha(periodoVigente.fechaLimite) }}</strong
              >. Cierra {{ describirDiasHasta(periodoVigente.fechaLimite) }}.
            </p>
          </div>

          <div v-else class="situacion">
            <InsigniaEstado texto="Matrícula cerrada" variante="advertencia" />

            <p>
              No hay un periodo de matrícula vigente, por lo que no se pueden registrar matrículas.
              <template v-if="proximoPeriodo">
                El próximo periodo inicia el
                <strong>{{ formatearFecha(proximoPeriodo.fechaInicio) }}</strong>
                ({{ describirDiasHasta(proximoPeriodo.fechaInicio) }}).
              </template>
            </p>
          </div>
        </div>
      </section>

      <section class="panel-tabla" aria-label="Periodos de matrícula registrados">
        <div class="tabla-desplazable">
          <table>
            <thead>
              <tr>
                <th scope="col">Periodo</th>
                <th scope="col">Fecha de inicio</th>
                <th scope="col">Fecha límite</th>
                <th scope="col">Duración</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="periodo in periodos" :key="periodo.id">
                <td class="dato-destacado">{{ describirPeriodo(periodo) }}</td>
                <td>{{ formatearFecha(periodo.fechaInicio) }}</td>
                <td>{{ formatearFecha(periodo.fechaLimite) }}</td>
                <td>{{ describirDuracion(periodo) }}</td>
                <td>
                  <InsigniaEstado
                    :texto="obtenerEtiquetaEstadoPeriodo(periodo.estado)"
                    :variante="obtenerVarianteEstadoPeriodo(periodo.estado)"
                  />
                </td>
                <td>
                  <div class="acciones-fila">
                    <button
                      type="button"
                      class="boton-tabla"
                      :disabled="Boolean(obtenerMotivoNoEditable(periodo))"
                      :title="obtenerMotivoNoEditable(periodo) || undefined"
                      :aria-label="`Editar periodo ${describirPeriodo(periodo)}`"
                      @click="abrirEdicion(periodo)"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      class="boton-tabla"
                      :aria-label="`Desactivar periodo ${describirPeriodo(periodo)}`"
                      @click="solicitarDesactivacion(periodo)"
                    >
                      Desactivar
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="periodos.length === 0">
                <td colspan="6" class="sin-resultados">
                  Aún no hay periodos de matrícula. Registra el primero con «Nuevo periodo».
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
      descripcion="Las matrículas solo se pueden registrar mientras el periodo esté vigente."
      :bloqueada="guardando"
      @cerrar="cerrarModal"
    >
      <form id="formulario-periodo" class="formulario" novalidate @submit.prevent="guardarPeriodo">
        <div class="cuadricula-fechas">
          <div class="campo">
            <label for="fecha-inicio">Fecha de inicio <span class="obligatorio">*</span></label>

            <input
              id="fecha-inicio"
              v-model="formulario.fechaInicio"
              type="date"
              :aria-invalid="Boolean(errores.fechaInicio)"
              :aria-describedby="errores.fechaInicio ? 'error-fecha-inicio' : undefined"
              @input="errores.fechaInicio = undefined"
            />

            <small v-if="errores.fechaInicio" id="error-fecha-inicio" class="error">{{ errores.fechaInicio }}</small>
          </div>

          <div class="campo">
            <label for="fecha-limite">Fecha límite <span class="obligatorio">*</span></label>

            <input
              id="fecha-limite"
              v-model="formulario.fechaLimite"
              type="date"
              :min="formulario.fechaInicio || undefined"
              :aria-invalid="Boolean(errores.fechaLimite)"
              :aria-describedby="errores.fechaLimite ? 'error-fecha-limite' : undefined"
              @input="errores.fechaLimite = undefined"
            />

            <small v-if="errores.fechaLimite" id="error-fecha-limite" class="error">{{ errores.fechaLimite }}</small>
          </div>
        </div>

        <p v-if="estadoPrevisto" class="vista-previa" role="status">
          Con estas fechas, el periodo quedará
          <InsigniaEstado
            :texto="obtenerEtiquetaEstadoPeriodo(estadoPrevisto)"
            :variante="obtenerVarianteEstadoPeriodo(estadoPrevisto)"
          />
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
