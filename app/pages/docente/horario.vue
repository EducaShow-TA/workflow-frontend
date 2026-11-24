<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
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
const anioActual = ahoraSistema().getFullYear()
const anio = ref(anioActual)
const vista = ref<'SEMANA' | 'HOY'>('SEMANA')
const sesiones = ref<BloqueHorarioDocente[]>([])
const cargando = ref(false)
const error = ref('')
const guardando = ref(false)
const editorAbierto = ref(false)
const sesionEditadaId = ref<number | null>(null)
const formulario = ref({ horarioId: 0, bloqueId: 0, dia: 'MONDAY', areaCodigo: '', aulaId: 0 })
const bloquesDisponibles = computed(() => {
  const porId = new Map(
    sesiones.value.filter((item) => item.horarioId === formulario.value.horarioId).map((item) => [item.bloqueId, item]),
  )
  return [...porId.values()].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
})
const areasDisponibles = computed(() => [
  ...new Map(sesiones.value.map((item) => [item.areaCodigo, item.areaNombre])).entries(),
])
const aulasDisponibles = computed(() => [
  ...new Map(sesiones.value.map((item) => [item.aulaId, item.aulaCodigo])).entries(),
])
const horariosDisponibles = computed(() => [
  ...new Map(sesiones.value.map((item) => [item.horarioId, descripcion(item)])).entries(),
])
const hoy = ahoraSistema().getDay()
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
  return formatearSeccionCompleta(bloque.gradoNumero, bloque.seccionCodigo)
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

function exportarAgenda(): void {
  vista.value = 'SEMANA'
  nextTick(() => window.print())
}

function abrirEditor(sesion?: BloqueHorarioDocente): void {
  sesionEditadaId.value = sesion?.id ?? null
  formulario.value = sesion
    ? {
        horarioId: sesion.horarioId,
        bloqueId: sesion.bloqueId,
        dia: sesion.dia,
        areaCodigo: sesion.areaCodigo,
        aulaId: sesion.aulaId,
      }
    : {
        horarioId: horariosDisponibles.value[0]?.[0] ?? 0,
        bloqueId: bloquesDisponibles.value[0]?.bloqueId ?? 0,
        dia: 'MONDAY',
        areaCodigo: areasDisponibles.value[0]?.[0] ?? '',
        aulaId: aulasDisponibles.value[0]?.[0] ?? 0,
      }
  editorAbierto.value = true
}

function ajustarBloque(): void {
  if (!bloquesDisponibles.value.some((bloque) => bloque.bloqueId === formulario.value.bloqueId)) {
    formulario.value.bloqueId = bloquesDisponibles.value[0]?.bloqueId ?? 0
  }
}

async function guardarSesion(): Promise<void> {
  guardando.value = true
  error.value = ''
  try {
    const cuerpo = {
      bloqueId: formulario.value.bloqueId,
      dia: formulario.value.dia,
      areaCodigo: formulario.value.areaCodigo,
      aulaId: formulario.value.aulaId,
    }
    if (sesionEditadaId.value) {
      await api.solicitar(`/api/v1/docentes/mi-horario/sesiones/${sesionEditadaId.value}`, { metodo: 'PUT', cuerpo })
    } else {
      await api.solicitar(`/api/v1/docentes/mi-horario/${formulario.value.horarioId}/sesiones`, {
        metodo: 'POST',
        cuerpo,
      })
    }
    editorAbierto.value = false
    await cargar()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo guardar la sesión del horario.')
  } finally {
    guardando.value = false
  }
}

async function eliminarSesion(sesion: BloqueHorarioDocente): Promise<void> {
  if (!window.confirm(`¿Eliminar ${sesion.areaNombre} del horario de ${descripcion(sesion)}?`)) return
  error.value = ''
  try {
    await api.solicitar(`/api/v1/docentes/mi-horario/sesiones/${sesion.id}`, { metodo: 'DELETE' })
    await cargar()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo eliminar la sesión del horario.')
  }
}

watch(anio, () => void cargar())
onMounted(cargar)
</script>

<template>
  <main class="docente-vista horario">
    <header class="agenda-exportacion">
      <div class="agenda-exportacion__marca">
        <img src="/icons/logo.svg" alt="" />
        <span>EducaShow <small>Gestión académica</small></span>
      </div>
      <div class="agenda-exportacion__titulo">
        <p>Agenda académica docente</p>
        <h1>Horario semanal de clases</h1>
      </div>
      <div class="agenda-exportacion__periodo">
        <span>Año escolar</span>
        <strong>{{ anio }}</strong>
        <small>Generado el {{ new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(new Date()) }}</small>
      </div>
      <div class="agenda-exportacion__resumen">
        <span
          ><strong>{{ sesiones.length }}</strong> bloques semanales</span
        >
        <span
          ><strong>{{ cantidadSecciones }}</strong> secciones</span
        >
        <span
          ><strong>{{ cantidadAsignaturas }}</strong> asignaturas</span
        >
      </div>
    </header>
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">Organización académica</span>
        <h1>Mi horario de clases</h1>
        <p>Consulta y gestiona tus bloques, asignaturas, secciones y aulas asignadas.</p>
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
        <span class="horario-etiqueta horario-etiqueta--demo">Horario actualizado</span>
      </div>
      <p>
        Puedes agregar, modificar o retirar tus sesiones. Las validaciones de disponibilidad y cruces se aplican al
        guardar.
      </p>
      <div class="horario-informacion__puntos">
        <span>Horario consolidado de todas tus secciones</span><span>Gestión de tus bloques asignados</span
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
        <div class="docente-controles">
          <button
            type="button"
            class="docente-boton docente-boton--secundario"
            @click="abrirEditor()"
            :disabled="!sesiones.length"
          >
            Agregar bloque
          </button>
          <button type="button" class="docente-boton docente-boton--secundario" @click="exportarAgenda">
            Exportar
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
              <div class="horario-acciones">
                <button type="button" @click="abrirEditor(bloque)">Modificar</button>
                <button type="button" @click="eliminarSesion(bloque)">Eliminar</button>
              </div>
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
            <div class="horario-acciones">
              <button type="button" @click="abrirEditor(bloque)">Modificar</button>
              <button type="button" @click="eliminarSesion(bloque)">Eliminar</button>
            </div>
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
    <div v-if="editorAbierto" class="horario-editor-fondo" role="presentation" @click.self="editorAbierto = false">
      <form class="horario-editor" aria-labelledby="horario-editor-titulo" @submit.prevent="guardarSesion">
        <h2 id="horario-editor-titulo">{{ sesionEditadaId ? 'Modificar bloque' : 'Agregar bloque' }}</h2>
        <label v-if="!sesionEditadaId"
          >Sección
          <select v-model.number="formulario.horarioId" required @change="ajustarBloque">
            <option v-for="[id, nombre] in horariosDisponibles" :key="id" :value="id">{{ nombre }}</option>
          </select>
        </label>
        <label
          >Bloque horario
          <select v-model.number="formulario.bloqueId" required>
            <option v-for="bloque in bloquesDisponibles" :key="bloque.bloqueId" :value="bloque.bloqueId">
              {{ hora(bloque.horaInicio) }}–{{ hora(bloque.horaFin) }}
            </option>
          </select>
        </label>
        <label
          >Día
          <select v-model="formulario.dia" required>
            <option v-for="dia in DIAS" :key="dia.codigo" :value="dia.codigo">{{ dia.nombre }}</option>
          </select>
        </label>
        <label
          >Área
          <select v-model="formulario.areaCodigo" required>
            <option v-for="[codigo, nombre] in areasDisponibles" :key="codigo" :value="codigo">{{ nombre }}</option>
          </select>
        </label>
        <label
          >Aula
          <select v-model.number="formulario.aulaId" required>
            <option v-for="[id, codigo] in aulasDisponibles" :key="id" :value="id">{{ codigo }}</option>
          </select>
        </label>
        <p v-if="!sesiones.length">
          Primero administración debe publicar un horario de sección para poder agregar bloques.
        </p>
        <div class="horario-editor__acciones">
          <button type="button" class="docente-boton docente-boton--secundario" @click="editorAbierto = false">
            Cancelar
          </button>
          <button type="submit" class="docente-boton" :disabled="guardando || !formulario.horarioId">
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    </div>
  </main>
</template>

<style scoped>
.horario {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.horario-acciones {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.horario-acciones button {
  padding: 5px 9px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #1e40af;
  background: #fff;
  cursor: pointer;
}
.horario-editor-fondo {
  position: fixed;
  z-index: 50;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: #0f172a88;
}
.horario-editor {
  display: grid;
  width: min(100%, 440px);
  gap: 14px;
  padding: 24px;
  border-radius: 14px;
  background: white;
  box-shadow: 0 20px 60px #0f172a40;
}
.horario-editor h2 {
  margin: 0;
}
.horario-editor label {
  display: grid;
  gap: 6px;
  color: #334155;
  font-size: 13px;
}
.horario-editor select {
  width: 100%;
  padding: 9px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
}
.horario-editor__acciones {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}
.agenda-exportacion {
  display: none;
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

  .horario {
    display: block;
    padding: 0;
  }

  .agenda-exportacion {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 14px 24px;
    align-items: center;
    margin-bottom: 18px;
    padding: 0 0 14px;
    border-bottom: 2px solid #1e3a8a;
    color: #172554;
  }

  .agenda-exportacion__marca {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 14px;
    font-weight: 800;
  }

  .agenda-exportacion__marca img {
    width: 32px;
    height: 32px;
  }

  .agenda-exportacion__marca small,
  .agenda-exportacion__periodo span,
  .agenda-exportacion__periodo small {
    display: block;
    color: #64748b;
    font-size: 9px;
    font-weight: 400;
  }

  .agenda-exportacion__titulo {
    grid-column: 1;
    grid-row: 2;
  }

  .agenda-exportacion__titulo p {
    margin: 0 0 3px;
    color: #475569;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .agenda-exportacion__titulo h1 {
    margin: 0;
    font-size: 21px;
  }

  .agenda-exportacion__periodo {
    grid-column: 2;
    grid-row: 1 / span 2;
    text-align: right;
  }

  .agenda-exportacion__periodo strong {
    display: block;
    margin: 2px 0 5px;
    font-size: 22px;
  }

  .agenda-exportacion__resumen {
    display: flex;
    grid-column: 1 / -1;
    gap: 18px;
    padding: 8px 11px;
    border-radius: 6px;
    background: #eff6ff;
    color: #1e3a8a;
    font-size: 10px;
  }

  .agenda-exportacion__resumen strong {
    font-size: 12px;
  }

  .horario > :not(.horario-principal):not(.agenda-exportacion) {
    display: none !important;
  }

  .horario-principal {
    padding: 0;
    border: 0;
    box-shadow: none;
  }

  .horario-principal__cabecera .docente-controles,
  .horario-principal__cabecera > button,
  .horario-principal__pie {
    display: none !important;
  }

  .horario-semana {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 7px;
  }

  .horario-dia {
    padding: 8px;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    background: #fff;
  }

  .horario-dia h3 {
    margin: 0 0 8px;
    padding: 0 0 6px;
    border-bottom: 2px solid #2563eb;
    color: #1e3a8a;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .horario-dia-lista__fila,
  .horario-dia-lista__contenido {
    break-inside: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .horario-dia-lista__fila {
    grid-template-columns: 43px minmax(0, 1fr);
    gap: 5px;
    margin-bottom: 7px;
  }

  .horario-dia-lista__horas {
    font-size: 8px;
  }

  .horario-dia-lista__contenido {
    padding: 6px;
    border-left-width: 3px;
    border-radius: 4px;
  }

  .horario-dia-lista__contenido h4,
  .horario-dia-lista__contenido h3 {
    margin: 0;
    font-size: 9px;
  }

  .horario-dia-lista__contenido p {
    margin: 4px 0 2px;
    font-size: 8px;
  }

  .horario-dia-lista__contenido small {
    font-size: 7px;
  }

  .horario-dia-vacio {
    padding: 8px 3px;
    color: #64748b;
    font-size: 8px;
  }
}
</style>
