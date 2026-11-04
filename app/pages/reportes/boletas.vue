<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { formatearFecha } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import { crearFiltrosReporte, useReporteBoletas, validarFechasReporte } from '~/composables/useReporteBoletas'
import type { PeriodoAcademico } from '~/types/periodoAcademico'
import type { ReporteBoletas } from '~/types/reporteBoletas'

definePageMeta({ middleware: 'autenticacion' })

const { consultar } = useReporteBoletas()
const { listar } = usePeriodosAcademicos()
const filtros = reactive(crearFiltrosReporte())
const filtrosAplicados = ref(crearFiltrosReporte())
const reporte = ref<ReporteBoletas | null>(null)
const periodos = ref<PeriodoAcademico[]>([])
const cargando = ref(false)
const cargandoCatalogo = ref(false)
const errorConsulta = ref('')
const errorCatalogo = ref('')
const ultimaConsulta = ref('')
const pagina = ref(1)
const tamanioPagina = 20
let ultimaSolicitud = 0
const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

const grados = computed(() =>
  [...new Map(periodos.value.map((periodo) => [periodo.gradoId, periodo.numeroGrado])).entries()]
    .map(([id, numero]) => ({ id, numero }))
    .sort((primero, segundo) => primero.numero - segundo.numero),
)
const secciones = computed(() =>
  [
    ...new Map(
      periodos.value
        .filter((periodo) => !filtros.gradoId || String(periodo.gradoId) === filtros.gradoId)
        .map((periodo) => [
          periodo.seccionId,
          { id: periodo.seccionId, nombre: periodo.seccion, grado: periodo.numeroGrado },
        ]),
    ).values(),
  ].sort((primera, segunda) => primera.grado - segunda.grado || primera.nombre.localeCompare(segunda.nombre)),
)
const errorFechas = computed(() => validarFechasReporte(filtros))
const cambiosSinAplicar = computed(() => JSON.stringify(filtros) !== JSON.stringify(filtrosAplicados.value))
const boletas = computed(() => reporte.value?.boletas ?? [])
const totalPaginas = computed(() => Math.max(1, Math.ceil(boletas.value.length / tamanioPagina)))
const boletasVisibles = computed(() =>
  boletas.value.slice((pagina.value - 1) * tamanioPagina, pagina.value * tamanioPagina),
)
const resumenFiltros = computed(() => {
  const aplicados = filtrosAplicados.value
  const grado = grados.value.find((opcion) => String(opcion.id) === aplicados.gradoId)
  const periodo = periodos.value.find((opcion) => String(opcion.seccionId) === aplicados.seccionId)
  return [
    grado ? `${grado.numero}.º de secundaria` : 'Todos los grados',
    periodo ? `Sección ${periodo.seccion}` : 'Todas las secciones',
    aplicados.estado === 'PENDIENTE'
      ? 'Pendientes'
      : aplicados.estado === 'EN_MORA'
        ? 'En mora'
        : 'Pendientes y en mora',
    aplicados.vencimientoDesde ? `Desde ${formatearFecha(aplicados.vencimientoDesde)}` : '',
    aplicados.vencimientoHasta ? `Hasta ${formatearFecha(aplicados.vencimientoHasta)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

watch(
  () => filtros.gradoId,
  () => {
    filtros.seccionId = ''
  },
)

// Cada selección aplica los filtros. Las respuestas anteriores no deben reemplazar la última selección.
watch(
  filtros,
  () => {
    void generarReporte()
  },
  { deep: true },
)
onUnmounted(() => {
  ultimaSolicitud++
})

async function cargarCatalogo(): Promise<void> {
  cargandoCatalogo.value = true
  errorCatalogo.value = ''
  try {
    periodos.value = await listar()
  } catch (error: unknown) {
    errorCatalogo.value = obtenerMensajeError(error, 'No se pudieron cargar los grados y secciones.')
  } finally {
    cargandoCatalogo.value = false
  }
}

async function generarReporte(): Promise<void> {
  const solicitud = ++ultimaSolicitud
  reporte.value = null
  errorConsulta.value = ''
  if (errorFechas.value) {
    cargando.value = false
    return
  }
  const seleccion = { ...filtros }
  cargando.value = true
  errorConsulta.value = ''
  reporte.value = null
  try {
    const resultado = await consultar(seleccion)
    if (solicitud !== ultimaSolicitud) return
    reporte.value = resultado
    filtrosAplicados.value = seleccion
    pagina.value = 1
    ultimaConsulta.value = new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(),
    )
  } catch (error: unknown) {
    if (solicitud !== ultimaSolicitud) return
    errorConsulta.value = obtenerMensajeError(error, 'No se pudo generar el reporte. Intenta nuevamente.')
  } finally {
    if (solicitud === ultimaSolicitud) cargando.value = false
  }
}

function limpiarFiltros(): void {
  const yaEstanLimpios = JSON.stringify(filtros) === JSON.stringify(crearFiltrosReporte())
  Object.assign(filtros, crearFiltrosReporte())
  if (yaEstanLimpios) void generarReporte()
}

onMounted(async () => {
  await Promise.all([cargarCatalogo(), generarReporte()])
})
</script>

<template>
  <main class="pagina-reporte">
    <header class="encabezado">
      <p class="ubicacion">Reportes / Cobranza</p>
      <h1>Boletas pendientes y en mora</h1>
      <p>Consulta la deuda por estudiante y apoderado para dar seguimiento a la cobranza del colegio.</p>
    </header>

    <section class="tarjeta" aria-labelledby="titulo-filtros">
      <h2 id="titulo-filtros">Filtros del reporte</h2>
      <p class="actualizacion">Los resultados se actualizan automáticamente al cambiar los filtros.</p>
      <div v-if="errorCatalogo" class="aviso aviso-error" role="alert">
        {{ errorCatalogo }} Puedes consultar todos los grados mientras tanto.
        <button type="button" class="enlace" :disabled="cargandoCatalogo" @click="cargarCatalogo">
          Reintentar carga
        </button>
      </div>
      <form @submit.prevent="generarReporte">
        <fieldset class="filtros">
          <label
            >Grado
            <select v-model="filtros.gradoId" :disabled="cargandoCatalogo || !!errorCatalogo">
              <option value="">Todos los grados</option>
              <option v-for="grado in grados" :key="grado.id" :value="String(grado.id)">
                {{ grado.numero }}.º de secundaria
              </option>
            </select>
          </label>
          <label
            >Sección
            <select v-model="filtros.seccionId" :disabled="cargandoCatalogo || !!errorCatalogo">
              <option value="">Todas las secciones</option>
              <option v-for="seccion in secciones" :key="seccion.id" :value="String(seccion.id)">
                {{ seccion.nombre }} · {{ seccion.grado }}.º de secundaria
              </option>
            </select>
          </label>
          <label
            >Estado de la boleta
            <select v-model="filtros.estado">
              <option value="">Pendientes y en mora</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_MORA">En mora</option>
            </select>
          </label>
          <label
            >Vencimiento desde
            <input
              v-model="filtros.vencimientoDesde"
              type="date"
              :aria-invalid="!!errorFechas"
              :aria-describedby="errorFechas ? 'error-fechas' : undefined"
            />
          </label>
          <label
            >Vencimiento hasta
            <input
              v-model="filtros.vencimientoHasta"
              type="date"
              :aria-invalid="!!errorFechas"
              :aria-describedby="errorFechas ? 'error-fechas' : undefined"
            />
          </label>
        </fieldset>
        <p v-if="errorFechas" id="error-fechas" class="texto-error" role="alert">{{ errorFechas }}</p>
        <div class="acciones">
          <button type="submit" class="boton primario" :disabled="cargando || !!errorFechas">
            {{ cargando ? 'Consultando…' : 'Generar reporte' }}
          </button>
          <button type="button" class="boton secundario" :disabled="cargando" @click="limpiarFiltros">
            Limpiar filtros
          </button>
        </div>
      </form>
    </section>

    <p v-if="cargando" class="aviso" role="status">Consultando las boletas del colegio…</p>
    <div v-else-if="errorConsulta" class="aviso aviso-error" role="alert">
      {{ errorConsulta }}
      <button type="button" class="enlace" @click="generarReporte">Reintentar consulta</button>
    </div>

    <template v-if="reporte && !cargando && !cambiosSinAplicar">
      <p v-if="cambiosSinAplicar" class="aviso" role="status">
        Hay filtros sin aplicar. Pulsa «Generar reporte» para actualizar los resultados.
      </p>
      <div class="resumen" aria-label="Resumen del reporte">
        <article class="tarjeta">
          <p>Monto total pendiente</p>
          <strong>{{ moneda.format(reporte.montoPendiente) }}</strong
          ><small>Incluye los recargos de las boletas seleccionadas.</small>
        </article>
        <article class="tarjeta">
          <p>Familias morosas</p>
          <strong>{{ reporte.familiasMorosas }}</strong
          ><small>Apoderados titulares con al menos una boleta en mora.</small>
        </article>
        <article class="tarjeta">
          <p>Boletas por cobrar</p>
          <strong>{{ boletas.length }}</strong
          ><small>Según los filtros aplicados.</small>
        </article>
      </div>
      <section class="tarjeta" aria-labelledby="titulo-detalle" :aria-busy="cargando">
        <h2 id="titulo-detalle">Detalle de cobranza</h2>
        <p class="filtros-aplicados">{{ resumenFiltros }}</p>
        <p class="actualizacion">
          Última consulta: {{ ultimaConsulta }}. Los totales incluyen todas las páginas del reporte.
        </p>
        <div v-if="!boletas.length" class="vacio" role="status">
          <h3>No hay boletas para estos filtros</h3>
          <p>
            Prueba con otro estado o rango de vencimiento. Si la base es nueva, primero deben existir matrículas y
            boletas generadas.
          </p>
        </div>
        <template v-else>
          <div
            class="tabla-contenedor"
            tabindex="0"
            role="region"
            aria-label="Detalle de boletas, desplazamiento horizontal"
          >
            <table>
              <caption class="solo-lectores">
                Boletas pendientes y en mora por estudiante y apoderado
              </caption>
              <thead>
                <tr>
                  <th scope="col">Boleta</th>
                  <th scope="col">Estudiante</th>
                  <th scope="col">Apoderado titular</th>
                  <th scope="col">Grado / Sección</th>
                  <th scope="col">Mes de cobro</th>
                  <th scope="col">Vencimiento</th>
                  <th scope="col">Estado</th>
                  <th scope="col" class="importe">Pensión</th>
                  <th scope="col" class="importe">Mora</th>
                  <th scope="col" class="importe">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="boleta in boletasVisibles" :key="boleta.id">
                  <td>#{{ boleta.id }}</td>
                  <td>{{ boleta.estudiante }}</td>
                  <td>{{ boleta.apoderado }}</td>
                  <td>{{ boleta.grado }}.º / {{ boleta.seccion }}</td>
                  <td>{{ boleta.mesCobro }}</td>
                  <td>{{ formatearFecha(boleta.fechaVencimiento) }}</td>
                  <td>
                    <span class="estado" :class="{ mora: boleta.estadoPago === 'EN_MORA' }">{{
                      boleta.estadoPago === 'EN_MORA' ? 'En mora' : 'Pendiente'
                    }}</span>
                  </td>
                  <td class="importe">{{ moneda.format(boleta.monto) }}</td>
                  <td class="importe">{{ moneda.format(boleta.mora) }}</td>
                  <td class="importe total">{{ moneda.format(boleta.montoTotal) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <nav class="paginacion" aria-label="Páginas del reporte">
            <span>{{ boletas.length }} boletas · Página {{ pagina }} de {{ totalPaginas }}</span>
            <div class="acciones">
              <button type="button" class="boton secundario" :disabled="pagina === 1" @click="pagina--">Anterior</button
              ><button type="button" class="boton secundario" :disabled="pagina === totalPaginas" @click="pagina++">
                Siguiente
              </button>
            </div>
          </nav>
        </template>
      </section>
    </template>
  </main>
</template>

<style scoped>
.pagina-reporte {
  max-width: 1600px;
  padding: 32px;
  margin: 0 auto;
}
.encabezado {
  margin-bottom: 24px;
}
h1 {
  margin: 8px 0 12px;
  font-size: 28px;
}
h2 {
  margin: 0 0 18px;
  font-size: 18px;
}
p {
  line-height: 1.5;
}
.encabezado > p,
.actualizacion,
small {
  color: var(--color-text-secondary);
}
.ubicacion {
  font-size: 13px;
}
.tarjeta {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
}
.filtros {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}
select,
input {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px 10px;
  background: white;
  color: var(--color-text);
}
.acciones {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
form > .acciones {
  margin-top: 20px;
}
.boton {
  min-height: 42px;
  padding: 9px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}
.primario {
  background: var(--color-primary);
  color: white;
  border: 1px solid var(--color-primary);
}
.secundario {
  background: white;
  border: 1px solid #cbd5e1;
  color: var(--color-text);
}
button:disabled,
select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.aviso {
  padding: 16px;
  margin: 20px 0;
  background: #eff6ff;
  border-radius: 8px;
  color: #1e40af;
}
.aviso-error {
  background: #fef2f2;
  color: #991b1b;
}
.texto-error {
  color: #991b1b;
}
.enlace {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-decoration: underline;
  padding: 8px;
}
.resumen {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin: 24px 0;
}
.resumen p {
  margin: 0 0 12px;
}
.resumen strong {
  display: block;
  font-size: 30px;
  margin-bottom: 12px;
  font-variant-numeric: tabular-nums;
}
small {
  display: block;
  line-height: 1.5;
}
.filtros-aplicados {
  font-size: 14px;
}
.actualizacion {
  font-size: 12px;
  margin-bottom: 20px;
}
.tabla-contenedor {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
th,
td {
  padding: 14px 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}
th {
  background: #f8fafc;
  font-size: 12px;
  color: #475569;
}
.importe {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.total {
  font-weight: 600;
}
.estado {
  display: inline-block;
  border-radius: 20px;
  padding: 5px 10px;
  background: #fff7ed;
  color: #9a3412;
  white-space: nowrap;
  font-size: 12px;
}
.estado.mora {
  color: #991b1b;
  background: #fef2f2;
}
.vacio {
  padding: 32px 16px;
  text-align: center;
}
.paginacion {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  font-size: 13px;
  flex-wrap: wrap;
}
.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
:focus-visible {
  outline: 3px solid #93b4fa;
  outline-offset: 3px;
}
@media (max-width: 1100px) {
  .filtros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .resumen {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .pagina-reporte {
    padding: 16px;
  }
  .filtros {
    grid-template-columns: 1fr;
  }
  .tarjeta {
    padding: 18px;
  }
  h1 {
    font-size: 24px;
  }
}
</style>
