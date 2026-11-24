<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import {
  ACCIONES_FINANCIERAS,
  NOMBRES_ACCION_FINANCIERA,
  crearFiltrosAuditoriaFinanciera,
  describirDetalleFinanciero,
  describirResponsable,
  formatearMontoAuditoria,
  nombrarEstadoFinanciero,
  nombrarMesCobro,
  rangoAuditoriaInvalido,
  separarFechaHoraAuditoria,
  useAuditoriaFinanciera,
} from '~/composables/useAuditoriaFinanciera'
import { obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import type { EventoAuditoriaFinanciera, ResumenAuditoriaFinanciera } from '~/types/auditoriaFinanciera'
import type { PeriodoAcademico } from '~/types/periodoAcademico'

definePageMeta({ middleware: 'autenticacion' })

const TAMANIO = 20
const ESPERA_TEXTO_MS = 400

const api = useAuditoriaFinanciera()
const { listar: listarPeriodos } = usePeriodosAcademicos()

const fechaHoy = obtenerFechaHoyIso()
const filtros = reactive(crearFiltrosAuditoriaFinanciera(fechaHoy))
const eventos = ref<EventoAuditoriaFinanciera[]>([])
const resumen = ref<ResumenAuditoriaFinanciera | null>(null)
const periodos = ref<PeriodoAcademico[]>([])
const pagina = ref(0)
const paginas = ref(1)
const total = ref(0)
const cargando = ref(true)
const error = ref('')
const errorCatalogo = ref('')
const exportando = ref(false)
const errorExportar = ref('')
const seleccionado = ref<EventoAuditoriaFinanciera | null>(null)
const historial = ref<EventoAuditoriaFinanciera[]>([])
const cargandoHistorial = ref(false)
const errorHistorial = ref('')
let ultimaSolicitud = 0
let temporizador: ReturnType<typeof setTimeout> | undefined

const rangoInvalido = computed(() => rangoAuditoriaInvalido(filtros))
const hayFiltros = computed(() => JSON.stringify(filtros) !== JSON.stringify(crearFiltrosAuditoriaFinanciera(fechaHoy)))
const grados = computed(() =>
  [
    ...new Map(
      periodos.value.map((periodo) => [
        periodo.gradoId,
        { id: periodo.gradoId, numero: periodo.numeroGrado, nivel: periodo.nivelEducativo },
      ]),
    ).values(),
  ].sort((primero, segundo) => primero.nivel.localeCompare(segundo.nivel) || primero.numero - segundo.numero),
)
const secciones = computed(() =>
  [
    ...new Map(
      periodos.value
        .filter((periodo) => !filtros.gradoId || String(periodo.gradoId) === filtros.gradoId)
        .map((periodo) => [periodo.seccionId, { id: periodo.seccionId, nombre: periodo.seccion }]),
    ).values(),
  ].sort((primera, segunda) => primera.nombre.localeCompare(segunda.nombre)),
)

function nombrarGrado(numero: number, nivel: string): string {
  return formatearGrado(numero, nivel)
}

function claseAccion(evento: EventoAuditoriaFinanciera): string {
  return evento.accion.toLowerCase().replace(/_/g, '-')
}

function claseEstado(estado: string | null): string {
  return (estado ?? 'ninguno').toLowerCase().replace(/_/g, '-')
}

async function cargarCatalogo(): Promise<void> {
  errorCatalogo.value = ''
  try {
    periodos.value = await listarPeriodos()
  } catch (fallo: unknown) {
    errorCatalogo.value = obtenerMensajeError(fallo, 'No se pudieron cargar los grados y secciones.')
  }
}

async function consultar(numero = 0): Promise<void> {
  if (rangoInvalido.value) {
    eventos.value = []
    resumen.value = null
    cargando.value = false
    return
  }

  const solicitud = ++ultimaSolicitud
  const seleccion = { ...filtros }
  cargando.value = true
  error.value = ''

  try {
    const [respuesta, totales] = await Promise.all([api.listar(seleccion, numero, TAMANIO), api.resumir(seleccion)])
    if (solicitud !== ultimaSolicitud) return
    eventos.value = respuesta.content
    pagina.value = respuesta.page.number
    paginas.value = Math.max(1, respuesta.page.totalPages)
    total.value = respuesta.page.totalElements
    resumen.value = totales
  } catch (fallo: unknown) {
    if (solicitud === ultimaSolicitud) {
      eventos.value = []
      resumen.value = null
      error.value = obtenerMensajeError(fallo, 'No se pudo cargar la auditoría.')
    }
  } finally {
    if (solicitud === ultimaSolicitud) cargando.value = false
  }
}

function limpiar(): void {
  Object.assign(filtros, crearFiltrosAuditoriaFinanciera(fechaHoy))
}

async function abrir(evento: EventoAuditoriaFinanciera): Promise<void> {
  seleccionado.value = evento
  historial.value = []
  errorHistorial.value = ''
  if (!evento.boletaId) return

  cargandoHistorial.value = true
  try {
    const eventosBoleta = await api.historialBoleta(evento.boletaId)
    if (seleccionado.value?.id === evento.id) historial.value = eventosBoleta
  } catch (fallo: unknown) {
    errorHistorial.value = obtenerMensajeError(fallo, 'No se pudo cargar el historial de la boleta.')
  } finally {
    cargandoHistorial.value = false
  }
}

function cerrar(): void {
  seleccionado.value = null
}

async function exportar(): Promise<void> {
  exportando.value = true
  errorExportar.value = ''
  try {
    const { archivo, nombre } = await api.descargarCsv({ ...filtros })
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(archivo)
    enlace.download = nombre
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  } catch (fallo: unknown) {
    errorExportar.value = obtenerMensajeError(fallo, 'No se pudo exportar la auditoría.')
  } finally {
    exportando.value = false
  }
}

function alPresionarTecla(evento: KeyboardEvent): void {
  if (evento.key === 'Escape') cerrar()
}

watch(
  () => filtros.gradoId,
  () => {
    filtros.seccionId = ''
  },
)

watch(
  () => [filtros.desde, filtros.hasta, filtros.accion, filtros.medioPago, filtros.gradoId, filtros.seccionId],
  () => {
    void consultar(0)
  },
)

watch(
  () => [filtros.estudiante, filtros.comprobante],
  () => {
    clearTimeout(temporizador)
    temporizador = setTimeout(() => void consultar(0), ESPERA_TEXTO_MS)
  },
)

onMounted(() => {
  window.addEventListener('keydown', alPresionarTecla)
  void cargarCatalogo()
  void consultar(0)
})

onUnmounted(() => {
  ultimaSolicitud++
  clearTimeout(temporizador)
  window.removeEventListener('keydown', alPresionarTecla)
})
</script>

<template>
  <main class="pagina-auditoria-finanzas">
    <NavegacionFinanzas />

    <header class="encabezado">
      <div>
        <h1>Auditoría de transacciones y pagos</h1>
        <p>Cada cambio de dinero o de estado de una boleta, quién lo hizo y cuándo.</p>
      </div>
      <button type="button" class="boton" :disabled="exportando || cargando || rangoInvalido" @click="exportar">
        {{ exportando ? 'Exportando…' : 'Exportar CSV' }}
      </button>
    </header>

    <AvisoMensaje v-if="errorExportar" :mensaje="errorExportar" tipo="error" />

    <section class="tarjeta" aria-label="Filtros de auditoría financiera">
      <div class="filtros">
        <label>
          Desde
          <input v-model="filtros.desde" type="date" :max="filtros.hasta || undefined" />
        </label>
        <label>
          Hasta
          <input v-model="filtros.hasta" type="date" :min="filtros.desde || undefined" />
        </label>
        <label>
          Acción
          <select v-model="filtros.accion">
            <option value="">Todas</option>
            <option v-for="accion in ACCIONES_FINANCIERAS" :key="accion" :value="accion">
              {{ NOMBRES_ACCION_FINANCIERA[accion] }}
            </option>
          </select>
        </label>
        <label>
          Medio de pago
          <select v-model="filtros.medioPago">
            <option value="">Todos</option>
            <option value="PRESENCIAL">Presencial</option>
            <option value="VIRTUAL">Virtual</option>
          </select>
        </label>
        <label class="ancho-doble">
          Estudiante
          <input v-model="filtros.estudiante" type="search" placeholder="Nombre o DNI" maxlength="100" />
        </label>
        <label>
          Grado
          <select v-model="filtros.gradoId" :disabled="!!errorCatalogo">
            <option value="">Todos</option>
            <option v-for="grado in grados" :key="grado.id" :value="String(grado.id)">
              {{ nombrarGrado(grado.numero, grado.nivel) }}
            </option>
          </select>
        </label>
        <label>
          Sección
          <select v-model="filtros.seccionId" :disabled="!!errorCatalogo || !filtros.gradoId">
            <option value="">Todas</option>
            <option v-for="seccion in secciones" :key="seccion.id" :value="String(seccion.id)">
              {{ seccion.nombre }}
            </option>
          </select>
        </label>
        <label class="ancho-doble">
          N.° de comprobante
          <input v-model="filtros.comprobante" type="search" placeholder="Ej. PEN-3F2A9C1B" maxlength="40" />
        </label>
      </div>
      <div class="pie-filtros">
        <span class="ayuda">Los filtros se aplican al escribir o elegir.</span>
        <button type="button" class="boton" :disabled="!hayFiltros" @click="limpiar">Limpiar filtros</button>
      </div>
      <AvisoMensaje v-if="errorCatalogo" :mensaje="errorCatalogo" tipo="advertencia" />
      <AvisoMensaje
        v-if="rangoInvalido"
        tipo="advertencia"
        mensaje="La fecha inicial no puede ser posterior a la fecha final."
      />
    </section>

    <ul v-if="resumen && !cargando && !error" class="resumen" aria-label="Totales del filtro">
      <li>
        <strong>{{ resumen.eventos }}</strong> {{ resumen.eventos === 1 ? 'evento' : 'eventos' }}
      </li>
      <li>
        <strong>{{ resumen.pagos }}</strong> {{ resumen.pagos === 1 ? 'pago' : 'pagos' }} ·
        <strong>{{ formatearMontoAuditoria(resumen.montoPagado) }}</strong>
      </li>
      <li>
        <strong>{{ resumen.boletasEnMora }}</strong>
        {{ resumen.boletasEnMora === 1 ? 'boleta pasó' : 'boletas pasaron' }} a mora
      </li>
      <li>
        <strong>{{ resumen.boletasGeneradas }}</strong>
        {{ resumen.boletasGeneradas === 1 ? 'boleta generada' : 'boletas generadas' }}
      </li>
      <li>
        <strong>{{ resumen.compromisosGenerados }}</strong>
        {{ resumen.compromisosGenerados === 1 ? 'compromiso' : 'compromisos' }}
      </li>
    </ul>

    <section class="tarjeta listado" aria-label="Eventos" :aria-busy="cargando">
      <PanelEstadoCarga
        v-if="cargando || error"
        :cargando="cargando"
        :error="error"
        texto-carga="Consultando la auditoría…"
        @reintentar="consultar(pagina)"
      />
      <p v-else-if="rangoInvalido" class="vacio">Corrige el rango de fechas para ver los eventos.</p>
      <div v-else-if="!eventos.length" class="vacio">
        <p>No hay eventos con esos filtros.</p>
        <small>Prueba con otro rango de fechas o quita algún filtro.</small>
      </div>

      <template v-else>
        <div class="tabla-contenedor" tabindex="0" role="region" aria-label="Eventos, desplazamiento horizontal">
          <table>
            <thead>
              <tr>
                <th scope="col">Fecha y hora</th>
                <th scope="col">Acción y responsable</th>
                <th scope="col">Estudiante y apoderado titular</th>
                <th scope="col">Detalle</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="evento in eventos"
                :key="evento.id"
                :class="{ elegido: seleccionado?.id === evento.id }"
                tabindex="0"
                :aria-label="`Ver detalle: ${NOMBRES_ACCION_FINANCIERA[evento.accion]} de ${evento.estudianteNombre}`"
                @click="abrir(evento)"
                @keydown.enter="abrir(evento)"
              >
                <td class="fecha">
                  {{ separarFechaHoraAuditoria(evento.fechaHora).fecha }}
                  <small>{{ separarFechaHoraAuditoria(evento.fechaHora).hora }}</small>
                </td>
                <td>
                  <span class="accion" :class="claseAccion(evento)">{{
                    NOMBRES_ACCION_FINANCIERA[evento.accion]
                  }}</span>
                  <small>por {{ describirResponsable(evento) }}</small>
                </td>
                <td>
                  <strong>{{ evento.estudianteNombre }}</strong>
                  <small>{{ formatearSeccion(evento.gradoNumero, evento.seccionCodigo) }}</small>
                  <small>Apoderado: {{ evento.apoderadoNombre }}</small>
                </td>
                <td>
                  {{ describirDetalleFinanciero(evento).principal }}
                  <small>{{ describirDetalleFinanciero(evento).secundario }}</small>
                </td>
                <td>
                  <span class="cambio">
                    <span v-if="evento.estadoAnterior" class="estado" :class="claseEstado(evento.estadoAnterior)">
                      {{ nombrarEstadoFinanciero(evento.estadoAnterior) }}
                    </span>
                    <span v-else class="sin-estado">—</span>
                    <span aria-hidden="true">→</span>
                    <span class="estado" :class="claseEstado(evento.estadoNuevo)">
                      {{ nombrarEstadoFinanciero(evento.estadoNuevo) }}
                    </span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul class="tarjetas-movil">
          <li v-for="evento in eventos" :key="evento.id">
            <button type="button" @click="abrir(evento)">
              <span class="fila-superior">
                <span class="accion" :class="claseAccion(evento)">{{ NOMBRES_ACCION_FINANCIERA[evento.accion] }}</span>
                <small
                  >{{ separarFechaHoraAuditoria(evento.fechaHora).fecha.slice(0, 5) }}
                  {{ separarFechaHoraAuditoria(evento.fechaHora).hora.slice(0, 5) }}</small
                >
              </span>
              <strong>{{ evento.estudianteNombre }}</strong>
              <small>Apoderado: {{ evento.apoderadoNombre }}</small>
              <span>{{ describirDetalleFinanciero(evento).principal }}</span>
              <span class="cambio">
                <span v-if="evento.estadoAnterior" class="estado" :class="claseEstado(evento.estadoAnterior)">
                  {{ nombrarEstadoFinanciero(evento.estadoAnterior) }}
                </span>
                <span v-else class="sin-estado">—</span>
                <span aria-hidden="true">→</span>
                <span class="estado" :class="claseEstado(evento.estadoNuevo)">
                  {{ nombrarEstadoFinanciero(evento.estadoNuevo) }}
                </span>
              </span>
              <small>{{ describirResponsable(evento) }}</small>
            </button>
          </li>
        </ul>

        <footer class="paginacion">
          <span>{{ pagina * TAMANIO + 1 }}–{{ Math.min((pagina + 1) * TAMANIO, total) }} de {{ total }} eventos</span>
          <span class="botones">
            <button type="button" class="boton" :disabled="pagina === 0" @click="consultar(pagina - 1)">
              ‹ Anterior
            </button>
            <button type="button" class="boton" :disabled="pagina + 1 >= paginas" @click="consultar(pagina + 1)">
              Siguiente ›
            </button>
          </span>
        </footer>
      </template>
    </section>
    <p class="ayuda">
      Del más reciente al más antiguo. El apoderado titular es el del compromiso de pago al momento del evento.
    </p>

    <div v-if="seleccionado" class="fondo" aria-hidden="true" @click="cerrar" />
    <aside v-if="seleccionado" class="detalle" role="dialog" aria-labelledby="titulo-detalle">
      <header>
        <div>
          <h2 id="titulo-detalle">{{ NOMBRES_ACCION_FINANCIERA[seleccionado.accion] }}</h2>
          <small>
            {{ separarFechaHoraAuditoria(seleccionado.fechaHora).fecha }} ·
            {{ separarFechaHoraAuditoria(seleccionado.fechaHora).hora }}
          </small>
        </div>
        <button type="button" class="cerrar" aria-label="Cerrar detalle" @click="cerrar">✕</button>
      </header>

      <dl>
        <dt>Estudiante</dt>
        <dd>
          {{ seleccionado.estudianteNombre }}
          <small
            >DNI {{ seleccionado.estudianteDni }} ·
            {{ formatearSeccionCompleta(seleccionado.gradoNumero, seleccionado.seccionCodigo) }}</small
          >
        </dd>
        <dt>Apoderado titular</dt>
        <dd>{{ seleccionado.apoderadoNombre }}</dd>
        <template v-if="seleccionado.concepto">
          <dt>Concepto</dt>
          <dd>{{ seleccionado.concepto }}</dd>
        </template>
        <template v-if="seleccionado.boletaId">
          <dt>Boleta</dt>
          <dd>N.° {{ seleccionado.boletaId }} · {{ nombrarMesCobro(seleccionado.mesCobro) }}</dd>
        </template>
        <template v-if="seleccionado.numeroCuotas">
          <dt>Cuotas</dt>
          <dd>{{ seleccionado.numeroCuotas }}</dd>
        </template>
        <dt>{{ seleccionado.accion === 'PAGO_REGISTRADO' ? 'Monto pagado' : 'Monto' }}</dt>
        <dd>{{ formatearMontoAuditoria(seleccionado.monto) }}</dd>
        <template v-if="seleccionado.medioPago">
          <dt>Medio de pago</dt>
          <dd>{{ seleccionado.medioPago === 'VIRTUAL' ? 'Virtual' : 'Presencial' }}</dd>
          <dt>Comprobante</dt>
          <dd>{{ seleccionado.numeroComprobante }}</dd>
        </template>
        <dt>Estado</dt>
        <dd>
          <span class="cambio">
            <span v-if="seleccionado.estadoAnterior" class="estado" :class="claseEstado(seleccionado.estadoAnterior)">
              {{ nombrarEstadoFinanciero(seleccionado.estadoAnterior) }}
            </span>
            <span v-else class="sin-estado">—</span>
            <span aria-hidden="true">→</span>
            <span class="estado" :class="claseEstado(seleccionado.estadoNuevo)">
              {{ nombrarEstadoFinanciero(seleccionado.estadoNuevo) }}
            </span>
          </span>
        </dd>
        <dt>Registrado por</dt>
        <dd>{{ describirResponsable(seleccionado) }}</dd>
      </dl>

      <section v-if="seleccionado.boletaId" class="historial" aria-label="Historial de la boleta">
        <h3>Historial de esta boleta</h3>
        <p v-if="cargandoHistorial" class="ayuda">Cargando historial…</p>
        <AvisoMensaje v-else-if="errorHistorial" :mensaje="errorHistorial" tipo="error" />
        <ol v-else>
          <li
            v-for="paso in historial"
            :key="paso.id"
            :class="[claseAccion(paso), { actual: paso.id === seleccionado.id }]"
          >
            <strong>
              {{ separarFechaHoraAuditoria(paso.fechaHora).fecha.slice(0, 5) }} ·
              {{ NOMBRES_ACCION_FINANCIERA[paso.accion] }}
              <template v-if="paso.accion === 'PAGO_REGISTRADO'"> · {{ formatearMontoAuditoria(paso.monto) }}</template>
            </strong>
            <small>{{ describirResponsable(paso) }}</small>
          </li>
        </ol>
      </section>
    </aside>
  </main>
</template>

<style scoped>
.pagina-auditoria-finanzas {
  max-width: 1600px;
  margin: auto;
  padding: 32px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

.encabezado p,
.ayuda,
small {
  color: #64748b;
}

.encabezado p {
  margin: 0;
}

.ayuda {
  font-size: 13px;
}

.tarjeta {
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: white;
}

.filtros {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.filtros label {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}

.filtros input,
.filtros select {
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  font: inherit;
  font-size: 14px;
  font-weight: 400;
}

.ancho-doble {
  grid-column: span 2;
}

.pie-filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
}

.boton {
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #004ac6;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.boton:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.resumen {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 18px 0 12px;
  padding: 0;
  list-style: none;
}

.resumen li {
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: white;
  font-size: 14px;
}

.listado {
  margin-top: 12px;
  padding: 0;
  overflow: hidden;
}

.vacio {
  padding: 32px 16px;
  color: #64748b;
  text-align: center;
}

.vacio p {
  margin: 0 0 4px;
}

.tabla-contenedor {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  padding: 10px 14px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  letter-spacing: 0.02em;
  text-align: left;
  text-transform: uppercase;
}

td {
  padding: 12px 14px;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}

td small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover,
tbody tr.elegido {
  background: #eff6ff;
}

tbody tr:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: -2px;
}

td:last-child .cambio {
  flex-wrap: nowrap;
}

.fecha {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.accion {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.pago-registrado {
  background: #dcfce7;
  color: #166534;
}

.boleta-en-mora {
  background: #fee2e2;
  color: #991b1b;
}

.boleta-generada {
  background: #e0e7ff;
  color: #3730a3;
}

.compromiso-generado {
  background: #f3e8ff;
  color: #6b21a8;
}

.cambio {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: #64748b;
}

.estado {
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.pendiente {
  background: #fef3c7;
  color: #92400e;
}

.pagada {
  background: #dcfce7;
  color: #166534;
}

.en-mora {
  background: #fee2e2;
  color: #991b1b;
}

.activo {
  background: #f1f5f9;
  color: #334155;
}

.paginacion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  color: #64748b;
  font-size: 14px;
}

.paginacion .botones {
  display: flex;
  gap: 8px;
}

.tarjetas-movil {
  display: none;
}

.fondo {
  position: fixed;
  z-index: 40;
  inset: 0;
  background: rgb(15 23 42 / 25%);
}

.detalle {
  position: fixed;
  z-index: 41;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 100%);
  overflow-y: auto;
  padding: 20px;
  background: white;
  box-shadow: -8px 0 24px rgb(15 23 42 / 15%);
}

.detalle header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detalle h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.cerrar {
  width: 36px;
  height: 36px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  font-size: 16px;
  cursor: pointer;
}

.detalle dl {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  gap: 8px 12px;
  margin: 18px 0;
  font-size: 14px;
}

.detalle dt {
  color: #64748b;
}

.detalle dd {
  margin: 0;
  font-weight: 600;
}

.detalle dd small {
  display: block;
  font-weight: 400;
}

.historial h3 {
  margin: 0 0 10px;
  font-size: 15px;
}

.historial ol {
  margin: 0;
  padding: 0 0 0 14px;
  border-left: 2px solid #dbe3ef;
  list-style: none;
  font-size: 14px;
}

.historial li {
  position: relative;
  padding: 0 0 12px 10px;
  font-weight: 400;
}

.historial li strong {
  font-weight: 500;
}

.historial li.actual strong {
  font-weight: 700;
}

.historial li small {
  display: block;
}

.historial li::before {
  position: absolute;
  top: 5px;
  left: -21px;
  width: 10px;
  height: 10px;
  border: 2px solid white;
  border-radius: 999px;
  background: #94a3b8;
  content: '';
}

.historial li.pago-registrado::before {
  background: #16a34a;
}

.historial li.boleta-en-mora::before {
  background: #dc2626;
}

.historial li.boleta-generada::before {
  background: #4f46e5;
}

.historial li.pago-registrado,
.historial li.boleta-en-mora,
.historial li.boleta-generada {
  background: none;
  color: inherit;
}

@media (max-width: 1100px) {
  .filtros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .pagina-auditoria-finanzas {
    padding: 16px;
  }

  .filtros {
    grid-template-columns: minmax(0, 1fr);
  }

  .ancho-doble {
    grid-column: auto;
  }

  .tabla-contenedor {
    display: none;
  }

  .tarjetas-movil {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 12px;
    list-style: none;
  }

  .tarjetas-movil button {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    background: white;
    color: inherit;
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }

  .fila-superior {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .detalle dl {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
