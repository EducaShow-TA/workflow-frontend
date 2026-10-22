<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { FiltrosRegistroError, NivelLog, RegistroError } from '~/types/registroError'
import {
  NIVELES_LOG,
  TAMANIO_PAGINA_REGISTROS,
  describirUsuarioLog,
  formatearFechaHoraLog,
  obtenerEtiquetaNivel,
  useRegistrosError,
} from '~/composables/useRegistrosError'
import { obtenerMensajeError } from '~/composables/useDatosPrueba'

definePageMeta({
  middleware: 'autenticacion',
})

const ESPERA_BUSQUEDA_MS = 400

const { consultarRegistros, obtenerRegistro } = useRegistrosError()

const filtros = reactive<FiltrosRegistroError>({ texto: '', nivel: '', fecha: '' })
const registros = ref<RegistroError[]>([])
const paginaActual = ref(0)
const totalPaginas = ref(0)
const totalRegistros = ref(0)
const cargando = ref(true)
const errorCarga = ref('')

// Si el usuario cambia de filtro antes de que llegue la respuesta anterior, esa respuesta se descarta.
let numeroConsulta = 0
let temporizadorBusqueda: ReturnType<typeof setTimeout> | undefined

async function cargarRegistros(pagina: number = paginaActual.value): Promise<void> {
  const consulta = ++numeroConsulta
  cargando.value = true
  errorCarga.value = ''

  try {
    const respuesta = await consultarRegistros(filtros, pagina)

    if (consulta !== numeroConsulta) {
      return
    }

    registros.value = respuesta.content
    paginaActual.value = respuesta.page.number
    totalPaginas.value = respuesta.page.totalPages
    totalRegistros.value = respuesta.page.totalElements
  } catch (error: unknown) {
    if (consulta === numeroConsulta) {
      errorCarga.value = obtenerMensajeError(error, 'No se pudo cargar el log de errores.')
    }
  } finally {
    if (consulta === numeroConsulta) {
      cargando.value = false
    }
  }
}

onMounted(() => cargarRegistros(0))

watch(
  () => filtros.texto,
  () => {
    clearTimeout(temporizadorBusqueda)
    temporizadorBusqueda = setTimeout(() => cargarRegistros(0), ESPERA_BUSQUEDA_MS)
  },
)

watch(
  () => [filtros.nivel, filtros.fecha],
  () => cargarRegistros(0),
)

onBeforeUnmount(() => clearTimeout(temporizadorBusqueda))

const hayFiltros = computed(() => Boolean(filtros.texto.trim() || filtros.nivel || filtros.fecha))

function limpiarFiltros(): void {
  clearTimeout(temporizadorBusqueda)
  filtros.texto = ''
  filtros.nivel = ''
  filtros.fecha = ''
}

const descripcionRango = computed(() => {
  if (totalRegistros.value === 0) {
    return 'Sin registros'
  }

  const inicio = paginaActual.value * TAMANIO_PAGINA_REGISTROS + 1
  const fin = inicio + registros.value.length - 1
  return `Mostrando ${inicio} a ${fin} de ${totalRegistros.value.toLocaleString('es-PE')} registros`
})

/** Numeros de pagina visibles (base 0); null representa los puntos suspensivos. */
const paginasVisibles = computed<(number | null)[]>(() => {
  const total = totalPaginas.value
  const actual = paginaActual.value

  if (total <= 7) {
    return Array.from({ length: total }, (_, indice) => indice)
  }

  const cercanas = [actual - 1, actual, actual + 1].filter((pagina) => pagina > 0 && pagina < total - 1)
  const resultado: (number | null)[] = [0]

  if (cercanas[0]! > 1) {
    resultado.push(null)
  }

  resultado.push(...cercanas)

  if (cercanas[cercanas.length - 1]! < total - 2) {
    resultado.push(null)
  }

  resultado.push(total - 1)
  return resultado
})

function irAPagina(pagina: number): void {
  if (pagina >= 0 && pagina < totalPaginas.value && pagina !== paginaActual.value) {
    void cargarRegistros(pagina)
  }
}

function claseNivel(nivel: NivelLog): string {
  return nivel.toLowerCase()
}

const registroSeleccionado = ref<RegistroError | null>(null)
const detalle = ref<RegistroError | null>(null)
const cargandoDetalle = ref(false)
const errorDetalle = ref('')

async function abrirDetalle(registro: RegistroError): Promise<void> {
  registroSeleccionado.value = registro
  detalle.value = null
  errorDetalle.value = ''
  cargandoDetalle.value = true

  try {
    detalle.value = await obtenerRegistro(registro.id)
  } catch (error: unknown) {
    errorDetalle.value = obtenerMensajeError(error, 'No se pudo cargar el detalle del registro.')
  } finally {
    cargandoDetalle.value = false
  }
}

function cerrarDetalle(): void {
  registroSeleccionado.value = null
}

const datosDetalle = computed(() => {
  const registro = detalle.value

  if (!registro) {
    return []
  }

  return [
    { etiqueta: 'Fecha y hora', valor: formatearFechaHoraLog(registro.fechaHora) },
    { etiqueta: 'Código de error', valor: registro.codigoError ?? '—' },
    { etiqueta: 'Código HTTP', valor: registro.codigoEstado ? String(registro.codigoEstado) : '—' },
    { etiqueta: 'Módulo', valor: registro.modulo ?? '—' },
    { etiqueta: 'Usuario', valor: describirUsuarioLog(registro) },
    {
      etiqueta: 'Endpoint',
      valor: registro.endpoint ? `${registro.metodoHttp ?? ''} ${registro.endpoint}`.trim() : '—',
    },
  ]
})
</script>

<template>
  <main class="pagina-logs">
    <EncabezadoPagina titulo="Logs del Sistema" descripcion="Monitoreo de errores y eventos registrados por el servidor.">
      <template #acciones>
        <BotonAccion variante="secundario" deshabilitado title="Exportación disponible próximamente">
          <svg class="icono-boton" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 2v8m0 0L5 7m3 3 3-3M3 12.5V13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Exportar CSV
        </BotonAccion>
      </template>
    </EncabezadoPagina>

    <section class="panel-filtros" aria-label="Filtros del log">
      <div class="campo-filtro campo-busqueda">
        <label for="buscar-log">Buscar</label>
        <input
          id="buscar-log"
          v-model="filtros.texto"
          type="search"
          placeholder="Buscar por mensaje, endpoint o ID de usuario..."
          autocomplete="off"
        />
      </div>

      <div class="campo-filtro">
        <label for="filtrar-nivel">Nivel</label>
        <select id="filtrar-nivel" v-model="filtros.nivel">
          <option value="">Todos los niveles</option>
          <option v-for="nivel in NIVELES_LOG" :key="nivel.valor" :value="nivel.valor">{{ nivel.etiqueta }}</option>
        </select>
      </div>

      <div class="campo-filtro">
        <label for="filtrar-fecha">Fecha</label>
        <input id="filtrar-fecha" v-model="filtros.fecha" type="date" />
      </div>

      <button type="button" class="boton-limpiar" :disabled="!hayFiltros" @click="limpiarFiltros">
        Limpiar filtros
      </button>
    </section>

    <section class="panel-tabla" aria-labelledby="titulo-registros">
      <header class="encabezado-tabla">
        <h2 id="titulo-registros">Registros recientes</h2>
        <span class="ayuda">Selecciona un registro para ver su traza técnica.</span>
      </header>

      <PanelEstadoCarga
        :cargando="cargando"
        :error="errorCarga"
        texto-carga="Cargando registros..."
        @reintentar="cargarRegistros()"
      >
        <div class="tabla-desplazable">
          <table>
            <colgroup>
              <col style="width: 19%" />
              <col style="width: 12%" />
              <col style="width: 14%" />
              <col style="width: 24%" />
              <col style="width: 31%" />
            </colgroup>

            <thead>
              <tr>
                <th scope="col">Marca de tiempo</th>
                <th scope="col">Nivel</th>
                <th scope="col">Usuario / Contexto</th>
                <th scope="col">Acción / Endpoint</th>
                <th scope="col">Mensaje</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="registro in registros"
                :key="registro.id"
                class="fila-registro"
                :class="{ critica: registro.nivel === 'CRITICO' }"
                tabindex="0"
                :aria-label="`Ver detalle del registro ${registro.id}`"
                @click="abrirDetalle(registro)"
                @keydown.enter.prevent="abrirDetalle(registro)"
                @keydown.space.prevent="abrirDetalle(registro)"
              >
                <td class="fecha">{{ formatearFechaHoraLog(registro.fechaHora) }}</td>

                <td>
                  <span class="nivel" :class="claseNivel(registro.nivel)">
                    <span class="punto" aria-hidden="true" />
                    {{ obtenerEtiquetaNivel(registro.nivel) }}
                  </span>
                </td>

                <td>
                  <div class="celda-doble">
                    <strong>{{ describirUsuarioLog(registro) }}</strong>
                    <small v-if="registro.modulo">{{ registro.modulo }}</small>
                  </div>
                </td>

                <td>
                  <div class="celda-doble">
                    <span class="endpoint">
                      <span v-if="registro.metodoHttp" class="metodo">{{ registro.metodoHttp }}</span>
                      {{ registro.endpoint ?? '—' }}
                    </span>
                    <small v-if="registro.codigoEstado">HTTP {{ registro.codigoEstado }}</small>
                  </div>
                </td>

                <td class="mensaje">{{ registro.mensaje ?? '—' }}</td>
              </tr>

              <tr v-if="registros.length === 0">
                <td colspan="5" class="sin-resultados">
                  {{ hayFiltros ? 'No hay registros con los filtros seleccionados.' : 'Aún no hay errores registrados.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </PanelEstadoCarga>

      <footer class="pie-tabla">
        <span>{{ descripcionRango }}</span>

        <nav v-if="totalPaginas > 1" class="paginacion" aria-label="Paginación de registros">
          <button
            type="button"
            class="boton-pagina"
            :disabled="paginaActual === 0 || cargando"
            aria-label="Página anterior"
            @click="irAPagina(paginaActual - 1)"
          >
            ‹
          </button>

          <template v-for="(pagina, indice) in paginasVisibles" :key="pagina ?? `puntos-${indice}`">
            <span v-if="pagina === null" class="puntos" aria-hidden="true">…</span>
            <button
              v-else
              type="button"
              class="boton-pagina"
              :class="{ actual: pagina === paginaActual }"
              :aria-current="pagina === paginaActual ? 'page' : undefined"
              :disabled="cargando"
              @click="irAPagina(pagina)"
            >
              {{ pagina + 1 }}
            </button>
          </template>

          <button
            type="button"
            class="boton-pagina"
            :disabled="paginaActual >= totalPaginas - 1 || cargando"
            aria-label="Página siguiente"
            @click="irAPagina(paginaActual + 1)"
          >
            ›
          </button>
        </nav>
      </footer>
    </section>

    <VentanaModal
      :abierta="registroSeleccionado !== null"
      :titulo="registroSeleccionado ? `Registro #${registroSeleccionado.id}` : ''"
      :descripcion="registroSeleccionado?.mensaje ?? ''"
      @cerrar="cerrarDetalle"
    >
      <PanelEstadoCarga
        :cargando="cargandoDetalle"
        :error="errorDetalle"
        texto-carga="Cargando detalle..."
        @reintentar="registroSeleccionado && abrirDetalle(registroSeleccionado)"
      >
        <div v-if="detalle" class="detalle">
          <span class="nivel" :class="claseNivel(detalle.nivel)">
            <span class="punto" aria-hidden="true" />
            {{ obtenerEtiquetaNivel(detalle.nivel) }}
          </span>

          <dl class="datos-detalle">
            <div v-for="dato in datosDetalle" :key="dato.etiqueta">
              <dt>{{ dato.etiqueta }}</dt>
              <dd>{{ dato.valor }}</dd>
            </div>
          </dl>

          <div class="traza">
            <h3>Traza técnica</h3>
            <pre v-if="detalle.stackTrace">{{ detalle.stackTrace }}</pre>
            <p v-else class="sin-traza">
              Sin traza técnica: el error fue controlado por el sistema (validación, permisos o regla de negocio).
            </p>
          </div>
        </div>
      </PanelEstadoCarga>
    </VentanaModal>
  </main>
</template>

<style scoped>
.pagina-logs {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}

.icono-boton {
  width: 16px;
  height: 16px;
}

.panel-filtros {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: end;
  gap: 16px;
  padding: 16px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
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
  color: #9ca3af;
  cursor: not-allowed;
}

.panel-tabla {
  display: flex;
  min-height: 480px;
  flex-direction: column;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  overflow: hidden;
  background: white;
}

.encabezado-tabla {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
}

.encabezado-tabla h2 {
  margin: 0;
  color: #191c1e;
  font-size: 17px;
}

.ayuda {
  padding: 4px 10px;
  border-radius: 999px;
  background: #f2f4f6;
  color: #434655;
  font-size: 12px;
}

.tabla-desplazable {
  flex: 1;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  text-align: left;
}

thead {
  background: #f2f4f6;
}

th {
  padding: 12px 16px;
  color: #434655;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

td {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  color: #191c1e;
  font-size: 13px;
  vertical-align: middle;
  overflow-wrap: anywhere;
}

.fila-registro {
  cursor: pointer;
}

.fila-registro:hover {
  background: #f7f9fb;
}

.fila-registro:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: -2px;
}

.fila-registro.critica {
  background: #fef2f2;
}

.fila-registro.critica .mensaje {
  color: #b91c1c;
  font-weight: 600;
}

.fecha {
  color: #434655;
  white-space: nowrap;
  font-family: monospace;
  font-size: 12px;
}

.nivel {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
}

.punto {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentcolor;
}

.nivel.info {
  background: #eef2ff;
  color: #1d4ed8;
}

.nivel.advertencia {
  background: #fef3c7;
  color: #92400e;
}

.nivel.error {
  background: #fee2e2;
  color: #b91c1c;
}

.nivel.critico {
  background: #b91c1c;
  color: white;
}

.celda-doble {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.celda-doble strong {
  font-weight: 600;
}

.celda-doble small {
  color: #737686;
  font-size: 12px;
}

.endpoint {
  color: #434655;
  font-family: monospace;
  font-size: 12px;
}

.metodo {
  margin-right: 4px;
  color: #004ac6;
  font-weight: 700;
}

.sin-resultados {
  padding: 48px 16px;
  color: #737686;
  text-align: center;
  cursor: default;
}

.pie-tabla {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  border-top: 1px solid #c3c6d7;
  color: #434655;
  font-size: 13px;
}

.paginacion {
  display: flex;
  align-items: center;
  gap: 6px;
}

.boton-pagina {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #c3c6d7;
  border-radius: 7px;
  background: white;
  color: #191c1e;
  font-size: 13px;
  cursor: pointer;
}

.boton-pagina:hover:not(:disabled) {
  background: #eef2ff;
}

.boton-pagina.actual {
  border-color: #004ac6;
  background: #004ac6;
  color: white;
}

.boton-pagina:disabled:not(.actual) {
  color: #9ca3af;
  cursor: not-allowed;
}

.puntos {
  color: #737686;
}

.detalle {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.datos-detalle {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 24px;
  margin: 0;
}

.datos-detalle dt {
  color: #737686;
  font-size: 12px;
}

.datos-detalle dd {
  margin: 2px 0 0;
  color: #191c1e;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.traza {
  width: 100%;
}

.traza h3 {
  margin: 0 0 8px;
  color: #191c1e;
  font-size: 14px;
}

.traza pre {
  max-height: 260px;
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  overflow: auto;
  background: #191c1e;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre;
}

.sin-traza {
  margin: 0;
  color: #737686;
  font-size: 13px;
}

@media (max-width: 1050px) {
  .panel-filtros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .campo-busqueda {
    grid-column: 1 / -1;
  }

  table {
    min-width: 900px;
  }
}

@media (max-width: 600px) {
  .pagina-logs {
    padding: 16px;
  }

  .panel-filtros {
    grid-template-columns: 1fr;
  }

  .campo-busqueda {
    grid-column: auto;
  }

  .pie-tabla {
    align-items: flex-start;
    flex-direction: column;
  }

  .datos-detalle {
    grid-template-columns: 1fr;
  }
}
</style>
