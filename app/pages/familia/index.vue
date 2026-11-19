<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  NOMBRES_ESTADO,
  VARIANTES_ESTADO,
  calcularRango,
  describirSeccionHijo,
  periodoVigente,
  resumirAsistencia,
  usePortalFamilia,
} from '~/composables/usePortalFamilia'
import {
  deudaFamiliar,
  fechaPago,
  formatearSolesFamilia,
  nombrarMesBoleta,
  primerNombre,
  sumarDeuda,
  NOMBRES_ESTADO_BOLETA,
  usePagosFamilia,
} from '~/composables/usePagosFamilia'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { HijoVinculado, PagosHijo, RegistroAsistencia, ResumenAsistencia } from '~/types/familia'

definePageMeta({ middleware: 'autenticacion', layout: 'familia' })

interface TarjetaHijo {
  hijo: HijoVinculado
  resumen: ResumenAsistencia | null
  incidencias: RegistroAsistencia[]
  error: string
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const autenticacion = useAutenticacionStore()
const { listarHijos, consultarAsistencia } = usePortalFamilia()
const { listarPagos } = usePagosFamilia()
const DEUDAS_VISIBLES = 3

const fechaHoy = obtenerFechaHoyIso()
const tarjetas = ref<TarjetaHijo[]>([])
const cargando = ref(true)
const error = ref('')
const pagos = ref<PagosHijo[]>([])
const errorPagos = ref('')

const deudas = computed(() => deudaFamiliar(pagos.value))
const totalDeuda = computed(() => sumarDeuda(deudas.value))
const deudasEnMora = computed(() => deudas.value.filter((deuda) => deuda.boleta.estadoPago === 'EN_MORA').length)
const hayCompromisos = computed(() => pagos.value.some((hijo) => hijo.compromisos.length > 0))
const proximaEmision = computed(
  () =>
    pagos.value
      .flatMap((hijo) => hijo.compromisos.map((compromiso) => compromiso.proximaEmision))
      .filter((fecha): fecha is string => Boolean(fecha))
      .sort()[0] ?? null,
)

const nombre = computed(() => autenticacion.usuario?.nombreCompleto?.trim().split(/\s+/)[0] ?? '')
const mes = MESES[Number(fechaHoy.slice(5, 7)) - 1]

function formatearDia(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`
}

async function armarTarjeta(hijo: HijoVinculado): Promise<TarjetaHijo> {
  const { desde, hasta } = calcularRango('MES', fechaHoy)

  try {
    const registros = await consultarAsistencia(hijo.estudianteId, desde, hasta)
    const incidencias = registros
      .filter((registro) => registro.estado !== 'PRESENTE')
      .sort(
        (primero, segundo) =>
          segundo.fecha.localeCompare(primero.fecha) || segundo.horaInicio.localeCompare(primero.horaInicio),
      )
      .slice(0, 3)
    return { hijo, resumen: resumirAsistencia(registros), incidencias, error: '' }
  } catch (fallo: unknown) {
    return {
      hijo,
      resumen: null,
      incidencias: [],
      error: obtenerMensajeError(fallo, 'No se pudo cargar la asistencia del mes.'),
    }
  }
}

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''

  try {
    const [hijos] = await Promise.all([listarHijos(), cargarPagos()])
    tarjetas.value = await Promise.all(hijos.map(armarTarjeta))
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar el resumen de tus hijos.')
  } finally {
    cargando.value = false
  }
}

async function cargarPagos(): Promise<void> {
  errorPagos.value = ''
  try {
    pagos.value = await listarPagos()
  } catch (fallo: unknown) {
    errorPagos.value = obtenerMensajeError(fallo, 'No se pudo cargar el resumen de pagos.')
  }
}

onMounted(cargar)
</script>

<template>
  <main class="docente-vista panel-familia">
    <div class="docente-titulo">
      <div>
        <h1>Hola{{ nombre ? `, ${nombre}` : '' }}</h1>
        <p>Resumen de tus hijos en el año escolar {{ fechaHoy.slice(0, 4) }}.</p>
      </div>
    </div>

    <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="cargar" />

    <AvisoMensaje
      v-else-if="!tarjetas.length"
      tipo="advertencia"
      mensaje="Tu cuenta aún no tiene estudiantes vinculados. Comunícate con la secretaría del colegio."
    />

    <template v-else>
      <AvisoMensaje v-if="errorPagos" :mensaje="errorPagos" tipo="advertencia" />

      <section v-else-if="hayCompromisos && deudas.length" class="docente-tarjeta franja-pagos" aria-label="Pagos">
        <div class="saldo">
          <span>Total por pagar</span>
          <strong>{{ formatearSolesFamilia(totalDeuda) }}</strong>
          <small>
            {{ deudas.length }} {{ deudas.length === 1 ? 'boleta' : 'boletas' }}
            <template v-if="deudasEnMora"> · {{ deudasEnMora }} en mora</template>
          </small>
        </div>
        <div class="lista-deudas">
          <div v-for="deuda in deudas.slice(0, DEUDAS_VISIBLES)" :key="deuda.boleta.boletaId" class="fila-deuda">
            <span class="texto">
              <strong>{{ primerNombre(deuda.nombreHijo) }}</strong> ·
              {{ nombrarMesBoleta(deuda.boleta.mesCobro, true) }}
              <small
                >{{ deuda.boleta.estadoPago === 'EN_MORA' ? 'Venció' : 'Vence' }}
                {{ fechaPago(deuda.boleta.fechaVencimiento, false) }}</small
              >
            </span>
            <span class="estado-boleta" :class="deuda.boleta.estadoPago.toLowerCase()">{{
              NOMBRES_ESTADO_BOLETA[deuda.boleta.estadoPago]
            }}</span>
            <strong class="importe">{{ formatearSolesFamilia(deuda.boleta.montoTotal) }}</strong>
          </div>
          <span v-if="deudas.length > DEUDAS_VISIBLES" class="mas">
            y {{ deudas.length - DEUDAS_VISIBLES }}
            {{ deudas.length - DEUDAS_VISIBLES === 1 ? 'boleta más' : 'boletas más' }}
          </span>
          <div class="botones-pagos">
            <NuxtLink to="/familia/pagos" class="ir-pagar" :class="{ mora: deudasEnMora }">Ir a pagar</NuxtLink>
            <NuxtLink to="/familia/pagos#titulo-historial" class="ver-pagos">Ver todos los pagos</NuxtLink>
          </div>
        </div>
      </section>

      <section v-else-if="hayCompromisos" class="docente-tarjeta pagos-al-dia" aria-label="Pagos">
        <span
          >✔ <strong>Estás al día con las pensiones.</strong>
          <template v-if="proximaEmision"> La próxima boleta se emite el {{ fechaPago(proximaEmision) }}.</template>
        </span>
        <NuxtLink to="/familia/pagos" class="ver-pagos">Ver pagos</NuxtLink>
      </section>

      <section class="hijos" aria-label="Resumen por hijo">
        <article v-for="tarjeta in tarjetas" :key="tarjeta.hijo.estudianteId" class="docente-tarjeta hijo">
          <header>
            <h2>{{ tarjeta.hijo.nombreCompleto }}</h2>
            <p>{{ describirSeccionHijo(periodoVigente(tarjeta.hijo, fechaHoy)) }}</p>
          </header>

          <h3>Asistencia de {{ mes }}</h3>

          <AvisoMensaje v-if="tarjeta.error" :mensaje="tarjeta.error" tipo="error" />
          <p v-else-if="!tarjeta.resumen?.total" class="secundario">Aún no hay clases registradas este mes.</p>
          <template v-else-if="tarjeta.resumen">
            <dl class="indicadores">
              <div>
                <dt>asistencia</dt>
                <dd class="verde">{{ tarjeta.resumen.porcentaje }} %</dd>
              </div>
              <div>
                <dt>tardanzas</dt>
                <dd :class="{ ambar: tarjeta.resumen.TARDANZA }">{{ tarjeta.resumen.TARDANZA }}</dd>
              </div>
              <div>
                <dt>ausencias</dt>
                <dd :class="{ rojo: tarjeta.resumen.AUSENTE }">{{ tarjeta.resumen.AUSENTE }}</dd>
              </div>
              <div>
                <dt>justificadas</dt>
                <dd :class="{ azul: tarjeta.resumen.JUSTIFICADA }">{{ tarjeta.resumen.JUSTIFICADA }}</dd>
              </div>
            </dl>

            <ul v-if="tarjeta.incidencias.length" class="incidencias" aria-label="Últimas faltas y tardanzas">
              <li v-for="registro in tarjeta.incidencias" :key="registro.asistenciaId">
                <span>{{ formatearDia(registro.fecha) }} · {{ registro.areaNombre }}</span>
                <InsigniaEstado
                  :texto="NOMBRES_ESTADO[registro.estado]"
                  :variante="VARIANTES_ESTADO[registro.estado]"
                />
              </li>
            </ul>
            <p v-else class="sin-incidencias">✔ Sin faltas ni tardanzas este mes.</p>
          </template>

          <div class="acciones">
            <NuxtLink :to="`/familia/asistencia?estudianteId=${tarjeta.hijo.estudianteId}`">Ver asistencia</NuxtLink>
            <NuxtLink to="/libretas">Ver progreso académico</NuxtLink>
          </div>
        </article>
      </section>
    </template>
  </main>
</template>

<style scoped>
.docente-titulo p {
  margin: 0;
  color: #64748b;
}

.hijos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 18px;
}

.hijo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hijo header h2 {
  margin: 0;
  font-size: 18px;
}

.hijo header p,
.secundario {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 14px;
}

.hijo h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.indicadores {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.indicadores div {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  padding: 8px 4px;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
}

.indicadores dt {
  color: #64748b;
  font-size: 12px;
}

.indicadores dd {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.verde {
  color: #15803d;
}

.ambar {
  color: #d97706;
}

.rojo {
  color: #dc2626;
}

.azul {
  color: #2563eb;
}

.incidencias {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}

.incidencias li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid #e2e8f0;
}

.sin-incidencias {
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  color: #15803d;
  font-size: 14px;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
}

.acciones a {
  padding: 8px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  color: #1e40af;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.acciones a:hover {
  border-color: #1e40af;
  background: #eff6ff;
}

.franja-pagos {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 20px;
  margin-bottom: 18px;
}

.saldo {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 16px;
  border-radius: 12px;
  background: #0f4c9c;
  color: white;
}

.saldo span,
.saldo small {
  color: #dbeafe;
  font-size: 13px;
}

.saldo strong {
  font-size: 30px;
  white-space: nowrap;
}

.lista-deudas {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.fila-deuda {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 6.5rem 6.5rem;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
}

.fila-deuda .texto {
  min-width: 0;
}

.fila-deuda small {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.estado-boleta {
  justify-self: start;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.estado-boleta.en_mora {
  background: #fee2e2;
  color: #991b1b;
}

.estado-boleta.pendiente {
  background: #fef3c7;
  color: #92400e;
}

.importe {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.mas {
  padding-top: 8px;
  color: #64748b;
  font-size: 13px;
}

.botones-pagos {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.ir-pagar,
.ver-pagos {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
}

.ir-pagar {
  background: #1e40af;
  color: white;
}

.ir-pagar.mora {
  background: #dc2626;
}

.ver-pagos {
  border: 1px solid #c3c6d7;
  color: #1e40af;
}

.pagos-al-dia {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 18px;
  color: #166534;
  font-size: 14px;
}

.hijos {
  align-items: start;
}

@media (max-width: 860px) {
  .franja-pagos {
    grid-template-columns: minmax(0, 1fr);
  }

  .botones-pagos > * {
    flex: 1;
  }
}

@media (max-width: 480px) {
  .fila-deuda {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .fila-deuda .estado-boleta {
    grid-row: 2;
  }

  .fila-deuda .importe {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  .hijos {
    grid-template-columns: minmax(0, 1fr);
  }

  .indicadores {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
