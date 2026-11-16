<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { crearFiltrosBoletas, etiquetaEstadoBoleta, useBoletasPension } from '~/composables/useBoletasPension'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import { formatearFecha } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import type { BoletaPension } from '~/types/boletaPension'
import type { PeriodoAcademico } from '~/types/periodoAcademico'

definePageMeta({ middleware: 'autenticacion' })
const api = useBoletasPension()
const catalogoPeriodos = usePeriodosAcademicos()
const filtros = reactive(crearFiltrosBoletas())
const boletas = ref<BoletaPension[]>([])
const estudiantes = ref<{ id: number; nombre: string }[]>([])
const periodos = ref<PeriodoAcademico[]>([])
const cargando = ref(false)
const cargandoCatalogos = ref(false)
const error = ref('')
const errorCatalogos = ref('')
const detalleId = ref<number | null>(null)
const pagoEnCurso = ref(false)
const pagina = ref(1)
const tamanio = 20
let ultimaSolicitud = 0
const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const paginas = ref(1)
const totalBoletas = ref(0)
const visibles = computed(() => boletas.value)
const boletaManualAbierta = ref(false)
const avisoBoletaManual = ref('')

async function alGenerarBoletaManual(boleta: BoletaPension): Promise<void> {
  boletaManualAbierta.value = false
  avisoBoletaManual.value = `Se generó la boleta #${boleta.id} de ${boleta.estudiante} para ${boleta.mesCobro} (manual).`
  await Promise.all([cargarCatalogos(), consultar()])
}

async function cargarCatalogos(): Promise<void> {
  cargandoCatalogos.value = true
  errorCatalogos.value = ''
  try {
    const [opcionesEstudiante, opcionesPeriodo] = await Promise.all([api.estudiantes(), catalogoPeriodos.listar()])
    estudiantes.value = opcionesEstudiante
    periodos.value = opcionesPeriodo
  } catch (fallo: unknown) {
    errorCatalogos.value = obtenerMensajeError(fallo, 'No se pudieron cargar las opciones de estudiante y período.')
  } finally {
    cargandoCatalogos.value = false
  }
}

async function consultar(numero = pagina.value): Promise<void> {
  const solicitud = ++ultimaSolicitud
  const seleccion = { ...filtros }
  cargando.value = true
  boletas.value = []
  error.value = ''
  try {
    const resultado = await api.listarPagina(seleccion, numero - 1, tamanio)
    if (solicitud !== ultimaSolicitud) return
    if (resultado.totalPages > 0 && numero > resultado.totalPages) {
      await consultar(resultado.totalPages)
      return
    }
    boletas.value = resultado.content
    pagina.value = resultado.number + 1
    paginas.value = Math.max(1, resultado.totalPages)
    totalBoletas.value = resultado.totalElements
  } catch (fallo: unknown) {
    if (solicitud === ultimaSolicitud) error.value = obtenerMensajeError(fallo, 'No se pudieron consultar las boletas.')
  } finally {
    if (solicitud === ultimaSolicitud) cargando.value = false
  }
}

function limpiar(): void {
  const iguales = JSON.stringify(filtros) === JSON.stringify(crearFiltrosBoletas())
  Object.assign(filtros, crearFiltrosBoletas())
  if (iguales) void consultar(1)
}

watch(
  filtros,
  () => {
    void consultar(1)
  },
  { deep: true },
)
onUnmounted(() => {
  ultimaSolicitud++
})
onMounted(async () => {
  await Promise.all([cargarCatalogos(), consultar()])
})
</script>

<template>
  <main class="pagina-finanzas">
    <header class="encabezado-finanzas">
      <div>
        <p class="ruta">Finanzas / Pensiones</p>
        <h1>Boletas de pensiones</h1>
        <p>Consulta las boletas generadas, registra pagos recibidos y revisa el reporte de cobranza.</p>
      </div>
      <button type="button" class="boton primario" @click="boletaManualAbierta = true">+ Generar boleta manual</button>
    </header>
    <AvisoMensaje
      v-if="avisoBoletaManual"
      :mensaje="avisoBoletaManual"
      tipo="exito"
      cerrable
      @cerrar="avisoBoletaManual = ''"
    />
    <ModalBoletaManual
      :abierta="boletaManualAbierta"
      :estudiantes="estudiantes"
      @cerrar="boletaManualAbierta = false"
      @generada="alGenerarBoletaManual"
    />
    <section class="tarjeta" aria-labelledby="filtros-boletas">
      <h2 id="filtros-boletas">Consultar boletas</h2>
      <p class="ayuda">
        Los filtros se aplican automáticamente. Los estudiantes listados son quienes tienen boletas generadas.
      </p>
      <p v-if="errorCatalogos" class="error" role="alert">
        {{ errorCatalogos }}
        <button class="boton" type="button" :disabled="cargandoCatalogos" @click="cargarCatalogos">
          Reintentar opciones
        </button>
      </p>
      <form @submit.prevent="consultar()">
        <div class="filtros">
          <label
            >Estudiante<select v-model="filtros.estudianteId" :disabled="cargandoCatalogos || !!errorCatalogos">
              <option value="">Todos los estudiantes</option>
              <option v-for="estudiante in estudiantes" :key="estudiante.id" :value="String(estudiante.id)">
                {{ estudiante.nombre }} · #{{ estudiante.id }}
              </option>
            </select></label
          >
          <label
            >Período académico<select v-model="filtros.periodoId" :disabled="cargandoCatalogos || !!errorCatalogos">
              <option value="">Todos los períodos</option>
              <option v-for="periodo in periodos" :key="periodo.periodoId" :value="String(periodo.periodoId)">
                {{ periodo.numeroGrado }}.º {{ periodo.seccion }} · {{ formatearFecha(periodo.fechaInicio) }} —
                {{ formatearFecha(periodo.fechaFin) }}
              </option>
            </select></label
          >
          <label
            >Estado<select v-model="filtros.estado">
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_MORA">En mora</option>
              <option value="PAGADA">Pagada</option>
            </select></label
          >
          <label>Mes de cobro<input v-model="filtros.mes" type="month" /></label>
        </div>
        <div class="acciones">
          <button type="submit" class="boton primario" :disabled="cargando">Actualizar boletas</button
          ><button type="button" class="boton" @click="limpiar">Limpiar filtros</button
          ><NuxtLink class="enlace" to="/reportes/boletas">Ver reporte de cobranza</NuxtLink>
        </div>
      </form>
    </section>

    <DetalleBoletaPension
      v-if="detalleId !== null"
      :id="detalleId"
      :key="detalleId"
      @cerrar="detalleId = null"
      @pagada="consultar()"
      @ocupada="pagoEnCurso = $event"
    />

    <section class="tarjeta listado" aria-labelledby="titulo-listado" :aria-busy="cargando">
      <h2 id="titulo-listado">Boletas generadas</h2>
      <p v-if="cargando" role="status">Consultando las boletas en el servidor…</p>
      <p v-else-if="error" class="error" role="alert">
        {{ error }} <button type="button" class="boton" @click="consultar()">Reintentar</button>
      </p>
      <div v-else-if="!boletas.length" class="vacio" role="status">
        <h3>No hay boletas para estos filtros</h3>
        <p>Modifica la selección o consulta nuevamente cuando se hayan generado boletas.</p>
      </div>
      <template v-else>
        <p class="ayuda">
          {{ totalBoletas }} boletas encontradas. Abre el detalle para consultar comprobantes o registrar un pago
          aprobado.
        </p>
        <div class="tabla-contenedor" tabindex="0" role="region" aria-label="Boletas, desplazamiento horizontal">
          <table>
            <caption>
              Listado de boletas según los filtros seleccionados
            </caption>
            <thead>
              <tr>
                <th scope="col">Boleta</th>
                <th scope="col">Estudiante / Apoderado</th>
                <th scope="col">Grado / Sección</th>
                <th scope="col">Mes</th>
                <th scope="col">Vencimiento</th>
                <th scope="col">Estado</th>
                <th scope="col" class="importe">Total</th>
                <th scope="col">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="boleta in visibles" :key="boleta.id">
                <td>
                  #{{ boleta.id }}<small>{{ boleta.mecanismoGeneracion === 'MANUAL' ? 'Manual' : 'Automática' }}</small>
                </td>
                <td>
                  {{ boleta.estudiante }}<small>{{ boleta.apoderado }}</small>
                </td>
                <td>{{ boleta.grado }}.º / {{ boleta.seccion }}</td>
                <td>{{ boleta.mesCobro }}</td>
                <td>{{ formatearFecha(boleta.fechaVencimiento) }}</td>
                <td>
                  <span class="estado" :class="boleta.estadoPago.toLowerCase()">{{
                    etiquetaEstadoBoleta(boleta.estadoPago)
                  }}</span>
                </td>
                <td class="importe">{{ moneda.format(boleta.montoTotal) }}</td>
                <td>
                  <button
                    type="button"
                    class="boton"
                    :disabled="pagoEnCurso"
                    :aria-label="`Ver detalle de boleta ${boleta.id}`"
                    @click="detalleId = boleta.id"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <nav class="paginacion" aria-label="Páginas de boletas">
          <span>Página {{ pagina }} de {{ paginas }}</span>
          <div>
            <button class="boton" type="button" :disabled="pagina === 1" @click="consultar(pagina - 1)">Anterior</button
            ><button class="boton" type="button" :disabled="pagina === paginas" @click="consultar(pagina + 1)">
              Siguiente
            </button>
          </div>
        </nav>
      </template>
    </section>
  </main>
</template>

<style scoped>
.pagina-finanzas {
  padding: 32px;
  max-width: 1600px;
  margin: auto;
}
header {
  margin-bottom: 24px;
}
.encabezado-finanzas {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
h1 {
  font-size: 28px;
  margin: 8px 0 12px;
}
h2 {
  font-size: 18px;
  margin: 0 0 16px;
}
p {
  line-height: 1.6;
}
.ruta,
.ayuda,
header > p,
small {
  color: #64748b;
}
.ruta,
.ayuda {
  font-size: 13px;
}
.tarjeta {
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 12px;
  padding: 24px;
}
.listado {
  margin-top: 24px;
}
.filtros {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}
input,
select {
  min-width: 0;
  width: 100%;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
}
.acciones {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 20px;
}
.boton {
  padding: 10px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}
.primario {
  background: #1e40af;
  border-color: #1e40af;
  color: white;
}
.boton.pagar {
  margin-left: 6px;
  white-space: nowrap;
}
.boton:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.enlace {
  color: #1e40af;
}
.error {
  color: #991b1b;
  background: #fef2f2;
  padding: 16px;
  border-radius: 8px;
}
.vacio {
  padding: 24px;
  text-align: center;
}
.tabla-contenedor {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
caption {
  text-align: left;
  padding: 8px 0 16px;
  color: #64748b;
  font-size: 12px;
}
th,
td {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
}
th {
  background: #f8fafc;
  font-size: 12px;
}
small {
  display: block;
  margin-top: 6px;
}
.importe {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.estado {
  display: inline-block;
  white-space: nowrap;
  padding: 5px 10px;
  border-radius: 20px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 12px;
}
.pagada {
  background: #f0fdf4;
  color: #166534;
}
.en_mora {
  background: #fef2f2;
  color: #991b1b;
}
.paginacion {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
}
.paginacion button + button {
  margin-left: 12px;
}
:focus-visible {
  outline: 3px solid #93b4fa;
  outline-offset: 2px;
}
@media (max-width: 700px) {
  .pagina-finanzas {
    padding: 16px;
  }
  .tarjeta {
    padding: 18px;
  }
  .filtros {
    grid-template-columns: 1fr;
  }
}
</style>
