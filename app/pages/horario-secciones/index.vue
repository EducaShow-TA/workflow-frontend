<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { PlantillaHorario } from '~/types/plantillaHorario'
import type { Seccion } from '~/types/seccion'
import type { AreaOpcion, DocenteOpcion } from '~/types/sesionClase'
import type { Aula, BloqueGrilla, DiaSemana, HorarioSeccion, SesionHorario } from '~/types/horarioSeccion'
import { ErrorSolicitudApi } from '~/types/api'
import { nombreDia, useHorarioSeccion } from '~/composables/useHorarioSeccion'
import { useSesionesClase } from '~/composables/useSesionesClase'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { obtenerNombreTurno, recortarHora } from '~/composables/usePlantillasHorario'

definePageMeta({ middleware: 'autenticacion' })

const api = useHorarioSeccion()
const { listarAreas, listarDocentes } = useSesionesClase()
const anhioActual = new Date().getFullYear()
const ANHIOS = [anhioActual, anhioActual + 1]

const secciones = ref<Seccion[]>([])
const plantillas = ref<PlantillaHorario[]>([])
const aulas = ref<Aula[]>([])
const areas = ref<AreaOpcion[]>([])
const docentes = ref<DocenteOpcion[]>([])
const seccionId = ref<number | ''>('')
const anhio = ref(anhioActual)
const horario = ref<HorarioSeccion | null>(null)
const sinHorario = ref(false)
const plantillaId = ref<number | ''>('')
const cargando = ref(false)
const creando = ref(false)
const error = ref('')
const aviso = ref('')

const celda = ref<{ bloque: BloqueGrilla; dia: DiaSemana; sesion: SesionHorario | null } | null>(null)
const modalAbierto = ref(false)

const nuevaAula = ref({ codigo: '', capacidad: 30, descripcion: '' })
const guardandoAula = ref(false)
const errorAula = ref('')

const seccion = computed(() => secciones.value.find((item) => item.id === seccionId.value) ?? null)
const plantillasActivas = computed(() => plantillas.value.filter((plantilla) => plantilla.activo))
const totalClases = computed(
  () => horario.value?.bloques.reduce((suma, bloque) => suma + bloque.sesiones.length, 0) ?? 0,
)
const totalCeldas = computed(
  () =>
    (horario.value?.bloques.filter((bloque) => bloque.tipo === 'PEDAGOGICO').length ?? 0) *
    (horario.value?.dias.length ?? 0),
)
const coloresArea = computed(() => {
  const mapa = new Map<string, number>()
  areas.value.forEach((area, indice) => mapa.set(area.codigo, indice % 6))
  return mapa
})

function nombreSeccion(item: Seccion): string {
  return `${item.gradoNumero}.° ${item.nombre}`
}

function franja(bloque: BloqueGrilla): string {
  return `${recortarHora(bloque.horaInicio)} – ${recortarHora(bloque.horaFin)}`
}

function numeroBloque(bloque: BloqueGrilla): number {
  return (horario.value?.bloques.filter((item) => item.tipo === 'PEDAGOGICO') ?? []).indexOf(bloque) + 1
}

function sesionDe(bloque: BloqueGrilla, dia: DiaSemana): SesionHorario | null {
  return bloque.sesiones.find((sesion) => sesion.dia === dia) ?? null
}

async function cargarCatalogos(): Promise<void> {
  try {
    const [listaSecciones, listaPlantillas, listaAulas, listaAreas, listaDocentes] = await Promise.all([
      api.listarSecciones(),
      api.listarPlantillas(),
      api.listarAulas(),
      listarAreas(),
      listarDocentes(),
    ])
    secciones.value = [...listaSecciones].sort(
      (a, b) => a.gradoNumero - b.gradoNumero || a.nombre.localeCompare(b.nombre, 'es'),
    )
    plantillas.value = listaPlantillas
    aulas.value = [...listaAulas].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'))
    areas.value = listaAreas
    docentes.value = listaDocentes
    if (!seccionId.value && secciones.value[0]) seccionId.value = secciones.value[0].id
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar secciones, aulas y docentes.')
  }
}

async function cargarHorario(): Promise<void> {
  if (!seccionId.value) return
  cargando.value = true
  error.value = ''
  sinHorario.value = false
  horario.value = null
  try {
    horario.value = await api.obtener(seccionId.value, anhio.value)
  } catch (fallo: unknown) {
    if (fallo instanceof ErrorSolicitudApi && fallo.estado === 404) {
      sinHorario.value = true
      plantillaId.value = plantillasActivas.value[0]?.id ?? ''
    } else {
      error.value = obtenerMensajeError(fallo, 'No se pudo consultar el horario de la sección.')
    }
  } finally {
    cargando.value = false
  }
}

async function crearHorario(): Promise<void> {
  if (!seccionId.value || !plantillaId.value) return
  creando.value = true
  error.value = ''
  try {
    horario.value = await api.crear(seccionId.value, anhio.value, plantillaId.value)
    sinHorario.value = false
    aviso.value = `Se creó el horario ${anhio.value} de ${seccion.value ? nombreSeccion(seccion.value) : 'la sección'}.`
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo crear el horario.')
  } finally {
    creando.value = false
  }
}

function abrirCelda(bloque: BloqueGrilla, dia: DiaSemana): void {
  celda.value = { bloque, dia, sesion: sesionDe(bloque, dia) }
  aviso.value = ''
  modalAbierto.value = true
}

async function alGuardar(mensaje: string): Promise<void> {
  modalAbierto.value = false
  aviso.value = mensaje
  await cargarHorario()
}

async function agregarAula(): Promise<void> {
  errorAula.value = ''
  const codigo = nuevaAula.value.codigo.trim()
  if (!/^[A-Za-z0-9-]{1,30}$/.test(codigo)) {
    errorAula.value = 'El código admite letras, números y guiones (máx. 30).'
    return
  }
  if (
    !Number.isInteger(nuevaAula.value.capacidad) ||
    nuevaAula.value.capacidad < 1 ||
    nuevaAula.value.capacidad > 200
  ) {
    errorAula.value = 'La capacidad debe estar entre 1 y 200.'
    return
  }
  guardandoAula.value = true
  try {
    const aula = await api.crearAula({ ...nuevaAula.value, codigo })
    aulas.value = [...aulas.value, aula].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es'))
    nuevaAula.value = { codigo: '', capacidad: 30, descripcion: '' }
  } catch (fallo: unknown) {
    errorAula.value = obtenerMensajeError(fallo, 'No se pudo registrar el aula.')
  } finally {
    guardandoAula.value = false
  }
}

watch([seccionId, anhio], () => {
  aviso.value = ''
  void cargarHorario()
})

onMounted(cargarCatalogos)
</script>

<template>
  <main class="vista">
    <header class="encabezado">
      <div>
        <p class="ruta">Horarios / Por sección</p>
        <h1>Horario por sección</h1>
        <p>Asigna curso, docente y aula a cada bloque. El sistema impide cruces de docente o aula y aulas sin aforo.</p>
      </div>
      <NuxtLink class="boton" to="/horarios">Plantillas de bloques</NuxtLink>
    </header>

    <section class="tarjeta controles" aria-label="Elegir sección">
      <label>
        Sección
        <select v-model.number="seccionId">
          <option v-for="item in secciones" :key="item.id" :value="item.id">
            {{ nombreSeccion(item) }} · {{ item.cantidadMatriculados }} alumnos
          </option>
        </select>
      </label>
      <label>
        Año
        <select v-model.number="anhio">
          <option v-for="valor in ANHIOS" :key="valor" :value="valor">{{ valor }}</option>
        </select>
      </label>
      <dl v-if="horario" class="resumen">
        <div>
          <dt>Plantilla</dt>
          <dd>{{ horario.plantillaNombre }} · {{ obtenerNombreTurno(horario.turno) }}</dd>
        </div>
        <div>
          <dt>Clases asignadas</dt>
          <dd>{{ totalClases }} de {{ totalCeldas }} bloques</dd>
        </div>
      </dl>
    </section>

    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" cerrable @cerrar="aviso = ''" />

    <p v-if="cargando" class="estado" role="status">Cargando horario…</p>

    <section v-else-if="sinHorario" class="tarjeta crear" aria-labelledby="titulo-crear">
      <h2 id="titulo-crear">{{ seccion ? nombreSeccion(seccion) : 'La sección' }} aún no tiene horario {{ anhio }}</h2>
      <p>Elige la plantilla de bloques (US-4.3) que usará la grilla.</p>
      <div class="fila-crear">
        <select v-model.number="plantillaId" aria-label="Plantilla de bloques">
          <option v-if="!plantillasActivas.length" value="">No hay plantillas activas</option>
          <option v-for="plantilla in plantillasActivas" :key="plantilla.id" :value="plantilla.id">
            {{ plantilla.nombre }} · {{ obtenerNombreTurno(plantilla.turno) }} ·
            {{ recortarHora(plantilla.horaInicio) }}–{{ recortarHora(plantilla.horaFin) }}
          </option>
        </select>
        <button type="button" class="boton primario" :disabled="creando || !plantillaId" @click="crearHorario">
          {{ creando ? 'Creando…' : 'Crear horario' }}
        </button>
      </div>
    </section>

    <section v-else-if="horario" class="tarjeta" aria-labelledby="titulo-grilla">
      <h2 id="titulo-grilla">Grilla semanal · {{ horario.seccionNombre }} · {{ horario.anio }}</h2>
      <p class="ayuda">Haz clic en un bloque libre para asignar una clase, o en una clase para editarla o quitarla.</p>
      <div class="grilla-contenedor" role="region" aria-label="Horario semanal, desplazamiento horizontal" tabindex="0">
        <table class="grilla">
          <thead>
            <tr>
              <th scope="col" class="hora">Hora</th>
              <th v-for="dia in horario.dias" :key="dia" scope="col">{{ nombreDia(dia) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bloque in horario.bloques" :key="bloque.id" :class="{ recreo: bloque.tipo === 'RECREO' }">
              <th scope="row" class="hora">
                {{ franja(bloque) }}<small v-if="bloque.tipo === 'PEDAGOGICO'">Bloque {{ numeroBloque(bloque) }}</small>
              </th>
              <td v-if="bloque.tipo === 'RECREO'" :colspan="horario.dias.length" class="celda-recreo">Recreo</td>
              <template v-else>
                <td v-for="dia in horario.dias" :key="dia">
                  <button
                    v-if="sesionDe(bloque, dia)"
                    type="button"
                    :class="['clase', `clase--${coloresArea.get(sesionDe(bloque, dia)!.areaCodigo) ?? 0}`]"
                    :aria-label="`Editar ${sesionDe(bloque, dia)!.areaNombre} del ${nombreDia(dia)} ${franja(bloque)}`"
                    @click="abrirCelda(bloque, dia)"
                  >
                    <strong>{{ sesionDe(bloque, dia)!.areaNombre }}</strong>
                    <span>{{ sesionDe(bloque, dia)!.docenteNombre }}</span>
                    <small>Aula {{ sesionDe(bloque, dia)!.aulaCodigo }}</small>
                  </button>
                  <button
                    v-else
                    type="button"
                    class="libre"
                    :aria-label="`Asignar clase el ${nombreDia(dia)} ${franja(bloque)}`"
                    @click="abrirCelda(bloque, dia)"
                  >
                    + Asignar
                  </button>
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="tarjeta" aria-labelledby="titulo-aulas">
      <h2 id="titulo-aulas">Aulas y aforo</h2>
      <p class="ayuda">El aforo se compara con los alumnos matriculados de la sección al asignar una clase (US-4.4).</p>
      <ul v-if="aulas.length" class="aulas">
        <li v-for="aula in aulas" :key="aula.id" :class="{ inactiva: !aula.activo }">
          <strong>{{ aula.codigo }}</strong>
          <span>{{ aula.capacidad }} personas</span>
          <small v-if="aula.descripcion">{{ aula.descripcion }}</small>
          <small v-if="seccion && seccion.cantidadMatriculados > aula.capacidad" class="insuficiente">
            No alcanza para {{ nombreSeccion(seccion) }}
          </small>
        </li>
      </ul>
      <p v-else class="ayuda">Aún no hay aulas registradas.</p>
      <form class="nueva-aula" novalidate @submit.prevent="agregarAula">
        <label>Código<input v-model="nuevaAula.codigo" maxlength="30" placeholder="A-101" /></label>
        <label>Aforo<input v-model.number="nuevaAula.capacidad" type="number" min="1" max="200" /></label>
        <label class="ancha"
          >Descripción<input v-model="nuevaAula.descripcion" maxlength="200" placeholder="Opcional"
        /></label>
        <button type="submit" class="boton primario" :disabled="guardandoAula">
          {{ guardandoAula ? 'Guardando…' : '+ Agregar aula' }}
        </button>
      </form>
      <p v-if="errorAula" class="error" role="alert">{{ errorAula }}</p>
    </section>

    <ModalSesionHorario
      v-if="horario && celda"
      :abierta="modalAbierto"
      :horario-id="horario.id"
      :bloque-id="celda.bloque.id"
      :dia="celda.dia"
      :franja="franja(celda.bloque)"
      :sesion="celda.sesion"
      :areas="areas"
      :docentes="docentes"
      :aulas="aulas"
      :alumnos="seccion?.cantidadMatriculados ?? 0"
      @cerrar="modalAbierto = false"
      @guardada="alGuardar"
    />
  </main>
</template>

<style scoped>
.vista {
  display: flex;
  max-width: 1600px;
  flex-direction: column;
  gap: 20px;
  margin: auto;
  padding: 32px;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.encabezado h1 {
  margin: 4px 0;
  font-size: 30px;
}

.encabezado p {
  margin: 0;
  color: #434655;
}

.ruta {
  font-size: 13px;
}

.tarjeta {
  padding: 22px 24px;
  border: 1px solid #e0e3e5;
  border-radius: 12px;
  background: white;
}

.tarjeta h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.ayuda,
.estado {
  margin: 0 0 14px;
  color: #434655;
  font-size: 13px;
}

.controles {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px 20px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

select,
input {
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  font: inherit;
  font-size: 14px;
  font-weight: 400;
}

.controles select {
  min-width: 200px;
}

.resumen {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 0 0 0 auto;
}

.resumen dt {
  color: #434655;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.resumen dd {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 600;
}

.boton {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  padding: 8px 16px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.boton.primario {
  border-color: #004ac6;
  background: #004ac6;
  color: white;
}

.boton:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.crear p {
  margin: 0 0 12px;
  color: #434655;
}

.fila-crear {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.fila-crear select {
  min-width: 280px;
}

.grilla-contenedor {
  position: relative;
  overflow-x: auto;
}

.grilla {
  width: 100%;
  min-width: 760px;
  border-collapse: separate;
  border-spacing: 6px;
  table-layout: fixed;
}

.grilla th {
  color: #434655;
  font-size: 12px;
  font-weight: 700;
  text-align: left;
  text-transform: uppercase;
}

.grilla th.hora {
  width: 112px;
  font-size: 13px;
  text-transform: none;
}

.grilla th.hora small {
  display: block;
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
}

.grilla td {
  height: 74px;
  padding: 0;
  vertical-align: top;
}

.celda-recreo {
  height: 30px !important;
  border-radius: 8px;
  background: repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 8px, #e2e8f0 8px, #e2e8f0 16px);
  color: #475569;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  vertical-align: middle;
}

.recreo th.hora {
  font-size: 12px;
}

.libre,
.clase {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 74px;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 8px;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.libre {
  align-items: center;
  border: 1px dashed #c3c6d7;
  background: #fafbfc;
  color: #6b7280;
  font-size: 13px;
}

.libre:hover {
  border-color: #004ac6;
  background: #eef4ff;
  color: #004ac6;
}

.clase {
  border: 1px solid transparent;
  border-left-width: 4px;
}

.clase strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clase span,
.clase small {
  overflow: hidden;
  color: #434655;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clase--0 {
  border-color: #1d4ed8;
  background: #eff6ff;
}

.clase--1 {
  border-color: #047857;
  background: #ecfdf5;
}

.clase--2 {
  border-color: #b45309;
  background: #fffbeb;
}

.clase--3 {
  border-color: #7c3aed;
  background: #f5f3ff;
}

.clase--4 {
  border-color: #be185d;
  background: #fdf2f8;
}

.clase--5 {
  border-color: #0e7490;
  background: #ecfeff;
}

.libre:focus-visible,
.clase:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.aulas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}

.aulas li {
  display: flex;
  min-width: 140px;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid #e0e3e5;
  border-radius: 8px;
  font-size: 13px;
}

.aulas li.inactiva {
  opacity: 0.55;
}

.aulas small {
  color: #6b7280;
  font-size: 11px;
}

.aulas .insuficiente {
  color: #b91c1c;
  font-weight: 600;
}

.nueva-aula {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}

.nueva-aula input {
  width: 120px;
}

.nueva-aula .ancha input {
  width: 240px;
}

.error {
  margin: 8px 0 0;
  color: #b91c1c;
  font-size: 13px;
}

@media (max-width: 760px) {
  .vista {
    padding: 20px 16px;
  }

  .resumen {
    margin-left: 0;
  }

  .controles select,
  .fila-crear select,
  .nueva-aula .ancha input {
    width: 100%;
    min-width: 0;
  }

  .controles label,
  .nueva-aula .ancha {
    flex: 1 1 100%;
  }
}
</style>
