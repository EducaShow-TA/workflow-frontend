<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  NOMBRES_ESTADO_BOLETA,
  NOMBRES_SITUACION_COMPROMISO,
  boletasPagadas,
  boletasPorPagar,
  fechaPago,
  formatearSolesFamilia,
  nombrarMesBoleta,
  usePagosFamilia,
} from '~/composables/usePagosFamilia'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { BoletaFamilia, DeudaFamilia, PagosHijo } from '~/types/familia'

definePageMeta({ middleware: 'autenticacion', layout: 'familia' })

const HISTORIAL_VISIBLE = 5

const ruta = useRoute()
const autenticacion = useAutenticacionStore()
const { listarPagos, descargarComprobante } = usePagosFamilia()

const hijos = ref<PagosHijo[]>([])
const estudianteId = ref<number | null>(null)
const compromisoId = ref<number | null>(null)
const seleccion = ref<number[]>([])
const verTodoHistorial = ref(false)
const cargando = ref(true)
const error = ref('')
const errorDescarga = ref('')
const descargandoId = ref<number | null>(null)
const modalAbierto = ref(false)

const hijo = computed(() => hijos.value.find((item) => item.estudianteId === estudianteId.value) ?? null)
const compromiso = computed(
  () =>
    hijo.value?.compromisos.find((item) => item.compromisoId === compromisoId.value) ??
    hijo.value?.compromisos[0] ??
    null,
)
const porPagar = computed(() => (compromiso.value ? boletasPorPagar(compromiso.value) : []))
const pagadas = computed(() => (compromiso.value ? boletasPagadas(compromiso.value) : []))
const historialVisible = computed(() =>
  verTodoHistorial.value ? pagadas.value : pagadas.value.slice(0, HISTORIAL_VISIBLE),
)
const enMora = computed(() => porPagar.value.filter((boleta) => boleta.estadoPago === 'EN_MORA').length)
const deudaTotal = computed(() => sumar(porPagar.value))
const seleccionadas = computed(() => porPagar.value.filter((boleta) => seleccion.value.includes(boleta.boletaId)))
const totalSeleccionado = computed(() => sumar(seleccionadas.value))
const todasMarcadas = computed(() => porPagar.value.length > 0 && seleccionadas.value.length === porPagar.value.length)
const deudasSeleccionadas = computed<DeudaFamilia[]>(() => {
  const actual = hijo.value
  return actual
    ? seleccionadas.value.map((boleta) => ({
        estudianteId: actual.estudianteId,
        nombreHijo: actual.nombreCompleto,
        boleta,
      }))
    : []
})
const avance = computed(() => {
  const actual = compromiso.value
  if (!actual || !actual.numeroCuotas) return { pagado: 0, mora: 0, pendiente: 0 }
  const porcentaje = (cuotas: number) => `${(cuotas / actual.numeroCuotas) * 100}%`
  return {
    pagado: porcentaje(actual.cuotasPagadas),
    mora: porcentaje(actual.cuotasEnMora),
    pendiente: porcentaje(actual.cuotasPendientes),
  }
})
const porcentajePagado = computed(() =>
  compromiso.value && compromiso.value.montoTotal
    ? Math.round((compromiso.value.montoPagado / compromiso.value.montoTotal) * 100)
    : 0,
)

function sumar(boletas: BoletaFamilia[]): number {
  return Math.round(boletas.reduce((total, boleta) => total + boleta.montoTotal, 0) * 100) / 100
}

function describirHijo(item: PagosHijo): string {
  const reciente = item.compromisos[0]
  return reciente ? `${item.nombreCompleto} · ${reciente.gradoNumero}.° ${reciente.seccion}` : item.nombreCompleto
}

function alternarTodas(): void {
  seleccion.value = todasMarcadas.value ? [] : porPagar.value.map((boleta) => boleta.boletaId)
}

function seleccionarTodas(): void {
  seleccion.value = porPagar.value.map((boleta) => boleta.boletaId)
}

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    hijos.value = await listarPagos()
    const pedido = Number(ruta.query.estudianteId)
    if (!hijos.value.some((item) => item.estudianteId === estudianteId.value)) {
      estudianteId.value = hijos.value.some((item) => item.estudianteId === pedido)
        ? pedido
        : (hijos.value[0]?.estudianteId ?? null)
    }
    seleccionarTodas()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar tus pagos.')
  } finally {
    cargando.value = false
  }
}

async function descargar(boleta: BoletaFamilia): Promise<void> {
  if (!boleta.comprobante) return
  errorDescarga.value = ''
  descargandoId.value = boleta.comprobante.comprobanteId
  try {
    await descargarComprobante(boleta.comprobante.comprobanteId, boleta.comprobante.numeroComprobante)
  } catch (fallo: unknown) {
    errorDescarga.value = obtenerMensajeError(fallo, 'No se pudo descargar el comprobante.')
  } finally {
    descargandoId.value = null
  }
}

watch(estudianteId, () => {
  compromisoId.value = null
  verTodoHistorial.value = false
  seleccionarTodas()
})

watch(compromisoId, seleccionarTodas)

onMounted(cargar)
</script>

<template>
  <main class="docente-vista pagos-familia">
    <div class="docente-titulo">
      <div>
        <h1>Pagos</h1>
        <p>Paga las pensiones de tus hijos y descarga tus comprobantes.</p>
      </div>
    </div>

    <PanelEstadoCarga v-if="cargando && !hijos.length" :cargando="cargando" @reintentar="cargar" />
    <PanelEstadoCarga v-else-if="error" :cargando="false" :error="error" @reintentar="cargar" />

    <AvisoMensaje
      v-else-if="!hijos.length"
      tipo="advertencia"
      mensaje="Tu cuenta aún no tiene estudiantes vinculados. Comunícate con la secretaría del colegio."
    />

    <template v-else>
      <div v-if="hijos.length > 1" class="selector-hijos" role="group" aria-label="Elegir hijo">
        <button
          v-for="item in hijos"
          :key="item.estudianteId"
          type="button"
          :class="{ activo: item.estudianteId === estudianteId }"
          :aria-pressed="item.estudianteId === estudianteId"
          @click="estudianteId = item.estudianteId"
        >
          {{ describirHijo(item) }}
        </button>
      </div>

      <AvisoMensaje v-if="errorDescarga" :mensaje="errorDescarga" tipo="error" />

      <AvisoMensaje
        v-if="hijo && !compromiso"
        :mensaje="`${hijo.nombreCompleto} aún no tiene un compromiso de pago. Se genera cuando el colegio confirma su matrícula.`"
      />

      <template v-else-if="compromiso">
        <section class="docente-tarjeta compromiso" aria-label="Compromiso de pago">
          <div class="compromiso-datos">
            <small>Compromiso de pago {{ compromiso.anio }} · Titular: {{ compromiso.apoderadoTitular }}</small>
            <h2>{{ compromiso.concepto }}</h2>
            <span class="situacion" :class="compromiso.situacion.toLowerCase()">
              ● {{ NOMBRES_SITUACION_COMPROMISO[compromiso.situacion] }}
            </span>
            <label v-if="hijo && hijo.compromisos.length > 1" class="selector-anio">
              Año
              <select v-model.number="compromisoId">
                <option v-for="item in hijo.compromisos" :key="item.compromisoId" :value="item.compromisoId">
                  {{ item.anio }}
                </option>
              </select>
            </label>
          </div>
          <div class="compromiso-avance">
            <div class="avance-texto">
              <span
                ><strong>{{ formatearSolesFamilia(compromiso.montoPagado) }}</strong> pagado de
                {{ formatearSolesFamilia(compromiso.montoTotal) }}</span
              >
              <span>{{ porcentajePagado }} %</span>
            </div>
            <div class="barra" aria-hidden="true">
              <i class="pagado" :style="{ width: avance.pagado }" />
              <i class="mora" :style="{ width: avance.mora }" />
              <i class="pendiente" :style="{ width: avance.pendiente }" />
            </div>
            <p>
              {{ compromiso.numeroCuotas }} cuotas:
              <strong>
                {{ compromiso.cuotasPagadas }} {{ compromiso.cuotasPagadas === 1 ? 'pagada' : 'pagadas' }}
                <template v-if="compromiso.cuotasEnMora"> · {{ compromiso.cuotasEnMora }} en mora</template>
                <template v-if="compromiso.cuotasPendientes">
                  · {{ compromiso.cuotasPendientes }}
                  {{ compromiso.cuotasPendientes === 1 ? 'pendiente' : 'pendientes' }}</template
                >
                <template v-if="compromiso.cuotasPorEmitir"> · {{ compromiso.cuotasPorEmitir }} por emitir</template>
              </strong>
            </p>
          </div>
        </section>

        <section class="seccion" aria-labelledby="titulo-por-pagar">
          <header class="seccion-cabecera">
            <h2 id="titulo-por-pagar">
              Por pagar
              <small v-if="porPagar.length"
                >· {{ porPagar.length }} {{ porPagar.length === 1 ? 'boleta' : 'boletas' }}</small
              >
            </h2>
            <span v-if="porPagar.length" class="deuda">
              Deuda total: <strong>{{ formatearSolesFamilia(deudaTotal) }}</strong>
            </span>
          </header>

          <div v-if="!porPagar.length" class="docente-tarjeta al-dia">
            <strong>✔ Estás al día.</strong>
            <span v-if="compromiso.proximaEmision">
              La próxima boleta se emite el {{ fechaPago(compromiso.proximaEmision) }}.
            </span>
          </div>

          <template v-else>
            <AvisoMensaje
              v-if="enMora"
              tipo="error"
              :mensaje="`Tienes ${enMora} ${enMora === 1 ? 'boleta en mora' : 'boletas en mora'}. Te recomendamos pagar primero las más antiguas.`"
            />
            <div class="docente-tarjeta lista-pagar">
              <table class="tabla-pagar">
                <thead>
                  <tr>
                    <th scope="col" class="marca">
                      <input
                        type="checkbox"
                        :checked="todasMarcadas"
                        aria-label="Seleccionar todas las boletas"
                        @change="alternarTodas"
                      />
                    </th>
                    <th scope="col">Mes</th>
                    <th scope="col">Vencimiento</th>
                    <th scope="col">Estado</th>
                    <th scope="col" class="monto">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="boleta in porPagar"
                    :key="boleta.boletaId"
                    :class="{ 'en-mora': boleta.estadoPago === 'EN_MORA' }"
                  >
                    <td class="marca">
                      <input
                        v-model="seleccion"
                        type="checkbox"
                        :value="boleta.boletaId"
                        :aria-label="`Seleccionar ${nombrarMesBoleta(boleta.mesCobro)}`"
                      />
                    </td>
                    <td>
                      <strong>{{ nombrarMesBoleta(boleta.mesCobro) }}</strong>
                    </td>
                    <td>
                      {{ boleta.estadoPago === 'EN_MORA' ? 'Venció' : 'Vence' }}
                      {{ fechaPago(boleta.fechaVencimiento) }}
                    </td>
                    <td>
                      <span class="estado" :class="boleta.estadoPago.toLowerCase()">{{
                        NOMBRES_ESTADO_BOLETA[boleta.estadoPago]
                      }}</span>
                    </td>
                    <td class="monto">{{ formatearSolesFamilia(boleta.montoTotal) }}</td>
                  </tr>
                </tbody>
              </table>
              <footer class="pie-pagar">
                <span>
                  <strong>{{ seleccionadas.length }}</strong>
                  {{ seleccionadas.length === 1 ? 'seleccionada' : 'seleccionadas' }} ·
                  <strong class="total">{{ formatearSolesFamilia(totalSeleccionado) }}</strong>
                </span>
                <button
                  type="button"
                  class="boton-pagar"
                  :disabled="!seleccionadas.length"
                  @click="modalAbierto = true"
                >
                  Consultar medios de pago
                </button>
              </footer>
            </div>
            <p class="nota">
              Las boletas se muestran de la más antigua a la más reciente. Consulta los medios de pago habilitados antes
              de realizar el pago.
            </p>
          </template>
        </section>

        <section class="seccion" aria-labelledby="titulo-historial">
          <header class="seccion-cabecera">
            <h2 id="titulo-historial">Historial de pagos</h2>
            <button
              v-if="pagadas.length > HISTORIAL_VISIBLE"
              type="button"
              class="enlace"
              @click="verTodoHistorial = !verTodoHistorial"
            >
              {{ verTodoHistorial ? 'Ver menos' : `Ver todos (${pagadas.length})` }}
            </button>
          </header>
          <p v-if="!pagadas.length" class="nota">Todavía no hay pagos registrados en este compromiso.</p>
          <div v-else class="docente-tarjeta lista-historial">
            <table class="tabla-historial">
              <thead>
                <tr>
                  <th scope="col">Mes</th>
                  <th scope="col">Pagado el</th>
                  <th scope="col">Medio</th>
                  <th scope="col" class="monto">Monto</th>
                  <th scope="col">Comprobante</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="boleta in historialVisible" :key="boleta.boletaId">
                  <td>
                    <strong>{{ nombrarMesBoleta(boleta.mesCobro) }}</strong>
                  </td>
                  <td>{{ boleta.comprobante ? fechaPago(boleta.comprobante.fechaEmision) : '—' }}</td>
                  <td>{{ boleta.comprobante?.medioPago === 'VIRTUAL' ? 'Virtual' : 'Presencial' }}</td>
                  <td class="monto">
                    {{ formatearSolesFamilia(boleta.comprobante?.montoPagado ?? boleta.montoTotal) }}
                  </td>
                  <td>
                    <button
                      v-if="boleta.comprobante"
                      type="button"
                      class="boton-comprobante"
                      :disabled="descargandoId !== null"
                      @click="descargar(boleta)"
                    >
                      {{
                        descargandoId === boleta.comprobante.comprobanteId
                          ? 'Descargando…'
                          : `⬇ ${boleta.comprobante.numeroComprobante}`
                      }}
                    </button>
                    <span v-else>—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>

    <ModalPagoEnLinea
      :abierta="modalAbierto"
      :deudas="deudasSeleccionadas"
      :titular="autenticacion.usuario?.nombreCompleto"
      @cerrar="modalAbierto = false"
    />
  </main>
</template>

<style scoped>
.docente-titulo p {
  margin: 0;
  color: #64748b;
}

.selector-hijos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selector-hijos button {
  min-height: 38px;
  padding: 6px 14px;
  border: 1px solid #c3c6d7;
  border-radius: 999px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.selector-hijos button.activo {
  border-color: #1e40af;
  background: #1e40af;
  color: white;
  font-weight: 600;
}

.compromiso {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: center;
}

.compromiso-datos {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.compromiso small,
.compromiso-avance p,
.nota {
  color: #64748b;
  font-size: 13px;
}

.compromiso h2 {
  margin: 0;
  font-size: 18px;
}

.situacion {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.situacion.con_mora {
  background: #fee2e2;
  color: #991b1b;
}

.situacion.con_pendientes {
  background: #fef3c7;
  color: #92400e;
}

.situacion.al_dia {
  background: #dcfce7;
  color: #166534;
}

.selector-anio {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}

.selector-anio select {
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid #c3c6d7;
  border-radius: 6px;
  font: inherit;
}

.avance-texto {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 14px;
}

.barra {
  display: flex;
  height: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef0f4;
}

.barra i {
  display: block;
  height: 100%;
}

.barra .pagado {
  background: #16a34a;
}

.barra .mora {
  background: #dc2626;
}

.barra .pendiente {
  background: #f59e0b;
}

.compromiso-avance p {
  margin: 8px 0 0;
}

.compromiso-avance p strong {
  color: #191c1e;
}

.seccion {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.seccion-cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.seccion-cabecera h2 {
  margin: 0;
  font-size: 17px;
}

.seccion-cabecera h2 small {
  color: #64748b;
  font-size: 14px;
  font-weight: 400;
}

.deuda {
  color: #64748b;
  font-size: 14px;
}

.deuda strong {
  color: #dc2626;
}

.al-dia {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  color: #166534;
}

.al-dia span {
  color: #475569;
}

.lista-pagar,
.lista-historial {
  padding: 0;
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  padding: 10px 14px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  text-align: left;
  text-transform: uppercase;
}

td {
  padding: 11px 14px;
  border-bottom: 1px solid #e2e8f0;
}

.marca {
  width: 44px;
}

.marca input {
  width: 18px;
  height: 18px;
}

.monto {
  width: 8rem;
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

tr.en-mora td {
  background: #fff7f7;
}

.estado {
  display: inline-block;
  min-width: 5.5rem;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
}

.estado.en_mora {
  background: #fee2e2;
  color: #991b1b;
}

.estado.pendiente {
  background: #fef3c7;
  color: #92400e;
}

.pie-pagar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  background: #f8fafc;
}

.pie-pagar .total {
  font-size: 17px;
  white-space: nowrap;
}

.boton-pagar {
  min-height: 40px;
  padding: 8px 18px;
  border: 0;
  border-radius: 8px;
  background: #1e40af;
  color: white;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.boton-pagar:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.nota {
  margin: 0;
}

.boton-comprobante,
.enlace {
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  padding: 5px 10px;
  background: white;
  color: #1e40af;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.enlace {
  border: 0;
  padding: 0;
  text-decoration: underline;
}

.boton-comprobante:disabled {
  color: #94a3b8;
  cursor: wait;
}

@media (max-width: 760px) {
  .compromiso {
    grid-template-columns: minmax(0, 1fr);
  }

  .tabla-pagar thead,
  .tabla-historial thead {
    display: none;
  }

  .tabla-pagar tr {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto;
    gap: 2px 8px;
    padding: 10px 12px;
    border-bottom: 1px solid #e2e8f0;
  }

  .tabla-pagar td {
    padding: 0;
    border: 0;
  }

  .tabla-pagar td.marca {
    grid-column: 1;
    grid-row: 1 / span 3;
    align-self: center;
  }

  .tabla-pagar td:nth-child(2) {
    grid-column: 2;
    grid-row: 1;
  }

  .tabla-pagar td:nth-child(3) {
    grid-column: 2;
    grid-row: 2;
    color: #64748b;
    font-size: 13px;
  }

  .tabla-pagar td:nth-child(4) {
    grid-column: 2;
    grid-row: 3;
  }

  .tabla-pagar td.monto {
    grid-column: 3;
    grid-row: 1 / span 3;
    align-self: center;
    width: auto;
  }

  .tabla-historial tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 8px;
    padding: 10px 12px;
    border-bottom: 1px solid #e2e8f0;
  }

  .tabla-historial td {
    padding: 0;
    border: 0;
  }

  .tabla-historial td:nth-child(1) {
    grid-column: 1;
    grid-row: 1;
  }

  .tabla-historial td.monto {
    grid-column: 2;
    grid-row: 1;
    width: auto;
  }

  .tabla-historial td:nth-child(2),
  .tabla-historial td:nth-child(3) {
    grid-row: 2;
    color: #64748b;
    font-size: 13px;
  }

  .tabla-historial td:nth-child(2) {
    grid-column: 1;
  }

  .tabla-historial td:nth-child(3) {
    grid-column: 2;
    text-align: right;
  }

  .tabla-historial td:last-child {
    grid-column: 1 / -1;
    grid-row: 3;
  }

  .tabla-pagar tr.en-mora {
    background: #fff7f7;
  }

  .tabla-pagar tr.en-mora td {
    background: transparent;
  }

  .pie-pagar {
    position: sticky;
    bottom: 0;
  }

  .boton-pagar {
    width: 100%;
  }
}
</style>
