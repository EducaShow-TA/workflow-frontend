<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { AlumnoClase, Calificacion, MiClase, NotaCualitativa } from '~/types/calificacion'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { formatearFecha } from '~/composables/useFechas'
import { useCalificaciones } from '~/composables/useCalificaciones'
import { NOTAS, claveClase, nombreClase, useMisClases } from '~/composables/useMisClases'
import { useAutenticacionStore } from '~/stores/autenticacion'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

const CLAVE_RECORDADA = 'educashow.docente.calificaciones'

type FiltroNota = NotaCualitativa | 'SIN_NOTA' | ''

const autenticacion = useAutenticacionStore()
const { listar: listarClases, listarAlumnos } = useMisClases()
const { listar: listarNotas, descargarEvidencia } = useCalificaciones()
const esDocente = computed(() => autenticacion.usuario?.rol === 'DOCENTE')

const clases = ref<MiClase[]>([])
const areaElegida = ref('')
const claseElegida = ref('')
const competenciaElegida = ref('')
const alumnos = ref<AlumnoClase[]>([])
const notasPorCompetencia = ref<Record<string, Calificacion[]>>({})
const busqueda = ref('')
const filtroNota = ref<FiltroNota>('')
const cargando = ref(true)
const cargandoClase = ref(false)
const error = ref('')
const aviso = ref('')

const modalAbierto = ref(false)
const alumnoEnEdicion = ref<AlumnoClase | null>(null)

const areas = computed(() => {
  const mapa = new Map<string, { codigo: string; nombre: string; secciones: number }>()
  for (const clase of clases.value) {
    const area = mapa.get(clase.areaCodigo)
    if (area) area.secciones += 1
    else mapa.set(clase.areaCodigo, { codigo: clase.areaCodigo, nombre: clase.areaNombre, secciones: 1 })
  }
  return [...mapa.values()]
})
const clasesDelArea = computed(() => clases.value.filter((clase) => clase.areaCodigo === areaElegida.value))
const clase = computed(() => clases.value.find((item) => claveClase(item) === claseElegida.value) ?? null)
const competencia = computed(
  () => clase.value?.competencias.find((item) => item.codigo === competenciaElegida.value) ?? null,
)
const notas = computed(() => notasPorCompetencia.value[competenciaElegida.value] ?? [])
const notaPorMatricula = computed(() => new Map(notas.value.map((nota) => [nota.matriculaId, nota])))

const conteo = computed(() => {
  const resultado: Record<NotaCualitativa | 'SIN_NOTA', number> = { AD: 0, A: 0, B: 0, C: 0, SIN_NOTA: 0 }
  for (const alumno of alumnos.value) {
    const nota = notaPorMatricula.value.get(alumno.matriculaId)
    resultado[nota ? nota.nota : 'SIN_NOTA'] += 1
  }
  return resultado
})

const alumnosFiltrados = computed(() => {
  const texto = normalizar(busqueda.value)
  return alumnos.value.filter((alumno) => {
    const nota = notaPorMatricula.value.get(alumno.matriculaId)
    if (filtroNota.value === 'SIN_NOTA' && nota) return false
    if (filtroNota.value && filtroNota.value !== 'SIN_NOTA' && nota?.nota !== filtroNota.value) return false
    return !texto || normalizar(alumno.nombreCompleto).includes(texto) || alumno.dni.includes(texto)
  })
})

const pendientes = computed(() => alumnos.value.filter((alumno) => !notaPorMatricula.value.has(alumno.matriculaId)))
const contexto = computed(() =>
  clase.value && competencia.value
    ? `${clase.value.areaNombre} ${nombreClase(clase.value)} · ${competencia.value.nombre}`
    : '',
)
const haySiguiente = computed(() =>
  pendientes.value.some((alumno) => alumno.matriculaId !== alumnoEnEdicion.value?.matriculaId),
)

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function calificados(codigo: string): number {
  const matriculas = new Set(alumnos.value.map((alumno) => alumno.matriculaId))
  return (notasPorCompetencia.value[codigo] ?? []).filter((nota) => matriculas.has(nota.matriculaId)).length
}

function recordar(): void {
  try {
    localStorage.setItem(
      CLAVE_RECORDADA,
      JSON.stringify({ clase: claseElegida.value, competencia: competenciaElegida.value }),
    )
  } catch {
    /* el navegador puede bloquear el almacenamiento */
  }
}

function leerRecordada(): { clase?: string; competencia?: string } {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_RECORDADA) || '{}')
  } catch {
    return {}
  }
}

function elegirArea(codigo: string): void {
  if (areaElegida.value === codigo) return
  areaElegida.value = codigo
  const primera = clasesDelArea.value[0]
  if (primera) void elegirClase(claveClase(primera))
}

async function elegirClase(clave: string, competenciaPreferida = ''): Promise<void> {
  const nueva = clases.value.find((item) => claveClase(item) === clave)
  if (!nueva) return
  claseElegida.value = clave
  areaElegida.value = nueva.areaCodigo
  competenciaElegida.value =
    nueva.competencias.find((item) => item.codigo === competenciaPreferida)?.codigo ??
    nueva.competencias[0]?.codigo ??
    ''
  filtroNota.value = ''
  busqueda.value = ''
  aviso.value = ''
  recordar()
  await cargarClase()
}

function elegirCompetencia(codigo: string): void {
  competenciaElegida.value = codigo
  filtroNota.value = ''
  recordar()
}

async function cargarClase(): Promise<void> {
  const actual = clase.value
  if (!actual) return
  cargandoClase.value = true
  error.value = ''
  alumnos.value = []
  notasPorCompetencia.value = {}
  try {
    const [lista, ...porCompetencia] = await Promise.all([
      listarAlumnos(actual.periodoId),
      ...actual.competencias.map((item) => listarNotas(actual.periodoId, item.codigo)),
    ])
    if (claveClase(actual) !== claseElegida.value) return
    alumnos.value = lista
    notasPorCompetencia.value = Object.fromEntries(
      actual.competencias.map((item, indice) => [item.codigo, porCompetencia[indice] ?? []]),
    )
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar la lista de alumnos.')
  } finally {
    cargandoClase.value = false
  }
}

function alternarFiltro(valor: FiltroNota): void {
  filtroNota.value = filtroNota.value === valor ? '' : valor
}

function abrir(alumno: AlumnoClase): void {
  alumnoEnEdicion.value = alumno
  aviso.value = ''
  modalAbierto.value = true
}

function calificarPendientes(): void {
  const primero = pendientes.value[0]
  if (primero) abrir(primero)
}

function alGuardar(calificacion: Calificacion, siguiente: boolean): void {
  const codigo = competenciaElegida.value
  const lista = (notasPorCompetencia.value[codigo] ?? []).filter(
    (nota) => nota.matriculaId !== calificacion.matriculaId,
  )
  notasPorCompetencia.value = { ...notasPorCompetencia.value, [codigo]: [...lista, calificacion] }
  aviso.value = `Nota ${calificacion.nota} guardada para ${alumnoEnEdicion.value?.nombreCompleto ?? 'el alumno'}.`

  const proximo = siguiente ? pendientes.value[0] : undefined
  if (proximo) {
    alumnoEnEdicion.value = proximo
    modalAbierto.value = false
    requestAnimationFrame(() => {
      modalAbierto.value = true
    })
  } else {
    modalAbierto.value = false
  }
}

async function descargar(calificacion: Calificacion): Promise<void> {
  try {
    await descargarEvidencia(calificacion)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo descargar la evidencia.')
  }
}

onMounted(async () => {
  if (!esDocente.value) {
    cargando.value = false
    return
  }
  try {
    clases.value = await listarClases()
    const recordada = leerRecordada()
    const inicial = clases.value.find((item) => claveClase(item) === recordada.clase) ?? clases.value[0]
    if (inicial) await elegirClase(claveClase(inicial), recordada.competencia)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar tus clases.')
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <main class="docente-vista">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">US-3.2 · US-3.8</span>
        <h1>Calificaciones</h1>
        <p>Elige tu clase y la competencia; registra la nota de cada alumno con su evidencia.</p>
      </div>
      <span class="docente-insignia">Escala AD · A · B · C</span>
    </header>

    <DocenteEstadoVacio
      v-if="!esDocente"
      titulo="Solo para docentes"
      descripcion="Ingresa con una cuenta docente para calificar a tus alumnos."
    />

    <p v-else-if="cargando" class="docente-texto-secundario" role="status">Cargando tus clases…</p>

    <template v-else>
      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />

      <DocenteEstadoVacio
        v-if="!clases.length && !error"
        titulo="Aún no tienes clases asignadas"
        descripcion="Tus clases aparecen aquí cuando el administrador te asigna sesiones en una sección."
      />

      <section v-else-if="clases.length" class="docente-tarjeta selector" aria-label="Elegir clase">
        <div class="fila">
          <span id="etiqueta-curso" class="etiqueta">Curso</span>
          <div class="pastillas" role="group" aria-labelledby="etiqueta-curso">
            <button
              v-for="area in areas"
              :key="area.codigo"
              type="button"
              class="pastilla"
              :aria-pressed="area.codigo === areaElegida"
              @click="elegirArea(area.codigo)"
            >
              {{ area.nombre }} <span class="contador">{{ area.secciones }}</span>
            </button>
          </div>
        </div>
        <div class="fila">
          <span id="etiqueta-seccion" class="etiqueta">Sección</span>
          <div class="secciones" role="group" aria-labelledby="etiqueta-seccion">
            <button
              v-for="item in clasesDelArea"
              :key="claveClase(item)"
              type="button"
              class="seccion"
              :aria-pressed="claveClase(item) === claseElegida"
              @click="elegirClase(claveClase(item))"
            >
              <strong>{{ nombreClase(item) }}</strong>
              <small>{{ item.totalAlumnos }} {{ item.totalAlumnos === 1 ? 'alumno' : 'alumnos' }}</small>
            </button>
          </div>
        </div>
      </section>

      <section v-if="clase" class="docente-tarjeta" :aria-busy="cargandoClase" aria-labelledby="titulo-clase">
        <div class="docente-tarjeta__titulo docente-tarjeta__titulo--wrap">
          <h2 id="titulo-clase">{{ clase.areaNombre }} · {{ nombreClase(clase) }} · {{ clase.anhio }}</h2>
          <button
            type="button"
            class="docente-boton"
            :disabled="cargandoClase || !competencia || !pendientes.length"
            @click="calificarPendientes"
          >
            {{ pendientes.length ? `Calificar pendientes (${pendientes.length})` : 'Todos calificados' }}
          </button>
        </div>

        <p v-if="!clase.competencias.length" class="docente-texto-secundario">
          El área no tiene competencias activas. Pide al administrador que las registre.
        </p>

        <template v-else>
          <div class="competencia-filtro">
            <label for="competencia-elegida">Competencia</label>
            <select
              id="competencia-elegida"
              :value="competenciaElegida"
              :disabled="cargandoClase"
              @change="elegirCompetencia(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="item in clase.competencias" :key="item.codigo" :value="item.codigo">
                {{ item.nombre }}{{ cargandoClase ? '' : ` · ${calificados(item.codigo)}/${alumnos.length}` }}
              </option>
            </select>
            <small v-if="!cargandoClase && competencia">
              {{ calificados(competencia.codigo) }} de {{ alumnos.length }} alumnos calificados ·
              {{ clase.competencias.length }} {{ clase.competencias.length === 1 ? 'competencia' : 'competencias' }} en
              el curso
            </small>
          </div>

          <p v-if="cargandoClase" class="docente-texto-secundario" role="status">Cargando alumnos y notas…</p>

          <template v-else>
            <p id="ayuda-filtro" class="ayuda-filtro">
              Toca una nota para ver solo esos alumnos; tócala de nuevo para ver a todos.
            </p>
            <div class="resumen" role="group" aria-label="Filtrar por nota" aria-describedby="ayuda-filtro">
              <button
                v-for="opcion in NOTAS"
                :key="opcion.valor"
                type="button"
                :class="['kpi', `kpi--${opcion.valor}`]"
                :aria-pressed="filtroNota === opcion.valor"
                @click="alternarFiltro(opcion.valor)"
              >
                <strong>{{ conteo[opcion.valor] }}</strong>
                <span>{{ opcion.valor }} · {{ opcion.descripcion }}</span>
              </button>
              <button
                type="button"
                class="kpi kpi--SIN"
                :aria-pressed="filtroNota === 'SIN_NOTA'"
                @click="alternarFiltro('SIN_NOTA')"
              >
                <strong>{{ conteo.SIN_NOTA }}</strong>
                <span>Sin nota</span>
              </button>
            </div>

            <div class="herramientas">
              <label class="buscador">
                <span class="solo-lectores">Buscar alumno</span>
                <input v-model="busqueda" type="search" placeholder="Buscar por apellido, nombre o DNI" />
              </label>
              <span class="docente-texto-secundario">
                {{ alumnosFiltrados.length }} de {{ alumnos.length }} alumnos
                <template v-if="filtroNota"
                  >· filtro {{ filtroNota === 'SIN_NOTA' ? 'Sin nota' : filtroNota }}</template
                >
                <button v-if="filtroNota" type="button" class="enlace" @click="filtroNota = ''">Quitar filtro</button>
              </span>
            </div>

            <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" />

            <div class="docente-tabla-contenedor tabla-desplazable">
              <table class="docente-tabla">
                <thead>
                  <tr>
                    <th scope="col">N.°</th>
                    <th scope="col">Alumno</th>
                    <th scope="col">Nota</th>
                    <th scope="col">Evidencia</th>
                    <th scope="col">Registrada</th>
                    <th scope="col"><span class="solo-lectores">Acción</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!alumnosFiltrados.length">
                    <td colspan="6" class="docente-tabla__vacia">
                      {{ alumnos.length ? 'Ningún alumno coincide con el filtro.' : 'La sección no tiene alumnos.' }}
                    </td>
                  </tr>
                  <tr v-for="alumno in alumnosFiltrados" :key="alumno.matriculaId">
                    <td class="numero">{{ alumnos.indexOf(alumno) + 1 }}</td>
                    <td>
                      <strong class="nombre">{{ alumno.nombreCompleto }}</strong>
                      <small class="dni">DNI {{ alumno.dni }}</small>
                    </td>
                    <template v-if="notaPorMatricula.get(alumno.matriculaId)">
                      <td>
                        <span :class="['chip', `chip--${notaPorMatricula.get(alumno.matriculaId)!.nota}`]">
                          {{ notaPorMatricula.get(alumno.matriculaId)!.nota }}
                        </span>
                      </td>
                      <td>
                        <a
                          v-if="notaPorMatricula.get(alumno.matriculaId)!.evidenciaTipo === 'URL'"
                          class="enlace"
                          :href="notaPorMatricula.get(alumno.matriculaId)!.evidenciaUrl ?? undefined"
                          target="_blank"
                          rel="noopener noreferrer"
                          >Enlace</a
                        >
                        <button
                          v-else
                          type="button"
                          class="enlace"
                          @click="descargar(notaPorMatricula.get(alumno.matriculaId)!)"
                        >
                          {{ notaPorMatricula.get(alumno.matriculaId)!.evidenciaNombre || 'Archivo' }}
                        </button>
                      </td>
                      <td class="fecha">
                        {{ formatearFecha(notaPorMatricula.get(alumno.matriculaId)!.fechaRegistro.slice(0, 10)) }}
                      </td>
                    </template>
                    <template v-else>
                      <td><span class="chip chip--vacio">Sin nota</span></td>
                      <td class="tenue">—</td>
                      <td class="tenue">—</td>
                    </template>
                    <td class="accion">
                      <button
                        type="button"
                        :class="[
                          'docente-boton',
                          { 'docente-boton--secundario': notaPorMatricula.has(alumno.matriculaId) },
                        ]"
                        @click="abrir(alumno)"
                      >
                        {{ notaPorMatricula.has(alumno.matriculaId) ? 'Editar' : 'Registrar' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>
      </section>
    </template>

    <ModalCalificacion
      v-if="clase && competencia"
      :abierta="modalAbierto"
      :alumno="alumnoEnEdicion"
      :contexto="contexto"
      :periodo-id="clase.periodoId"
      :competencia-codigo="competencia.codigo"
      :actual="alumnoEnEdicion ? (notaPorMatricula.get(alumnoEnEdicion.matriculaId) ?? null) : null"
      :hay-siguiente="haySiguiente"
      @cerrar="modalAbierto = false"
      @guardada="alGuardar"
    />
  </main>
</template>

<style scoped>
.selector {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.fila {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.etiqueta {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pastillas,
.secciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pastilla {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.contador {
  display: inline-grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 999px;
  background: #e2e8f0;
  font-size: 12px;
}

.pastilla[aria-pressed='true'] {
  border-color: #1e40af;
  background: #1e40af;
  color: #fff;
}

.pastilla[aria-pressed='true'] .contador {
  background: rgb(255 255 255 / 0.22);
}

.seccion {
  display: flex;
  min-width: 92px;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  color: #0f172a;
  cursor: pointer;
}

.seccion strong {
  font-size: 16px;
}

.seccion small {
  color: #64748b;
  font-size: 12px;
}

.seccion[aria-pressed='true'] {
  border-color: #1e40af;
  background: #eaf1ff;
  box-shadow: inset 0 0 0 1px #1e40af;
}

.pastilla:focus-visible,
.seccion:focus-visible,
.kpi:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.competencia-filtro {
  display: flex;
  max-width: 640px;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0 18px;
}

.competencia-filtro label {
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
}

.competencia-filtro select {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  font: inherit;
  font-size: 14px;
}

.competencia-filtro select:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.competencia-filtro small,
.ayuda-filtro {
  color: #64748b;
  font-size: 12px;
}

.ayuda-filtro {
  margin: 0 0 8px;
}

.resumen {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.kpi {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-left-width: 4px;
  border-radius: 10px;
  background: #fff;
  color: #0f172a;
  text-align: left;
  cursor: pointer;
}

.kpi strong {
  font-size: 22px;
}

.kpi span {
  color: #64748b;
  font-size: 12px;
}

.kpi--AD {
  border-left-color: #047857;
}

.kpi--A {
  border-left-color: #1d4ed8;
}

.kpi--B {
  border-left-color: #b45309;
}

.kpi--C {
  border-left-color: #b91c1c;
}

.kpi--SIN {
  border-left-color: #94a3b8;
}

.kpi:hover {
  background: #f8fafc;
}

.kpi[aria-pressed='true'] {
  background: #eaf1ff;
  box-shadow: inset 0 0 0 2px #1e40af;
}

.herramientas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.buscador {
  flex: 1 1 260px;
  max-width: 380px;
}

.buscador input {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
}

.enlace {
  padding: 0;
  border: 0;
  background: none;
  color: #1e40af;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.herramientas .enlace {
  margin-left: 8px;
}

.tabla-desplazable {
  position: relative;
}

.docente-tabla td {
  padding: 12px;
  vertical-align: middle;
}

.numero {
  width: 48px;
  color: #64748b;
}

.nombre {
  display: block;
  color: #0f172a;
}

.dni,
.tenue,
.fecha {
  color: #64748b;
  font-size: 12px;
}

.accion {
  text-align: right;
}

.accion .docente-boton {
  min-height: 34px;
  padding: 6px 14px;
}

.chip {
  display: inline-grid;
  white-space: nowrap;
  min-width: 38px;
  padding: 4px 10px;
  place-items: center;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.chip--AD {
  background: #d1fae5;
  color: #065f46;
}

.chip--A {
  background: #dbeafe;
  color: #1e3a8a;
}

.chip--B {
  background: #fef3c7;
  color: #92400e;
}

.chip--C {
  background: #fee2e2;
  color: #991b1b;
}

.chip--vacio {
  background: #f1f5f9;
  color: #64748b;
  font-weight: 600;
}

.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 760px) {
  .fila {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .resumen {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .docente-tabla :is(th, td):is(:nth-child(1), :nth-child(4), :nth-child(5)):not(.docente-tabla__vacia) {
    display: none;
  }
}
</style>
