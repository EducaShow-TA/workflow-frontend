<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type {
  AreaOpcion,
  DocenteOpcion,
  ErroresSesionClase,
  SesionClaseResumen,
  SituacionSesion,
  SolicitudSesionClase,
} from '~/types/sesionClase'
import type { Seccion } from '~/types/seccion'
import type { VarianteInsignia } from '~/types/interfaz'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { obtenerFechaHoyIso } from '~/composables/useFechas'
import { useSecciones } from '~/composables/useSecciones'
import {
  formatearHora,
  nombreSeccion,
  obtenerSituacion,
  ordenarPorHora,
  useSesionesClase,
  validarSesionClase,
} from '~/composables/useSesionesClase'

definePageMeta({
  middleware: 'autenticacion',
})

const { listar, crear, listarDocentes, listarAreas } = useSesionesClase()
const { listarSecciones } = useSecciones()

const fecha = ref(obtenerFechaHoyIso())
const seccionFiltro = ref<number | ''>('')
const sesiones = ref<SesionClaseResumen[]>([])
const secciones = ref<Seccion[]>([])
const areas = ref<AreaOpcion[]>([])
const docentes = ref<DocenteOpcion[]>([])
const cargando = ref(true)
const error = ref('')
const aviso = ref('')

const modalAbierto = ref(false)
const creando = ref(false)
const errorCrear = ref('')
const formulario = reactive<Partial<SolicitudSesionClase>>({})
const errores = ref<ErroresSesionClase>({})

const sesionesOrdenadas = computed(() => ordenarPorHora(sesiones.value))

const INSIGNIAS: Record<SituacionSesion, { texto: string; variante: VarianteInsignia }> = {
  REGISTRADA: { texto: 'Registrada', variante: 'exito' },
  ABIERTA: { texto: 'Ventana abierta', variante: 'advertencia' },
  POR_ABRIR: { texto: 'Por abrir', variante: 'neutro' },
  CERRADA: { texto: 'Sin registro', variante: 'error' },
}

function etiquetaSeccion(seccion: Seccion): string {
  return `${seccion.gradoNumero}.° ${seccion.nombre}`
}

async function cargarSesiones(): Promise<void> {
  cargando.value = true
  error.value = ''

  try {
    sesiones.value = await listar(fecha.value, seccionFiltro.value || undefined)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar las sesiones de clase.')
  } finally {
    cargando.value = false
  }
}

async function cargarCatalogos(): Promise<void> {
  try {
    const [listaSecciones, listaAreas, listaDocentes] = await Promise.all([
      listarSecciones(),
      listarAreas(),
      listarDocentes(),
    ])
    secciones.value = listaSecciones
    areas.value = listaAreas
    docentes.value = listaDocentes
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar las secciones, áreas o docentes.')
  }
}

function abrirNuevaSesion(): void {
  Object.assign(formulario, {
    seccionId: typeof seccionFiltro.value === 'number' ? seccionFiltro.value : undefined,
    areaCodigo: '',
    docenteId: undefined,
    fecha: fecha.value,
    horaInicio: '',
    horaFin: '',
  })
  errores.value = {}
  errorCrear.value = ''
  modalAbierto.value = true
}

async function crearSesion(): Promise<void> {
  errores.value = validarSesionClase(formulario)
  if (Object.values(errores.value).some(Boolean)) return

  creando.value = true
  errorCrear.value = ''

  try {
    await crear(formulario as SolicitudSesionClase)
    modalAbierto.value = false
    aviso.value = 'Sesión creada. El docente ya la ve en "Mis clases".'
    if (formulario.fecha !== fecha.value) {
      fecha.value = formulario.fecha as string
    } else {
      await cargarSesiones()
    }
  } catch (fallo: unknown) {
    errorCrear.value = obtenerMensajeError(fallo, 'No se pudo crear la sesión.')
  } finally {
    creando.value = false
  }
}

function limpiarError(campo: keyof SolicitudSesionClase): void {
  errores.value = { ...errores.value, [campo]: undefined }
}

watch([fecha, seccionFiltro], () => {
  if (fecha.value) void cargarSesiones()
})

onMounted(() => {
  void cargarSesiones()
  void cargarCatalogos()
})
</script>

<template>
  <main class="pagina-sesiones">
    <EncabezadoPagina
      titulo="Sesiones de clase"
      descripcion="Programa las sesiones de cada sección; el docente asignado toma la asistencia desde su portal."
    >
      <template #acciones>
        <BotonAccion @click="abrirNuevaSesion">+ Nueva sesión</BotonAccion>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" cerrable @cerrar="aviso = ''" />

    <section class="tarjeta">
      <div class="filtros">
        <div class="campo">
          <label for="fecha-sesiones">Fecha</label>
          <input id="fecha-sesiones" v-model="fecha" type="date" />
        </div>
        <div class="campo">
          <label for="seccion-sesiones">Sección</label>
          <select id="seccion-sesiones" v-model="seccionFiltro">
            <option value="">Todas</option>
            <option v-for="seccion in secciones" :key="seccion.id" :value="seccion.id">
              {{ etiquetaSeccion(seccion) }}
            </option>
          </select>
        </div>
      </div>

      <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="cargarSesiones" />

      <p v-else-if="!sesiones.length" class="vacio">No hay sesiones programadas para esta fecha.</p>

      <div v-else class="tabla-desplazable">
        <table>
          <thead>
            <tr>
              <th scope="col">Hora</th>
              <th scope="col">Sección</th>
              <th scope="col">Área</th>
              <th scope="col">Docente</th>
              <th scope="col">Asistencia</th>
              <th scope="col"><span class="solo-lectores">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sesion in sesionesOrdenadas" :key="sesion.id">
              <td>{{ formatearHora(sesion.horaInicio) }} – {{ formatearHora(sesion.horaFin) }}</td>
              <td>{{ nombreSeccion(sesion) }}</td>
              <td>{{ sesion.areaNombre }}</td>
              <td>{{ sesion.docenteNombre }}</td>
              <td>
                <InsigniaEstado
                  :texto="INSIGNIAS[obtenerSituacion(sesion)].texto"
                  :variante="INSIGNIAS[obtenerSituacion(sesion)].variante"
                />
              </td>
              <td class="accion">
                <NuxtLink :to="`/sesiones-clase/${sesion.id}`" class="enlace">Ver asistencia</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <VentanaModal
      :abierta="modalAbierto"
      titulo="Nueva sesión de clase"
      descripcion="El docente asignado la verá en Mis clases."
      :bloqueada="creando"
      @cerrar="modalAbierto = false"
    >
      <form id="formulario-sesion" class="formulario" novalidate @submit.prevent="crearSesion">
        <div class="campo">
          <label for="sesion-seccion">Sección <span class="obligatorio">*</span></label>
          <select
            id="sesion-seccion"
            v-model.number="formulario.seccionId"
            :aria-invalid="Boolean(errores.seccionId)"
            @change="limpiarError('seccionId')"
          >
            <option :value="undefined" disabled>Selecciona una sección</option>
            <option v-for="seccion in secciones" :key="seccion.id" :value="seccion.id">
              {{ etiquetaSeccion(seccion) }}
            </option>
          </select>
          <small v-if="errores.seccionId" class="error">{{ errores.seccionId }}</small>
        </div>

        <div class="campo">
          <label for="sesion-area">Área <span class="obligatorio">*</span></label>
          <select
            id="sesion-area"
            v-model="formulario.areaCodigo"
            :aria-invalid="Boolean(errores.areaCodigo)"
            @change="limpiarError('areaCodigo')"
          >
            <option value="" disabled>Selecciona un área</option>
            <option v-for="area in areas" :key="area.codigo" :value="area.codigo">{{ area.nombre }}</option>
          </select>
          <small v-if="errores.areaCodigo" class="error">{{ errores.areaCodigo }}</small>
        </div>

        <div class="campo ancho">
          <label for="sesion-docente">Docente <span class="obligatorio">*</span></label>
          <select
            id="sesion-docente"
            v-model.number="formulario.docenteId"
            :aria-invalid="Boolean(errores.docenteId)"
            @change="limpiarError('docenteId')"
          >
            <option :value="undefined" disabled>Selecciona un docente</option>
            <option v-for="docente in docentes" :key="docente.id" :value="docente.id">
              {{ docente.nombreCompleto }} · DNI {{ docente.dni }}
            </option>
          </select>
          <small v-if="errores.docenteId" class="error">{{ errores.docenteId }}</small>
          <small v-else-if="!docentes.length" class="ayuda">
            No hay cuentas activas con rol Docente. Créalas en Usuarios.
          </small>
          <small v-else class="ayuda">Cuentas activas con rol Docente.</small>
        </div>

        <div class="campo ancho">
          <label for="sesion-fecha">Fecha <span class="obligatorio">*</span></label>
          <input
            id="sesion-fecha"
            v-model="formulario.fecha"
            type="date"
            :aria-invalid="Boolean(errores.fecha)"
            @input="limpiarError('fecha')"
          />
          <small v-if="errores.fecha" class="error">{{ errores.fecha }}</small>
        </div>

        <div class="campo">
          <label for="sesion-inicio">Hora de inicio <span class="obligatorio">*</span></label>
          <input
            id="sesion-inicio"
            v-model="formulario.horaInicio"
            type="time"
            :aria-invalid="Boolean(errores.horaInicio)"
            @input="limpiarError('horaInicio')"
          />
          <small v-if="errores.horaInicio" class="error">{{ errores.horaInicio }}</small>
        </div>

        <div class="campo">
          <label for="sesion-fin">Hora de fin <span class="obligatorio">*</span></label>
          <input
            id="sesion-fin"
            v-model="formulario.horaFin"
            type="time"
            :aria-invalid="Boolean(errores.horaFin)"
            @input="limpiarError('horaFin')"
          />
          <small v-if="errores.horaFin" class="error">{{ errores.horaFin }}</small>
        </div>

        <AvisoMensaje v-if="errorCrear" class="ancho" :mensaje="errorCrear" tipo="error" />
      </form>

      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="creando" @click="modalAbierto = false">Cancelar</BotonAccion>
        <BotonAccion tipo="submit" form="formulario-sesion" :deshabilitado="creando">
          {{ creando ? 'Creando...' : 'Crear sesión' }}
        </BotonAccion>
      </template>
    </VentanaModal>
  </main>
</template>

<style scoped>
.pagina-sesiones {
  display: flex;
  width: 100%;
  max-width: 1100px;
  flex-direction: column;
  gap: 20px;
  margin: 0 auto;
  padding: 32px;
}

.tarjeta {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.filtros .campo {
  min-width: 180px;
}

.campo label {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.campo input,
.campo select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 14px;
}

.campo [aria-invalid='true'] {
  border-color: #dc2626;
}

.obligatorio,
.error {
  color: #dc2626;
}

.error,
.ayuda {
  font-size: 12px;
}

.ayuda {
  color: #434655;
}

.formulario {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ancho {
  grid-column: 1 / -1;
}

.vacio {
  margin: 0;
  padding: 32px 16px;
  color: #434655;
  text-align: center;
}

.tabla-desplazable {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th,
td {
  padding: 12px 16px;
  border-bottom: 1px solid #eef0f2;
  text-align: left;
  white-space: nowrap;
}

th {
  background: #f9fafb;
  color: #434655;
  font-size: 12px;
}

.accion {
  text-align: right;
}

.enlace {
  color: #004ac6;
  font-weight: 600;
  text-decoration: none;
}

.enlace:hover {
  text-decoration: underline;
}

.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 720px) {
  .pagina-sesiones {
    padding: 16px;
  }

  .formulario {
    grid-template-columns: minmax(0, 1fr);
  }

  .filtros .campo {
    min-width: 0;
    flex: 1 1 100%;
  }
}
</style>
