<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { etiquetaEstadoBoleta, useBoletasPension, validarPagoBoleta } from '~/composables/useBoletasPension'
import { formatearFecha } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import type { BoletaPension, ComprobanteBoleta, MedioPago } from '~/types/boletaPension'

const props = defineProps<{ id: number }>()
const emitir = defineEmits<{ cerrar: []; pagada: []; ocupada: [valor: boolean] }>()
const api = useBoletasPension()
const boleta = ref<BoletaPension | null>(null)
const recibos = ref<ComprobanteBoleta[]>([])
const cargando = ref(false)
const guardando = ref(false)
const error = ref('')
const exito = ref('')
const errorPago = ref('')
const revisar = ref(false)
// Un POST con respuesta incierta no se reintenta automáticamente: se consulta el estado primero.
const debeVerificar = ref(false)
const medio = ref<MedioPago>('PRESENCIAL')
const referencia = ref('')
const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const solicitud = computed(() => ({
  monto: boleta.value?.montoTotal ?? 0,
  medioPago: medio.value,
  referencia: referencia.value,
}))

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''
  revisar.value = false
  boleta.value = null
  recibos.value = []
  try {
    const [actual, comprobantes] = await Promise.all([api.obtener(props.id), api.comprobantes(props.id)])
    boleta.value = actual
    recibos.value = comprobantes
    debeVerificar.value = false
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo consultar la boleta y sus comprobantes.')
  } finally {
    cargando.value = false
  }
}

function revisarPago(): void {
  if (!boleta.value) return
  errorPago.value = validarPagoBoleta(boleta.value, solicitud.value)
  revisar.value = !errorPago.value
}

async function confirmarPago(): Promise<void> {
  if (!boleta.value || guardando.value || !revisar.value || debeVerificar.value) return
  guardando.value = true
  emitir('ocupada', true)
  errorPago.value = ''
  try {
    const recibo = await api.registrarPago(boleta.value, solicitud.value)
    exito.value = `Pago registrado. Comprobante ${recibo.numeroComprobante}, por ${moneda.format(recibo.montoPagado)}.`
    revisar.value = false
    debeVerificar.value = true
    emitir('pagada')
    await cargar()
  } catch (fallo: unknown) {
    errorPago.value = obtenerMensajeError(fallo, 'No se pudo confirmar el registro del pago.')
    debeVerificar.value = true
    revisar.value = false
  } finally {
    guardando.value = false
    emitir('ocupada', false)
  }
}

onMounted(cargar)
</script>

<template>
  <section class="detalle" aria-labelledby="titulo-boleta" :aria-busy="cargando || guardando">
    <header>
      <h2 id="titulo-boleta">Detalle de boleta #{{ id }}</h2>
      <button :disabled="guardando" class="boton" type="button" @click="emitir('cerrar')">Cerrar detalle</button>
    </header>
    <p v-if="exito" class="exito" role="status">{{ exito }}</p>
    <p v-if="cargando" role="status">Consultando estado y comprobantes…</p>
    <div v-if="error" class="error" role="alert">
      {{ error }} <button class="boton" type="button" @click="cargar">Reintentar consulta</button>
    </div>
    <template v-if="boleta && !cargando">
      <dl class="datos">
        <div>
          <dt>Estudiante</dt>
          <dd>{{ boleta.estudiante }}</dd>
        </div>
        <div>
          <dt>Apoderado titular</dt>
          <dd>{{ boleta.apoderado }}</dd>
        </div>
        <div>
          <dt>Grado y sección</dt>
          <dd>{{ boleta.grado }}.º / {{ boleta.seccion }}</dd>
        </div>
        <div>
          <dt>Mes de cobro</dt>
          <dd>{{ boleta.mesCobro }}</dd>
        </div>
        <div>
          <dt>Vencimiento</dt>
          <dd>{{ formatearFecha(boleta.fechaVencimiento) }}</dd>
        </div>
        <div>
          <dt>Estado actual</dt>
          <dd>{{ etiquetaEstadoBoleta(boleta.estadoPago) }}</dd>
        </div>
        <div>
          <dt>Pensión</dt>
          <dd>{{ moneda.format(boleta.monto) }}</dd>
        </div>
        <div>
          <dt>Mora</dt>
          <dd>{{ moneda.format(boleta.mora) }}</dd>
        </div>
        <div>
          <dt>Total de la boleta</dt>
          <dd>
            <strong>{{ moneda.format(boleta.montoTotal) }}</strong>
          </dd>
        </div>
      </dl>
      <h3>Comprobantes registrados</h3>
      <p v-if="!recibos.length">No hay comprobantes registrados para esta boleta.</p>
      <ul v-else class="recibos">
        <li v-for="recibo in recibos" :key="recibo.id">
          <strong>{{ recibo.numeroComprobante }}</strong> · {{ formatearFecha(recibo.fechaEmision) }} ·
          {{ moneda.format(recibo.montoPagado) }} · {{ recibo.medioPago === 'PRESENCIAL' ? 'Presencial' : 'Virtual' }}
        </li>
      </ul>

      <p v-if="boleta.estadoPago === 'PAGADA'" class="exito">La boleta está pagada. No admite un segundo pago.</p>
      <form v-else @submit.prevent="revisarPago">
        <h3>Registrar pago aprobado</h3>
        <p>
          Registra únicamente un pago que ya verificaste. Esta operación actualiza la boleta a pagada; no cobra mediante
          una pasarela. Solo se admite el pago total.
        </p>
        <fieldset :disabled="guardando || revisar || debeVerificar" class="campos">
          <label>Importe total<input :value="moneda.format(boleta.montoTotal)" readonly /></label>
          <label
            >Medio de pago<select v-model="medio">
              <option value="PRESENCIAL">Presencial</option>
              <option value="VIRTUAL">Virtual (previamente verificado)</option>
            </select></label
          >
          <label
            >Número de comprobante (opcional)<input
              v-model="referencia"
              maxlength="40"
              placeholder="Vacío: lo genera el servidor"
          /></label>
        </fieldset>
        <p v-if="errorPago" class="error" role="alert">{{ errorPago }}</p>
        <div v-if="debeVerificar" class="error" role="alert">
          Consulta el estado antes de intentar otro registro: la petición anterior pudo haberse guardado.
          <button type="button" class="boton" :disabled="guardando" @click="cargar">Consultar estado actual</button>
        </div>
        <div v-else-if="revisar" class="confirmacion" role="region" aria-label="Confirmación del pago">
          <p>
            ¿Confirmas el pago aprobado de <strong>{{ moneda.format(boleta.montoTotal) }}</strong> para
            <strong>{{ boleta.estudiante }}</strong>, boleta #{{ boleta.id }}?
          </p>
          <p>
            Medio: {{ medio === 'PRESENCIAL' ? 'Presencial' : 'Virtual' }}. Comprobante:
            {{ referencia.trim() || 'Generado por el servidor' }}.
          </p>
          <button class="boton primario" :disabled="guardando" type="button" @click="confirmarPago">
            {{ guardando ? 'Registrando…' : 'Confirmar pago aprobado' }}
          </button>
          <button class="boton" :disabled="guardando" type="button" @click="revisar = false">Cancelar</button>
        </div>
        <button v-else class="boton primario" type="submit" :disabled="guardando">Revisar pago</button>
      </form>
    </template>
  </section>
</template>

<style scoped>
.detalle {
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 24px;
  margin: 24px 0;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
h2 {
  font-size: 20px;
}
h3 {
  margin-top: 24px;
  font-size: 16px;
}
p,
li {
  line-height: 1.6;
}
.datos,
.campos {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
dt {
  color: #64748b;
  font-size: 13px;
}
dd {
  margin: 6px 0;
  overflow-wrap: anywhere;
}
.campos {
  border: 0;
  padding: 0;
  margin: 20px 0;
}
label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
}
input,
select {
  width: 100%;
  min-width: 0;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
}
.boton {
  padding: 10px 16px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  margin: 4px 8px 4px 0;
}
.primario {
  background: #1e40af;
  color: white;
  border-color: #1e40af;
}
.boton:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.error {
  background: #fef2f2;
  color: #991b1b;
  padding: 14px;
  border-radius: 8px;
}
.exito {
  background: #f0fdf4;
  color: #166534;
  padding: 14px;
  border-radius: 8px;
}
.confirmacion {
  background: #eff6ff;
  padding: 16px;
  border-radius: 8px;
}
.recibos {
  padding-left: 20px;
}
:focus-visible {
  outline: 3px solid #93b4fa;
  outline-offset: 2px;
}
@media (max-width: 850px) {
  .datos,
  .campos {
    grid-template-columns: 1fr;
  }
}
</style>
