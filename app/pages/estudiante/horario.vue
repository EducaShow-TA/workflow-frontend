<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { usePortalEstudiante } from '~/composables/usePortalEstudiante'
import type { FichaEstudiante, HorarioEstudiante } from '~/types/portalEstudiante'

definePageMeta({ middleware: 'autenticacion', layout: 'estudiante' })

const DIAS = [
  { codigo: 'MONDAY', nombre: 'Lunes' },
  { codigo: 'TUESDAY', nombre: 'Martes' },
  { codigo: 'WEDNESDAY', nombre: 'Miércoles' },
  { codigo: 'THURSDAY', nombre: 'Jueves' },
  { codigo: 'FRIDAY', nombre: 'Viernes' },
] as const

const { obtenerFicha, consultarHorario } = usePortalEstudiante()
const anioActual = ahoraSistema().getFullYear()
const anio = ref(anioActual)
const ficha = ref<FichaEstudiante | null>(null)
const sesiones = ref<HorarioEstudiante[]>([])
const cargandoFicha = ref(true)
const cargando = ref(false)
const errorFicha = ref('')
const error = ref('')
let temporizador: ReturnType<typeof setInterval> | undefined

const anios = computed(() => {
  const valores = new Set<number>()
  for (const periodo of ficha.value?.periodos ?? []) {
    const inicio = Number(periodo.fechaInicio.slice(0, 4))
    const fin = Number(periodo.fechaFin.slice(0, 4))
    for (let valor = inicio; valor <= fin; valor++) valores.add(valor)
  }
  return [...valores].sort((a, b) => a - b)
})

const periodoAnio = computed(
  () =>
    ficha.value?.periodos
      .filter(
        (periodo) =>
          Number(periodo.fechaInicio.slice(0, 4)) <= anio.value && anio.value <= Number(periodo.fechaFin.slice(0, 4)),
      )
      .sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))[0] ?? null,
)

const nombreSeccion = computed(() =>
  periodoAnio.value ? `${periodoAnio.value.gradoNumero}.° ${periodoAnio.value.seccion}` : '',
)

const sesionesPorDia = computed(
  () =>
    Object.fromEntries(
      DIAS.map((dia) => [
        dia.codigo,
        sesiones.value
          .filter((sesion) => sesion.dia === dia.codigo)
          .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
      ]),
    ) as Record<(typeof DIAS)[number]['codigo'], HorarioEstudiante[]>,
)

function hora(valor: string): string {
  return valor.slice(0, 5)
}

async function cargarHorario(): Promise<void> {
  if (!ficha.value || !periodoAnio.value) {
    sesiones.value = []
    return
  }
  cargando.value = true
  error.value = ''
  try {
    sesiones.value = await consultarHorario(anio.value)
  } catch (fallo: unknown) {
    sesiones.value = []
    error.value = obtenerMensajeError(fallo, 'No se pudo consultar tu horario.')
  } finally {
    cargando.value = false
  }
}

async function cargar(): Promise<void> {
  cargandoFicha.value = true
  errorFicha.value = ''
  try {
    ficha.value = await obtenerFicha()
    if (anios.value.length && !anios.value.includes(anio.value)) {
      anio.value = anios.value.includes(anioActual) ? anioActual : (anios.value.at(-1) ?? anioActual)
    }
    await cargarHorario()
  } catch (fallo: unknown) {
    errorFicha.value = obtenerMensajeError(fallo, 'No se pudo cargar tu información.')
  } finally {
    cargandoFicha.value = false
  }
}

function imprimirHorario(): void {
  window.print()
}

watch(anio, () => {
  if (ficha.value && !cargandoFicha.value) void cargarHorario()
})
onMounted(() => {
  void cargar()
  temporizador = setInterval(() => void cargarHorario(), 60_000)
  window.addEventListener('focus', cargarHorario)
})
onUnmounted(() => {
  clearInterval(temporizador)
  window.removeEventListener('focus', cargarHorario)
})
</script>

<template>
  <main class="docente-vista horario-estudiante">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">Portal del estudiante</span>
        <h1>Mi horario</h1>
        <p v-if="nombreSeccion">{{ nombreSeccion }} · Año escolar {{ anio }}</p>
        <p v-else>Consulta tus clases y aulas asignadas.</p>
      </div>
      <label v-if="anios.length" class="selector-anio">
        Año escolar
        <select v-model.number="anio">
          <option v-for="valor in anios" :key="valor" :value="valor">{{ valor }}</option>
        </select>
      </label>
    </header>

    <PanelEstadoCarga
      v-if="cargandoFicha || errorFicha"
      :cargando="cargandoFicha"
      :error="errorFicha"
      @reintentar="cargar"
    />

    <AvisoMensaje
      v-else-if="!ficha?.periodos.length"
      mensaje="Todavía no tienes una matrícula confirmada. Cuando el colegio la confirme, aquí verás tu horario."
    />

    <AvisoMensaje v-else-if="error" :mensaje="error" tipo="error" />

    <section
      v-else
      class="docente-tarjeta horario-estudiante__grilla"
      aria-labelledby="titulo-horario"
      :aria-busy="cargando"
    >
      <div class="horario-estudiante__cabecera">
        <div>
          <h2 id="titulo-horario">Horario semanal · {{ nombreSeccion }} · {{ anio }}</h2>
          <p>Asignaturas, docentes y aulas de tu matrícula confirmada.</p>
        </div>
        <button
          type="button"
          class="docente-boton docente-boton--secundario"
          :disabled="cargando || !sesiones.length"
          @click="imprimirHorario"
        >
          Imprimir / Guardar como PDF
        </button>
      </div>

      <p v-if="cargando" class="horario-estudiante__vacio" role="status">Consultando horario…</p>
      <p v-else-if="!sesiones.length" class="horario-estudiante__vacio">
        Aún no hay clases asignadas para este año escolar.
      </p>
      <div v-else class="horario-estudiante__semana">
        <section v-for="dia in DIAS" :key="dia.codigo" class="horario-estudiante__dia" :aria-label="dia.nombre">
          <h3>{{ dia.nombre }}</h3>
          <p v-if="!sesionesPorDia[dia.codigo].length" class="horario-estudiante__sin-clases">Sin clases asignadas.</p>
          <article v-for="sesion in sesionesPorDia[dia.codigo]" :key="sesion.id" class="horario-estudiante__clase">
            <div class="horario-estudiante__horas">
              <strong>{{ hora(sesion.horaInicio) }}</strong>
              <span>{{ hora(sesion.horaFin) }}</span>
            </div>
            <div>
              <h4>{{ sesion.areaNombre }}</h4>
              <p>{{ sesion.docenteNombre }}</p>
              <small>Aula {{ sesion.aulaCodigo }}</small>
            </div>
          </article>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.horario-estudiante {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.horario-estudiante__grilla {
  padding: 22px 24px;
}

.horario-estudiante__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.horario-estudiante__cabecera h2 {
  margin: 0 0 5px;
  font-size: 18px;
}

.horario-estudiante__cabecera p,
.horario-estudiante__vacio {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

.horario-estudiante__semana {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.horario-estudiante__dia {
  min-width: 0;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.horario-estudiante__dia h3 {
  margin: 0 0 10px;
  color: #1e3a8a;
  font-size: 14px;
}

.horario-estudiante__sin-clases {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
}

.horario-estudiante__clase {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 8px;
  padding: 9px 0;
  border-top: 1px solid #e2e8f0;
  break-inside: avoid;
}

.horario-estudiante__horas {
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: #475569;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.horario-estudiante__clase h4 {
  margin: 0;
  color: #172554;
  font-size: 12px;
}

.horario-estudiante__clase p {
  margin: 4px 0;
  color: #475569;
  font-size: 11px;
}

.horario-estudiante__clase small {
  color: #64748b;
  font-size: 10px;
}

@media (max-width: 950px) {
  .horario-estudiante__semana {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media print {
  @page {
    size: landscape;
    margin: 12mm;
  }

  :global(body) {
    background: #fff !important;
  }

  :global(.docente-lateral),
  :global(.docente-superior) {
    display: none !important;
  }

  :global(.portal-docente),
  :global(.portal-docente__contenido) {
    display: block !important;
    min-height: 0 !important;
  }

  :global(.portal-docente__pagina) {
    padding: 0 !important;
  }

  .horario-estudiante {
    display: block;
  }

  .horario-estudiante > :not(.horario-estudiante__grilla) {
    display: none !important;
  }

  .horario-estudiante__grilla {
    padding: 0;
    border: 0;
    box-shadow: none;
  }

  .horario-estudiante__cabecera button {
    display: none !important;
  }

  .horario-estudiante__semana {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .horario-estudiante__dia,
  .horario-estudiante__clase {
    break-inside: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
