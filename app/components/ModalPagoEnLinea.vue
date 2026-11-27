<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { fechaPago, formatearSolesFamilia, nombrarMesBoleta, usePagosFamilia } from '~/composables/usePagosFamilia'
import type { ComprobantePagoFamilia, DeudaFamilia } from '~/types/familia'

const TARJETA_APROBADA = '4111 1111 1111 1111'
const TARJETA_RECHAZADA = '4000 0000 0000 0002'
const DEMORA_PASARELA_MS = 1800

const propiedades = defineProps<{
  abierta: boolean
  deudas: DeudaFamilia[]
  titular?: string
}>()

const emitir = defineEmits<{
  cerrar: []
  pagadas: [comprobantes: ComprobantePagoFamilia[]]
}>()

const { pagar: registrarPagos, descargarComprobante } = usePagosFamilia()

type Paso = 'datos' | 'procesando' | 'aprobado'

const paso = ref<Paso>('datos')
const titularTarjeta = ref('')
const numero = ref('')
const vencimiento = ref('')
const cvv = ref('')
const error = ref('')
const comprobantes = ref<ComprobantePagoFamilia[]>([])
const descargando = ref(false)
// El padre recarga la lista al aprobarse el pago; el modal conserva lo que se pagó.
const aPagar = ref<DeudaFamilia[]>([])

const procesando = computed(() => paso.value === 'procesando')
const digitos = computed(() => numero.value.replace(/\D/g, ''))
const marca = computed(() =>
  digitos.value.startsWith('4') ? 'VISA' : digitos.value.startsWith('5') ? 'Mastercard' : '',
)
const total = computed(
  () => Math.round(aPagar.value.reduce((suma, deuda) => suma + deuda.boleta.montoTotal, 0) * 100) / 100,
)
const descripcion = computed(() => {
  const hijos = [...new Set(aPagar.value.map((deuda) => deuda.nombreHijo))]
  const conceptos = aPagar.value.map(
    (deuda) =>
      `${deuda.boleta.tipoCargo === 'MATRICULA' ? 'Matrícula' : 'Pensión'} ${nombrarMesBoleta(deuda.boleta.mesCobro, true)}`,
  )
  const cantidad = aPagar.value.length
  return `${hijos.join(' y ')} · ${cantidad === 1 ? conceptos[0] : `${cantidad} boletas (${conceptos.join(', ')})`}`
})

watch(
  () => propiedades.abierta,
  (abierta) => {
    if (!abierta) return
    aPagar.value = [...propiedades.deudas]
    paso.value = 'datos'
    titularTarjeta.value = propiedades.titular ?? ''
    numero.value = TARJETA_APROBADA
    vencimiento.value = '12/30'
    cvv.value = '123'
    error.value = ''
    comprobantes.value = []
  },
)

watch([titularTarjeta, numero, vencimiento, cvv], () => {
  if (paso.value === 'datos') error.value = ''
})

function formatearNumero(evento: Event): void {
  const solo = (evento.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 16)
  numero.value = solo.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatearVencimiento(evento: Event): void {
  const solo = (evento.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4)
  vencimiento.value = solo.length > 2 ? `${solo.slice(0, 2)}/${solo.slice(2)}` : solo
}

function vencimientoValido(): boolean {
  const coincidencia = /^(\d{2})\/(\d{2})$/.exec(vencimiento.value)
  if (!coincidencia) return false
  const mes = Number(coincidencia[1])
  const anhio = 2000 + Number(coincidencia[2])
  if (mes < 1 || mes > 12) return false
  const hoy = new Date()
  return anhio > hoy.getFullYear() || (anhio === hoy.getFullYear() && mes >= hoy.getMonth() + 1)
}

function validar(): string {
  if (!titularTarjeta.value.trim()) return 'Ingresa el nombre del titular de la tarjeta.'
  if (digitos.value.length !== 16) return 'El número de tarjeta debe tener 16 dígitos.'
  if (!vencimientoValido()) return 'La fecha de vencimiento no es válida o ya pasó (formato MM/AA).'
  if (!/^\d{3,4}$/.test(cvv.value)) return 'El código de seguridad debe tener 3 o 4 dígitos.'
  return ''
}

async function pagar(): Promise<void> {
  error.value = validar()
  if (error.value || !aPagar.value.length) return

  paso.value = 'procesando'
  await new Promise((resolver) => setTimeout(resolver, DEMORA_PASARELA_MS))

  if (digitos.value === TARJETA_RECHAZADA.replace(/\s/g, '')) {
    paso.value = 'datos'
    error.value = 'La pasarela rechazó la tarjeta (fondos insuficientes). No se registró ningún pago.'
    return
  }

  try {
    comprobantes.value = await registrarPagos(aPagar.value.map((deuda) => deuda.boleta.boletaId))
    paso.value = 'aprobado'
    emitir('pagadas', comprobantes.value)
  } catch (fallo: unknown) {
    paso.value = 'datos'
    error.value = obtenerMensajeError(fallo, 'No se pudo registrar el pago. No se cobró ninguna boleta.')
  }
}

async function descargarTodos(): Promise<void> {
  descargando.value = true
  error.value = ''
  try {
    for (const comprobante of comprobantes.value) {
      await descargarComprobante(comprobante.id, comprobante.numeroComprobante)
    }
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo descargar el comprobante.')
  } finally {
    descargando.value = false
  }
}
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    :titulo="aPagar.length === 1 ? 'Pagar boleta' : 'Pagar boletas'"
    :descripcion="descripcion"
    :bloqueada="procesando"
    @cerrar="emitir('cerrar')"
  >
    <div class="contenido">
      <p class="simulacion" role="note">
        <strong>Pasarela simulada.</strong> No se realiza ningún cobro real y los datos de la tarjeta no salen de tu
        navegador.
      </p>

      <div v-if="paso === 'aprobado'" class="aprobado" role="status">
        <span class="check" aria-hidden="true">✓</span>
        <h3>Pago aprobado</h3>
        <dl>
          <div>
            <dt>{{ comprobantes.length === 1 ? 'Comprobante' : 'Comprobantes' }}</dt>
            <dd>
              {{
                comprobantes.length === 1
                  ? comprobantes[0]?.numeroComprobante
                  : `${comprobantes.length} (uno por boleta)`
              }}
            </dd>
          </div>
          <div>
            <dt>Monto</dt>
            <dd>{{ formatearSolesFamilia(total) }}</dd>
          </div>
          <div>
            <dt>Medio</dt>
            <dd>Virtual · {{ marca || 'tarjeta' }} ···· {{ digitos.slice(-4) }}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{{ comprobantes[0] ? fechaPago(comprobantes[0].fechaEmision) : '' }}</dd>
          </div>
        </dl>
        <p>{{ comprobantes.length === 1 ? 'La boleta quedó como pagada.' : 'Las boletas quedaron como pagadas.' }}</p>
        <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
      </div>

      <template v-else>
        <div class="importe">
          <span>Total a pagar</span>
          <strong>{{ formatearSolesFamilia(total) }}</strong>
          <small>
            {{
              aPagar.length === 1
                ? `Vence el ${aPagar[0] ? fechaPago(aPagar[0].boleta.fechaVencimiento) : ''}`
                : `${aPagar.length} boletas`
            }}
          </small>
        </div>

        <p v-if="procesando" class="procesando" role="status">
          <span class="giro" aria-hidden="true" />Procesando el pago con la pasarela…
        </p>

        <form v-else id="formulario-pago-linea" class="tarjeta" novalidate @submit.prevent="pagar">
          <div class="campo">
            <label for="pago-titular">Titular de la tarjeta</label>
            <input id="pago-titular" v-model="titularTarjeta" autocomplete="off" maxlength="60" />
          </div>
          <div class="campo">
            <label for="pago-numero"
              >Número de tarjeta <span v-if="marca" class="marca">{{ marca }}</span></label
            >
            <input
              id="pago-numero"
              :value="numero"
              inputmode="numeric"
              autocomplete="off"
              placeholder="0000 0000 0000 0000"
              @input="formatearNumero"
            />
          </div>
          <div class="doble">
            <div class="campo">
              <label for="pago-vencimiento">Vencimiento</label>
              <input
                id="pago-vencimiento"
                :value="vencimiento"
                inputmode="numeric"
                autocomplete="off"
                placeholder="MM/AA"
                @input="formatearVencimiento"
              />
            </div>
            <div class="campo">
              <label for="pago-cvv">CVV</label>
              <input id="pago-cvv" v-model="cvv" inputmode="numeric" autocomplete="off" maxlength="4" type="password" />
            </div>
          </div>
          <p class="ayuda">
            Tarjetas de prueba: <code>{{ TARJETA_APROBADA }}</code> se aprueba; <code>{{ TARJETA_RECHAZADA }}</code> se
            rechaza.
          </p>
          <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
        </form>
      </template>
    </div>

    <template #pie>
      <template v-if="paso === 'aprobado'">
        <BotonAccion variante="secundario" :deshabilitado="descargando" @click="descargarTodos">
          {{
            descargando
              ? 'Descargando…'
              : comprobantes.length === 1
                ? 'Descargar comprobante'
                : 'Descargar comprobantes'
          }}
        </BotonAccion>
        <BotonAccion @click="emitir('cerrar')">Listo</BotonAccion>
      </template>
      <template v-else>
        <BotonAccion variante="secundario" :deshabilitado="procesando" @click="emitir('cerrar')">Cancelar</BotonAccion>
        <BotonAccion tipo="submit" form="formulario-pago-linea" :deshabilitado="procesando || !aPagar.length">
          {{ procesando ? 'Procesando…' : `Pagar ${formatearSolesFamilia(total)}` }}
        </BotonAccion>
      </template>
    </template>
  </VentanaModal>
</template>

<style scoped>
.contenido {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.simulacion {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  background: #fffbeb;
  color: #78350f;
  font-size: 13px;
  line-height: 1.5;
}

.importe {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 2px 12px;
  padding: 14px 16px;
  border-radius: 10px;
  background: #f7f9fb;
}

.importe span,
.importe small {
  color: #434655;
  font-size: 13px;
}

.importe strong {
  grid-row: span 2;
  color: #191c1e;
  font-size: 24px;
}

.tarjeta {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.doble {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.campo label {
  display: flex;
  justify-content: space-between;
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.marca {
  color: #004ac6;
  font-size: 12px;
  font-weight: 700;
}

.campo input {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  font: inherit;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.campo input:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.ayuda {
  margin: 0;
  color: #434655;
  font-size: 12px;
}

.ayuda code {
  font-size: 12px;
}

.procesando {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 0;
  padding: 36px 0;
  color: #191c1e;
  font-weight: 600;
}

.giro {
  width: 22px;
  height: 22px;
  border: 3px solid #dbeafe;
  border-top-color: #004ac6;
  border-radius: 50%;
  animation: girar 0.8s linear infinite;
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .giro {
    animation: none;
  }
}

.aprobado {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.check {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  background: #d1fae5;
  color: #047857;
  font-size: 24px;
  font-weight: 700;
}

.aprobado h3 {
  margin: 0;
  font-size: 18px;
}

.aprobado dl {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 8px 0 0;
  text-align: left;
}

.aprobado dt {
  color: #434655;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.aprobado dd {
  margin: 2px 0 0;
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.aprobado p {
  margin: 0;
  color: #434655;
  font-size: 13px;
}

@media (max-width: 480px) {
  .aprobado dl {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
