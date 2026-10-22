<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import type {
  AmbitoFiltro,
  Area,
  Competencia,
  ErroresArea,
  ErroresCompetencia,
  FiltroEstado,
  SolicitudArea,
  SolicitudCompetencia,
} from '~/types/competencia'
import {
  LONGITUD_MAXIMA_DESCRIPCION,
  LONGITUD_MAXIMA_NOMBRE,
  MINIMO_COMPETENCIAS_POR_AREA,
  calcularResumenCatalogo,
  filtrarAreas,
  limpiarTexto,
  useCompetencias,
  validarArea,
  validarCompetencia,
  validarCompetenciasNuevas,
  validarMinimoCompetencias,
} from '~/composables/useCompetencias'
import { obtenerMensajeError } from '~/composables/useDatosPrueba'
import { tieneErrores } from '~/composables/useValidacion'

definePageMeta({
  middleware: 'autenticacion',
})

const {
  listarAreas,
  registrarArea,
  actualizarArea,
  cambiarEstadoArea,
  registrarCompetencia,
  actualizarCompetencia,
  cambiarEstadoCompetencia,
} = useCompetencias()

const areas = ref<Area[]>([])
const cargando = ref(true)
const errorCarga = ref('')
const mensajeExito = ref('')

async function cargarAreas(): Promise<void> {
  cargando.value = true
  errorCarga.value = ''

  try {
    areas.value = await listarAreas()
  } catch (error: unknown) {
    errorCarga.value = obtenerMensajeError(error, 'No se pudo cargar el catálogo de áreas y competencias.')
  } finally {
    cargando.value = false
  }
}

onMounted(async () => {
  await cargarAreas()
  const primera = areas.value[0]

  if (primera) {
    idsExpandidos.value = [primera.id]
  }
})

// Filtros y resumen
const busqueda = ref('')
const filtroEstado = ref<FiltroEstado>('TODOS')
const ambitoFiltro = ref<AmbitoFiltro>('AMBAS')

const opcionesAmbito: { valor: AmbitoFiltro; etiqueta: string; ejemplo: string }[] = [
  { valor: 'AREAS', etiqueta: 'Áreas', ejemplo: 'Ej. Matemática' },
  { valor: 'COMPETENCIAS', etiqueta: 'Competencias', ejemplo: 'Ej. Resuelve problemas de cantidad' },
  { valor: 'AMBAS', etiqueta: 'Ambas', ejemplo: 'Ej. Matemática o cantidad' },
]

const ejemploBusqueda = computed(
  () => opcionesAmbito.find((opcion) => opcion.valor === ambitoFiltro.value)?.ejemplo ?? '',
)

const areasFiltradas = computed(() => filtrarAreas(areas.value, busqueda.value, filtroEstado.value, ambitoFiltro.value))
const resumen = computed(() => calcularResumenCatalogo(areas.value))
const hayFiltros = computed(
  () => Boolean(busqueda.value.trim()) || filtroEstado.value !== 'TODOS' || ambitoFiltro.value !== 'AMBAS',
)

function limpiarFiltros(): void {
  busqueda.value = ''
  ambitoFiltro.value = 'AMBAS'
  filtroEstado.value = 'TODOS'
}

function contarCompetencias(areaId: number): number {
  return areas.value.find((area) => area.id === areaId)?.competencias.length ?? 0
}

function obtenerAreaOriginal(areaId: number): Area | undefined {
  return areas.value.find((area) => area.id === areaId)
}

// Areas desplegadas: al buscar o filtrar competencias se abren todas para ver las coincidencias.
const idsExpandidos = ref<number[]>([])

const filtraCompetencias = computed(
  () => Boolean(busqueda.value.trim()) || (ambitoFiltro.value !== 'AREAS' && filtroEstado.value !== 'TODOS'),
)

function estaExpandida(areaId: number): boolean {
  return filtraCompetencias.value || idsExpandidos.value.includes(areaId)
}

function alternarArea(areaId: number): void {
  idsExpandidos.value = idsExpandidos.value.includes(areaId)
    ? idsExpandidos.value.filter((id) => id !== areaId)
    : [...idsExpandidos.value, areaId]
}

function mostrarExito(mensaje: string): void {
  mensajeExito.value = mensaje
}

// Formulario de area (crear con su primera competencia, o editar)
const modoArea = ref<'crear' | 'editar' | null>(null)
const areaEnEdicion = ref<Area | null>(null)
const guardandoArea = ref(false)
const errorGuardadoArea = ref('')

const formularioArea = reactive<SolicitudArea>({ nombre: '', descripcion: '' })
const competenciasNuevas = ref<SolicitudCompetencia[]>([])
const erroresArea = reactive<ErroresArea>({})
const erroresCompetenciasNuevas = ref<ErroresCompetencia[]>([])
const errorMinimoCompetencias = ref('')

function crearCompetenciaVacia(): SolicitudCompetencia {
  return { nombre: '', descripcion: '' }
}

async function agregarCompetenciaNueva(): Promise<void> {
  competenciasNuevas.value.push(crearCompetenciaVacia())
  await nextTick()
  // Se enfoca el nombre de la competencia agregada para seguir escribiendo sin usar el mouse.
  document.getElementById(`nombre-competencia-nueva-${competenciasNuevas.value.length - 1}`)?.focus()
}

function quitarCompetenciaNueva(indice: number): void {
  if (competenciasNuevas.value.length <= MINIMO_COMPETENCIAS_POR_AREA) {
    return
  }

  competenciasNuevas.value.splice(indice, 1)
  erroresCompetenciasNuevas.value = []
}

function limpiarErrorCompetenciaNueva(indice: number): void {
  errorMinimoCompetencias.value = ''
  const errores = erroresCompetenciasNuevas.value[indice]

  if (errores) {
    errores.nombre = undefined
  }
}

function limpiarErroresArea(): void {
  erroresArea.nombre = undefined
  erroresArea.descripcion = undefined
  erroresCompetenciasNuevas.value = []
  errorMinimoCompetencias.value = ''
  errorGuardadoArea.value = ''
}

function abrirNuevaArea(): void {
  modoArea.value = 'crear'
  areaEnEdicion.value = null
  formularioArea.nombre = ''
  formularioArea.descripcion = ''
  competenciasNuevas.value = [crearCompetenciaVacia()]
  limpiarErroresArea()
}

function abrirEdicionArea(area: Area): void {
  modoArea.value = 'editar'
  areaEnEdicion.value = obtenerAreaOriginal(area.id) ?? area
  formularioArea.nombre = area.nombre
  formularioArea.descripcion = area.descripcion
  limpiarErroresArea()
}

function cerrarModalArea(): void {
  modoArea.value = null
}

async function guardarArea(): Promise<void> {
  limpiarErroresArea()

  const idEnEdicion = modoArea.value === 'editar' ? (areaEnEdicion.value?.id ?? null) : null
  Object.assign(erroresArea, validarArea(formularioArea, areas.value, idEnEdicion))

  if (modoArea.value === 'crear') {
    // Primero la regla del minimo (1..*), con un mensaje propio; despues, los errores de cada competencia.
    errorMinimoCompetencias.value = validarMinimoCompetencias(competenciasNuevas.value)

    if (!errorMinimoCompetencias.value) {
      erroresCompetenciasNuevas.value = validarCompetenciasNuevas(competenciasNuevas.value)
    }
  }

  if (
    tieneErrores(erroresArea) ||
    Boolean(errorMinimoCompetencias.value) ||
    erroresCompetenciasNuevas.value.some(tieneErrores)
  ) {
    return
  }

  guardandoArea.value = true

  try {
    if (modoArea.value === 'crear') {
      const nueva = await registrarArea({
        ...formularioArea,
        competencias: competenciasNuevas.value.map((competencia) => ({ ...competencia })),
      })
      const cantidad = nueva.competencias.length
      idsExpandidos.value = [...idsExpandidos.value, nueva.id]
      mostrarExito(`Área «${nueva.nombre}» creada con ${cantidad} ${cantidad === 1 ? 'competencia' : 'competencias'}.`)
    } else if (areaEnEdicion.value) {
      const actualizada = await actualizarArea(areaEnEdicion.value.id, { ...formularioArea })
      mostrarExito(`Área «${actualizada.nombre}» actualizada.`)
    }

    modoArea.value = null
    await cargarAreas()
  } catch (error: unknown) {
    errorGuardadoArea.value = obtenerMensajeError(error, 'No se pudo guardar el área.')
  } finally {
    guardandoArea.value = false
  }
}

// Formulario de competencia (agregar a un area, o editar)
const areaDeCompetencia = ref<Area | null>(null)
const competenciaEnEdicion = ref<Competencia | null>(null)
const guardandoCompetencia = ref(false)
const errorGuardadoCompetencia = ref('')

const formularioCompetencia = reactive<SolicitudCompetencia>({ nombre: '', descripcion: '' })
const erroresCompetencia = reactive<ErroresCompetencia>({})

const tituloModalCompetencia = computed(() =>
  competenciaEnEdicion.value ? 'Editar competencia' : `Nueva competencia de ${areaDeCompetencia.value?.nombre ?? ''}`,
)

function limpiarErroresCompetencia(): void {
  erroresCompetencia.nombre = undefined
  erroresCompetencia.descripcion = undefined
  errorGuardadoCompetencia.value = ''
}

function abrirNuevaCompetencia(area: Area): void {
  areaDeCompetencia.value = obtenerAreaOriginal(area.id) ?? area
  competenciaEnEdicion.value = null
  formularioCompetencia.nombre = ''
  formularioCompetencia.descripcion = ''
  limpiarErroresCompetencia()
}

function abrirEdicionCompetencia(area: Area, competencia: Competencia): void {
  areaDeCompetencia.value = obtenerAreaOriginal(area.id) ?? area
  competenciaEnEdicion.value = competencia
  formularioCompetencia.nombre = competencia.nombre
  formularioCompetencia.descripcion = competencia.descripcion
  limpiarErroresCompetencia()
}

function cerrarModalCompetencia(): void {
  areaDeCompetencia.value = null
  competenciaEnEdicion.value = null
}

async function guardarCompetencia(): Promise<void> {
  const area = areaDeCompetencia.value

  if (!area) {
    return
  }

  limpiarErroresCompetencia()
  const idEnEdicion = competenciaEnEdicion.value?.id ?? null
  Object.assign(erroresCompetencia, validarCompetencia(formularioCompetencia, area, idEnEdicion))

  if (tieneErrores(erroresCompetencia)) {
    return
  }

  guardandoCompetencia.value = true

  try {
    if (competenciaEnEdicion.value) {
      await actualizarCompetencia(competenciaEnEdicion.value.id, { ...formularioCompetencia })
      mostrarExito(`Competencia «${limpiarTexto(formularioCompetencia.nombre)}» actualizada.`)
    } else {
      await registrarCompetencia(area.id, { ...formularioCompetencia })
      mostrarExito(`Competencia agregada al área ${area.nombre}.`)
    }

    cerrarModalCompetencia()
    await cargarAreas()
  } catch (error: unknown) {
    errorGuardadoCompetencia.value = obtenerMensajeError(error, 'No se pudo guardar la competencia.')
  } finally {
    guardandoCompetencia.value = false
  }
}

// Confirmacion de acciones: desactivar pide confirmacion; activar se aplica directamente.
interface AccionPendiente {
  titulo: string
  mensaje: string
  textoConfirmar: string
  variante: 'normal' | 'peligro'
  ejecutar: () => Promise<string>
}

const accionPendiente = ref<AccionPendiente | null>(null)
const procesandoAccion = ref(false)
const errorAccion = ref('')
// Error de una accion sin confirmacion (activar), que se muestra arriba de la lista.
const errorGeneral = ref('')

function pedirConfirmacion(accion: AccionPendiente): void {
  errorAccion.value = ''
  accionPendiente.value = accion
}

function cancelarAccion(): void {
  accionPendiente.value = null
}

async function ejecutarAccion(accion: () => Promise<string>, mensajeError: string): Promise<boolean> {
  try {
    mostrarExito(await accion())
    await cargarAreas()
    return true
  } catch (error: unknown) {
    const mensaje = obtenerMensajeError(error, mensajeError)

    if (accionPendiente.value) {
      errorAccion.value = mensaje
    } else {
      mensajeExito.value = ''
      errorGeneral.value = mensaje
    }

    return false
  }
}

async function confirmarAccion(): Promise<void> {
  const accion = accionPendiente.value

  if (!accion) {
    return
  }

  procesandoAccion.value = true
  const exito = await ejecutarAccion(accion.ejecutar, 'No se pudo completar la acción.')
  procesandoAccion.value = false

  if (exito) {
    accionPendiente.value = null
  }
}

function solicitarCambioEstadoArea(area: Area): void {
  errorGeneral.value = ''
  const nuevoEstado = !area.activo
  const ejecutar = async (): Promise<string> => {
    const actualizada = await cambiarEstadoArea(area.id, nuevoEstado)
    return `Área «${actualizada.nombre}» ${nuevoEstado ? 'activada' : 'desactivada'}.`
  }

  if (nuevoEstado) {
    void ejecutarAccion(ejecutar, 'No se pudo activar el área.')
    return
  }

  pedirConfirmacion({
    titulo: 'Desactivar área',
    mensaje: `¿Desactivar el área «${area.nombre}»? Sus competencias no estarán disponibles para nuevas evaluaciones mientras el área esté inactiva. Las notas ya registradas se conservan.`,
    textoConfirmar: 'Desactivar área',
    variante: 'normal',
    ejecutar,
  })
}

function solicitarCambioEstadoCompetencia(competencia: Competencia): void {
  errorGeneral.value = ''
  const nuevoEstado = !competencia.activo
  const ejecutar = async (): Promise<string> => {
    const actualizada = await cambiarEstadoCompetencia(competencia.id, nuevoEstado)
    return `Competencia «${actualizada.nombre}» ${nuevoEstado ? 'activada' : 'desactivada'}.`
  }

  if (nuevoEstado) {
    void ejecutarAccion(ejecutar, 'No se pudo activar la competencia.')
    return
  }

  pedirConfirmacion({
    titulo: 'Desactivar competencia',
    mensaje: `¿Desactivar «${competencia.nombre}»? No estará disponible para nuevas evaluaciones. Las notas ya registradas se conservan.`,
    textoConfirmar: 'Desactivar competencia',
    variante: 'normal',
    ejecutar,
  })
}
</script>

<template>
  <main class="pagina-competencias">
    <EncabezadoPagina
      titulo="Áreas y Competencias"
      descripcion="Configura el catálogo de áreas curriculares y sus competencias según el plan curricular vigente."
    >
      <template #acciones>
        <BotonAccion @click="abrirNuevaArea">+ Nueva área</BotonAccion>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="mensajeExito" :mensaje="mensajeExito" tipo="exito" cerrable @cerrar="mensajeExito = ''" />
    <AvisoMensaje v-if="errorGeneral" :mensaje="errorGeneral" tipo="error" cerrable @cerrar="errorGeneral = ''" />

    <PanelEstadoCarga :cargando="cargando" :error="errorCarga" @reintentar="cargarAreas">
      <section v-if="areas.length === 0" class="estado-vacio">
        <h2>Aún no hay áreas curriculares</h2>
        <p>Crea la primera área con su competencia para empezar a configurar el plan curricular del colegio.</p>
        <BotonAccion @click="abrirNuevaArea">+ Crear primera área</BotonAccion>
      </section>

      <template v-else>
        <section class="resumen" aria-label="Resumen del catálogo">
          <div class="indicador">
            <span>Áreas activas</span>
            <strong>{{ resumen.areasActivas }}</strong>
          </div>

          <div class="indicador">
            <span>Áreas inactivas</span>
            <strong>{{ resumen.areasInactivas }}</strong>
          </div>

          <div class="indicador destacado">
            <span>Competencias activas</span>
            <strong>{{ resumen.competenciasActivas }}</strong>
          </div>

          <div class="indicador">
            <span>Competencias inactivas</span>
            <strong>{{ resumen.competenciasInactivas }}</strong>
          </div>
        </section>

        <section class="panel-filtros" aria-label="Filtros del catálogo">
          <div class="fila-ambito">
            <span id="etiqueta-ambito" class="etiqueta-filtro">Filtrar en</span>

            <div class="selector-ambito" role="group" aria-labelledby="etiqueta-ambito">
              <button
                v-for="opcion in opcionesAmbito"
                :key="opcion.valor"
                type="button"
                class="opcion-ambito"
                :class="{ seleccionada: ambitoFiltro === opcion.valor }"
                :aria-pressed="ambitoFiltro === opcion.valor"
                @click="ambitoFiltro = opcion.valor"
              >
                {{ opcion.etiqueta }}
              </button>
            </div>
          </div>

          <div class="fila-filtros">
            <div class="campo-filtro">
              <label for="buscar-competencia">Buscar</label>
              <input id="buscar-competencia" v-model="busqueda" type="search" :placeholder="ejemploBusqueda" />
            </div>

            <div class="campo-filtro">
              <label for="filtro-estado">Estado</label>
              <select id="filtro-estado" v-model="filtroEstado">
                <option value="TODOS">Todos</option>
                <option value="ACTIVOS">Activos</option>
                <option value="INACTIVOS">Inactivos</option>
              </select>
            </div>

            <button type="button" class="boton-limpiar" :disabled="!hayFiltros" @click="limpiarFiltros">
              Limpiar filtros
            </button>
          </div>
        </section>

        <section class="lista-areas" aria-label="Áreas curriculares">
          <TarjetaArea
            v-for="area in areasFiltradas"
            :key="area.id"
            :area="area"
            :total-competencias="contarCompetencias(area.id)"
            :expandida="estaExpandida(area.id)"
            @alternar="alternarArea(area.id)"
            @editar-area="abrirEdicionArea(area)"
            @cambiar-estado-area="solicitarCambioEstadoArea(area)"
            @agregar-competencia="abrirNuevaCompetencia(area)"
            @editar-competencia="abrirEdicionCompetencia(area, $event)"
            @cambiar-estado-competencia="solicitarCambioEstadoCompetencia"
          />

          <p v-if="areasFiltradas.length === 0" class="sin-resultados">
            Ninguna área o competencia coincide con los filtros seleccionados.
          </p>
        </section>
      </template>
    </PanelEstadoCarga>

    <VentanaModal
      :abierta="modoArea !== null"
      :titulo="modoArea === 'crear' ? 'Nueva área curricular' : 'Editar área curricular'"
      :descripcion="modoArea === 'crear' ? 'Registra el área junto con sus competencias.' : ''"
      :bloqueada="guardandoArea"
      @cerrar="cerrarModalArea"
    >
      <form id="formulario-area" class="formulario" novalidate @submit.prevent="guardarArea">
        <div class="campo">
          <label for="nombre-area">Nombre del área <span class="obligatorio">*</span></label>
          <input
            id="nombre-area"
            v-model="formularioArea.nombre"
            type="text"
            :maxlength="LONGITUD_MAXIMA_NOMBRE"
            placeholder="Ej. Matemática"
            autocomplete="off"
            :aria-invalid="Boolean(erroresArea.nombre)"
            :aria-describedby="erroresArea.nombre ? 'error-nombre-area' : undefined"
            @input="erroresArea.nombre = undefined"
          />
          <small v-if="erroresArea.nombre" id="error-nombre-area" class="error">{{ erroresArea.nombre }}</small>
        </div>

        <div class="campo">
          <label for="descripcion-area">Descripción</label>
          <textarea
            id="descripcion-area"
            v-model="formularioArea.descripcion"
            rows="2"
            :maxlength="LONGITUD_MAXIMA_DESCRIPCION"
            placeholder="Propósito del área en el plan curricular (opcional)"
            :aria-invalid="Boolean(erroresArea.descripcion)"
            :aria-describedby="erroresArea.descripcion ? 'error-descripcion-area' : undefined"
          />
          <small v-if="erroresArea.descripcion" id="error-descripcion-area" class="error">
            {{ erroresArea.descripcion }}
          </small>
        </div>

        <fieldset v-if="modoArea === 'crear'" class="grupo-competencias">
          <legend>Competencias del área</legend>

          <p class="ayuda">Registra al menos una competencia. Podrás agregar más después de crear el área.</p>

          <p v-if="errorMinimoCompetencias" id="error-minimo-competencias" class="error-grupo" role="alert">
            {{ errorMinimoCompetencias }}
          </p>

          <div v-for="(competencia, indice) in competenciasNuevas" :key="indice" class="competencia-nueva">
            <div class="encabezado-competencia-nueva">
              <span>Competencia {{ indice + 1 }}</span>

              <button
                v-if="competenciasNuevas.length > MINIMO_COMPETENCIAS_POR_AREA"
                type="button"
                class="boton-quitar"
                :aria-label="`Quitar competencia ${indice + 1}`"
                @click="quitarCompetenciaNueva(indice)"
              >
                Quitar
              </button>
            </div>

            <div class="campo">
              <label :for="`nombre-competencia-nueva-${indice}`">
                Nombre de la competencia <span class="obligatorio">*</span>
              </label>
              <input
                :id="`nombre-competencia-nueva-${indice}`"
                v-model="competencia.nombre"
                type="text"
                :maxlength="LONGITUD_MAXIMA_NOMBRE"
                placeholder="Ej. Resuelve problemas de cantidad"
                autocomplete="off"
                :aria-invalid="Boolean(erroresCompetenciasNuevas[indice]?.nombre) || Boolean(errorMinimoCompetencias)"
                :aria-describedby="
                  erroresCompetenciasNuevas[indice]?.nombre
                    ? `error-competencia-nueva-${indice}`
                    : errorMinimoCompetencias
                      ? 'error-minimo-competencias'
                      : undefined
                "
                @input="limpiarErrorCompetenciaNueva(indice)"
              />
              <small
                v-if="erroresCompetenciasNuevas[indice]?.nombre"
                :id="`error-competencia-nueva-${indice}`"
                class="error"
              >
                {{ erroresCompetenciasNuevas[indice]?.nombre }}
              </small>
            </div>

            <div class="campo">
              <label :for="`descripcion-competencia-nueva-${indice}`">Descripción de la competencia</label>
              <textarea
                :id="`descripcion-competencia-nueva-${indice}`"
                v-model="competencia.descripcion"
                rows="2"
                :maxlength="LONGITUD_MAXIMA_DESCRIPCION"
                placeholder="Qué logra el estudiante con esta competencia (opcional)"
              />
            </div>
          </div>

          <button type="button" class="boton-agregar-competencia" @click="agregarCompetenciaNueva">
            + Agregar otra competencia
          </button>
        </fieldset>

        <AvisoMensaje v-if="errorGuardadoArea" :mensaje="errorGuardadoArea" tipo="error" />
      </form>

      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="guardandoArea" @click="cerrarModalArea">
          Cancelar
        </BotonAccion>
        <BotonAccion tipo="submit" form="formulario-area" :deshabilitado="guardandoArea">
          {{ guardandoArea ? 'Guardando...' : modoArea === 'crear' ? 'Crear área' : 'Guardar cambios' }}
        </BotonAccion>
      </template>
    </VentanaModal>

    <VentanaModal
      :abierta="areaDeCompetencia !== null"
      :titulo="tituloModalCompetencia"
      :descripcion="competenciaEnEdicion ? `Área: ${areaDeCompetencia?.nombre ?? ''}` : ''"
      :bloqueada="guardandoCompetencia"
      @cerrar="cerrarModalCompetencia"
    >
      <form id="formulario-competencia" class="formulario" novalidate @submit.prevent="guardarCompetencia">
        <div class="campo">
          <label for="nombre-competencia">Nombre de la competencia <span class="obligatorio">*</span></label>
          <input
            id="nombre-competencia"
            v-model="formularioCompetencia.nombre"
            type="text"
            :maxlength="LONGITUD_MAXIMA_NOMBRE"
            placeholder="Ej. Resuelve problemas de cantidad"
            autocomplete="off"
            :aria-invalid="Boolean(erroresCompetencia.nombre)"
            :aria-describedby="erroresCompetencia.nombre ? 'error-nombre-competencia' : undefined"
            @input="erroresCompetencia.nombre = undefined"
          />
          <small v-if="erroresCompetencia.nombre" id="error-nombre-competencia" class="error">
            {{ erroresCompetencia.nombre }}
          </small>
        </div>

        <div class="campo">
          <label for="descripcion-competencia">Descripción</label>
          <textarea
            id="descripcion-competencia"
            v-model="formularioCompetencia.descripcion"
            rows="3"
            :maxlength="LONGITUD_MAXIMA_DESCRIPCION"
            placeholder="Qué logra el estudiante con esta competencia (opcional)"
            :aria-invalid="Boolean(erroresCompetencia.descripcion)"
            :aria-describedby="erroresCompetencia.descripcion ? 'error-descripcion-competencia' : undefined"
          />
          <small v-if="erroresCompetencia.descripcion" id="error-descripcion-competencia" class="error">
            {{ erroresCompetencia.descripcion }}
          </small>
        </div>

        <AvisoMensaje v-if="errorGuardadoCompetencia" :mensaje="errorGuardadoCompetencia" tipo="error" />
      </form>

      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="guardandoCompetencia" @click="cerrarModalCompetencia">
          Cancelar
        </BotonAccion>
        <BotonAccion tipo="submit" form="formulario-competencia" :deshabilitado="guardandoCompetencia">
          {{ guardandoCompetencia ? 'Guardando...' : competenciaEnEdicion ? 'Guardar cambios' : 'Agregar competencia' }}
        </BotonAccion>
      </template>
    </VentanaModal>

    <VentanaConfirmacion
      :abierta="accionPendiente !== null"
      :titulo="accionPendiente?.titulo ?? ''"
      :mensaje="accionPendiente?.mensaje ?? ''"
      :texto-confirmar="accionPendiente?.textoConfirmar"
      :variante="accionPendiente?.variante"
      :procesando="procesandoAccion"
      :error="errorAccion"
      @confirmar="confirmarAccion"
      @cancelar="cancelarAccion"
    />
  </main>
</template>

<style scoped>
.pagina-competencias {
  display: flex;
  width: 100%;
  max-width: 1100px;
  flex-direction: column;
  gap: 24px;
  margin: 0 auto;
  padding: 32px;
}

.resumen {
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

.panel-filtros {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.fila-ambito {
  display: flex;
  align-items: center;
  gap: 12px;
}

.etiqueta-filtro {
  color: #434655;
  font-size: 12px;
  font-weight: 600;
}

.selector-ambito {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
}

.opcion-ambito {
  min-height: 36px;
  padding: 7px 16px;
  border: 0;
  background: white;
  color: #434655;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.opcion-ambito + .opcion-ambito {
  border-left: 1px solid #c3c6d7;
}

.opcion-ambito:hover:not(.seleccionada) {
  background: #f2f4f6;
}

.opcion-ambito.seleccionada {
  background: #004ac6;
  color: white;
}

.opcion-ambito:focus-visible {
  position: relative;
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.fila-filtros {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto;
  align-items: end;
  gap: 16px;
}

.campo-filtro {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.campo-filtro label {
  color: #434655;
  font-size: 12px;
  font-weight: 600;
}

.campo-filtro input,
.campo-filtro select {
  width: 100%;
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 7px;
  background: #f7f9fb;
  color: #191c1e;
  font-size: 14px;
}

.campo-filtro input:focus,
.campo-filtro select:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.boton-limpiar {
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 7px;
  background: #f2f4f6;
  color: #434655;
  font-size: 13px;
  cursor: pointer;
}

.boton-limpiar:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.lista-areas {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sin-resultados,
.estado-vacio {
  margin: 0;
  padding: 48px 16px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
  color: #737686;
  font-size: 14px;
  text-align: center;
}

.estado-vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.estado-vacio h2 {
  margin: 0;
  color: #191c1e;
  font-size: 20px;
}

.estado-vacio p {
  max-width: 460px;
  margin: 0 0 8px;
  color: #434655;
}

.formulario {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.campo label {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.campo input,
.campo textarea {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font-size: 14px;
  resize: vertical;
}

.campo input:focus-visible,
.campo textarea:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.campo [aria-invalid='true'] {
  border-color: #dc2626;
}

.obligatorio,
.error {
  color: #dc2626;
}

.error {
  font-size: 12px;
}

.grupo-competencias {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f7f9fb;
}

.grupo-competencias legend {
  padding: 0 6px;
  color: #191c1e;
  font-size: 14px;
  font-weight: 700;
}

.error-grupo {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #991b1b;
  font-size: 13px;
}

.competencia-nueva {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
}

.encabezado-competencia-nueva {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #434655;
  font-size: 13px;
  font-weight: 700;
}

.boton-quitar {
  padding: 4px 10px;
  border: 1px solid #fecaca;
  border-radius: 7px;
  background: white;
  color: #b91c1c;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.boton-quitar:hover {
  background: #fef2f2;
}

.boton-agregar-competencia {
  align-self: flex-start;
  padding: 8px 14px;
  border: 1px dashed #004ac6;
  border-radius: 8px;
  background: white;
  color: #004ac6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.boton-agregar-competencia:hover {
  background: #eef2ff;
}

.boton-quitar:focus-visible,
.boton-agregar-competencia:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.ayuda {
  margin: 0;
  color: #6b7280;
  font-size: 12px;
}

@media (max-width: 900px) {
  .resumen {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .fila-filtros {
    grid-template-columns: 1fr 1fr;
  }

  .fila-filtros .campo-filtro:first-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 600px) {
  .pagina-competencias {
    padding: 20px 14px;
  }

  .resumen {
    gap: 8px;
  }

  .indicador {
    padding: 12px;
  }

  .indicador strong {
    font-size: 22px;
  }

  .fila-ambito {
    align-items: stretch;
    flex-direction: column;
    gap: 6px;
  }

  .selector-ambito {
    display: flex;
  }

  .opcion-ambito {
    flex: 1;
    padding: 7px 8px;
  }

  .fila-filtros {
    grid-template-columns: 1fr;
  }
}
</style>
