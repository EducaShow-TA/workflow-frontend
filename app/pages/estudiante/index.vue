<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { VARIANTES_ESTADO, describirSeccionHijo, periodoVigente } from '~/composables/usePortalFamilia'
import {
  NOMBRES_CLASE,
  agruparIncidenciasEstudiante,
  limitesMesEstudiante,
  nombrarMesEstudiante,
  resumirClasesEstudiante,
  tituloIncidenciaEstudiante,
  usePortalEstudiante,
} from '~/composables/usePortalEstudiante'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { ResumenAsistencia } from '~/types/familia'
import type { FichaEstudiante, IncidenciaEstudiante } from '~/types/portalEstudiante'

definePageMeta({ middleware: 'autenticacion', layout: 'estudiante' })

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const autenticacion = useAutenticacionStore()
const { obtenerFicha, consultarClases } = usePortalEstudiante()

const fechaHoy = obtenerFechaHoyIso()
const mesActual = fechaHoy.slice(0, 7)
const ficha = ref<FichaEstudiante | null>(null)
const resumen = ref<ResumenAsistencia | null>(null)
const incidencias = ref<IncidenciaEstudiante[]>([])
const cargando = ref(true)
const error = ref('')
const errorAsistencia = ref('')

const nombre = computed(() => autenticacion.usuario?.nombreCompleto?.trim().split(/\s+/)[0] ?? '')
const seccion = computed(() => (ficha.value ? describirSeccionHijo(periodoVigente(ficha.value, fechaHoy)) : ''))

function fechaIncidencia(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number]
  return `${DIAS_CORTOS[new Date(anio, mes - 1, dia).getDay()]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`
}

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''
  errorAsistencia.value = ''

  try {
    ficha.value = await obtenerFicha()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar tu información.')
    cargando.value = false
    return
  }

  if (ficha.value.periodos.length) {
    try {
      const { desde, hasta } = limitesMesEstudiante(mesActual)
      const clases = await consultarClases(ficha.value.estudianteId, desde, hasta)
      resumen.value = resumirClasesEstudiante(clases)
      incidencias.value = agruparIncidenciasEstudiante(clases).slice(0, 3)
    } catch (fallo: unknown) {
      errorAsistencia.value = obtenerMensajeError(fallo, 'No se pudo cargar tu asistencia del mes.')
    }
  }
  cargando.value = false
}

onMounted(cargar)
</script>

<template>
  <main class="docente-vista panel-estudiante">
    <div class="docente-titulo">
      <div>
        <h1>Hola{{ nombre ? `, ${nombre}` : '' }}</h1>
        <p v-if="ficha?.periodos.length">{{ seccion }} · Así va tu año escolar {{ fechaHoy.slice(0, 4) }}.</p>
      </div>
    </div>

    <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="cargar" />

    <AvisoMensaje
      v-else-if="!ficha?.periodos.length"
      mensaje="Todavía no tienes una matrícula confirmada. Cuando el colegio la confirme, aquí verás tu asistencia."
    />

    <article v-else class="docente-tarjeta resumen-mes">
      <h2>Tu asistencia de {{ nombrarMesEstudiante(mesActual, false) }}</h2>

      <AvisoMensaje v-if="errorAsistencia" :mensaje="errorAsistencia" tipo="error" />
      <p v-else-if="!resumen?.total" class="secundario">Aún no tienes clases registradas este mes.</p>
      <template v-else-if="resumen">
        <dl class="indicadores">
          <div>
            <dt>asistencia</dt>
            <dd class="verde">{{ resumen.porcentaje }} %</dd>
          </div>
          <div>
            <dt>{{ resumen.TARDANZA === 1 ? 'tardanza' : 'tardanzas' }}</dt>
            <dd :class="{ ambar: resumen.TARDANZA }">{{ resumen.TARDANZA }}</dd>
          </div>
          <div>
            <dt>{{ resumen.AUSENTE === 1 ? 'falta' : 'faltas' }}</dt>
            <dd :class="{ rojo: resumen.AUSENTE }">{{ resumen.AUSENTE }}</dd>
          </div>
          <div>
            <dt>{{ resumen.JUSTIFICADA === 1 ? 'justificada' : 'justificadas' }}</dt>
            <dd :class="{ azul: resumen.JUSTIFICADA }">{{ resumen.JUSTIFICADA }}</dd>
          </div>
        </dl>

        <ul v-if="incidencias.length" class="incidencias" aria-label="Últimas incidencias">
          <li v-for="incidencia in incidencias" :key="incidencia.clave">
            <span>{{ fechaIncidencia(incidencia.fecha) }} · {{ tituloIncidenciaEstudiante(incidencia) }}</span>
            <InsigniaEstado :texto="NOMBRES_CLASE[incidencia.estado]" :variante="VARIANTES_ESTADO[incidencia.estado]" />
          </li>
        </ul>
        <p v-else class="sin-incidencias">✔ Sin faltas ni tardanzas este mes.</p>
      </template>

      <div class="acciones">
        <NuxtLink to="/estudiante/asistencia">Ver mi asistencia</NuxtLink>
      </div>
    </article>
  </main>
</template>

<style scoped>
.docente-titulo p {
  margin: 0;
  color: #64748b;
}

.resumen-mes {
  display: flex;
  max-width: 560px;
  flex-direction: column;
  gap: 12px;
}

.resumen-mes h2 {
  margin: 0;
  font-size: 16px;
}

.secundario {
  margin: 0;
  color: #64748b;
  font-size: 14px;
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

.acciones a {
  display: inline-block;
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
  .indicadores {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
