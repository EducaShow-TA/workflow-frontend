<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { PeriodoAcademico } from '~/types/periodoAcademico'
import { obtenerMensajeError } from '~/composables/useDatosPrueba'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import { usePermisosRol } from '~/composables/usePermisosRol'

definePageMeta({
  middleware: 'autenticacion',
})

const anioActual = new Date().getFullYear()
const { listarPorAnhio, abrirAnhio } = usePeriodosAcademicos()
const { puede } = usePermisosRol()
const anio = ref(anioActual)
const formulario = ref({ fechaInicio: `${anioActual}-03-01`, fechaFin: `${anioActual}-12-20` })
const periodos = ref<PeriodoAcademico[]>([])
const cargando = ref(false)
const guardando = ref(false)
const error = ref('')
const aviso = ref('')

const anioValido = computed(() => Number.isInteger(anio.value) && anio.value >= 2000 && anio.value <= 2100)
const inicioPerteneceAlAnio = computed(() => formulario.value.fechaInicio.startsWith(`${anio.value}-`))
const fechasValidas = computed(
  () =>
    Boolean(formulario.value.fechaInicio && formulario.value.fechaFin) &&
    inicioPerteneceAlAnio.value &&
    formulario.value.fechaFin > formulario.value.fechaInicio,
)

async function cargarPeriodos(): Promise<void> {
  if (!anioValido.value) {
    error.value = 'Ingresa un año entre 2000 y 2100.'
    return
  }

  cargando.value = true
  error.value = ''
  aviso.value = ''
  try {
    periodos.value = await listarPorAnhio(anio.value)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar los periodos académicos.')
  } finally {
    cargando.value = false
  }
}

async function registrarApertura(): Promise<void> {
  if (!anioValido.value || !fechasValidas.value) return

  guardando.value = true
  error.value = ''
  aviso.value = ''
  try {
    periodos.value = await abrirAnhio({ anhio: anio.value, ...formulario.value })
    aviso.value = `Año escolar ${anio.value} abierto para ${periodos.value.length} secciones.`
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo abrir el año escolar.')
  } finally {
    guardando.value = false
  }
}

function etiquetaEstado(estado: PeriodoAcademico['estado']): string {
  const etiquetas: Record<PeriodoAcademico['estado'], string> = {
    PLANIFICADO: 'Planificado',
    EN_CURSO: 'En curso',
    FINALIZADO: 'Finalizado',
  }
  return etiquetas[estado]
}

onMounted(cargarPeriodos)
</script>

<template>
  <main class="pagina-periodos-anuales">
    <EncabezadoPagina
      titulo="Año escolar por secciones"
      descripcion="Consulta vacantes y administra los periodos de clases de cada sección."
    >
      <template #acciones>
        <BotonAccion variante="secundario" destino="/matriculas">Volver a matrícula</BotonAccion>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" />

    <section v-if="puede('PERIODO_CONFIGURAR')" class="tarjeta" aria-labelledby="titulo-apertura">
      <h2 id="titulo-apertura">Abrir año escolar</h2>
      <p>Se creará un periodo para cada sección activa. Esta operación no abre la ventana de matrícula.</p>
      <form class="formulario" @submit.prevent="registrarApertura">
        <label>
          Año escolar
          <input v-model.number="anio" type="number" min="2000" max="2100" required />
        </label>
        <label>
          Inicio de clases
          <input v-model="formulario.fechaInicio" type="date" required />
        </label>
        <label>
          Fin de clases
          <input v-model="formulario.fechaFin" type="date" :min="formulario.fechaInicio" required />
        </label>
        <BotonAccion tipo="submit" :deshabilitado="guardando || !anioValido || !fechasValidas">
          {{ guardando ? 'Abriendo…' : 'Abrir año escolar' }}
        </BotonAccion>
      </form>
      <small v-if="anioValido && formulario.fechaInicio && !inicioPerteneceAlAnio" class="error">
        La fecha de inicio debe pertenecer al año escolar seleccionado.
      </small>
    </section>

    <section class="tarjeta" aria-labelledby="titulo-periodos">
      <div class="encabezado-tabla">
        <div>
          <h2 id="titulo-periodos">Periodos y vacantes</h2>
          <p>El listado corresponde al año escolar seleccionado.</p>
        </div>
        <form class="filtro" @submit.prevent="cargarPeriodos">
          <label for="filtro-anio">Año</label>
          <input id="filtro-anio" v-model.number="anio" type="number" min="2000" max="2100" />
          <BotonAccion tipo="submit" variante="secundario" :deshabilitado="cargando || !anioValido">
            Consultar
          </BotonAccion>
        </form>
      </div>

      <p v-if="cargando" role="status">Cargando periodos…</p>
      <p v-else-if="periodos.length === 0" class="vacio">No hay periodos académicos para {{ anio }}.</p>
      <div v-else class="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>Grado</th>
              <th>Sección</th>
              <th>Fechas</th>
              <th>Estado</th>
              <th>Matriculados</th>
              <th>Vacantes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="periodo in periodos" :key="periodo.periodoId">
              <td>{{ periodo.numeroGrado }}.° {{ periodo.nivelEducativo }}</td>
              <td>{{ periodo.seccion }}</td>
              <td>{{ periodo.fechaInicio }} – {{ periodo.fechaFin }}</td>
              <td>{{ etiquetaEstado(periodo.estado) }}</td>
              <td>{{ periodo.matriculasActivas }}</td>
              <td>{{ periodo.vacantesDisponibles }} / {{ periodo.vacantesTotales }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.pagina-periodos-anuales {
  display: flex;
  min-height: calc(100vh - 90px);
  flex-direction: column;
  gap: 24px;
  padding: 32px;
}

.tarjeta {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: white;
}

.tarjeta h2,
.tarjeta p {
  margin: 0;
}

.tarjeta h2 {
  color: #191c1e;
  font-size: 18px;
}

.tarjeta p,
.vacio {
  color: #434655;
  font-size: 14px;
}

.formulario,
.filtro {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 16px;
}

label {
  display: flex;
  min-width: 150px;
  flex-direction: column;
  gap: 6px;
  color: #434655;
  font-size: 13px;
}

input {
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  color: #191c1e;
}

.encabezado-tabla {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
}

.tabla-contenedor {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 14px;
}

th,
td {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

th {
  color: #434655;
  font-weight: 600;
}

.error {
  color: #991b1b;
}

@media (max-width: 640px) {
  .pagina-periodos-anuales {
    padding: 20px 16px;
  }

  .encabezado-tabla {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
