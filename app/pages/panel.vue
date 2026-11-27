<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  fechaLocalPanel,
  fechaTituloPanel,
  formatearSolesPanel,
  listarPendientesPanel,
  mesesCobranzaPanel,
  nombreMesPanel,
  porcentajePanel,
  saludoPanel,
  tiempoRelativoPanel,
  usePanelAdministrador,
} from '~/composables/usePanelAdministrador'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { CobranzaMesPanel, OcupacionGradoPanel, PanelAdministrador } from '~/types/panelAdministrador'

definePageMeta({
  middleware: 'autenticacion',
})

const api = usePanelAdministrador()
const autenticacion = useAutenticacionStore()
const panel = ref<PanelAdministrador | null>(null)
const cargando = ref(true)
const error = ref('')
const ahora = ref(ahoraSistema())

const accesos = [
  {
    titulo: 'Registrar estudiante',
    destino: '/estudiantes/nuevo',
    icono: '/icons/accion-estudiante.svg',
    fondo: '#004ac61a',
  },
  { titulo: 'Crear matrícula', destino: '/matriculas/nueva', icono: '/icons/accion-matricula.svg', fondo: '#4059aa' },
  { titulo: 'Registrar pago', destino: '/finanzas', icono: '/icons/accion-pago.svg', fondo: '#196fc01a' },
  { titulo: 'Gestionar horarios', destino: '/horarios', icono: '/icons/accion-horarios.svg', fondo: '#7376861a' },
]

const saludo = computed(() => saludoPanel(ahora.value, autenticacion.usuario?.nombreCompleto))

const ventana = computed(() => {
  const datos = panel.value
  if (!datos?.ventanaMatricula) return null
  const { estado, fechaInicio, anhioEscolar } = datos.ventanaMatricula
  if (estado === 'PENDIENTE') {
    const fecha = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long' }).format(
      fechaLocalPanel(fechaInicio),
    )
    return { texto: `Matrícula ${anhioEscolar} abre el ${fecha}`, abierta: false }
  }
  return { texto: `Matrícula ${anhioEscolar} abierta · hasta que la desactives`, abierta: true }
})

const pendientes = computed(() => (panel.value ? listarPendientesPanel(panel.value) : []))

const indicadores = computed(() => {
  const datos = panel.value
  if (!datos) return []
  const i = datos.indicadores
  const mes = new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(fechaLocalPanel(datos.fecha)).toLowerCase()
  const ocupacion = Math.round(porcentajePanel(i.estudiantesMatriculados, i.vacantesTotales))
  const porConfirmar = i.estudiantesMatriculados - i.estudiantesConfirmados
  const cobro = Math.round(porcentajePanel(i.pensionMesCobrada, i.pensionMesEmitida))
  const asistencia = porcentajePanel(i.presentesSemana, i.asistenciasSemana)
  const docentes = porcentajePanel(i.docentesPresentesHoy, i.docentesConClaseHoy)
  return [
    {
      titulo: `Estudiantes matriculados ${datos.anio}`,
      valor: String(i.estudiantesConfirmados),
      detalle: i.vacantesTotales
        ? `${porConfirmar ? `+${porConfirmar} por confirmar · ` : ''}de ${i.vacantesTotales} vacantes · ${ocupacion} % ocupado`
        : 'Sin secciones registradas este año',
      avance: ocupacion,
      tono: 'azul',
      destino: '/secciones',
    },
    {
      titulo: `Cobrado de ${mes}`,
      valor: formatearSolesPanel(i.pensionMesCobrada),
      detalle: i.pensionMesEmitida
        ? `${cobro} % de ${formatearSolesPanel(i.pensionMesEmitida)} emitidos`
        : 'Sin boletas emitidas este mes',
      avance: cobro,
      tono: 'verde',
      destino: '/finanzas',
    },
    {
      titulo: 'Asistencia de alumnos',
      valor: i.asistenciasSemana ? `${asistencia.toLocaleString('es-PE')} %` : '—',
      detalle: i.asistenciasSemana
        ? `Esta semana · ${i.tardanzasSemana} ${i.tardanzasSemana === 1 ? 'tardanza' : 'tardanzas'}`
        : 'Aún no hay asistencia registrada esta semana',
      avance: asistencia,
      tono: 'verde',
      destino: '/reportes/asistencia',
    },
    {
      titulo: 'Docentes presentes hoy',
      valor: i.docentesConClaseHoy ? `${i.docentesPresentesHoy} / ${i.docentesConClaseHoy}` : '—',
      detalle: i.docentesConClaseHoy
        ? `${i.docentesTardanzaHoy} ${i.docentesTardanzaHoy === 1 ? 'tardanza' : 'tardanzas'} · ${datos.pendientes.docentesSinMarcar} sin marcar`
        : 'Hoy no hay clases programadas',
      avance: docentes,
      tono: 'azul',
      destino: '/asistencia-docentes',
    },
  ]
})

const meses = computed(() => (panel.value ? mesesCobranzaPanel(panel.value.cobranza) : []))
const mesActual = computed(() => (panel.value ? fechaLocalPanel(panel.value.fecha).getMonth() + 1 : 0))
const maximoMes = computed(() => Math.max(1, ...meses.value.map((m) => m.pagado + m.vencido + m.porVencer)))
const hayCobranza = computed(() => meses.value.some((m) => m.pagado + m.vencido + m.porVencer > 0))

function alto(monto: number): string {
  return `${(monto / maximoMes.value) * 100}%`
}

function resumenMes(m: CobranzaMesPanel): string {
  return `${nombreMesPanel(m.mes)}: pagado ${formatearSolesPanel(m.pagado)}, vencido ${formatearSolesPanel(m.vencido)}, por vencer ${formatearSolesPanel(m.porVencer)}`
}

function nombreGrado(g: OcupacionGradoPanel): string {
  return formatearGrado(g.grado, g.nivelEducativo)
}

function tonoOcupacion(g: OcupacionGradoPanel): string {
  const porcentaje = porcentajePanel(g.matriculados, g.vacantes)
  return porcentaje >= 100 ? 'lleno' : porcentaje >= 90 ? 'casi' : 'azul'
}

const iconosActividad = { PAGO: 'S/', MORA: '!', RECTIFICACION: '✎' } as const

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    panel.value = await api.consultar()
    ahora.value = ahoraSistema()
  } catch (causa) {
    error.value = obtenerMensajeError(causa, 'No se pudo cargar el resumen del colegio.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <main class="pagina-panel">
    <header class="encabezado">
      <div>
        <span class="sobrelinea">Resumen del colegio</span>
        <h1>{{ saludo }}</h1>
        <p v-if="panel">{{ fechaTituloPanel(panel.fecha, panel.anio) }}</p>
      </div>
      <NuxtLink v-if="ventana" to="/matriculas" :class="['chip', { 'chip--proxima': !ventana.abierta }]">
        <span class="chip__punto" aria-hidden="true" />{{ ventana.texto }}
      </NuxtLink>
    </header>

    <nav class="accesos" aria-label="Accesos rápidos">
      <NuxtLink
        v-for="(acceso, indice) in accesos"
        :key="acceso.destino"
        :to="acceso.destino"
        :class="['acceso', { 'acceso--principal': indice === 0 }]"
      >
        <span class="acceso__icono" :style="{ background: indice === 0 ? undefined : acceso.fondo }">
          <img :src="acceso.icono" alt="" />
        </span>
        {{ acceso.titulo }}
      </NuxtLink>
    </nav>

    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <p v-if="cargando && !panel" class="cargando" role="status">Consultando el resumen del colegio…</p>

    <template v-if="panel">
      <section class="tarjeta atencion" aria-labelledby="titulo-atencion">
        <div class="tarjeta__cabecera">
          <h2 id="titulo-atencion">Requiere tu atención</h2>
          <button type="button" class="enlace" :disabled="cargando" @click="cargar">
            {{ cargando ? 'Actualizando…' : 'Actualizar' }}
          </button>
        </div>
        <ul v-if="pendientes.length" class="pendientes">
          <li v-for="pendiente in pendientes" :key="pendiente.destino">
            <span :class="['numero', `numero--${pendiente.tono}`]">{{ pendiente.cantidad }}</span>
            <div class="pendientes__texto">
              {{ pendiente.titulo }}
              <small>{{ pendiente.detalle }}</small>
            </div>
            <NuxtLink :to="pendiente.destino">{{ pendiente.enlace }} →</NuxtLink>
          </li>
        </ul>
        <p v-else class="al-dia">✓ Todo al día: no hay pendientes por revisar.</p>
      </section>

      <section class="indicadores" aria-label="Indicadores principales">
        <NuxtLink v-for="indicador in indicadores" :key="indicador.titulo" :to="indicador.destino" class="tarjeta kpi">
          <span class="kpi__titulo">{{ indicador.titulo }}</span>
          <strong>{{ indicador.valor }}</strong>
          <small>{{ indicador.detalle }}</small>
          <span :class="['barra', `barra--${indicador.tono}`]" aria-hidden="true">
            <span :style="{ width: `${indicador.avance}%` }" />
          </span>
        </NuxtLink>
      </section>

      <div class="fila">
        <section class="tarjeta" aria-labelledby="titulo-cobranza">
          <div class="tarjeta__cabecera">
            <h2 id="titulo-cobranza">Cobranza de pensiones {{ panel.anio }}</h2>
            <NuxtLink to="/finanzas">Ver finanzas</NuxtLink>
          </div>
          <template v-if="hayCobranza">
            <div class="leyenda">
              <span><i class="muestra muestra--pagado" />Pagado</span>
              <span><i class="muestra muestra--vencido" />Vencido / en mora</span>
              <span><i class="muestra muestra--futuro" />Por vencer</span>
            </div>
            <ul class="grafico" :aria-label="`Cobranza por mes de ${panel.anio}`">
              <li
                v-for="m in meses"
                :key="m.mes"
                :class="['columna', { 'columna--actual': m.mes === mesActual }]"
                :title="resumenMes(m)"
              >
                <span class="solo-lectores">{{ resumenMes(m) }}</span>
                <span class="pila" aria-hidden="true">
                  <span class="segmento segmento--futuro" :style="{ height: alto(m.porVencer) }" />
                  <span class="segmento segmento--vencido" :style="{ height: alto(m.vencido) }" />
                  <span class="segmento segmento--pagado" :style="{ height: alto(m.pagado) }" />
                </span>
                <span class="columna__mes" aria-hidden="true">{{ nombreMesPanel(m.mes) }}</span>
              </li>
            </ul>
            <p class="nota">Pasa el cursor por una barra para ver los montos del mes.</p>
          </template>
          <p v-else class="vacio">Aún no hay boletas de pensión emitidas este año.</p>
        </section>

        <section class="tarjeta" aria-labelledby="titulo-ocupacion">
          <div class="tarjeta__cabecera">
            <h2 id="titulo-ocupacion">Ocupación por grado</h2>
            <NuxtLink to="/secciones">Ver secciones</NuxtLink>
          </div>
          <ul v-if="panel.ocupacion.length" class="grados">
            <li v-for="grado in panel.ocupacion" :key="`${grado.nivelEducativo}-${grado.grado}`">
              <div class="grados__linea">
                <b>{{ nombreGrado(grado) }}</b>
                <small>
                  {{ grado.matriculados }} / {{ grado.vacantes }} ·
                  {{
                    grado.vacantes > 0 && grado.matriculados >= grado.vacantes
                      ? 'completo'
                      : `${grado.secciones} ${grado.secciones === 1 ? 'sección' : 'secciones'}`
                  }}
                </small>
              </div>
              <span
                :class="['barra', 'barra--grado', `barra--${tonoOcupacion(grado)}`]"
                role="progressbar"
                :aria-valuenow="porcentajePanel(grado.matriculados, grado.vacantes)"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="`Ocupación de ${nombreGrado(grado)}`"
              >
                <span :style="{ width: `${porcentajePanel(grado.matriculados, grado.vacantes)}%` }" />
              </span>
            </li>
          </ul>
          <p v-else class="vacio">No hay secciones con periodo registrado este año.</p>
        </section>
      </div>

      <section class="tarjeta" aria-labelledby="titulo-actividad">
        <div class="tarjeta__cabecera">
          <h2 id="titulo-actividad">Actividad reciente</h2>
          <NuxtLink to="/finanzas/auditoria">Ver auditoría</NuxtLink>
        </div>
        <ul v-if="panel.actividad.length" class="actividad">
          <li v-for="(evento, indice) in panel.actividad" :key="indice">
            <span :class="['icono', `icono--${evento.tipo.toLowerCase()}`]" aria-hidden="true">
              {{ iconosActividad[evento.tipo] }}
            </span>
            <div>
              {{ evento.titulo }}
              <small>{{ evento.detalle }} · {{ tiempoRelativoPanel(evento.fecha, ahora) }}</small>
            </div>
          </li>
        </ul>
        <p v-else class="vacio">Todavía no hay pagos ni rectificaciones registradas.</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.pagina-panel {
  display: flex;
  width: 100%;
  max-width: 1240px;
  flex-direction: column;
  gap: 18px;
  padding: 28px 32px 40px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.sobrelinea {
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.encabezado h1 {
  margin: 4px 0 2px;
  color: #0f172a;
  font-size: 28px;
}

.encabezado p {
  margin: 0;
  color: #475569;
  font-size: 14px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
}

.chip__punto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #16a34a;
}

.chip--proxima {
  background: #dbeafe;
  color: #1e40af;
}

.chip--proxima .chip__punto {
  background: #2563eb;
}

.accesos {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: -4px;
}

.acceso {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: white;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.acceso__icono {
  display: grid;
  width: 26px;
  height: 26px;
  flex: none;
  place-items: center;
  border-radius: 7px;
}

.acceso__icono img {
  width: 15px;
  height: 15px;
}

.acceso:hover {
  border-color: #93c5fd;
  background: #f8fbff;
}

.acceso--principal,
.acceso--principal:hover {
  border-color: #1d4ed8;
  background: #1d4ed8;
  color: white;
}

.acceso--principal .acceso__icono {
  background: rgb(255 255 255 / 0.18);
}

.acceso--principal img {
  filter: brightness(0) invert(1);
}

.cargando,
.vacio {
  margin: 0;
  color: #475569;
  font-size: 14px;
}

.tarjeta {
  padding: 18px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: white;
}

.tarjeta__cabecera {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.tarjeta__cabecera h2 {
  margin: 0;
  color: #0f172a;
  font-size: 16px;
}

.tarjeta__cabecera a,
.pendientes a,
.enlace {
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.enlace {
  padding: 0;
  border: 0;
  background: none;
  font-family: inherit;
  cursor: pointer;
}

.atencion {
  border-left: 4px solid #f59e0b;
}

.pendientes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pendientes li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
}

.numero {
  display: grid;
  min-width: 44px;
  height: 44px;
  padding: 0 6px;
  place-items: center;
  border-radius: 10px;
  font-size: 18px;
  font-weight: 800;
}

.numero--ambar {
  background: #fef3c7;
  color: #92400e;
}

.numero--rojo {
  background: #fee2e2;
  color: #991b1b;
}

.numero--azul {
  background: #dbeafe;
  color: #1e40af;
}

.numero--gris {
  background: #e2e8f0;
  color: #334155;
}

.pendientes__texto {
  min-width: 0;
  flex: 1;
  color: #0f172a;
  font-size: 14px;
}

.pendientes__texto small,
.actividad small {
  display: block;
  color: #64748b;
  font-size: 12.5px;
}

.al-dia {
  margin: 0;
  color: #166534;
  font-size: 14px;
  font-weight: 600;
}

.indicadores {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: inherit;
  text-decoration: none;
}

.kpi:hover {
  border-color: #93c5fd;
}

.kpi__titulo {
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.kpi strong {
  color: #0f172a;
  font-size: 30px;
  line-height: 1.1;
}

.kpi small {
  color: #64748b;
  font-size: 12.5px;
}

.barra {
  display: block;
  overflow: hidden;
  height: 6px;
  margin-top: 6px;
  border-radius: 999px;
  background: #e2e8f0;
}

.barra > span {
  display: block;
  height: 100%;
  background: #2563eb;
}

.barra--verde > span {
  background: #16a34a;
}

.barra--casi > span {
  background: #f59e0b;
}

.barra--lleno > span {
  background: #dc2626;
}

.barra--grado {
  height: 9px;
}

.fila {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 14px;
}

.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 6px;
  color: #475569;
  font-size: 12.5px;
}

.muestra {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 5px;
  border-radius: 3px;
  vertical-align: -1px;
}

.muestra--pagado,
.segmento--pagado {
  background: #2563eb;
}

.muestra--vencido,
.segmento--vencido {
  background: #cbd5e1;
}

.muestra--futuro,
.segmento--futuro {
  border: 1.5px dashed #94a3b8;
  background: white;
}

.grafico {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  gap: 10px;
  height: 220px;
  margin: 0;
  padding: 8px 4px 0;
  list-style: none;
}

.columna {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.pila {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
  border-bottom: 1px solid #e2e8f0;
}

.segmento {
  display: block;
  box-sizing: border-box;
}

.segmento--futuro[style*='height: 0%'] {
  border: 0;
}

.columna--actual .segmento--vencido {
  background: repeating-linear-gradient(45deg, #fcd34d, #fcd34d 4px, #fde68a 4px, #fde68a 8px);
}

.columna__mes {
  color: #64748b;
  font-size: 12px;
  text-align: center;
}

.columna--actual .columna__mes {
  color: #0f172a;
  font-weight: 700;
}

.nota {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 12.5px;
}

.grados {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.grados__linea {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13.5px;
}

.grados__linea small {
  color: #64748b;
}

.actividad {
  margin: 0;
  padding: 0;
  list-style: none;
}

.actividad li {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
  color: #0f172a;
  font-size: 14px;
}

.actividad li:last-child {
  border-bottom: 0;
}

.icono {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
}

.icono--pago {
  background: #dbeafe;
  color: #1e40af;
}

.icono--mora {
  background: #fee2e2;
  color: #991b1b;
}

.icono--rectificacion {
  background: #fef3c7;
  color: #92400e;
}

.solo-lectores {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.enlace:focus-visible,
.acceso:focus-visible,
.kpi:focus-visible,
.chip:focus-visible {
  outline: 2px solid #1d4ed8;
  outline-offset: 2px;
}

@media (max-width: 1000px) {
  .indicadores {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .fila {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .pagina-panel {
    padding: 18px 14px 32px;
  }

  .encabezado h1 {
    font-size: 24px;
  }

  .accesos {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .acceso {
    justify-content: center;
    padding: 10px 8px;
    font-size: 13px;
  }

  .pendientes {
    grid-template-columns: 1fr;
  }

  .pendientes li {
    flex-wrap: wrap;
  }

  .pendientes a {
    flex-basis: 100%;
    padding-left: 56px;
  }

  .kpi strong {
    font-size: 26px;
  }

  .grafico {
    gap: 4px;
  }
}
</style>
