<script setup lang="ts">
import { computed, ref } from 'vue'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

type VistaHorario = 'SEMANA' | 'HOY'
type AreaVisual = 'matematica' | 'comunicacion' | 'ciencias' | 'tutoria'

interface DiaSemana {
  numero: number
  nombre: string
}

interface BloqueHorario {
  id: number
  diaSemana: number
  inicio: string
  fin: string
  asignatura: string
  grado: string
  seccion: string
  aula: string
  areaVisual: AreaVisual
}

const dias: DiaSemana[] = [
  { numero: 1, nombre: 'Lunes' },
  { numero: 2, nombre: 'Martes' },
  { numero: 3, nombre: 'Miércoles' },
  { numero: 4, nombre: 'Jueves' },
  { numero: 5, nombre: 'Viernes' },
]

/** Franjas ilustrativas: el horario oficial y su duración vendrán del servidor. */
const franjas = [
  { inicio: '07:30', fin: '08:15' },
  { inicio: '08:15', fin: '09:00' },
  { inicio: '09:00', fin: '09:45' },
  { inicio: '09:45', fin: '10:30' },
  { inicio: '10:30', fin: '11:15' },
  { inicio: '11:15', fin: '12:00' },
  { inicio: '12:00', fin: '12:45' },
  { inicio: '12:45', fin: '13:30' },
]

/** Solo ilustración. NO corresponde a ningún docente o sección del colegio. */
const bloquesEjemplo: BloqueHorario[] = [
  {
    id: 1,
    diaSemana: 1,
    inicio: '07:30',
    fin: '08:15',
    asignatura: 'Matemática',
    grado: '3.º',
    seccion: 'A',
    aula: 'Aula 301',
    areaVisual: 'matematica',
  },
  {
    id: 2,
    diaSemana: 1,
    inicio: '08:15',
    fin: '09:00',
    asignatura: 'Matemática',
    grado: '3.º',
    seccion: 'A',
    aula: 'Aula 301',
    areaVisual: 'matematica',
  },
  {
    id: 3,
    diaSemana: 1,
    inicio: '11:15',
    fin: '12:00',
    asignatura: 'Ciencia y tecnología',
    grado: '2.º',
    seccion: 'B',
    aula: 'Laboratorio 1',
    areaVisual: 'ciencias',
  },
  {
    id: 4,
    diaSemana: 2,
    inicio: '09:00',
    fin: '09:45',
    asignatura: 'Comunicación',
    grado: '1.º',
    seccion: 'A',
    aula: 'Aula 102',
    areaVisual: 'comunicacion',
  },
  {
    id: 5,
    diaSemana: 2,
    inicio: '09:45',
    fin: '10:30',
    asignatura: 'Comunicación',
    grado: '1.º',
    seccion: 'A',
    aula: 'Aula 102',
    areaVisual: 'comunicacion',
  },
  {
    id: 6,
    diaSemana: 2,
    inicio: '12:00',
    fin: '12:45',
    asignatura: 'Tutoría',
    grado: '3.º',
    seccion: 'A',
    aula: 'Aula 301',
    areaVisual: 'tutoria',
  },
  {
    id: 7,
    diaSemana: 3,
    inicio: '07:30',
    fin: '08:15',
    asignatura: 'Matemática',
    grado: '2.º',
    seccion: 'B',
    aula: 'Aula 205',
    areaVisual: 'matematica',
  },
  {
    id: 8,
    diaSemana: 3,
    inicio: '10:30',
    fin: '11:15',
    asignatura: 'Ciencia y tecnología',
    grado: '2.º',
    seccion: 'B',
    aula: 'Laboratorio 1',
    areaVisual: 'ciencias',
  },
  {
    id: 9,
    diaSemana: 4,
    inicio: '08:15',
    fin: '09:00',
    asignatura: 'Comunicación',
    grado: '1.º',
    seccion: 'A',
    aula: 'Aula 102',
    areaVisual: 'comunicacion',
  },
  {
    id: 10,
    diaSemana: 4,
    inicio: '11:15',
    fin: '12:00',
    asignatura: 'Matemática',
    grado: '3.º',
    seccion: 'A',
    aula: 'Aula 301',
    areaVisual: 'matematica',
  },
  {
    id: 11,
    diaSemana: 5,
    inicio: '09:00',
    fin: '09:45',
    asignatura: 'Ciencia y tecnología',
    grado: '2.º',
    seccion: 'B',
    aula: 'Laboratorio 1',
    areaVisual: 'ciencias',
  },
  {
    id: 12,
    diaSemana: 5,
    inicio: '12:45',
    fin: '13:30',
    asignatura: 'Tutoría',
    grado: '3.º',
    seccion: 'A',
    aula: 'Aula 301',
    areaVisual: 'tutoria',
  },
]

const vista = ref<VistaHorario>('SEMANA')
const modoDemostracion = ref(false)
const hoy = new Date()
const numeroHoy = hoy.getDay()
const diaHoy = computed(() => dias.find((dia) => dia.numero === numeroHoy))

const semanaActual = computed(() => {
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  lunes.setDate(lunes.getDate() - ((numeroHoy + 6) % 7))
  const viernes = new Date(lunes)
  viernes.setDate(lunes.getDate() + 4)
  const formato = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' })
  return `${formato.format(lunes)} – ${formato.format(viernes)} de ${viernes.getFullYear()}`
})

const fechaHoyTexto = new Intl.DateTimeFormat('es-PE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(hoy)

const bloques = computed<BloqueHorario[]>(() => (modoDemostracion.value ? bloquesEjemplo : []))
const bloquesHoy = computed(() => bloques.value.filter((bloque) => bloque.diaSemana === numeroHoy))
const cantidadSecciones = computed(
  () => new Set(bloques.value.map((bloque) => `${bloque.grado}-${bloque.seccion}`)).size,
)
const cantidadAsignaturas = computed(() => new Set(bloques.value.map((bloque) => bloque.asignatura)).size)
const totalBloques = computed(() => bloques.value.length)

function obtenerBloque(diaSemana: number, horaInicio: string): BloqueHorario | undefined {
  return bloques.value.find((bloque) => bloque.diaSemana === diaSemana && bloque.inicio === horaInicio)
}

function seleccionarVista(nuevaVista: VistaHorario): void {
  vista.value = nuevaVista
}

function activarDemostracion(): void {
  modoDemostracion.value = true
}

function cerrarDemostracion(): void {
  modoDemostracion.value = false
}
</script>

<template>
  <main class="docente-vista horario">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">US-4.6 · Organización académica</span>
        <h1>Mi horario de clases</h1>
        <p>Consulta en un solo lugar tus asignaturas, secciones, aulas y bloques de clase.</p>
      </div>
      <span class="docente-insignia">Diseño del Sprint 2</span>
    </header>

    <section class="horario-informacion" aria-labelledby="horario-aviso-titulo">
      <div class="horario-informacion__encabezado">
        <h2 id="horario-aviso-titulo">Horario personal y consolidado</h2>
        <span
          class="horario-etiqueta"
          :class="modoDemostracion ? 'horario-etiqueta--demo' : 'horario-etiqueta--pendiente'"
        >
          {{ modoDemostracion ? 'Vista de ejemplo' : 'Sin sincronizar' }}
        </span>
      </div>
      <p v-if="!modoDemostracion">
        El horario real deberá obtenerse exclusivamente de las clases asignadas al docente autenticado. La consulta por
        docente todavía no está integrada con el backend.
      </p>
      <p v-else>
        Estás visualizando una agenda ficticia para revisar la interfaz. Los cursos, aulas y secciones de ejemplo
        <strong>no son asignaciones reales</strong> y no se guardan en MySQL.
      </p>
      <div class="horario-informacion__puntos">
        <span>Un solo horario para todas las secciones</span>
        <span>Asignatura, grado, sección y aula por bloque</span>
        <span>Vista semanal o del día de hoy</span>
      </div>
    </section>

    <section class="docente-grid docente-grid--tres horario-resumen" aria-label="Resumen de horario">
      <article class="horario-indicador">
        <div class="horario-indicador__icono"><img src="/icons/menu-horarios.svg" alt="" /></div>
        <div>
          <span>Bloques semanales</span>
          <strong>{{ modoDemostracion ? totalBloques : '—' }}</strong>
          <small>{{ modoDemostracion ? 'Solo datos de ejemplo' : 'Pendiente de consulta' }}</small>
        </div>
      </article>
      <article class="horario-indicador">
        <div class="horario-indicador__icono"><img src="/icons/menu-secciones.svg" alt="" /></div>
        <div>
          <span>Secciones</span>
          <strong>{{ modoDemostracion ? cantidadSecciones : '—' }}</strong>
          <small>{{ modoDemostracion ? 'Solo datos de ejemplo' : 'Pendiente de asignación' }}</small>
        </div>
      </article>
      <article class="horario-indicador">
        <div class="horario-indicador__icono"><img src="/icons/menu-competencias.svg" alt="" /></div>
        <div>
          <span>Asignaturas</span>
          <strong>{{ modoDemostracion ? cantidadAsignaturas : '—' }}</strong>
          <small>{{ modoDemostracion ? 'Solo datos de ejemplo' : 'Pendiente de consulta' }}</small>
        </div>
      </article>
    </section>

    <section class="docente-tarjeta horario-principal" aria-labelledby="horario-agenda-titulo">
      <div class="horario-principal__cabecera">
        <div>
          <h2 id="horario-agenda-titulo">1. Agenda académica</h2>
          <p class="docente-texto-secundario">
            {{ vista === 'SEMANA' ? `Semana del ${semanaActual}` : `Hoy: ${fechaHoyTexto}` }}
          </p>
        </div>
        <div class="docente-controles" role="group" aria-label="Vista del horario">
          <button
            type="button"
            :class="{ 'docente-controles__activo': vista === 'SEMANA' }"
            :aria-pressed="vista === 'SEMANA'"
            @click="seleccionarVista('SEMANA')"
          >
            Semana completa
          </button>
          <button
            type="button"
            :class="{ 'docente-controles__activo': vista === 'HOY' }"
            :aria-pressed="vista === 'HOY'"
            @click="seleccionarVista('HOY')"
          >
            Hoy
          </button>
        </div>
      </div>

      <div v-if="modoDemostracion" class="horario-aviso-demo" role="status">
        Vista previa con datos ficticios. No representa el horario del usuario autenticado.
      </div>

      <template v-if="vista === 'SEMANA'">
        <p class="horario-ayuda-tabla">Desplaza la grilla horizontalmente si no ves todos los días.</p>
        <div class="horario-tabla-contenedor" tabindex="0" aria-label="Horario semanal con desplazamiento horizontal">
          <table class="horario-tabla">
            <thead>
              <tr>
                <th scope="col" class="horario-tabla__hora">Horario</th>
                <th
                  v-for="dia in dias"
                  :key="dia.numero"
                  scope="col"
                  :class="{ 'horario-tabla__hoy': dia.numero === numeroHoy }"
                >
                  <span class="horario-tabla__dia">{{ dia.nombre }}</span>
                  <span v-if="dia.numero === numeroHoy" class="horario-tabla__referencia">Hoy</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="franja in franjas" :key="franja.inicio">
                <th scope="row" class="horario-tabla__hora">
                  <strong>{{ franja.inicio }}</strong>
                  <span>{{ franja.fin }}</span>
                </th>
                <td v-for="dia in dias" :key="`${dia.numero}-${franja.inicio}`">
                  <article
                    v-if="obtenerBloque(dia.numero, franja.inicio)"
                    class="horario-bloque"
                    :class="`horario-bloque--${obtenerBloque(dia.numero, franja.inicio)?.areaVisual}`"
                  >
                    <strong>{{ obtenerBloque(dia.numero, franja.inicio)?.asignatura }}</strong>
                    <span
                      >{{ obtenerBloque(dia.numero, franja.inicio)?.grado }} Sec. · Sección
                      {{ obtenerBloque(dia.numero, franja.inicio)?.seccion }}</span
                    >
                    <small>{{ obtenerBloque(dia.numero, franja.inicio)?.aula }}</small>
                  </article>
                  <span v-else class="horario-tabla__libre">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-else>
        <div v-if="!diaHoy" class="horario-dia-vacio">
          <strong>Hoy no es un día lectivo de lunes a viernes</strong>
          <p>Consulta la semana completa para revisar los bloques de lunes a viernes.</p>
        </div>
        <div v-else-if="!bloquesHoy.length" class="horario-dia-vacio">
          <strong>{{
            modoDemostracion ? 'No hay bloques de ejemplo para hoy' : 'No se ha sincronizado el horario de hoy'
          }}</strong>
          <p>
            {{
              modoDemostracion
                ? 'Cambia a Semana completa para ver otros bloques ficticios.'
                : 'La agenda real estará disponible cuando se integre el servicio del docente.'
            }}
          </p>
        </div>
        <div v-else class="horario-dia-lista">
          <article v-for="bloque in bloquesHoy" :key="bloque.id" class="horario-dia-lista__fila">
            <div class="horario-dia-lista__horas">
              <strong>{{ bloque.inicio }}</strong>
              <span>{{ bloque.fin }}</span>
            </div>
            <div class="horario-dia-lista__contenido" :class="`horario-bloque--${bloque.areaVisual}`">
              <div class="horario-dia-lista__titulo">
                <h3>{{ bloque.asignatura }}</h3>
                <span class="horario-etiqueta horario-etiqueta--demo">Ejemplo</span>
              </div>
              <p>{{ bloque.grado }} de Secundaria · Sección {{ bloque.seccion }}</p>
              <small>{{ bloque.aula }}</small>
            </div>
          </article>
        </div>
      </template>

      <div v-if="!modoDemostracion" class="horario-sin-datos" role="status">
        <DocenteEstadoVacio
          titulo="Tu horario todavía no está disponible"
          descripcion="Falta integrar la consulta de clases, aulas y secciones asignadas exclusivamente al docente autenticado. La grilla permanecerá vacía hasta recibir información real."
          icono="/icons/menu-horarios.svg"
        />
      </div>

      <div class="horario-principal__pie">
        <p>La información oficial deberá actualizarse desde el servidor al consultar esta pantalla.</p>
        <button
          type="button"
          class="docente-boton docente-boton--secundario"
          disabled
          title="Disponible cuando se integre el horario real"
        >
          Imprimir horario
        </button>
      </div>
    </section>

    <section class="docente-tarjeta horario-previa" aria-labelledby="horario-previa-titulo">
      <div class="horario-previa__encabezado">
        <div>
          <h2 id="horario-previa-titulo">2. Vista previa del diseño</h2>
          <p class="docente-texto-secundario">Revisa los bloques y la navegación antes de integrar los datos reales.</p>
        </div>
        <span class="horario-etiqueta horario-etiqueta--demo">Sin persistencia</span>
      </div>
      <p>
        La demostración utiliza cursos, grados, secciones y aulas ficticios. No realiza solicitudes al backend ni
        modifica registros.
      </p>
      <button v-if="!modoDemostracion" type="button" class="docente-boton" @click="activarDemostracion">
        Ver horario con datos de ejemplo
      </button>
      <button v-else type="button" class="docente-boton docente-boton--secundario" @click="cerrarDemostracion">
        Cerrar vista previa
      </button>
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
