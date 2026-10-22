<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { PeriodoMatricula } from '~/types/periodoMatricula'
import type { Seccion } from '~/types/seccion'
import { usePeriodoMatricula } from '~/composables/usePeriodoMatricula'
import { useSecciones } from '~/composables/useSecciones'
import {
  calcularResumenVacantes,
  describirDiasParaInicio,
  describirDiasRestantes,
  obtenerSituacionPeriodo,
} from '~/composables/useResumenMatricula'
import { formatearFecha, obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useDatosPrueba'
import { usePermisosRol } from '~/composables/usePermisosRol'

definePageMeta({
  middleware: 'autenticacion',
})

const { listarPeriodos } = usePeriodoMatricula()
const { listarSecciones } = useSecciones()
const { puede } = usePermisosRol()

const periodos = ref<PeriodoMatricula[]>([])
const secciones = ref<Seccion[]>([])
const cargando = ref(true)
const errorCarga = ref('')
const fechaHoy = obtenerFechaHoyIso()

async function cargarResumen(): Promise<void> {
  cargando.value = true
  errorCarga.value = ''

  try {
    const [periodosCargados, seccionesCargadas] = await Promise.all([listarPeriodos(), listarSecciones()])
    periodos.value = periodosCargados
    secciones.value = seccionesCargadas
  } catch (error: unknown) {
    errorCarga.value = obtenerMensajeError(error, 'No se pudo cargar el resumen de matrícula.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargarResumen)

const situacion = computed(() => obtenerSituacionPeriodo(periodos.value))
const periodoVigente = computed(() => situacion.value.vigente)
const proximoPeriodo = computed(() => situacion.value.proximo)
const resumen = computed(() => calcularResumenVacantes(secciones.value))

const sinVacantes = computed(() => secciones.value.length > 0 && resumen.value.vacantes === 0)
const puedeRegistrar = computed(() => periodoVigente.value !== null && !sinVacantes.value)

const motivoBloqueo = computed(() => {
  if (!periodoVigente.value) {
    return 'Disponible cuando el periodo de matrícula esté vigente.'
  }

  return sinVacantes.value ? 'No quedan vacantes en ninguna sección.' : ''
})
</script>

<template>
  <main class="pagina-resumen-matricula">
    <EncabezadoPagina titulo="Matrícula" descripcion="Gestiona el proceso de matrícula del año escolar." />

    <PanelEstadoCarga :cargando="cargando" :error="errorCarga" @reintentar="cargarResumen">
      <section v-if="periodoVigente" class="estado-periodo vigente" aria-labelledby="titulo-periodo">
        <div>
          <h2 id="titulo-periodo">Periodo de matrícula {{ periodoVigente.anhio }}</h2>
          <p>
            Del {{ formatearFecha(periodoVigente.fechaInicio) }} al {{ formatearFecha(periodoVigente.fechaFin) }}.
            {{ describirDiasRestantes(periodoVigente.fechaFin, fechaHoy) }}
          </p>
        </div>
        <InsigniaEstado texto="Vigente" variante="exito" />
      </section>

      <section v-else class="estado-periodo pendiente" aria-labelledby="titulo-periodo">
        <div>
          <h2 id="titulo-periodo">No hay un periodo de matrícula vigente</h2>
          <p v-if="proximoPeriodo">
            El periodo {{ proximoPeriodo.anhio }} va del {{ formatearFecha(proximoPeriodo.fechaInicio) }} al
            {{ formatearFecha(proximoPeriodo.fechaFin) }}.
            {{ describirDiasParaInicio(proximoPeriodo.fechaInicio, fechaHoy) }}
            Las matrículas solo se registran dentro del periodo.
          </p>
          <p v-else>Configura el periodo para habilitar el registro de matrículas.</p>
        </div>
        <InsigniaEstado :texto="proximoPeriodo ? 'Pendiente' : 'Sin periodo'" variante="advertencia" />
      </section>

      <section class="acciones" aria-label="Acciones de matrícula">
        <article v-if="puede('MATRICULA_REGISTRAR')" class="tarjeta-accion">
          <h2>Registrar matrícula</h2>
          <p>Asigna grado y sección a un estudiante con vacantes disponibles.</p>

          <BotonAccion v-if="puedeRegistrar" destino="/matriculas/nueva">Registrar matrícula</BotonAccion>

          <template v-else>
            <span class="boton-bloqueado" aria-disabled="true">Registrar matrícula</span>
            <small class="motivo">{{ motivoBloqueo }}</small>
          </template>
        </article>

        <article v-if="puede('PERIODO_CONFIGURAR')" class="tarjeta-accion" :class="{ destacada: !periodoVigente }">
          <h2>Periodo de matrícula</h2>
          <p>Configura la fecha de inicio y la fecha límite del periodo de cada año escolar.</p>

          <BotonAccion :variante="periodoVigente ? 'secundario' : 'primario'" destino="/matriculas/periodo">
            Configurar periodo
          </BotonAccion>
        </article>
      </section>

      <section class="vacantes" aria-labelledby="titulo-vacantes">
        <header class="encabezado-vacantes">
          <h2 id="titulo-vacantes">Vacantes del año escolar</h2>
          <NuxtLink v-if="puede('SECCION_VER')" to="/secciones" class="enlace">Ver detalle por sección</NuxtLink>
        </header>

        <div class="indicadores">
          <div class="indicador">
            <span>Capacidad total</span>
            <strong>{{ resumen.capacidad }}</strong>
          </div>

          <div class="indicador">
            <span>Matriculados</span>
            <strong>{{ resumen.matriculados }}</strong>
          </div>

          <div class="indicador destacado">
            <span>Vacantes disponibles</span>
            <strong>{{ resumen.vacantes }}</strong>
          </div>

          <div class="indicador" :class="{ alerta: resumen.seccionesSinVacantes > 0 }">
            <span>Secciones sin vacantes</span>
            <strong>{{ resumen.seccionesSinVacantes }}</strong>
          </div>
        </div>
      </section>
    </PanelEstadoCarga>
  </main>
</template>

<style scoped>
.pagina-resumen-matricula {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}

.estado-periodo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid;
  border-radius: 12px;
}

.estado-periodo.vigente {
  border-color: #a7f3d0;
  background: #ecfdf5;
}

.estado-periodo.pendiente {
  border-color: #fde68a;
  background: #fffbeb;
}

.estado-periodo h2 {
  margin: 0 0 4px;
  color: #191c1e;
  font-size: 18px;
}

.estado-periodo p {
  margin: 0;
  color: #434655;
  font-size: 14px;
  line-height: 1.5;
}

.acciones {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.tarjeta-accion {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 20px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.tarjeta-accion.destacada {
  border-color: #004ac6;
  box-shadow: 0 0 0 3px rgb(0 74 198 / 12%);
}

.tarjeta-accion h2 {
  margin: 0;
  color: #191c1e;
  font-size: 17px;
}

.tarjeta-accion p {
  margin: 0 0 8px;
  color: #434655;
  font-size: 14px;
  line-height: 1.5;
}

.boton-bloqueado {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  padding: 10px 18px;
  border-radius: 8px;
  background: #9db3e3;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: not-allowed;
}

.motivo {
  color: #737686;
  font-size: 12px;
}

.vacantes {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.encabezado-vacantes {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.encabezado-vacantes h2 {
  margin: 0;
  color: #191c1e;
  font-size: 17px;
}

.enlace {
  color: #004ac6;
  font-size: 14px;
  font-weight: 600;
}

.indicadores {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.indicador {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: white;
}

.indicador span {
  color: #434655;
  font-size: 12px;
}

.indicador strong {
  color: #191c1e;
  font-size: 30px;
}

.indicador.destacado {
  background: #ecfdf5;
}

.indicador.alerta {
  background: #fef2f2;
}

@media (max-width: 960px) {
  .indicadores {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .pagina-resumen-matricula {
    padding: 20px 16px;
  }

  .estado-periodo {
    align-items: flex-start;
    flex-direction: column;
  }

  .acciones {
    grid-template-columns: 1fr;
  }

  .indicadores {
    gap: 8px;
  }

  .indicador {
    padding: 12px;
  }

  .indicador strong {
    font-size: 22px;
  }
}
</style>
