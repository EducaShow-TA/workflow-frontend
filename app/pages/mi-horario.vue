<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useHorarioFamiliar } from '~/composables/useHorarioFamiliar'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { BloqueHorarioFamiliar, DiaHorario, HorarioFamiliar } from '~/types/horarioFamiliar'

definePageMeta({ middleware: 'autenticacion', layout: 'familia' })

const autenticacion = useAutenticacionStore()
const { listar } = useHorarioFamiliar()
const anioActual = new Date().getFullYear()
const anio = ref(anioActual)
const opcionesAnio = [anioActual - 1, anioActual, anioActual + 1, anioActual + 2]
const horarios = ref<HorarioFamiliar[]>([])
const estudianteId = ref<number | null>(null)
const cargando = ref(false)
const error = ref('')
let numeroSolicitud = 0
let actualizador: ReturnType<typeof setInterval> | null = null

const esApoderado = computed(() => autenticacion.usuario?.rol === 'APODERADO')
const horarioSeleccionado = computed(
  () => horarios.value.find((horario) => horario.estudianteId === estudianteId.value) ?? horarios.value[0] ?? null,
)
const dias: { codigo: DiaHorario; nombre: string }[] = [
  { codigo: 'MONDAY', nombre: 'Lunes' },
  { codigo: 'TUESDAY', nombre: 'Martes' },
  { codigo: 'WEDNESDAY', nombre: 'Miércoles' },
  { codigo: 'THURSDAY', nombre: 'Jueves' },
  { codigo: 'FRIDAY', nombre: 'Viernes' },
]
const franjas = computed(() => {
  const unicas = new Map<string, { inicio: string; fin: string }>()
  for (const bloque of horarioSeleccionado.value?.bloques ?? []) {
    unicas.set(`${bloque.horaInicio}|${bloque.horaFin}`, { inicio: bloque.horaInicio, fin: bloque.horaFin })
  }
  return [...unicas.values()].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fin.localeCompare(b.fin))
})

function clasesEn(dia: DiaHorario, inicio: string, fin: string): BloqueHorarioFamiliar[] {
  return (horarioSeleccionado.value?.bloques ?? []).filter(
    (bloque) => bloque.dia === dia && bloque.horaInicio === inicio && bloque.horaFin === fin,
  )
}

async function cargar(): Promise<void> {
  if (!['ALUMNO', 'APODERADO'].includes(autenticacion.usuario?.rol ?? '')) return
  const actual = ++numeroSolicitud
  cargando.value = true
  error.value = ''
  try {
    const lista = await listar(anio.value)
    if (actual !== numeroSolicitud) return
    horarios.value = lista
    if (!lista.some((item) => item.estudianteId === estudianteId.value)) {
      estudianteId.value = lista[0]?.estudianteId ?? null
    }
  } catch (fallo: unknown) {
    if (actual !== numeroSolicitud) return
    horarios.value = []
    estudianteId.value = null
    error.value = obtenerMensajeError(fallo, 'No fue posible consultar el horario.')
  } finally {
    if (actual === numeroSolicitud) cargando.value = false
  }
}

watch(anio, () => void cargar())
onMounted(() => {
  void cargar()
  actualizador = setInterval(() => {
    if (document.visibilityState === 'visible') void cargar()
  }, 60000)
})
onUnmounted(() => {
  numeroSolicitud++
  if (actualizador !== null) clearInterval(actualizador)
})
</script>

<template>
  <main class="pagina-horario">
    <div class="superior">
      <div>
        <p class="sobrelinea">US-4.7 · Consulta académica</p>
        <h1>Horario de clases</h1>
        <p>
          Consulta el horario semanal de la sección. Los cambios guardados por administración se reflejan al actualizar.
        </p>
      </div>
      <button class="boton-actualizar" type="button" :disabled="cargando" @click="cargar">
        {{ cargando ? 'Consultando…' : 'Actualizar horario' }}
      </button>
    </div>

    <section class="tarjeta" aria-label="Seleccionar horario">
      <div class="filtros">
        <label>
          Año escolar
          <select v-model.number="anio" :disabled="cargando">
            <option v-for="opcion in opcionesAnio" :key="opcion" :value="opcion">{{ opcion }}</option>
          </select>
        </label>
        <label v-if="esApoderado && horarios.length">
          Estudiante
          <select v-model.number="estudianteId" :disabled="cargando">
            <option v-for="horario in horarios" :key="horario.estudianteId" :value="horario.estudianteId">
              {{ horario.estudianteNombre }}
            </option>
          </select>
        </label>
      </div>
      <p v-if="cargando" role="status" class="estado">Consultando el horario del servidor…</p>
      <div v-else-if="error" class="aviso-error" role="alert">
        {{ error }}
        <button type="button" @click="cargar">Reintentar</button>
      </div>
      <p v-else-if="!horarios.length" class="estado" role="status">
        No hay matrícula confirmada para el año seleccionado o no existen estudiantes vinculados a esta cuenta.
      </p>
      <template v-else-if="horarioSeleccionado">
        <div class="resumen">
          <strong>{{ horarioSeleccionado.estudianteNombre }}</strong>
          <span
            >{{ horarioSeleccionado.gradoNumero }}.° de secundaria · Sección
            {{ horarioSeleccionado.seccionCodigo }}</span
          >
          <span>Horario {{ horarioSeleccionado.anio }}</span>
        </div>
        <p v-if="!horarioSeleccionado.horarioDisponible" class="estado" role="status">
          Administración aún no ha configurado un horario para esta sección.
        </p>
        <p v-else-if="!horarioSeleccionado.bloques.length" class="estado" role="status">
          No hay clases vigentes configuradas para esta sección.
        </p>
        <div v-else class="contenedor-tabla">
          <table>
            <caption>
              Horario semanal de clases
            </caption>
            <thead>
              <tr>
                <th scope="col">Horario</th>
                <th v-for="dia in dias" :key="dia.codigo" scope="col">{{ dia.nombre }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="franja in franjas" :key="`${franja.inicio}-${franja.fin}`">
                <th scope="row" class="hora">{{ franja.inicio }} – {{ franja.fin }}</th>
                <td v-for="dia in dias" :key="dia.codigo">
                  <article
                    v-for="bloque in clasesEn(dia.codigo, franja.inicio, franja.fin)"
                    :key="bloque.id"
                    class="clase"
                  >
                    <strong>{{ bloque.areaNombre }}</strong>
                    <span>{{ bloque.aulaCodigo }}</span>
                    <small>{{ bloque.docenteNombre }}</small>
                  </article>
                  <span v-if="!clasesEn(dia.codigo, franja.inicio, franja.fin).length" class="sin-clase">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
    <p class="pie">Vista de solo lectura. Las modificaciones de horarios se realizan desde el Portal Administrador.</p>
  </main>
</template>

<style scoped>
.pagina-horario {
  max-width: 1500px;
  margin: 0 auto;
  padding: 32px;
  color: #1e293b;
}
.superior {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 22px;
}
.sobrelinea {
  margin: 0 0 8px;
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
}
h1 {
  margin: 0 0 8px;
  font-size: 30px;
  color: #143a72;
}
.superior p {
  max-width: 730px;
  line-height: 1.5;
}
.tarjeta {
  background: white;
  border: 1px solid #dde6f1;
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 3px 12px rgb(15 23 42 / 4%);
}
.boton-actualizar {
  border: 0;
  border-radius: 8px;
  background: #1e40af;
  color: white;
  padding: 12px 18px;
  font-weight: 600;
  cursor: pointer;
}
.boton-actualizar:disabled {
  opacity: 0.55;
  cursor: wait;
}
.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-bottom: 20px;
}
.filtros label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}
select {
  min-width: 210px;
  max-width: 100%;
  border: 1px solid #bdcce0;
  border-radius: 8px;
  padding: 10px;
  background: white;
  color: #1e293b;
}
.resumen {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
  margin-bottom: 22px;
  padding: 16px;
  background: #f0f6ff;
  border-radius: 10px;
}
.resumen strong {
  color: #143a72;
}
.resumen span {
  font-size: 14px;
}
.contenedor-tabla {
  width: 100%;
  overflow-x: auto;
}
table {
  width: 100%;
  min-width: 800px;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}
caption {
  text-align: left;
  padding: 0 0 12px;
  font-weight: 600;
  color: #475569;
}
th,
td {
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
  padding: 12px;
  text-align: left;
}
tr > :last-child {
  border-right: 0;
}
tr:last-child > * {
  border-bottom: 0;
}
thead th {
  background: #eaf1fc;
  color: #173a6f;
  font-size: 14px;
}
td {
  width: 18%;
}
.hora {
  width: 125px;
  background: #f8fafc;
  white-space: nowrap;
  font-size: 13px;
}
.clase {
  background: #eff6ff;
  border-left: 3px solid #2563eb;
  border-radius: 5px;
  padding: 10px;
  margin-bottom: 5px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.clase strong {
  color: #173a6f;
  font-size: 13px;
}
.clase span {
  font-size: 13px;
}
.clase small {
  font-size: 12px;
  color: #64748b;
}
.sin-clase {
  color: #94a3b8;
}
.estado {
  padding: 22px 12px;
  color: #64748b;
}
.aviso-error {
  padding: 16px;
  background: #fff1f2;
  color: #9f1239;
  border-radius: 8px;
}
.aviso-error button {
  margin-left: 10px;
  border: 0;
  background: none;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.pie {
  color: #64748b;
  font-size: 13px;
  margin-top: 18px;
}
@media (max-width: 600px) {
  .pagina-horario {
    padding: 16px;
  }
  .tarjeta {
    padding: 14px;
  }
  h1 {
    font-size: 25px;
  }
}
</style>
