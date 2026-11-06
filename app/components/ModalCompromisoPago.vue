<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { ErroresCompromisoPago, FormularioCompromisoPago, SolicitudCompromisoPago } from '~/types/compromisoPago'
import {
  CUOTAS_MAXIMAS,
  LONGITUD_MAXIMA_CONCEPTO,
  calcularCronograma,
  construirSolicitudCompromiso,
  crearFormularioCompromiso,
  describirMes,
  formatearSoles,
  validarCompromiso,
} from '~/composables/useCompromisoPago'
import { formatearFecha, obtenerFechaHoyIso } from '~/composables/useFechas'

const propiedades = withDefaults(
  defineProps<{
    abierta: boolean
    cantidad: number
    anhioEscolar: number
    destino?: string
    procesando?: boolean
    error?: string
  }>(),
  {
    destino: '',
    procesando: false,
    error: '',
  },
)

const emitir = defineEmits<{
  confirmar: [compromiso: SolicitudCompromisoPago]
  cerrar: []
}>()

const formulario = reactive<FormularioCompromisoPago>(
  crearFormularioCompromiso(propiedades.anhioEscolar, obtenerFechaHoyIso()),
)
const errores = ref<ErroresCompromisoPago>({})

const cronograma = computed(() => calcularCronograma(formulario))
const primeraCuota = computed(() => cronograma.value[0])
const ultimaCuota = computed(() => cronograma.value[cronograma.value.length - 1])
const textoEstudiantes = computed(() =>
  propiedades.cantidad === 1 ? '1 estudiante' : `${propiedades.cantidad} estudiantes`,
)
const descripcion = computed(() =>
  [`${textoEstudiantes.value} seleccionados`, propiedades.destino].filter(Boolean).join(' · '),
)

// Se reinicia al abrir; un error del servidor no cierra la ventana, así se conservan los términos.
watch(
  () => propiedades.abierta,
  (abierta) => {
    if (abierta) {
      Object.assign(formulario, crearFormularioCompromiso(propiedades.anhioEscolar, obtenerFechaHoyIso()))
      errores.value = {}
    }
  },
)

function limpiarError(campo: keyof FormularioCompromisoPago): void {
  errores.value = { ...errores.value, [campo]: undefined }
}

function confirmar(): void {
  errores.value = validarCompromiso(formulario, obtenerFechaHoyIso())

  if (Object.values(errores.value).some(Boolean)) {
    return
  }

  emitir('confirmar', construirSolicitudCompromiso(formulario))
}
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    titulo="Compromiso de pago"
    :descripcion="descripcion"
    :bloqueada="procesando"
    ancho="amplia"
    @cerrar="emitir('cerrar')"
  >
    <div class="distribucion">
      <form id="formulario-compromiso" class="formulario" novalidate @submit.prevent="confirmar">
        <p class="dato-informativo">
          Al confirmar se crea este compromiso para cada estudiante y se emite su primera boleta. Los términos se
          aplican por igual a {{ cantidad === 1 ? 'este estudiante' : `los ${cantidad} estudiantes` }}.
        </p>

        <div class="campo">
          <label for="concepto-compromiso">Concepto <span class="obligatorio">*</span></label>
          <input
            id="concepto-compromiso"
            v-model="formulario.concepto"
            type="text"
            :maxlength="LONGITUD_MAXIMA_CONCEPTO"
            :aria-invalid="Boolean(errores.concepto)"
            :aria-describedby="errores.concepto ? 'error-concepto' : undefined"
            @input="limpiarError('concepto')"
          />
          <small v-if="errores.concepto" id="error-concepto" class="error">{{ errores.concepto }}</small>
        </div>

        <div class="cuadricula-campos">
          <div class="campo">
            <label for="monto-compromiso">Monto total (S/) <span class="obligatorio">*</span></label>
            <input
              id="monto-compromiso"
              v-model.number="formulario.montoTotal"
              type="number"
              inputmode="decimal"
              min="0.01"
              step="0.01"
              placeholder="Ej. 3500.00"
              :aria-invalid="Boolean(errores.montoTotal)"
              :aria-describedby="errores.montoTotal ? 'error-monto' : undefined"
              @input="limpiarError('montoTotal')"
            />
            <small v-if="errores.montoTotal" id="error-monto" class="error">{{ errores.montoTotal }}</small>
          </div>

          <div class="campo">
            <label for="cuotas-compromiso">Número de cuotas <span class="obligatorio">*</span></label>
            <input
              id="cuotas-compromiso"
              v-model.number="formulario.numeroCuotas"
              type="number"
              inputmode="numeric"
              min="1"
              :max="CUOTAS_MAXIMAS"
              step="1"
              :aria-invalid="Boolean(errores.numeroCuotas)"
              :aria-describedby="errores.numeroCuotas ? 'error-cuotas' : 'ayuda-cuotas'"
              @input="limpiarError('numeroCuotas')"
            />
            <small v-if="errores.numeroCuotas" id="error-cuotas" class="error">{{ errores.numeroCuotas }}</small>
            <small v-else id="ayuda-cuotas" class="ayuda">De 1 a {{ CUOTAS_MAXIMAS }} cuotas mensuales.</small>
          </div>
        </div>

        <div class="campo">
          <label for="vencimiento-compromiso">Primer vencimiento <span class="obligatorio">*</span></label>
          <input
            id="vencimiento-compromiso"
            v-model="formulario.primerVencimiento"
            type="date"
            :aria-invalid="Boolean(errores.primerVencimiento)"
            :aria-describedby="errores.primerVencimiento ? 'error-vencimiento' : 'ayuda-vencimiento'"
            @input="limpiarError('primerVencimiento')"
          />
          <small v-if="errores.primerVencimiento" id="error-vencimiento" class="error">
            {{ errores.primerVencimiento }}
          </small>
          <small v-else id="ayuda-vencimiento" class="ayuda">
            Las demás cuotas vencen el mismo día de cada mes siguiente (del 1 al 28).
          </small>
        </div>

        <p class="aviso-apoderado">
          Cada estudiante necesita un <strong>apoderado principal</strong>. Si alguno no lo tiene, no se confirma
          ninguna matrícula del grupo.
        </p>

        <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
      </form>

      <section class="vista-previa" aria-labelledby="titulo-cronograma">
        <h3 id="titulo-cronograma">Cronograma por estudiante</h3>

        <template v-if="primeraCuota && ultimaCuota">
          <dl class="resumen">
            <div>
              <dt>Cuota</dt>
              <dd>{{ formatearSoles(primeraCuota.montoCentimos) }}</dd>
            </div>
            <div>
              <dt>Cuotas</dt>
              <dd>{{ cronograma.length }}</dd>
            </div>
            <div>
              <dt>Última</dt>
              <dd>{{ formatearSoles(ultimaCuota.montoCentimos) }}</dd>
            </div>
          </dl>

          <div class="tabla-desplazable">
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Mes</th>
                  <th scope="col">Vence</th>
                  <th scope="col" class="numero">Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="cuota in cronograma" :key="cuota.numero" :class="{ destacada: cuota.numero === 1 }">
                  <td>{{ cuota.numero }}</td>
                  <td>{{ describirMes(cuota.vencimiento) }}</td>
                  <td>{{ formatearFecha(cuota.vencimiento) }}</td>
                  <td class="numero">{{ formatearSoles(cuota.montoCentimos) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="nota">La cuota 1 se emite como boleta al confirmar.</p>
        </template>

        <p v-else class="vacio">Ingresa el monto total y el número de cuotas para ver el cronograma.</p>
      </section>
    </div>

    <template #pie>
      <BotonAccion variante="secundario" :deshabilitado="procesando" @click="emitir('cerrar')">Cancelar</BotonAccion>
      <BotonAccion tipo="submit" form="formulario-compromiso" :deshabilitado="procesando">
        {{ procesando ? 'Confirmando...' : `Confirmar ${textoEstudiantes}` }}
      </BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.distribucion {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.formulario {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.cuadricula-campos {
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

.campo input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font-size: 14px;
}

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

.error,
.ayuda {
  font-size: 12px;
}

.ayuda {
  color: #434655;
}

.dato-informativo {
  margin: 0;
  color: #434655;
  font-size: 14px;
  line-height: 1.5;
}

.aviso-apoderado {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 13px;
  line-height: 1.5;
}

.vista-previa {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e0e3e5;
  border-radius: 10px;
  background: #f7f9fb;
}

.vista-previa h3 {
  margin: 0;
  color: #191c1e;
  font-size: 14px;
}

.resumen {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.resumen div {
  padding: 8px;
  border-radius: 8px;
  background: white;
}

.resumen dt {
  color: #434655;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.resumen dd {
  margin: 2px 0 0;
  color: #191c1e;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.tabla-desplazable {
  max-height: 260px;
  overflow: auto;
  border-radius: 8px;
  background: white;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 7px 10px;
  border-bottom: 1px solid #eceef0;
  text-align: left;
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  background: white;
  color: #434655;
  font-size: 12px;
}

.numero {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

tr.destacada td {
  background: #eef4ff;
  color: #004ac6;
  font-weight: 600;
}

.nota,
.vacio {
  margin: 0;
  color: #434655;
  font-size: 12px;
}

.vacio {
  padding: 24px 8px;
  text-align: center;
}

@media (max-width: 760px) {
  .distribucion,
  .cuadricula-campos {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
