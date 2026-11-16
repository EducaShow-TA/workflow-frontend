<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { BloqueHorarioDocente } from '~/types/horarioDocente'
import { useApi } from '~/composables/useApi'
import { obtenerMensajeError } from '~/composables/useMensajesError'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

const DIAS = [
  { codigo: 'MONDAY', nombre: 'Lunes' },
  { codigo: 'TUESDAY', nombre: 'Martes' },
  { codigo: 'WEDNESDAY', nombre: 'Miércoles' },
  { codigo: 'THURSDAY', nombre: 'Jueves' },
  { codigo: 'FRIDAY', nombre: 'Viernes' },
] as const
const api = useApi()
const anioActual = new Date().getFullYear()
const anio = ref(anioActual)
const vista = ref<'SEMANA' | 'HOY'>('SEMANA')
const sesiones = ref<BloqueHorarioDocente[]>([])
const cargando = ref(false)
const error = ref('')
const hoy = new Date().getDay()
const hoyCodigo = hoy >= 1 && hoy <= 5 ? DIAS[hoy - 1]?.codigo : null
const nombreHoy = hoyCodigo ? DIAS.find((dia) => dia.codigo === hoyCodigo)?.nombre : ''
const bloquesHoy = computed(() => sesiones.value.filter((item) => item.dia === hoyCodigo))
const cantidadSecciones = computed(
  () => new Set(sesiones.value.map((item) => `${item.gradoNumero}:${item.seccionCodigo}`)).size,
)
const cantidadAsignaturas = computed(() => new Set(sesiones.value.map((item) => item.areaCodigo)).size)
const sesionesPorDia = computed(
  () =>
    Object.fromEntries(
      DIAS.map((dia) => [dia.codigo, sesiones.value.filter((item) => item.dia === dia.codigo)]),
    ) as Record<(typeof DIAS)[number]['codigo'], BloqueHorarioDocente[]>,
)

function hora(valor: string): string {
  return valor.slice(0, 5)
}
function descripcion(bloque: BloqueHorarioDocente): string {
  return `${bloque.gradoNumero}.° Secundaria · Sección ${bloque.seccionCodigo}`
}
async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    sesiones.value = await api.solicitar<BloqueHorarioDocente[]>(`/api/v1/docentes/mi-horario?anio=${anio.value}`)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo consultar tu horario asignado.')
  } finally {
    cargando.value = false
  }
}
watch(anio, () => void cargar())
onMounted(cargar)
</script>

<template>
  <main class="docente-vista horario">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">US-4.6 · Organización académica</span>
        <h1>Mi horario de clases</h1>
        <p>Consulta tus asignaturas, secciones, aulas y bloques asignados por administración.</p>
      </div>
      <label class="selector-anio"
        >Año escolar
        <select v-model.number="anio">
          <option :value="anioActual">{{ anioActual }}</option>
          <option :value="anioActual + 1">{{ anioActual + 1 }}</option>
        </select>
      </label>
    </header>

    <section class="horario-informacion" aria-labelledby="horario-aviso-titulo">
      <div class="horario-informacion__encabezado">
        <h2 id="horario-aviso-titulo">Horario personal</h2>
        <span class="horario-etiqueta horario-etiqueta--demo">Sincronizado con el servidor</span>
      </div>
      <p>
        Solo se muestran bloques asignados a tu cuenta. Si administración modifica la grilla, vuelve a actualizar esta
        vista.
      </p>
      <div class="horario-informacion__puntos">
        <span>Horario consolidado de todas tus secciones</span><span>Área, grado, sección y aula en cada bloque</span
        ><span>Consulta semanal o del día actual</span>
      </div>
    </section>

    <section class="docente-grid docente-grid--tres horario-resumen" aria-label="Resumen de horario">
      <article class="horario-indicador">
        <div class="horario-indicador__icono"><img src="/icons/menu-horarios.svg" alt="" /></div>
        <div>
          <span>Bloques semanales</span><strong>{{ sesiones.length }}</strong
          ><small>Asignaciones del año escolar</small>
        </div>
      </article>
      <article class="horario-indicador">
        <div class="horario-indicador__icono"><img src="/icons/menu-secciones.svg" alt="" /></div>
        <div>
          <span>Secciones</span><strong>{{ cantidadSecciones }}</strong
          ><small>Secciones asignadas</small>
        </div>
      </article>
      <article class="horario-indicador">
        <div class="horario-indicador__icono"><img src="/icons/menu-competencias.svg" alt="" /></div>
        <div>
          <span>Asignaturas</span><strong>{{ cantidadAsignaturas }}</strong
          ><small>Áreas asignadas</small>
        </div>
      </article>
    </section>

    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <section class="docente-tarjeta horario-principal" aria-labelledby="horario-agenda-titulo" :aria-busy="cargando">
      <div class="horario-principal__cabecera">
        <div>
          <h2 id="horario-agenda-titulo">Agenda académica</h2>
          <p class="docente-texto-secundario">
            {{ vista === 'SEMANA' ? `Semana · ${anio}` : `Hoy · ${nombreHoy || 'fin de semana'}` }}
          </p>
        </div>
        <div class="docente-controles" role="group" aria-label="Vista del horario">
          <button
            type="button"
            :class="{ 'docente-controles__activo': vista === 'SEMANA' }"
            :aria-pressed="vista === 'SEMANA'"
            @click="vista = 'SEMANA'"
          >
            Semana completa</button
          ><button
            type="button"
            :class="{ 'docente-controles__activo': vista === 'HOY' }"
            :aria-pressed="vista === 'HOY'"
            @click="vista = 'HOY'"
          >
            Hoy
          </button>
        </div>
      </div>
      <p v-if="cargando" role="status">Consultando horario…</p>
      <p v-else-if="!sesiones.length" class="horario-dia-vacio">
        <strong>No tienes bloques asignados para {{ anio }}.</strong><br />Cuando administración publique tu horario,
        aparecerá aquí.
      </p>
      <div v-else-if="vista === 'SEMANA'" class="horario-semana">
        <section v-for="dia in DIAS" :key="dia.codigo" class="horario-dia" :aria-label="dia.nombre">
          <h3>{{ dia.nombre }}</h3>
          <p v-if="!sesionesPorDia[dia.codigo].length" class="horario-dia-vacio">Sin clases asignadas.</p>
          <article v-for="bloque in sesionesPorDia[dia.codigo]" :key="bloque.id" class="horario-dia-lista__fila">
            <div class="horario-dia-lista__horas">
              <strong>{{ hora(bloque.horaInicio) }}</strong><span>{{ hora(bloque.horaFin) }}</span>
            </div>
            <div class="horario-dia-lista__contenido">
              <h4>{{ bloque.areaNombre }}</h4>
              <p>{{ descripcion(bloque) }}</p>
              <small>Aula {{ bloque.aulaCodigo }}</small>
            </div>
          </article>
        </section>
      </div>
      <div v-else-if="!hoyCodigo" class="horario-dia-vacio">
        <strong>Hoy no es un día lectivo de lunes a viernes.</strong>
        <p>Selecciona Semana completa para consultar tus asignaciones.</p>
      </div>
      <div v-else-if="!bloquesHoy.length" class="horario-dia-vacio">
        <strong>No tienes clases asignadas para hoy.</strong>
      </div>
      <div v-else class="horario-dia-lista">
        <article v-for="bloque in bloquesHoy" :key="bloque.id" class="horario-dia-lista__fila">
          <div class="horario-dia-lista__horas">
            <strong>{{ hora(bloque.horaInicio) }}</strong><span>{{ hora(bloque.horaFin) }}</span>
          </div>
          <div class="horario-dia-lista__contenido">
            <h3>{{ bloque.areaNombre }}</h3>
            <p>{{ descripcion(bloque) }}</p>
            <small>Aula {{ bloque.aulaCodigo }}</small>
          </div>
        </article>
      </div>
      <div class="horario-principal__pie">
        <p>La vista se actualiza directamente desde los horarios asignados a tu usuario.</p>
        <button type="button" class="docente-boton docente-boton--secundario" :disabled="cargando" @click="cargar">
          Actualizar horario
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.horario {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.horario-informacion {
  padding: 20px 24px;
  border: 1px solid #bfdbfe;
  border-left: 4px solid #2563eb;
  border-radius: 12px;
  background: #eff6ff;
}
.horario-informacion__encabezado,
.horario-principal__cabecera,
.horario-previa__encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.horario-informacion h2 {
  margin: 0;
  color: #1e3a8a;
  font-size: 17px;
}
.horario-informacion > p {
  max-width: 870px;
  margin: 9px 0 14px;
  color: #1e3a8a;
  font-size: 13px;
  line-height: 1.65;
}
.horario-informacion__puntos {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}
.horario-informacion__puntos span {
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #fff;
  color: #1e40af;
  font-size: 12px;
  line-height: 1.45;
}
.horario-etiqueta {
  display: inline-block;
  flex-shrink: 0;
  padding: 6px 11px;
  border-radius: 30px;
  font-size: 11px;
  font-weight: 600;
}
.horario-etiqueta--pendiente {
  background: #e2e8f0;
  color: #475569;
}
.horario-etiqueta--demo {
  background: #dbeafe;
  color: #1d4ed8;
}
.horario-resumen {
  gap: 16px;
}
.horario-indicador {
  display: flex;
  min-width: 0;
  min-height: 115px;
  align-items: center;
  gap: 13px;
  padding: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgb(15 23 42 / 3%);
}
.horario-indicador__icono {
  display: grid;
  width: 47px;
  height: 47px;
  flex: 0 0 47px;
  place-items: center;
  border-radius: 12px;
  background: #eaf1ff;
}
.horario-indicador__icono img {
  width: 24px;
  height: 24px;
}
.horario-indicador > div:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}
.horario-indicador span,
.horario-indicador small {
  color: #64748b;
  font-size: 12px;
}
.horario-indicador strong {
  color: #172554;
  font-size: 28px;
  line-height: 1.25;
}
.horario-principal__cabecera {
  margin-bottom: 12px;
}
.horario-principal__cabecera h2,
.horario-previa__encabezado h2 {
  margin: 0 0 5px;
  font-size: 18px;
}
.horario-principal__cabecera p,
.horario-previa__encabezado p {
  margin: 0;
}
.horario-principal__cabecera .docente-controles {
  flex-wrap: wrap;
}
.horario-aviso-demo {
  margin: 12px 0;
  padding: 10px 13px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1e40af;
  font-size: 12px;
}
.horario-ayuda-tabla {
  margin: 12px 0 8px;
  color: #64748b;
  font-size: 12px;
}
.horario-tabla-contenedor {
  max-width: 100%;
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}
.horario-tabla-contenedor:focus-visible {
  outline: 3px solid #93b4fa;
  outline-offset: 2px;
}
.horario-tabla {
  width: 100%;
  min-width: 940px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 12px;
}
.horario-tabla th,
.horario-tabla td {
  padding: 9px;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}
.horario-tabla tr > *:last-child {
  border-right: 0;
}
.horario-tabla tbody tr:last-child > * {
  border-bottom: 0;
}
.horario-tabla thead th {
  padding: 13px 8px;
  background: #f8fafc;
  color: #334155;
  text-align: center;
}
.horario-tabla thead th.horario-tabla__hoy {
  background: #dbeafe;
  color: #1d4ed8;
}
.horario-tabla__dia,
.horario-tabla__referencia {
  display: block;
}
.horario-tabla__dia {
  font-weight: 700;
}
.horario-tabla__referencia {
  margin-top: 3px;
  font-size: 10px;
}
.horario-tabla .horario-tabla__hora {
  width: 83px;
  background: #f8fafc;
  color: #475569;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  text-align: center;
}
.horario-tabla tbody .horario-tabla__hora {
  padding-top: 19px;
}
.horario-tabla__hora strong,
.horario-tabla__hora span {
  display: block;
}
.horario-tabla__hora span {
  margin-top: 5px;
  color: #94a3b8;
}
.horario-tabla__libre {
  display: block;
  padding-top: 15px;
  color: #cbd5e1;
  text-align: center;
}
.horario-bloque {
  display: flex;
  min-height: 93px;
  flex-direction: column;
  gap: 7px;
  padding: 12px 10px;
  border-left: 3px solid;
  border-radius: 7px;
  line-height: 1.35;
}
.horario-bloque strong {
  font-size: 12px;
}
.horario-bloque span,
.horario-bloque small {
  font-size: 11px;
}
.horario-bloque--matematica {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1e3a8a;
}
.horario-bloque--comunicacion {
  border-color: #7c3aed;
  background: #f5f3ff;
  color: #5b21b6;
}
.horario-bloque--ciencias {
  border-color: #059669;
  background: #ecfdf5;
  color: #065f46;
}
.horario-bloque--tutoria {
  border-color: #d97706;
  background: #fffbeb;
  color: #92400e;
}
.horario-dia-lista {
  display: flex;
  flex-direction: column;
  gap: 11px;
  margin-top: 20px;
}
.horario-dia-lista__fila {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr);
  gap: 14px;
  align-items: stretch;
}
.horario-dia-lista__horas {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  color: #475569;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.horario-dia-lista__horas span {
  color: #94a3b8;
}
.horario-dia-lista__contenido {
  min-width: 0;
  padding: 13px 16px;
  border-left: 4px solid;
  border-radius: 9px;
}
.horario-dia-lista__titulo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.horario-dia-lista__titulo h3 {
  margin: 0;
  font-size: 14px;
}
.horario-dia-lista__contenido p {
  margin: 9px 0 4px;
  font-size: 12px;
}
.horario-dia-lista__contenido small {
  font-size: 11px;
}
.horario-dia-vacio {
  padding: 40px 20px;
  text-align: center;
}
.horario-dia-vacio strong {
  font-size: 14px;
}
.horario-dia-vacio p {
  color: #64748b;
  font-size: 12px;
}
.horario-sin-datos {
  margin: 15px 0;
  border-top: 1px solid #e2e8f0;
}
.horario-principal__pie {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #e2e8f0;
}
.horario-principal__pie p {
  max-width: 550px;
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
.horario-previa__encabezado {
  margin-bottom: 12px;
}
.horario-previa > p {
  margin: 0 0 16px;
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
}
@media (max-width: 1100px) {
  .horario-informacion__puntos {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 720px) {
  .horario-informacion__encabezado,
  .horario-principal__cabecera,
  .horario-previa__encabezado,
  .horario-principal__pie {
    align-items: flex-start;
    flex-direction: column;
  }
  .horario-resumen {
    grid-template-columns: 1fr;
  }
  .horario-indicador {
    min-height: 92px;
  }
}
</style>
