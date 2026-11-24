<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { HistorialBoletas } from '~/types/boletaPension'
import { etiquetaEstadoBoleta } from '~/composables/useBoletasPension'
import { useBusquedaAdministrador, type EstudianteEncontrado } from '~/composables/useBusquedaAdministrador'
import { nombreMes } from '~/composables/useCompromisosPago'
import { formatearFecha } from '~/composables/useFechas'
import {
  avisarLimiteBusqueda,
  describirHistorial,
  esBusquedaValida,
  useHistorialBoletas,
} from '~/composables/useHistorialBoletas'
import { obtenerMensajeError } from '~/composables/useMensajesError'

const propiedades = defineProps<{ abierta: boolean }>()
const emitir = defineEmits<{ cerrar: []; actualizada: [] }>()

const { buscarEstudiantes } = useBusquedaAdministrador()
const { generar: generarHistorial } = useHistorialBoletas()
const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

const texto = ref('')
const encontrados = ref<EstudianteEncontrado[]>([])
const buscado = ref(false)
const buscando = ref(false)
const estudianteId = ref<number | null>(null)
const historial = ref<HistorialBoletas | null>(null)
const generando = ref(false)
const error = ref('')
let ultimaBusqueda = 0

const huboCambios = computed(() =>
  historial.value ? historial.value.boletasGeneradas + historial.value.boletasEnMora > 0 : false,
)

// El historial de un alumno no debe quedar visible al buscar o elegir a otro.
function limpiarResultado(): void {
  historial.value = null
  error.value = ''
}

watch(
  () => propiedades.abierta,
  () => {
    ultimaBusqueda++
    texto.value = ''
    encontrados.value = []
    buscado.value = false
    buscando.value = false
    estudianteId.value = null
    limpiarResultado()
  },
)

watch(estudianteId, limpiarResultado)

async function buscar(): Promise<void> {
  if (!esBusquedaValida(texto.value) || buscando.value || generando.value) return
  const busqueda = ++ultimaBusqueda
  buscando.value = true
  buscado.value = false
  encontrados.value = []
  estudianteId.value = null
  limpiarResultado()
  try {
    const resultado = await buscarEstudiantes(texto.value)
    if (busqueda !== ultimaBusqueda) return
    encontrados.value = resultado
    buscado.value = true
  } catch (fallo: unknown) {
    if (busqueda === ultimaBusqueda) error.value = obtenerMensajeError(fallo, 'No se pudo buscar a los alumnos.')
  } finally {
    if (busqueda === ultimaBusqueda) buscando.value = false
  }
}

async function generar(): Promise<void> {
  if (estudianteId.value === null || generando.value) return
  limpiarResultado()
  generando.value = true
  try {
    historial.value = await generarHistorial(estudianteId.value)
    if (huboCambios.value) emitir('actualizada')
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo generar el historial de boletas.')
  } finally {
    generando.value = false
  }
}
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    titulo="Historial de boletas"
    descripcion="Completa las boletas que falten hasta el mes actual según el compromiso de pago y muestra todas las boletas del alumno."
    :bloqueada="generando"
    ancho="amplia"
    @cerrar="emitir('cerrar')"
  >
    <div class="contenido">
      <form class="buscador" @submit.prevent="buscar">
        <label for="historial-busqueda">Nombre o DNI del alumno</label>
        <div class="fila">
          <input id="historial-busqueda" v-model="texto" type="search" autocomplete="off" :disabled="generando" />
          <BotonAccion
            tipo="submit"
            variante="secundario"
            :deshabilitado="!esBusquedaValida(texto) || buscando || generando"
          >
            {{ buscando ? 'Buscando…' : 'Buscar' }}
          </BotonAccion>
        </div>
      </form>

      <p v-if="buscado && !encontrados.length" class="ayuda" role="status">No se encontraron alumnos.</p>

      <fieldset v-if="encontrados.length" class="resultados">
        <legend>Alumno</legend>
        <label v-for="alumno in encontrados" :key="alumno.estudianteId">
          <input
            v-model="estudianteId"
            type="radio"
            name="historial-alumno"
            :value="alumno.estudianteId"
            :disabled="generando"
          />
          <span>{{ alumno.nombreCompleto }} · {{ alumno.dni }} · {{ alumno.aula }}</span>
        </label>
      </fieldset>
      <p v-if="avisarLimiteBusqueda(encontrados.length)" class="ayuda" role="status">
        {{ avisarLimiteBusqueda(encontrados.length) }}
      </p>

      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />

      <template v-if="historial">
        <AvisoMensaje :mensaje="describirHistorial(historial)" :tipo="huboCambios ? 'exito' : 'informacion'" />

        <h3>{{ historial.estudiante }} · hasta {{ nombreMes(historial.mesCorte) }}</h3>
        <dl class="totales">
          <div>
            <dt>Pagado</dt>
            <dd>{{ moneda.format(historial.totales.pagado) }}</dd>
          </div>
          <div>
            <dt>Pendiente</dt>
            <dd>{{ moneda.format(historial.totales.pendiente) }}</dd>
          </div>
          <div>
            <dt>En mora</dt>
            <dd>{{ moneda.format(historial.totales.enMora) }}</dd>
          </div>
        </dl>

        <section v-for="matricula in historial.matriculas" :key="matricula.matriculaId" class="matricula">
          <h4>
            {{ matricula.anio }} · {{ matricula.grado }}.º {{ matricula.seccion }}
            <span v-if="matricula.estado === 'RETIRADA'" class="estado">Retirada</span>
          </h4>
          <p v-if="!matricula.compromiso" class="ayuda">Sin compromiso de pago</p>
          <template v-else>
            <p class="ayuda">
              {{ matricula.compromiso.concepto }} · {{ matricula.compromiso.numeroCuotas }} cuotas desde
              {{ nombreMes(matricula.compromiso.mesInicio) }}
            </p>
            <p v-if="!matricula.boletas.length" class="ayuda">Aún no hay boletas emitidas</p>
            <div
              v-else
              class="tabla-contenedor"
              tabindex="0"
              role="region"
              :aria-label="`Boletas de ${matricula.anio}, desplazamiento horizontal`"
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Boleta</th>
                    <th scope="col">Mes</th>
                    <th scope="col">Vencimiento</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Comprobante</th>
                    <th scope="col" class="importe">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="boleta in matricula.boletas" :key="boleta.id">
                    <td>#{{ boleta.id }}</td>
                    <td>{{ nombreMes(boleta.mesCobro) }}</td>
                    <td>{{ formatearFecha(boleta.fechaVencimiento) }}</td>
                    <td>
                      <span class="estado" :class="boleta.estadoPago.toLowerCase()">
                        {{ etiquetaEstadoBoleta(boleta.estadoPago) }}
                      </span>
                    </td>
                    <td>{{ boleta.numeroComprobante ?? '—' }}</td>
                    <td class="importe">{{ moneda.format(boleta.montoTotal) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </section>
      </template>
    </div>

    <template #pie>
      <BotonAccion variante="secundario" :deshabilitado="generando" @click="emitir('cerrar')">Cerrar</BotonAccion>
      <BotonAccion :deshabilitado="estudianteId === null || generando" @click="generar">
        {{ generando ? 'Generando…' : 'Generar historial' }}
      </BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.contenido {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.buscador label,
.resultados legend {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.fila {
  display: flex;
  gap: 12px;
  margin-top: 6px;
}

.fila input {
  min-width: 0;
  min-height: 44px;
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
}

.resultados {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
}

.resultados label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid #e0e3e5;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.ayuda {
  margin: 0;
  color: #434655;
  font-size: 13px;
}

h3,
h4 {
  margin: 0;
  color: #191c1e;
}

h3 {
  font-size: 16px;
}

h4 {
  font-size: 15px;
}

.totales {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 12px;
  border-radius: 10px;
  background: #f7f9fb;
}

.totales dt {
  color: #434655;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.totales dd {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 600;
}

.matricula {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.tabla-contenedor {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 10px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  white-space: nowrap;
}

th {
  background: #f8fafc;
  font-size: 12px;
}

.importe {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.estado {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
  font-weight: 400;
}

.pendiente {
  background: #fff7ed;
  color: #9a3412;
}

.pagada {
  background: #f0fdf4;
  color: #166534;
}

.en_mora {
  background: #fef2f2;
  color: #991b1b;
}

@media (max-width: 520px) {
  .fila {
    flex-direction: column;
  }

  .totales {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
