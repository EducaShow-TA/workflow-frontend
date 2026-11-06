<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BoletaPension, ComprobanteBoleta } from '~/types/boletaPension'
import { useBoletasPension } from '~/composables/useBoletasPension'
import { formatearFecha } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'

const TARJETA_APROBADA = '4111 1111 1111 1111'
const TARJETA_RECHAZADA = '4000 0000 0000 0002'
const DEMORA_PASARELA_MS = 1800

const propiedades = defineProps<{
  abierta: boolean
  boleta: BoletaPension | null
}>()

const emitir = defineEmits<{
  cerrar: []
  pagada: [comprobante: ComprobanteBoleta]
}>()

const { registrarPago } = useBoletasPension()
const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

type Paso = 'datos' | 'procesando' | 'aprobado'

const paso = ref<Paso>('datos')
const titular = ref('')
const numero = ref('')
const vencimiento = ref('')
const cvv = ref('')
const error = ref('')
const comprobante = ref<ComprobanteBoleta | null>(null)

const procesando = computed(() => paso.value === 'procesando')
const digitos = computed(() => numero.value.replace(/\D/g, ''))
const marca = computed(() =>
  digitos.value.startsWith('4') ? 'VISA' : digitos.value.startsWith('5') ? 'Mastercard' : '',
)

watch(
  () => propiedades.abierta,
  (abierta) => {
    if (!abierta) return
    paso.value = 'datos'
    titular.value = propiedades.boleta?.apoderado ?? ''
    numero.value = TARJETA_APROBADA
    vencimiento.value = '12/30'
    cvv.value = '123'
    error.value = ''
    comprobante.value = null
  },
)

watch([titular, numero, vencimiento, cvv], () => {
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
  if (!titular.value.trim()) return 'Ingresa el nombre del titular de la tarjeta.'
  if (digitos.value.length !== 16) return 'El número de tarjeta debe tener 16 dígitos.'
  if (!vencimientoValido()) return 'La fecha de vencimiento no es válida o ya pasó (formato MM/AA).'
  if (!/^\d{3,4}$/.test(cvv.value)) return 'El código de seguridad debe tener 3 o 4 dígitos.'
  return ''
}

function referenciaSimulada(): string {
  return `SIM-${Date.now().toString(36).toUpperCase()}`
}

async function pagar(): Promise<void> {
  const boleta = propiedades.boleta
  error.value = validar()
  if (error.value || !boleta) return

  paso.value = 'procesando'
  await new Promise((resolver) => setTimeout(resolver, DEMORA_PASARELA_MS))

  if (digitos.value === TARJETA_RECHAZADA.replace(/\s/g, '')) {
    paso.value = 'datos'
    error.value = 'La pasarela rechazó la tarjeta (fondos insuficientes). No se registró ningún pago.'
    return
  }

  try {
    comprobante.value = await registrarPago(boleta, {
      monto: boleta.montoTotal,
      medioPago: 'VIRTUAL',
      referencia: referenciaSimulada(),
    })
    paso.value = 'aprobado'
    emitir('pagada', comprobante.value)
  } catch (fallo: unknown) {
    paso.value = 'datos'
    error.value = obtenerMensajeError(fallo, 'El pago fue aprobado por la pasarela, pero no se pudo registrar.')
  }
}
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    titulo="Pago en línea"
    :descripcion="boleta ? `Boleta #${boleta.id} · ${boleta.estudiante} · ${boleta.mesCobro}` : ''"
    :bloqueada="procesando"
    @cerrar="emitir('cerrar')"
  >
    <div v-if="boleta" class="contenido">
      <p class="simulacion" role="note">
        <strong>Pasarela simulada.</strong> No se realiza ningún cobro real y los datos de la tarjeta no se envían ni se
        guardan.
      </p>

      <div class="importe">
        <span>Total a pagar</span>
        <strong>{{ moneda.format(boleta.montoTotal) }}</strong>
        <small>Vence el {{ formatearFecha(boleta.fechaVencimiento) }}</small>
      </div>

      <div v-if="paso === 'aprobado' && comprobante" class="aprobado" role="status">
        <span class="check" aria-hidden="true">✓</span>
        <h3>Pago aprobado</h3>
        <dl>
          <div>
            <dt>Comprobante</dt>
            <dd>{{ comprobante.numeroComprobante }}</dd>
          </div>
          <div>
            <dt>Monto</dt>
            <dd>{{ moneda.format(comprobante.montoPagado) }}</dd>
          </div>
          <div>
            <dt>Medio</dt>
            <dd>Virtual (tarjeta {{ marca || 'de prueba' }} ···· {{ digitos.slice(-4) }})</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{{ formatearFecha(comprobante.fechaEmision.slice(0, 10)) }}</dd>
          </div>
        </dl>
        <p>La boleta quedó como pagada.</p>
      </div>

      <p v-else-if="procesando" class="procesando" role="status">
        <span class="giro" aria-hidden="true" />Procesando el pago con la pasarela…
      </p>

      <form v-else id="formulario-pago-linea" class="tarjeta" novalidate @submit.prevent="pagar">
        <div class="campo">
          <label for="pago-titular">Titular de la tarjeta</label>
          <input id="pago-titular" v-model="titular" autocomplete="off" maxlength="60" />
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
    </div>

    <template #pie>
      <template v-if="paso === 'aprobado'">
        <BotonAccion @click="emitir('cerrar')">Listo</BotonAccion>
      </template>
      <template v-else>
        <BotonAccion variante="secundario" :deshabilitado="procesando" @click="emitir('cerrar')">Cancelar</BotonAccion>
        <BotonAccion tipo="submit" form="formulario-pago-linea" :deshabilitado="procesando || !boleta">
          {{ procesando ? 'Procesando...' : `Pagar ${boleta ? moneda.format(boleta.montoTotal) : ''}` }}
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
