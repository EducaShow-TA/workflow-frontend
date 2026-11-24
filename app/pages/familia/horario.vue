<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { usePortalFamilia } from '~/composables/usePortalFamilia'
import type { HijoVinculado } from '~/types/familia'
import type { HorarioEstudiante } from '~/types/portalEstudiante'

definePageMeta({ middleware: 'autenticacion', layout: 'familia' })

const DIAS = [
  { codigo: 'MONDAY', nombre: 'Lunes' },
  { codigo: 'TUESDAY', nombre: 'Martes' },
  { codigo: 'WEDNESDAY', nombre: 'Miércoles' },
  { codigo: 'THURSDAY', nombre: 'Jueves' },
  { codigo: 'FRIDAY', nombre: 'Viernes' },
] as const

const ruta = useRoute()
const { listarHijos, consultarHorario } = usePortalFamilia()
const hijos = ref<HijoVinculado[]>([])
const estudianteId = ref<number | ''>('')
const anio = ref(ahoraSistema().getFullYear())
const sesiones = ref<HorarioEstudiante[]>([])
const cargandoHijos = ref(true)
const cargando = ref(false)
const error = ref('')
let temporizador: ReturnType<typeof setInterval> | undefined
let solicitud = 0

const hijoActual = computed(() => hijos.value.find((hijo) => hijo.estudianteId === estudianteId.value) ?? null)
const periodos = computed(() => hijoActual.value?.periodos ?? [])
const anios = computed(() => {
  const resultado = new Set<number>()
  for (const periodo of periodos.value) {
    for (let valor = Number(periodo.fechaInicio.slice(0, 4)); valor <= Number(periodo.fechaFin.slice(0, 4)); valor++) {
      resultado.add(valor)
    }
  }
  return [...resultado].sort((a, b) => a - b)
})
const periodoAnio = computed(
  () =>
    periodos.value
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

function imprimir(): void {
  window.print()
}

async function cargarHorario(): Promise<void> {
  const estudiante = estudianteId.value
  const turno = ++solicitud
  if (typeof estudiante !== 'number' || !periodoAnio.value) {
    sesiones.value = []
    return
  }
  cargando.value = true
  error.value = ''
  try {
    const resultado = await consultarHorario(estudiante, anio.value)
    if (turno === solicitud) sesiones.value = resultado
  } catch (fallo: unknown) {
    if (turno === solicitud) {
      sesiones.value = []
      error.value = obtenerMensajeError(fallo, 'No se pudo consultar el horario de tu hijo.')
    }
  } finally {
    if (turno === solicitud) cargando.value = false
  }
}

async function cargarHijos(): Promise<void> {
  cargandoHijos.value = true
  try {
    hijos.value = await listarHijos()
    const indicado = Number(ruta.query.estudianteId)
    estudianteId.value = hijos.value.some((hijo) => hijo.estudianteId === indicado)
      ? indicado
      : (hijos.value[0]?.estudianteId ?? '')
    if (anios.value.length && !anios.value.includes(anio.value)) {
      anio.value = anios.value.includes(ahoraSistema().getFullYear())
        ? ahoraSistema().getFullYear()
        : (anios.value.at(-1) ?? anio.value)
    }
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar los hijos vinculados.')
  } finally {
    cargandoHijos.value = false
  }
}

watch([estudianteId, anio], () => void cargarHorario())
onMounted(() => {
  void cargarHijos()
  temporizador = setInterval(() => void cargarHorario(), 60_000)
  window.addEventListener('focus', cargarHorario)
})
onUnmounted(() => {
  solicitud++
  clearInterval(temporizador)
  window.removeEventListener('focus', cargarHorario)
})
</script>

<template>
  <main class="horario-familia">
    <header class="cabecera">
      <div>
        <span class="sobrelinea">Portal del apoderado</span>
        <h1>Horario de mi hijo</h1>
        <p v-if="hijoActual">
          {{ hijoActual.nombreCompleto }} · {{ nombreSeccion || 'Matrícula del año' }} · {{ anio }}
        </p>
      </div>
      <div class="filtros">
        <label v-if="hijos.length > 1">
          Estudiante
          <select v-model.number="estudianteId">
            <option v-for="hijo in hijos" :key="hijo.estudianteId" :value="hijo.estudianteId">
              {{ hijo.nombreCompleto }}
            </option>
          </select>
        </label>
        <label v-if="anios.length">
          Año escolar
          <select v-model.number="anio">
            <option v-for="valor in anios" :key="valor" :value="valor">{{ valor }}</option>
          </select>
        </label>
        <button type="button" :disabled="cargando || !sesiones.length" @click="imprimir">
          Imprimir / Guardar como PDF
        </button>
      </div>
    </header>

    <AvisoMensaje v-if="cargandoHijos" mensaje="Cargando estudiantes vinculados…" />
    <AvisoMensaje v-else-if="!hijos.length" mensaje="Tu cuenta no tiene estudiantes vinculados." />
    <AvisoMensaje v-else-if="error" :mensaje="error" tipo="error" />
    <section v-else class="grilla" :aria-busy="cargando" aria-label="Horario semanal">
      <p v-if="cargando" class="estado" role="status">Actualizando horario…</p>
      <p v-else-if="!sesiones.length" class="estado">No hay clases asignadas para este año escolar.</p>
      <div v-else class="semana">
        <section v-for="dia in DIAS" :key="dia.codigo" class="dia" :aria-label="dia.nombre">
          <h2>{{ dia.nombre }}</h2>
          <p v-if="!sesionesPorDia[dia.codigo].length" class="vacio">Sin clases asignadas.</p>
          <article v-for="sesion in sesionesPorDia[dia.codigo]" :key="sesion.id" class="clase">
            <div class="horas">
              <strong>{{ hora(sesion.horaInicio) }}</strong><span>{{ hora(sesion.horaFin) }}</span>
            </div>
            <div>
              <h3>{{ sesion.areaNombre }}</h3>
              <p>{{ sesion.docenteNombre }}</p>
              <small>Aula {{ sesion.aulaCodigo }} · {{ sesion.gradoNumero }}.° {{ sesion.seccionCodigo }}</small>
            </div>
          </article>
        </section>
      </div>
    </section>
    <small class="actualizacion"
      >El horario se actualiza al entrar en esta página, volver a ella y periódicamente.</small
    >
  </main>
</template>

<style scoped>
.horario-familia {
  display: flex;
  max-width: 1500px;
  flex-direction: column;
  gap: 18px;
  margin: auto;
  padding: 28px;
  color: #172b42;
}
.cabecera {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}
.sobrelinea {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}
h1 {
  margin: 4px 0;
  font-size: 26px;
}
.cabecera p {
  margin: 0;
  color: #64748b;
}
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}
label {
  display: grid;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
}
select,
button {
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: white;
  color: #172b42;
  font: inherit;
}
button {
  border-color: #234486;
  color: white;
  background: #234486;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.grilla {
  min-height: 120px;
  padding: 16px;
  border: 1px solid #d9e0eb;
  border-radius: 12px;
  background: white;
}
.semana {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.dia {
  min-height: 180px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  background: #f8fafc;
}
.dia h2 {
  margin: 0 0 10px;
  font-size: 15px;
}
.clase {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  padding: 10px;
  border-left: 3px solid #3159a8;
  border-radius: 6px;
  background: white;
  break-inside: avoid;
}
.horas {
  display: grid;
  align-content: start;
  gap: 3px;
  color: #3159a8;
  font-size: 12px;
}
.clase h3 {
  margin: 0;
  font-size: 13px;
}
.clase p,
.clase small,
.vacio,
.estado,
.actualizacion {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}
.actualizacion {
  align-self: flex-end;
}
@media (max-width: 950px) {
  .semana {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .cabecera {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media print {
  @page {
    size: landscape;
    margin: 12mm;
  }
  :global(body) {
    background: white !important;
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
  .horario-familia {
    display: block;
    padding: 0;
  }
  .filtros,
  .actualizacion {
    display: none !important;
  }
  .grilla {
    border: 0;
    padding: 0;
  }
  .semana {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 7px;
  }
  .dia,
  .clase {
    break-inside: avoid;
    -webkit-print-color-adjust: exact;
  }
}
</style>
