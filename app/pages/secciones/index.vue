<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { ErroresSeccion, Seccion, SolicitudSeccion } from '~/types/seccion'
import { obtenerMensajeError } from '~/composables/useDatosPrueba'
import {
  GRADOS_SECUNDARIA,
  calcularPorcentajeOcupacion,
  calcularVacantesDisponibles,
  obtenerEstadoCupos,
  obtenerEtiquetaEstadoCupos,
  obtenerNombreGrado,
  obtenerVarianteEstadoCupos,
  useSecciones,
  validarNuevaCapacidad,
  validarSeccion,
} from '~/composables/useSecciones'
import { tieneErrores } from '~/composables/useValidacion'

definePageMeta({
  middleware: 'autenticacion',
})

const { listarSecciones, registrarSeccion, actualizarVacantes } = useSecciones()

const secciones = ref<Seccion[]>([])
const cargando = ref(true)
const errorCarga = ref('')
const mensajeExito = ref('')
const gradoFiltro = ref<number | ''>('')

async function cargarSecciones(): Promise<void> {
  cargando.value = true
  errorCarga.value = ''

  try {
    secciones.value = await listarSecciones()
  } catch (error: unknown) {
    errorCarga.value = obtenerMensajeError(error, 'No se pudieron cargar las secciones.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargarSecciones)

const seccionesFiltradas = computed(() =>
  gradoFiltro.value === ''
    ? secciones.value
    : secciones.value.filter((seccion) => seccion.gradoNumero === gradoFiltro.value),
)

// Panel resumen de capacidad, matriculados y vacantes (US-1.7, criterio 6).
const resumen = computed(() => {
  const lista = seccionesFiltradas.value

  return {
    capacidad: lista.reduce((total, seccion) => total + seccion.vacantesTotales, 0),
    matriculados: lista.reduce((total, seccion) => total + seccion.cantidadMatriculados, 0),
    vacantes: lista.reduce((total, seccion) => total + calcularVacantesDisponibles(seccion), 0),
    seccionesLlenas: lista.filter((seccion) => calcularVacantesDisponibles(seccion) === 0).length,
  }
})

const tituloResumen = computed(() =>
  gradoFiltro.value === '' ? 'Resumen general' : `Resumen de ${obtenerNombreGrado(gradoFiltro.value)}`,
)

function describirSeccion(seccion: Pick<Seccion, 'gradoNumero' | 'nombre'>): string {
  return `${obtenerNombreGrado(seccion.gradoNumero)} – Sección ${seccion.nombre}`
}

// Edicion de la capacidad maxima (US-1.7, criterio 2)
const seccionEnEdicion = ref<Seccion | null>(null)
const nuevaCapacidad = ref<number | ''>('')
const errorCapacidad = ref('')
const errorGuardadoCapacidad = ref('')
const guardandoCapacidad = ref(false)

const vacantesPrevistas = computed(() => {
  if (!seccionEnEdicion.value || nuevaCapacidad.value === '') {
    return null
  }

  return calcularVacantesDisponibles({
    vacantesTotales: nuevaCapacidad.value,
    cantidadMatriculados: seccionEnEdicion.value.cantidadMatriculados,
  })
})

function abrirEdicionCapacidad(seccion: Seccion): void {
  seccionEnEdicion.value = seccion
  nuevaCapacidad.value = seccion.vacantesTotales
  errorCapacidad.value = ''
  errorGuardadoCapacidad.value = ''
}

function cerrarEdicionCapacidad(): void {
  seccionEnEdicion.value = null
}

async function guardarCapacidad(): Promise<void> {
  const seccion = seccionEnEdicion.value

  if (!seccion) {
    return
  }

  errorGuardadoCapacidad.value = ''
  errorCapacidad.value = validarNuevaCapacidad(Number(nuevaCapacidad.value), seccion.cantidadMatriculados)

  if (nuevaCapacidad.value === '') {
    errorCapacidad.value = 'La capacidad máxima es obligatoria.'
  }

  if (errorCapacidad.value) {
    return
  }

  guardandoCapacidad.value = true

  try {
    await actualizarVacantes(seccion.id, { vacantesTotales: Number(nuevaCapacidad.value) })
    seccionEnEdicion.value = null
    mensajeExito.value = `Capacidad de ${describirSeccion(seccion)} actualizada a ${nuevaCapacidad.value} alumnos.`
    await cargarSecciones()
  } catch (error: unknown) {
    errorGuardadoCapacidad.value = obtenerMensajeError(error, 'No se pudo actualizar la capacidad.')
  } finally {
    guardandoCapacidad.value = false
  }
}

// Registro de una nueva seccion (US-1.7, criterio 1)
const modalSeccionAbierto = ref(false)
const guardandoSeccion = ref(false)
const errorGuardadoSeccion = ref('')

const formularioSeccion = reactive<SolicitudSeccion>({
  gradoNumero: 1,
  nombre: '',
  vacantesTotales: 30,
})

const erroresSeccion = reactive<ErroresSeccion>({})

function limpiarErroresSeccion(): void {
  erroresSeccion.gradoNumero = undefined
  erroresSeccion.nombre = undefined
  erroresSeccion.vacantesTotales = undefined
  errorGuardadoSeccion.value = ''
}

function abrirRegistroSeccion(): void {
  formularioSeccion.gradoNumero = gradoFiltro.value === '' ? 1 : gradoFiltro.value
  formularioSeccion.nombre = ''
  formularioSeccion.vacantesTotales = 30
  limpiarErroresSeccion()
  modalSeccionAbierto.value = true
}

function cambiarNombreSeccion(evento: Event): void {
  const entrada = evento.target as HTMLInputElement
  const valor = entrada.value
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2)

  formularioSeccion.nombre = valor
  entrada.value = valor
  erroresSeccion.nombre = undefined
}

async function guardarSeccion(): Promise<void> {
  limpiarErroresSeccion()
  Object.assign(erroresSeccion, validarSeccion(formularioSeccion, secciones.value))

  if (tieneErrores(erroresSeccion)) {
    return
  }

  guardandoSeccion.value = true

  try {
    const nueva = await registrarSeccion({ ...formularioSeccion })
    modalSeccionAbierto.value = false
    mensajeExito.value = `${describirSeccion(nueva)} registrada con ${nueva.vacantesTotales} vacantes.`
    await cargarSecciones()
  } catch (error: unknown) {
    errorGuardadoSeccion.value = obtenerMensajeError(error, 'No se pudo registrar la sección.')
  } finally {
    guardandoSeccion.value = false
  }
}
</script>

<template>
  <main class="pagina-secciones">
    <EncabezadoPagina
      titulo="Vacantes por Grado y Sección"
      descripcion="Configura la capacidad máxima de cada sección y revisa cuántas vacantes quedan disponibles."
    >
      <template #acciones>
        <BotonAccion variante="secundario" destino="/matriculas/periodo">Periodo de matrícula</BotonAccion>
        <BotonAccion @click="abrirRegistroSeccion">+ Agregar sección</BotonAccion>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="mensajeExito" :mensaje="mensajeExito" tipo="exito" cerrable @cerrar="mensajeExito = ''" />

    <PanelEstadoCarga :cargando="cargando" :error="errorCarga" @reintentar="cargarSecciones">
      <section class="panel-filtros" aria-label="Filtros de secciones">
        <div class="campo-filtro">
          <label for="filtro-grado">Grado</label>

          <select id="filtro-grado" v-model="gradoFiltro">
            <option value="">Todos los Grados</option>
            <option v-for="grado in GRADOS_SECUNDARIA" :key="grado" :value="grado">
              {{ obtenerNombreGrado(grado) }}
            </option>
          </select>
        </div>
      </section>

      <section class="resumen" :aria-label="tituloResumen">
        <h2 class="solo-lectores">{{ tituloResumen }}</h2>

        <div class="indicador">
          <span>Capacidad máxima</span>
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

        <div class="indicador" :class="{ alerta: resumen.seccionesLlenas > 0 }">
          <span>Secciones sin vacantes</span>
          <strong>{{ resumen.seccionesLlenas }}</strong>
        </div>
      </section>

      <section class="panel-tabla" aria-label="Vacantes por sección">
        <div class="tabla-desplazable">
          <table>
            <thead>
              <tr>
                <th scope="col">Grado</th>
                <th scope="col">Sección</th>
                <th scope="col">Capacidad máxima</th>
                <th scope="col">Matriculados</th>
                <th scope="col">Vacantes</th>
                <th scope="col">Ocupación</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="seccion in seccionesFiltradas" :key="seccion.id">
                <td class="sin-salto">{{ obtenerNombreGrado(seccion.gradoNumero) }}</td>
                <td class="dato-destacado">{{ seccion.nombre }}</td>
                <td>{{ seccion.vacantesTotales }}</td>
                <td>{{ seccion.cantidadMatriculados }}</td>
                <td class="dato-destacado">{{ calcularVacantesDisponibles(seccion) }}</td>
                <td>
                  <div class="celda-ocupacion">
                    <BarraOcupacion
                      :porcentaje="calcularPorcentajeOcupacion(seccion)"
                      :estado="obtenerEstadoCupos(calcularVacantesDisponibles(seccion))"
                      :etiqueta="`Ocupación de ${describirSeccion(seccion)}`"
                    />
                    <span>{{ calcularPorcentajeOcupacion(seccion) }}%</span>
                  </div>
                </td>
                <td>
                  <InsigniaEstado
                    :texto="obtenerEtiquetaEstadoCupos(obtenerEstadoCupos(calcularVacantesDisponibles(seccion)))"
                    :variante="obtenerVarianteEstadoCupos(obtenerEstadoCupos(calcularVacantesDisponibles(seccion)))"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    class="boton-tabla"
                    :aria-label="`Editar capacidad de ${describirSeccion(seccion)}`"
                    @click="abrirEdicionCapacidad(seccion)"
                  >
                    Editar capacidad
                  </button>
                </td>
              </tr>

              <tr v-if="seccionesFiltradas.length === 0">
                <td colspan="8" class="sin-resultados">
                  No hay secciones registradas para este grado. Agrégalas con «Agregar sección».
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="pie-tabla">Mostrando {{ seccionesFiltradas.length }} de {{ secciones.length }} secciones</footer>
      </section>
    </PanelEstadoCarga>

    <VentanaModal
      :abierta="seccionEnEdicion !== null"
      titulo="Editar capacidad máxima"
      :descripcion="seccionEnEdicion ? describirSeccion(seccionEnEdicion) : ''"
      :bloqueada="guardandoCapacidad"
      @cerrar="cerrarEdicionCapacidad"
    >
      <form
        v-if="seccionEnEdicion"
        id="formulario-capacidad"
        class="formulario"
        novalidate
        @submit.prevent="guardarCapacidad"
      >
        <p class="dato-informativo">
          Alumnos matriculados actualmente: <strong>{{ seccionEnEdicion.cantidadMatriculados }}</strong
          >. La nueva capacidad no puede ser menor que esta cantidad.
        </p>

        <div class="campo">
          <label for="nueva-capacidad">Capacidad máxima <span class="obligatorio">*</span></label>

          <input
            id="nueva-capacidad"
            v-model.number="nuevaCapacidad"
            type="number"
            inputmode="numeric"
            :min="Math.max(1, seccionEnEdicion.cantidadMatriculados)"
            step="1"
            :aria-invalid="Boolean(errorCapacidad)"
            :aria-describedby="errorCapacidad ? 'error-capacidad' : undefined"
            @input="errorCapacidad = ''"
          />

          <small v-if="errorCapacidad" id="error-capacidad" class="error">{{ errorCapacidad }}</small>
        </div>

        <p v-if="vacantesPrevistas !== null && !errorCapacidad" class="vista-previa" role="status">
          Vacantes disponibles con esta capacidad: <strong>{{ vacantesPrevistas }}</strong>
        </p>

        <AvisoMensaje v-if="errorGuardadoCapacidad" :mensaje="errorGuardadoCapacidad" tipo="error" />
      </form>

      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="guardandoCapacidad" @click="cerrarEdicionCapacidad">
          Cancelar
        </BotonAccion>
        <BotonAccion tipo="submit" form="formulario-capacidad" :deshabilitado="guardandoCapacidad">
          {{ guardandoCapacidad ? 'Guardando...' : 'Guardar capacidad' }}
        </BotonAccion>
      </template>
    </VentanaModal>

    <VentanaModal
      :abierta="modalSeccionAbierto"
      titulo="Agregar sección"
      descripcion="Registra una sección y su capacidad máxima antes del inicio de la matrícula."
      :bloqueada="guardandoSeccion"
      @cerrar="modalSeccionAbierto = false"
    >
      <form id="formulario-seccion" class="formulario" novalidate @submit.prevent="guardarSeccion">
        <div class="cuadricula-campos">
          <div class="campo">
            <label for="grado-seccion">Grado <span class="obligatorio">*</span></label>

            <select
              id="grado-seccion"
              v-model.number="formularioSeccion.gradoNumero"
              :aria-invalid="Boolean(erroresSeccion.gradoNumero)"
              :aria-describedby="erroresSeccion.gradoNumero ? 'error-grado' : undefined"
              @change="erroresSeccion.nombre = undefined"
            >
              <option v-for="grado in GRADOS_SECUNDARIA" :key="grado" :value="grado">
                {{ obtenerNombreGrado(grado) }}
              </option>
            </select>

            <small v-if="erroresSeccion.gradoNumero" id="error-grado" class="error">
              {{ erroresSeccion.gradoNumero }}
            </small>
          </div>

          <div class="campo">
            <label for="nombre-seccion">Sección <span class="obligatorio">*</span></label>

            <input
              id="nombre-seccion"
              :value="formularioSeccion.nombre"
              type="text"
              maxlength="2"
              placeholder="Ej. C"
              autocomplete="off"
              :aria-invalid="Boolean(erroresSeccion.nombre)"
              :aria-describedby="erroresSeccion.nombre ? 'error-nombre-seccion' : undefined"
              @input="cambiarNombreSeccion"
            />

            <small v-if="erroresSeccion.nombre" id="error-nombre-seccion" class="error">
              {{ erroresSeccion.nombre }}
            </small>
          </div>
        </div>

        <div class="campo">
          <label for="capacidad-seccion">Capacidad máxima <span class="obligatorio">*</span></label>

          <input
            id="capacidad-seccion"
            v-model.number="formularioSeccion.vacantesTotales"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            :aria-invalid="Boolean(erroresSeccion.vacantesTotales)"
            :aria-describedby="erroresSeccion.vacantesTotales ? 'error-capacidad-seccion' : undefined"
            @input="erroresSeccion.vacantesTotales = undefined"
          />

          <small v-if="erroresSeccion.vacantesTotales" id="error-capacidad-seccion" class="error">
            {{ erroresSeccion.vacantesTotales }}
          </small>
        </div>

        <AvisoMensaje v-if="errorGuardadoSeccion" :mensaje="errorGuardadoSeccion" tipo="error" />
      </form>

      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="guardandoSeccion" @click="modalSeccionAbierto = false">
          Cancelar
        </BotonAccion>
        <BotonAccion tipo="submit" form="formulario-seccion" :deshabilitado="guardandoSeccion">
          {{ guardandoSeccion ? 'Guardando...' : 'Agregar sección' }}
        </BotonAccion>
      </template>
    </VentanaModal>
  </main>
</template>

<style scoped>
.pagina-secciones {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}

.panel-filtros {
  display: flex;
  padding: 16px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.campo-filtro {
  display: flex;
  width: 100%;
  max-width: 280px;
  flex-direction: column;
  gap: 6px;
}

.campo-filtro label {
  color: #434655;
  font-size: 12px;
  font-weight: 600;
}

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

.campo-filtro select:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
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

.indicador.alerta {
  background: #fef2f2;
}

.panel-tabla {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.tabla-desplazable {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

thead {
  background: #f2f4f6;
}

th {
  padding: 12px 14px;
  color: #434655;
  font-size: 12px;
  font-weight: 600;
}

td {
  padding: 12px 14px;
  border-top: 1px solid #e5e7eb;
  color: #191c1e;
  font-size: 13px;
}

.dato-destacado {
  font-weight: 600;
}

.sin-salto {
  white-space: nowrap;
}

.celda-ocupacion {
  display: grid;
  min-width: 140px;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
}

.celda-ocupacion span {
  min-width: 36px;
  color: #434655;
  font-size: 12px;
  text-align: right;
}

.boton-tabla {
  padding: 6px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 7px;
  background: white;
  color: #004ac6;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.boton-tabla:hover {
  background: #eef2ff;
}

.sin-resultados {
  padding: 48px 16px;
  color: #737686;
  text-align: center;
}

.pie-tabla {
  padding: 14px;
  border-top: 1px solid #c3c6d7;
  color: #434655;
  font-size: 13px;
}

.formulario {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cuadricula-campos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.campo select,
.campo input {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font-size: 14px;
}

.campo select:focus-visible,
.campo input:focus-visible {
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

.dato-informativo,
.vista-previa {
  margin: 0;
  color: #434655;
  font-size: 14px;
  line-height: 1.5;
}

.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 900px) {
  .resumen {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .pagina-secciones {
    padding: 20px 14px;
  }

  .campo-filtro {
    max-width: none;
  }

  .resumen {
    gap: 12px;
  }

  .indicador strong {
    font-size: 24px;
  }

  .cuadricula-campos {
    grid-template-columns: 1fr;
  }

  table {
    min-width: 860px;
  }
}
</style>
