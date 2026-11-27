<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { AsistenciaDocente, ErroresMarcaje, FormularioMarcaje } from '~/types/asistenciaDocente'
import type { DocenteOpcion } from '~/types/sesionClase'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { formatearFecha, obtenerFechaHoyIso } from '~/composables/useFechas'
import { guardarArchivo } from '~/composables/useReporteAsistencia'
import { useSesionesClase } from '~/composables/useSesionesClase'
import { useAutenticacionStore } from '~/stores/autenticacion'
import { useCargaMasivaAsistenciaDocente } from '~/composables/useCargaMasivaAsistenciaDocente'
import {
  ESTADOS_AJUSTABLES,
  LONGITUD_MAXIMA_MOTIVO,
  construirRegistro,
  obtenerEtiquetaEstadoDocente,
  obtenerVarianteEstadoDocente,
  useAsistenciaDocente,
  validarMarcaje,
} from '~/composables/useAsistenciaDocente'

definePageMeta({
  middleware: 'autenticacion',
})

interface FilaDocente {
  docenteId: number
  nombre: string
  dni: string
  asistencia: AsistenciaDocente | null
}

const { listar, registrar, ajustar } = useAsistenciaDocente()
const { listarDocentes } = useSesionesClase()
const autenticacion = useAutenticacionStore()
const { descargarPlantilla, cargar: cargarCsv } = useCargaMasivaAsistenciaDocente()

const fecha = ref(obtenerFechaHoyIso())
const busqueda = ref('')
const docentes = ref<DocenteOpcion[]>([])
const asistencias = ref<AsistenciaDocente[]>([])
const cargando = ref(true)
const error = ref('')
const aviso = ref('')
const archivoCsv = ref<File | null>(null)
const entradaArchivoCsv = ref<HTMLInputElement | null>(null)
const resultadoCargaCsv = ref<Awaited<ReturnType<typeof cargarCsv>> | null>(null)
const errorCargaCsv = ref('')
const validandoCsv = ref(false)
const guardandoCsv = ref(false)
const descargandoPlantillaCsv = ref(false)

const esAdministrador = computed(() => autenticacion.usuario?.rol === 'ADMINISTRADOR')

const modalAbierto = ref(false)
const asistenciaEnAjuste = ref<AsistenciaDocente | null>(null)
const guardando = ref(false)
const errorGuardar = ref('')
const formulario = reactive<FormularioMarcaje>({
  docenteId: null,
  fecha: '',
  estado: 'PRESENTE',
  horaEntrada: '',
  horaSalida: '',
  motivoAjuste: '',
})
const errores = ref<ErroresMarcaje>({})

const esAjuste = computed(() => asistenciaEnAjuste.value !== null)
const nombreDocenteModal = computed(() => {
  if (asistenciaEnAjuste.value) return asistenciaEnAjuste.value.docenteNombre
  return docentes.value.find((docente) => docente.id === formulario.docenteId)?.nombreCompleto ?? ''
})

const filas = computed<FilaDocente[]>(() => {
  const porDocente = new Map(asistencias.value.map((asistencia) => [asistencia.docenteId, asistencia]))
  const lista: FilaDocente[] = docentes.value.map((docente) => ({
    docenteId: docente.id,
    nombre: docente.nombreCompleto,
    dni: docente.dni,
    asistencia: porDocente.get(docente.id) ?? null,
  }))
  for (const asistencia of asistencias.value) {
    if (!docentes.value.some((docente) => docente.id === asistencia.docenteId)) {
      lista.push({ docenteId: asistencia.docenteId, nombre: asistencia.docenteNombre, dni: '', asistencia })
    }
  }
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
})

const filasVisibles = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()
  return texto ? filas.value.filter((fila) => `${fila.nombre} ${fila.dni}`.toLowerCase().includes(texto)) : filas.value
})

const totales = computed(() => {
  const resultado = { PRESENTE: 0, TARDANZA: 0, INASISTENCIA: 0, sinMarcaje: 0 }
  for (const fila of filas.value) {
    const estado = fila.asistencia?.estado
    if (estado === 'PRESENTE' || estado === 'TARDANZA' || estado === 'INASISTENCIA') resultado[estado] += 1
    else resultado.sinMarcaje += 1
  }
  return resultado
})

function hora(valor: string | null): string {
  return valor ? valor.slice(0, 5) : '—'
}

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''

  try {
    const [listaDocentes, listaAsistencias] = await Promise.all([listarDocentes(), listar(fecha.value)])
    docentes.value = listaDocentes
    asistencias.value = listaAsistencias
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar la asistencia de los docentes.')
  } finally {
    cargando.value = false
  }
}

function abrirRegistro(fila: FilaDocente): void {
  asistenciaEnAjuste.value = null
  Object.assign(formulario, {
    docenteId: fila.docenteId,
    fecha: fecha.value,
    estado: 'PRESENTE',
    horaEntrada: '',
    horaSalida: '',
    motivoAjuste: '',
  })
  errores.value = {}
  errorGuardar.value = ''
  modalAbierto.value = true
}

function abrirAjuste(asistencia: AsistenciaDocente): void {
  asistenciaEnAjuste.value = asistencia
  Object.assign(formulario, {
    docenteId: asistencia.docenteId,
    fecha: asistencia.fecha,
    estado: asistencia.estado === 'PENDIENTE_MARCAJE' ? 'PRESENTE' : asistencia.estado,
    horaEntrada: asistencia.horaEntrada?.slice(0, 5) ?? '',
    horaSalida: asistencia.horaSalida?.slice(0, 5) ?? '',
    motivoAjuste: '',
  })
  errores.value = {}
  errorGuardar.value = ''
  modalAbierto.value = true
}

function limpiarError(campo: keyof FormularioMarcaje): void {
  errores.value = { ...errores.value, [campo]: undefined }
}

async function guardar(): Promise<void> {
  errores.value = validarMarcaje(formulario, esAjuste.value)
  if (Object.values(errores.value).some(Boolean)) return

  guardando.value = true
  errorGuardar.value = ''

  try {
    if (asistenciaEnAjuste.value) {
      await ajustar(asistenciaEnAjuste.value.id, {
        estado: formulario.estado,
        motivoAjuste: formulario.motivoAjuste.trim(),
      })
      aviso.value = `Se ajustó la asistencia de ${nombreDocenteModal.value}.`
    } else {
      await registrar(construirRegistro(formulario))
      aviso.value = `Se registró la asistencia de ${nombreDocenteModal.value}.`
    }
    modalAbierto.value = false
    await cargar()
  } catch (fallo: unknown) {
    errorGuardar.value = obtenerMensajeError(fallo, 'No se pudo guardar la asistencia del docente.')
  } finally {
    guardando.value = false
  }
}

function seleccionarArchivoCsv(evento: Event): void {
  const entrada = evento.target as HTMLInputElement
  archivoCsv.value = entrada.files?.[0] ?? null
  resultadoCargaCsv.value = null
  errorCargaCsv.value = ''
}

async function obtenerPlantilla(formato: 'csv' | 'xlsx'): Promise<void> {
  descargandoPlantillaCsv.value = true
  errorCargaCsv.value = ''
  try {
    const archivo = await descargarPlantilla(formato)
    guardarArchivo(archivo, `plantilla-asistencia-docentes.${formato}`)
  } catch (fallo: unknown) {
    errorCargaCsv.value = obtenerMensajeError(fallo, 'No se pudo descargar la plantilla CSV.')
  } finally {
    descargandoPlantillaCsv.value = false
  }
}

async function validarArchivoCsv(): Promise<void> {
  if (!archivoCsv.value) return
  validandoCsv.value = true
  errorCargaCsv.value = ''
  resultadoCargaCsv.value = null
  try {
    resultadoCargaCsv.value = await cargarCsv(archivoCsv.value, true)
  } catch (fallo: unknown) {
    errorCargaCsv.value = obtenerMensajeError(fallo, 'No se pudo validar el archivo CSV.')
  } finally {
    validandoCsv.value = false
  }
}

async function guardarArchivoCsv(): Promise<void> {
  if (!archivoCsv.value || !resultadoCargaCsv.value || resultadoCargaCsv.value.errores.length) return
  guardandoCsv.value = true
  errorCargaCsv.value = ''
  try {
    const resultado = await cargarCsv(archivoCsv.value, false)
    resultadoCargaCsv.value = resultado
    if (!resultado.guardado) return
    aviso.value = `Carga completada: ${resultado.registrosNuevos} nuevos y ${resultado.registrosActualizados} actualizados.`
    archivoCsv.value = null
    if (entradaArchivoCsv.value) entradaArchivoCsv.value.value = ''
    await cargar()
  } catch (fallo: unknown) {
    errorCargaCsv.value = obtenerMensajeError(fallo, 'No se pudo guardar la carga CSV.')
  } finally {
    guardandoCsv.value = false
  }
}

watch(fecha, (nueva) => {
  if (nueva) {
    aviso.value = ''
    void cargar()
  }
})

onMounted(cargar)
</script>

<template>
  <main class="pagina-asistencia-docente">
    <EncabezadoPagina
      titulo="Asistencia docente"
      descripcion="Consulta los marcajes de los docentes y registra o ajusta los que tengan incidencias, indicando el motivo."
    >
      <template #acciones>
        <NuxtLink class="enlace-configuracion" to="/asistencia-docentes/configuracion"> Configurar marcaje </NuxtLink>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" cerrable @cerrar="aviso = ''" />

    <section v-if="esAdministrador" class="tarjeta carga-csv" aria-labelledby="titulo-carga-csv">
      <header class="encabezado-carga-csv">
        <div>
          <h2 id="titulo-carga-csv">Carga masiva de asistencia</h2>
          <p>Registra o actualiza marcajes de varios docentes y fechas en CSV o Excel.</p>
        </div>
        <div class="acciones-csv">
          <button
            type="button"
            class="boton-csv secundario"
            :disabled="descargandoPlantillaCsv || validandoCsv || guardandoCsv"
            @click="obtenerPlantilla('csv')"
          >
            {{ descargandoPlantillaCsv ? 'Descargando…' : 'Plantilla CSV' }}
          </button>
          <button
            type="button"
            class="boton-csv secundario"
            :disabled="descargandoPlantillaCsv || validandoCsv || guardandoCsv"
            @click="obtenerPlantilla('xlsx')"
          >
            {{ descargandoPlantillaCsv ? 'Descargando…' : 'Plantilla Excel' }}
          </button>
        </div>
      </header>

      <div class="contenido-carga-csv">
        <div class="campo campo-archivo-csv">
          <label for="archivo-asistencia-docentes">Archivo CSV o Excel</label>
          <input
            id="archivo-asistencia-docentes"
            ref="entradaArchivoCsv"
            type="file"
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            :disabled="validandoCsv || guardandoCsv"
            @change="seleccionarArchivoCsv"
          />
          <small class="ayuda">
            Columnas: DNI del docente, fecha, hora de entrada, hora de salida, estado y motivo. Estados: PRESENTE,
            TARDANZA o INASISTENCIA. Máximo 500 filas.
          </small>
        </div>

        <p v-if="archivoCsv" class="archivo-seleccionado">Seleccionado: {{ archivoCsv.name }}</p>

        <div class="acciones-csv">
          <button
            type="button"
            class="boton-csv"
            :disabled="!archivoCsv || validandoCsv || guardandoCsv || descargandoPlantillaCsv"
            @click="validarArchivoCsv"
          >
            {{ validandoCsv ? 'Validando…' : 'Validar archivo' }}
          </button>
          <button
            v-if="resultadoCargaCsv && !resultadoCargaCsv.errores.length && !resultadoCargaCsv.guardado"
            type="button"
            class="boton-csv confirmar"
            :disabled="guardandoCsv || validandoCsv"
            @click="guardarArchivoCsv"
          >
            {{ guardandoCsv ? 'Guardando…' : 'Guardar lote validado' }}
          </button>
        </div>

        <AvisoMensaje v-if="errorCargaCsv" :mensaje="errorCargaCsv" tipo="error" />

        <div v-if="resultadoCargaCsv" class="resultado-csv" role="status" aria-live="polite">
          <p>
            <strong>{{ resultadoCargaCsv.guardado ? 'Carga guardada.' : 'Resultado de validación.' }}</strong>
            {{ resultadoCargaCsv.filasValidas }} de {{ resultadoCargaCsv.totalFilas }} filas válidas;
            {{ resultadoCargaCsv.filasRechazadas }} rechazadas.
            <template v-if="resultadoCargaCsv.guardado">
              {{ resultadoCargaCsv.registrosNuevos }} registros nuevos y
              {{ resultadoCargaCsv.registrosActualizados }} actualizados.
            </template>
          </p>
          <div v-if="resultadoCargaCsv.errores.length" class="tabla-desplazable errores-csv">
            <table>
              <thead>
                <tr>
                  <th scope="col">Fila</th>
                  <th scope="col">Campo</th>
                  <th scope="col">Detalle</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(errorFila, indice) in resultadoCargaCsv.errores" :key="`${errorFila.fila}-${indice}`">
                  <td>{{ errorFila.fila }}</td>
                  <td>{{ errorFila.campo }}</td>
                  <td>{{ errorFila.mensaje }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else-if="!resultadoCargaCsv.guardado" class="ayuda">
            La validación pasó. Revisa el resumen y guarda el lote para aplicar los cambios.
          </p>
        </div>
      </div>
    </section>

    <dl class="totales">
      <div class="total presente">
        <dt>Presentes</dt>
        <dd>{{ totales.PRESENTE }}</dd>
      </div>
      <div class="total tardanza">
        <dt>Tardanzas</dt>
        <dd>{{ totales.TARDANZA }}</dd>
      </div>
      <div class="total ausente">
        <dt>Inasistencias</dt>
        <dd>{{ totales.INASISTENCIA }}</dd>
      </div>
      <div class="total neutro">
        <dt>Sin marcaje</dt>
        <dd>{{ totales.sinMarcaje }}</dd>
      </div>
    </dl>

    <section class="tarjeta" aria-labelledby="titulo-marcajes">
      <h2 id="titulo-marcajes" class="solo-lectores">Marcajes del día</h2>
      <div class="filtros">
        <div class="campo">
          <label for="fecha-marcajes">Fecha</label>
          <input id="fecha-marcajes" v-model="fecha" type="date" />
        </div>
        <div class="campo busqueda">
          <label for="buscar-docente">Docente</label>
          <input
            id="buscar-docente"
            v-model="busqueda"
            type="search"
            placeholder="Buscar por nombre o DNI"
            autocomplete="off"
          />
        </div>
        <BotonAccion variante="secundario" :deshabilitado="cargando" @click="cargar">Actualizar</BotonAccion>
      </div>

      <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="cargar" />

      <p v-else-if="!filas.length" class="vacio">No hay docentes activos. Crea cuentas con rol Docente en Usuarios.</p>
      <p v-else-if="!filasVisibles.length" class="vacio">Ningún docente coincide con la búsqueda.</p>

      <div v-else class="tabla-desplazable">
        <table>
          <thead>
            <tr>
              <th scope="col">Docente</th>
              <th scope="col">Entrada</th>
              <th scope="col">Salida</th>
              <th scope="col">Estado</th>
              <th scope="col">Motivo</th>
              <th scope="col"><span class="solo-lectores">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fila in filasVisibles" :key="fila.docenteId">
              <td>
                <p class="nombre">{{ fila.nombre }}</p>
                <p v-if="fila.dni" class="dni">DNI {{ fila.dni }}</p>
              </td>
              <td>{{ hora(fila.asistencia?.horaEntrada ?? null) }}</td>
              <td>{{ hora(fila.asistencia?.horaSalida ?? null) }}</td>
              <td>
                <InsigniaEstado
                  v-if="fila.asistencia"
                  :texto="obtenerEtiquetaEstadoDocente(fila.asistencia.estado)"
                  :variante="obtenerVarianteEstadoDocente(fila.asistencia.estado)"
                />
                <InsigniaEstado v-else texto="Sin marcaje" variante="neutro" />
              </td>
              <td class="motivo">{{ fila.asistencia?.motivoAjuste || '—' }}</td>
              <td class="accion">
                <button v-if="fila.asistencia" type="button" class="enlace" @click="abrirAjuste(fila.asistencia)">
                  Ajustar
                </button>
                <button v-else type="button" class="enlace" @click="abrirRegistro(fila)">Registrar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <VentanaModal
      :abierta="modalAbierto"
      :titulo="esAjuste ? 'Ajustar asistencia' : 'Registrar asistencia'"
      :descripcion="`${nombreDocenteModal} · ${formatearFecha(formulario.fecha || fecha)}`"
      :bloqueada="guardando"
      @cerrar="modalAbierto = false"
    >
      <form id="formulario-marcaje" class="formulario" novalidate @submit.prevent="guardar">
        <fieldset class="estados">
          <legend>Estado <span class="obligatorio">*</span></legend>
          <div class="selector" role="radiogroup">
            <label
              v-for="opcion in ESTADOS_AJUSTABLES"
              :key="opcion.estado"
              :class="[opcion.estado.toLowerCase(), { elegido: formulario.estado === opcion.estado }]"
            >
              <input v-model="formulario.estado" type="radio" name="estado-marcaje" :value="opcion.estado" />
              {{ opcion.etiqueta }}
            </label>
          </div>
        </fieldset>

        <div v-if="!esAjuste && formulario.estado !== 'INASISTENCIA'" class="horas">
          <div class="campo">
            <label for="hora-entrada">Hora de entrada <span class="obligatorio">*</span></label>
            <input
              id="hora-entrada"
              v-model="formulario.horaEntrada"
              type="time"
              :aria-invalid="Boolean(errores.horaEntrada)"
              @input="limpiarError('horaEntrada')"
            />
            <small v-if="errores.horaEntrada" class="error">{{ errores.horaEntrada }}</small>
          </div>
          <div class="campo">
            <label for="hora-salida">Hora de salida</label>
            <input
              id="hora-salida"
              v-model="formulario.horaSalida"
              type="time"
              :aria-invalid="Boolean(errores.horaSalida)"
              @input="limpiarError('horaSalida')"
            />
            <small v-if="errores.horaSalida" class="error">{{ errores.horaSalida }}</small>
          </div>
        </div>
        <p v-else-if="esAjuste" class="nota">
          Marcaje actual: entrada {{ hora(asistenciaEnAjuste?.horaEntrada ?? null) }}, salida
          {{ hora(asistenciaEnAjuste?.horaSalida ?? null) }}. El ajuste cambia el estado y deja constancia del motivo.
        </p>

        <div class="campo">
          <label for="motivo-marcaje">Motivo <span class="obligatorio">*</span></label>
          <textarea
            id="motivo-marcaje"
            v-model="formulario.motivoAjuste"
            rows="3"
            :maxlength="LONGITUD_MAXIMA_MOTIVO"
            placeholder="Ej. Olvidó marcar al ingresar; se verificó con el registro de portería."
            :aria-invalid="Boolean(errores.motivoAjuste)"
            @input="limpiarError('motivoAjuste')"
          />
          <small v-if="errores.motivoAjuste" class="error">{{ errores.motivoAjuste }}</small>
          <small v-else class="ayuda">Queda registrado junto al marcaje.</small>
        </div>

        <AvisoMensaje v-if="errorGuardar" :mensaje="errorGuardar" tipo="error" />
      </form>

      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="guardando" @click="modalAbierto = false">
          Cancelar
        </BotonAccion>
        <BotonAccion tipo="submit" form="formulario-marcaje" :deshabilitado="guardando">
          {{ guardando ? 'Guardando...' : esAjuste ? 'Guardar ajuste' : 'Registrar' }}
        </BotonAccion>
      </template>
    </VentanaModal>
  </main>
</template>

<style scoped>
.pagina-asistencia-docente {
  display: flex;
  width: 100%;
  max-width: 1100px;
  flex-direction: column;
  gap: 20px;
  margin: 0 auto;
  padding: 32px;
}

.enlace-configuracion {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  padding: 9px 14px;
  border: 1px solid #3159a8;
  border-radius: 8px;
  color: #234486;
  background: white;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.enlace-configuracion:hover {
  background: #f2f5fc;
}

.encabezado-carga-csv {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px 14px;
}

.encabezado-carga-csv h2 {
  margin: 0 0 4px;
  color: #191c1e;
  font-size: 18px;
}

.encabezado-carga-csv p,
.resultado-csv p {
  margin: 0;
  color: #434655;
  font-size: 14px;
  line-height: 1.5;
}

.contenido-carga-csv {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 20px 20px;
}

.campo-archivo-csv input[type='file'] {
  padding: 8px;
  background: #fff;
}

.boton-csv {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  padding: 9px 14px;
  border: 1px solid #234486;
  border-radius: 8px;
  color: #fff;
  background: #234486;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.boton-csv.secundario {
  color: #234486;
  background: #fff;
}

.boton-csv.confirmar {
  border-color: #167545;
  background: #167545;
}

.boton-csv:hover:not(:disabled) {
  filter: brightness(0.94);
}

.boton-csv:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.acciones-csv {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.archivo-seleccionado {
  margin: -4px 0 0;
  color: #434655;
  font-size: 13px;
}

.resultado-csv {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid #d9dee8;
  border-radius: 8px;
  background: #f9fafb;
}

.errores-csv {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.errores-csv table {
  min-width: 520px;
}

.totales {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.total {
  padding: 12px 16px;
  border: 1px solid #c3c6d7;
  border-left-width: 4px;
  border-radius: 10px;
  background: white;
}

.total dt {
  color: #434655;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.total dd {
  margin: 4px 0 0;
  font-size: 26px;
  font-weight: 700;
}

.total.presente {
  border-left-color: #16a34a;
}

.total.presente dd {
  color: #15803d;
}

.total.tardanza {
  border-left-color: #ea580c;
}

.total.tardanza dd {
  color: #c2410c;
}

.total.ausente {
  border-left-color: #dc2626;
}

.total.ausente dd {
  color: #b91c1c;
}

.total.neutro {
  border-left-color: #9ca3af;
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
  align-items: flex-end;
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

.filtros .busqueda {
  flex: 1 1 260px;
}

.campo label,
.estados legend {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.campo input,
.campo textarea {
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

.campo textarea {
  resize: vertical;
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

.ayuda,
.nota {
  color: #434655;
}

.nota {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.vacio {
  margin: 0;
  padding: 32px 16px;
  color: #434655;
  text-align: center;
}

.tabla-desplazable {
  position: relative;
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
  vertical-align: middle;
}

th {
  background: #f9fafb;
  color: #434655;
  font-size: 12px;
  white-space: nowrap;
}

.nombre,
.dni {
  margin: 0;
}

.nombre {
  color: #191c1e;
  font-weight: 600;
}

.dni {
  color: #6b7280;
  font-size: 12px;
}

.motivo {
  max-width: 280px;
  color: #434655;
  font-size: 13px;
}

.accion {
  text-align: right;
  white-space: nowrap;
}

.enlace {
  padding: 0;
  border: 0;
  background: none;
  color: #004ac6;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.enlace:hover {
  text-decoration: underline;
}

.formulario {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.estados {
  margin: 0;
  padding: 0;
  border: 0;
}

.selector {
  display: flex;
  overflow: hidden;
  margin-top: 8px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
}

.selector label {
  flex: 1;
  padding: 10px 12px;
  border-right: 1px solid #c3c6d7;
  color: #434655;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
}

.selector label:last-child {
  border-right: 0;
}

.selector input {
  position: absolute;
  opacity: 0;
}

.selector label:focus-within {
  outline: 2px solid #004ac6;
  outline-offset: -2px;
}

.selector .presente.elegido {
  background: #16a34a;
  color: white;
}

.selector .tardanza.elegido {
  background: #ea580c;
  color: white;
}

.selector .inasistencia.elegido {
  background: #dc2626;
  color: white;
}

.horas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
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
  .pagina-asistencia-docente {
    padding: 16px;
  }

  .totales,
  .horas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .horas {
    grid-template-columns: minmax(0, 1fr);
  }

  .filtros .campo {
    min-width: 0;
    flex: 1 1 100%;
  }

  .encabezado-carga-csv {
    flex-direction: column;
  }
}
</style>
