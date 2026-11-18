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
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { HijoVinculado, RegistroAsistencia, ResumenAsistencia } from '~/types/familia'

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

const fechaHoy = obtenerFechaHoyIso()
const tarjetas = ref<TarjetaHijo[]>([])
const cargando = ref(true)
const error = ref('')

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
    const hijos = await listarHijos()
    tarjetas.value = await Promise.all(hijos.map(armarTarjeta))
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar el resumen de tus hijos.')
  } finally {
    cargando.value = false
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

    <section v-else class="hijos" aria-label="Resumen por hijo">
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
              <InsigniaEstado :texto="NOMBRES_ESTADO[registro.estado]" :variante="VARIANTES_ESTADO[registro.estado]" />
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

@media (max-width: 480px) {
  .hijos {
    grid-template-columns: minmax(0, 1fr);
  }

  .indicadores {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
