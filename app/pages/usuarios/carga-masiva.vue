<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ResultadoCargaMasiva, RevisionCsv } from '~/types/cargaMasiva'
import { obtenerMensajeError } from '~/composables/useDatosPrueba'
import {
  COLUMNAS_OBLIGATORIAS,
  COLUMNAS_OPCIONALES,
  MAXIMO_FILAS,
  combinarFilas,
  decodificarArchivo,
  descargarArchivo,
  describirConteoRoles,
  generarCsvCredenciales,
  generarCsvRechazadas,
  obtenerEtiquetaEstadoFila,
  obtenerVarianteEstadoFila,
  revisarCsv,
  useCargaMasiva,
} from '~/composables/useCargaMasiva'

definePageMeta({
  middleware: 'autenticacion',
})

type Paso = 'elegir' | 'revisar' | 'resultado'
type Pestana = 'cuentas' | 'todas' | 'rechazadas'

const FILAS_VISTA_PREVIA = 10
const PASOS: { clave: Paso; nombre: string }[] = [
  { clave: 'elegir', nombre: 'Elegir archivo' },
  { clave: 'revisar', nombre: 'Revisar' },
  { clave: 'resultado', nombre: 'Resultado' },
]

const { obtenerPlantilla, cargarArchivo } = useCargaMasiva()

const paso = ref<Paso>('elegir')
const archivo = ref<File | null>(null)
const revision = ref<RevisionCsv | null>(null)
const resultado = ref<ResultadoCargaMasiva | null>(null)
const pestana = ref<Pestana>('cuentas')
const errorGeneral = ref('')
const procesando = ref(false)
const descargandoPlantilla = ref(false)
const arrastrando = ref(false)
const credencialesDescargadas = ref(false)
const contrasenasVisibles = ref(new Set<number>())
const filaCopiada = ref<number | null>(null)
const selectorArchivo = ref<HTMLInputElement | null>(null)

const indicePaso = computed(() => PASOS.findIndex((elemento) => elemento.clave === paso.value))
const vistaPrevia = computed(() => revision.value?.csv.filas.slice(0, FILAS_VISTA_PREVIA) ?? [])
const filasResumen = computed(() =>
  resultado.value ? combinarFilas(resultado.value, revision.value?.csv ?? null) : [],
)
const filasRechazadas = computed(() => filasResumen.value.filter((fila) => fila.estado === 'RECHAZADA'))
const hayCredencialesPendientes = computed(
  () => (resultado.value?.cuentas.length ?? 0) > 0 && !credencialesDescargadas.value,
)

const avisoResultado = computed(() => {
  const datos = resultado.value
  if (!datos) return null

  const procesadas = datos.totalFilas - datos.filasRechazadas
  if (datos.filasRechazadas === 0) {
    return { tipo: 'exito' as const, texto: `Se procesaron las ${datos.totalFilas} filas sin errores.` }
  }
  if (procesadas === 0) {
    return {
      tipo: 'error' as const,
      texto:
        'No se procesó ninguna fila: todas fueron rechazadas. Revisa los motivos, corrige el archivo y vuelve a cargarlo.',
    }
  }
  return {
    tipo: 'advertencia' as const,
    texto: `Se procesaron ${procesadas} de ${datos.totalFilas} filas. Las rechazadas no se guardaron; corrígelas y vuelve a cargar solo esas. Las demás ya quedaron registradas.`,
  }
})

function formatearTamano(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function elegirArchivo(seleccionado: File | undefined): Promise<void> {
  if (!seleccionado) return

  errorGeneral.value = ''
  archivo.value = seleccionado
  const texto = decodificarArchivo(await seleccionado.arrayBuffer())
  revision.value = revisarCsv(seleccionado.name, seleccionado.size, texto)
  paso.value = 'revisar'
}

function alSeleccionar(evento: Event): void {
  const entrada = evento.target as HTMLInputElement
  void elegirArchivo(entrada.files?.[0])
  entrada.value = ''
}

function alSoltar(evento: DragEvent): void {
  arrastrando.value = false
  void elegirArchivo(evento.dataTransfer?.files[0])
}

async function descargarPlantilla(): Promise<void> {
  descargandoPlantilla.value = true
  errorGeneral.value = ''

  try {
    descargarArchivo('plantilla-usuarios.csv', await obtenerPlantilla())
  } catch (error: unknown) {
    errorGeneral.value = obtenerMensajeError(error, 'No se pudo descargar la plantilla.')
  } finally {
    descargandoPlantilla.value = false
  }
}

async function procesar(): Promise<void> {
  if (!archivo.value || !revision.value || revision.value.errores.length > 0) return

  procesando.value = true
  errorGeneral.value = ''

  try {
    resultado.value = await cargarArchivo(archivo.value)
    credencialesDescargadas.value = false
    contrasenasVisibles.value = new Set()
    pestana.value =
      resultado.value.cuentas.length > 0 ? 'cuentas' : resultado.value.filasRechazadas > 0 ? 'rechazadas' : 'todas'
    paso.value = 'resultado'
  } catch (error: unknown) {
    errorGeneral.value = obtenerMensajeError(error, 'No se pudo procesar el archivo.')
  } finally {
    procesando.value = false
  }
}

function confirmarDescarte(): boolean {
  return (
    !hayCredencialesPendientes.value ||
    window.confirm(
      'Todavía no descargaste las contraseñas temporales. Si sales, no podrás volver a verlas. ¿Salir de todas formas?',
    )
  )
}

function reiniciar(): void {
  if (!confirmarDescarte()) return

  credencialesDescargadas.value = true
  archivo.value = null
  revision.value = null
  resultado.value = null
  errorGeneral.value = ''
  paso.value = 'elegir'
}

function descargarCredenciales(): void {
  if (!resultado.value) return

  descargarArchivo('credenciales-temporales.csv', generarCsvCredenciales(resultado.value))
  credencialesDescargadas.value = true
}

function descargarRechazadas(): void {
  if (!resultado.value || !revision.value) return

  const base = archivo.value?.name.replace(/\.csv$/i, '') ?? 'usuarios'
  descargarArchivo(`${base}-rechazadas.csv`, generarCsvRechazadas(resultado.value, revision.value.csv))
}

function alternarContrasena(fila: number): void {
  const visibles = new Set(contrasenasVisibles.value)
  if (visibles.has(fila)) {
    visibles.delete(fila)
  } else {
    visibles.add(fila)
  }
  contrasenasVisibles.value = visibles
}

async function copiarContrasena(fila: number, contrasena: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(contrasena)
    filaCopiada.value = fila
    setTimeout(() => {
      if (filaCopiada.value === fila) filaCopiada.value = null
    }, 2000)
  } catch {
    errorGeneral.value = 'No se pudo copiar; usa "Mostrar" o descarga las credenciales.'
  }
}

function avisarAntesDeCerrar(evento: BeforeUnloadEvent): void {
  if (hayCredencialesPendientes.value) {
    evento.preventDefault()
  }
}

onBeforeRouteLeave(() => confirmarDescarte())
onMounted(() => window.addEventListener('beforeunload', avisarAntesDeCerrar))
onBeforeUnmount(() => window.removeEventListener('beforeunload', avisarAntesDeCerrar))
</script>

<template>
  <main class="pagina-carga">
    <EncabezadoPagina
      titulo="Carga masiva de usuarios"
      descripcion="Crea o actualiza cuentas de docentes, alumnos y apoderados desde un archivo CSV."
    >
      <template #acciones>
        <template v-if="paso === 'resultado'">
          <BotonAccion variante="secundario" @click="reiniciar">Cargar otro archivo</BotonAccion>
          <BotonAccion destino="/usuarios">Ir a usuarios</BotonAccion>
        </template>
        <BotonAccion v-else variante="secundario" destino="/usuarios">Volver a usuarios</BotonAccion>
      </template>
    </EncabezadoPagina>

    <ol class="pasos" aria-label="Pasos de la carga">
      <li
        v-for="(elemento, indice) in PASOS"
        :key="elemento.clave"
        :class="{ actual: indice === indicePaso, hecho: indice < indicePaso }"
        :aria-current="indice === indicePaso ? 'step' : undefined"
      >
        <span class="numero">{{ indice < indicePaso ? '✓' : indice + 1 }}</span>
        {{ elemento.nombre }}
      </li>
    </ol>

    <AvisoMensaje v-if="errorGeneral" :mensaje="errorGeneral" tipo="error" cerrable @cerrar="errorGeneral = ''" />

    <section v-if="paso === 'elegir'" class="cuadricula">
      <div
        class="tarjeta zona"
        :class="{ arrastrando }"
        @dragover.prevent="arrastrando = true"
        @dragleave.prevent="arrastrando = false"
        @drop.prevent="alSoltar"
      >
        <div class="icono-zona" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
          </svg>
        </div>
        <strong>Arrastra aquí tu archivo CSV</strong>
        <span>o</span>
        <BotonAccion variante="secundario" @click="selectorArchivo?.click()">Seleccionar archivo</BotonAccion>
        <input
          ref="selectorArchivo"
          type="file"
          accept=".csv,text/csv"
          class="oculto"
          aria-label="Seleccionar archivo CSV"
          @change="alSeleccionar"
        />
        <small>Hasta {{ MAXIMO_FILAS }} filas y 10 MB · separado por comas o punto y coma</small>
      </div>

      <aside class="tarjeta guia" aria-labelledby="titulo-guia">
        <h2 id="titulo-guia">¿Cómo armar el archivo?</h2>
        <ol>
          <li>Descarga la plantilla y ábrela en Excel.</li>
          <li>
            Una fila por persona. Rol: <strong>DOCENTE</strong>, <strong>ALUMNO</strong> o <strong>APODERADO</strong>.
          </li>
          <li>
            Cada alumno necesita <code>dni_apoderado</code> y <code>parentesco</code> (PADRE, MADRE, TUTOR_LEGAL u
            OTRO). Su apoderado puede ir en el mismo archivo.
          </li>
          <li>Guárdalo como <strong>CSV</strong>.</li>
        </ol>
        <BotonAccion variante="secundario" :deshabilitado="descargandoPlantilla" @click="descargarPlantilla">
          {{ descargandoPlantilla ? 'Descargando...' : '⬇ Descargar plantilla' }}
        </BotonAccion>
        <details>
          <summary>Ver columnas</summary>
          <p><strong>Obligatorias:</strong> {{ COLUMNAS_OBLIGATORIAS.join(', ') }}</p>
          <p>
            <strong>Opcionales:</strong> {{ COLUMNAS_OPCIONALES.join(', ') }}. La fecha va como AAAA-MM-DD;
            dni_apoderado y parentesco son obligatorias para ALUMNO.
          </p>
        </details>
        <p class="nota">
          Las cuentas existentes conservan su contraseña y su rol: si un DNI ya registrado viene con otro rol, esa fila
          se rechaza.
        </p>
      </aside>
    </section>

    <section v-else-if="paso === 'revisar' && revision && archivo" class="tarjeta" aria-labelledby="titulo-revision">
      <h2 id="titulo-revision" class="oculto">Revisión del archivo</h2>
      <div class="archivo">
        <div>
          <strong>{{ archivo.name }}</strong>
          <span>
            · {{ formatearTamano(archivo.size) }} · {{ revision.csv.filas.length }}
            {{ revision.csv.filas.length === 1 ? 'fila' : 'filas' }}
          </span>
        </div>
        <BotonAccion variante="secundario" :deshabilitado="procesando" @click="paso = 'elegir'">
          Cambiar archivo
        </BotonAccion>
      </div>

      <ul class="comprobaciones">
        <li v-for="error in revision.errores" :key="error" class="bloqueo">{{ error }}</li>
        <template v-if="revision.errores.length === 0">
          <li class="correcto">Están todas las columnas obligatorias.</li>
          <li class="correcto">
            {{ revision.csv.filas.length }} {{ revision.csv.filas.length === 1 ? 'fila' : 'filas' }} de datos (máximo
            {{ MAXIMO_FILAS }}): {{ describirConteoRoles(revision.conteoPorRol) }}.
          </li>
        </template>
        <li v-for="advertencia in revision.advertencias" :key="advertencia" class="advertencia">
          {{ advertencia }} El sistema rechazará esas filas y procesará las demás.
        </li>
      </ul>

      <div v-if="vistaPrevia.length > 0" class="tabla-contenedor">
        <table>
          <caption class="oculto">
            Vista previa de las primeras filas
          </caption>
          <thead>
            <tr>
              <th scope="col">Fila</th>
              <th scope="col">Rol</th>
              <th scope="col">DNI</th>
              <th scope="col">Nombre</th>
              <th scope="col">Correo</th>
              <th scope="col">Apoderado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fila in vistaPrevia" :key="fila.fila">
              <td>{{ fila.fila }}</td>
              <td>{{ fila.valores.rol?.toUpperCase() || '—' }}</td>
              <td>{{ fila.valores.dni || '—' }}</td>
              <td>
                {{
                  [fila.valores.nombres, fila.valores.apellido_paterno, fila.valores.apellido_materno]
                    .filter(Boolean)
                    .join(' ') || '—'
                }}
              </td>
              <td>
                <InsigniaEstado v-if="!fila.valores.correo" texto="vacío" variante="advertencia" />
                <template v-else>{{ fila.valores.correo }}</template>
              </td>
              <td>
                {{
                  fila.valores.dni_apoderado
                    ? `${fila.valores.dni_apoderado}${fila.valores.parentesco ? ` · ${fila.valores.parentesco}` : ''}`
                    : '—'
                }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="revision.csv.filas.length > FILAS_VISTA_PREVIA" class="nota">
          … y {{ revision.csv.filas.length - FILAS_VISTA_PREVIA }} filas más.
        </p>
      </div>

      <div class="acciones-revision">
        <BotonAccion variante="secundario" :deshabilitado="procesando" @click="paso = 'elegir'">Cancelar</BotonAccion>
        <BotonAccion :deshabilitado="procesando || revision.errores.length > 0" @click="procesar">
          {{
            procesando
              ? 'Procesando...'
              : `Procesar ${revision.csv.filas.length} ${revision.csv.filas.length === 1 ? 'fila' : 'filas'}`
          }}
        </BotonAccion>
      </div>
    </section>

    <template v-else-if="paso === 'resultado' && resultado">
      <AvisoMensaje v-if="avisoResultado" :mensaje="avisoResultado.texto" :tipo="avisoResultado.tipo" />

      <section class="metricas" aria-label="Resumen de la carga">
        <div class="metrica destacada">
          <span>Cuentas creadas</span><strong>{{ resultado.usuariosCreados }}</strong>
        </div>
        <div class="metrica">
          <span>Actualizadas</span><strong>{{ resultado.usuariosActualizados }}</strong>
        </div>
        <div class="metrica">
          <span>Vinculadas</span><strong>{{ resultado.usuariosVinculados }}</strong>
        </div>
        <div class="metrica">
          <span>Sin cambios</span><strong>{{ resultado.usuariosSinCambios }}</strong>
        </div>
        <div class="metrica" :class="{ alerta: resultado.filasRechazadas > 0 }">
          <span>Filas rechazadas</span><strong>{{ resultado.filasRechazadas }}</strong>
        </div>
      </section>

      <section class="tarjeta">
        <div class="pestanas" role="tablist" aria-label="Detalle de la carga">
          <button
            type="button"
            role="tab"
            :aria-selected="pestana === 'cuentas'"
            :class="{ activa: pestana === 'cuentas' }"
            @click="pestana = 'cuentas'"
          >
            Cuentas creadas ({{ resultado.cuentas.length }})
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="pestana === 'todas'"
            :class="{ activa: pestana === 'todas' }"
            @click="pestana = 'todas'"
          >
            Todas las filas ({{ filasResumen.length }})
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="pestana === 'rechazadas'"
            :class="{ activa: pestana === 'rechazadas' }"
            @click="pestana = 'rechazadas'"
          >
            Rechazadas ({{ filasRechazadas.length }})
          </button>
        </div>

        <div v-if="pestana === 'cuentas'" role="tabpanel">
          <p v-if="resultado.cuentas.length === 0" class="vacio">No se creó ninguna cuenta nueva en esta carga.</p>
          <template v-else>
            <p class="aviso-credenciales">
              <strong>Las contraseñas temporales solo se muestran ahora.</strong> Descárgalas antes de salir de esta
              pantalla y entrégalas a cada persona: no se pueden volver a consultar ni se guardan en el navegador.
            </p>
            <div class="barra-tabla">
              <span>Las cuentas ya están activas y pueden iniciar sesión.</span>
              <BotonAccion @click="descargarCredenciales">
                {{ credencialesDescargadas ? '✓ Credenciales descargadas' : '⬇ Descargar credenciales (CSV)' }}
              </BotonAccion>
            </div>
            <div class="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Fila</th>
                    <th scope="col">Rol</th>
                    <th scope="col">DNI</th>
                    <th scope="col">Usuario (correo)</th>
                    <th scope="col">Contraseña temporal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="cuenta in resultado.cuentas" :key="cuenta.fila">
                    <td>{{ cuenta.fila }}</td>
                    <td>{{ cuenta.rol }}</td>
                    <td>{{ cuenta.dni }}</td>
                    <td>{{ cuenta.username }}</td>
                    <td class="celda-contrasena">
                      <code>{{ contrasenasVisibles.has(cuenta.fila) ? cuenta.contrasenhaTemporal : '••••••••' }}</code>
                      <button
                        type="button"
                        class="boton-mini"
                        :aria-label="`${contrasenasVisibles.has(cuenta.fila) ? 'Ocultar' : 'Mostrar'} la contraseña de ${cuenta.username}`"
                        @click="alternarContrasena(cuenta.fila)"
                      >
                        {{ contrasenasVisibles.has(cuenta.fila) ? 'Ocultar' : 'Mostrar' }}
                      </button>
                      <button
                        type="button"
                        class="boton-mini"
                        :aria-label="`Copiar la contraseña de ${cuenta.username}`"
                        @click="copiarContrasena(cuenta.fila, cuenta.contrasenhaTemporal)"
                      >
                        {{ filaCopiada === cuenta.fila ? 'Copiada' : 'Copiar' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <div v-else-if="pestana === 'todas'" role="tabpanel" class="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th scope="col">Fila</th>
                <th scope="col">Rol</th>
                <th scope="col">DNI</th>
                <th scope="col">Usuario</th>
                <th scope="col">Resultado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fila in filasResumen" :key="fila.fila">
                <td>{{ fila.fila }}</td>
                <td>{{ fila.rol || '—' }}</td>
                <td>{{ fila.dni || '—' }}</td>
                <td>{{ fila.username || '—' }}</td>
                <td>
                  <InsigniaEstado
                    :texto="obtenerEtiquetaEstadoFila(fila.estado)"
                    :variante="obtenerVarianteEstadoFila(fila.estado)"
                  />
                  <small v-if="fila.motivos.length > 0" class="motivo">
                    {{ fila.motivos.map((motivo) => `${motivo.campo}: ${motivo.mensaje}`).join(' · ') }}
                  </small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else role="tabpanel">
          <p v-if="filasRechazadas.length === 0" class="vacio">No hay filas rechazadas.</p>
          <template v-else>
            <div class="barra-tabla">
              <span>Una fila puede tener varios motivos.</span>
              <BotonAccion variante="secundario" @click="descargarRechazadas">⬇ Descargar rechazadas (CSV)</BotonAccion>
            </div>
            <div class="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Fila</th>
                    <th scope="col">Campo</th>
                    <th scope="col">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="fila in filasRechazadas" :key="fila.fila">
                    <tr v-for="(motivo, indice) in fila.motivos" :key="`${fila.fila}-${indice}`">
                      <td>{{ indice === 0 ? fila.fila : '' }}</td>
                      <td>{{ motivo.campo }}</td>
                      <td>{{ motivo.mensaje }}</td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.pagina-carga {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}

.oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.pasos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pasos li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: white;
  color: #6b7280;
  font-size: 13px;
}

.pasos .numero {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e5e7eb;
  color: #434655;
  font-size: 11px;
}

.pasos .actual {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

.pasos .actual .numero {
  background: var(--color-primary);
  color: white;
}

.pasos .hecho .numero {
  background: #22c55e;
  color: white;
}

.cuadricula {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  align-items: start;
  gap: 20px;
}

.tarjeta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.zona {
  align-items: center;
  justify-content: center;
  min-height: 280px;
  border: 2px dashed #9fb3d9;
  background: #f8faff;
  color: #434655;
  text-align: center;
}

.zona.arrastrando {
  border-color: var(--color-primary);
  background: #eef2ff;
}

.zona strong {
  color: #191c1e;
  font-size: 15px;
}

.zona small {
  color: #6b7280;
}

.icono-zona {
  display: flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e0e7ff;
  color: var(--color-primary);
}

.guia h2 {
  margin: 0;
  font-size: 16px;
}

.guia ol {
  margin: 0;
  padding-left: 18px;
  color: #434655;
  font-size: 14px;
  line-height: 1.6;
}

.guia details {
  color: #434655;
  font-size: 13px;
}

.guia summary {
  font-weight: 600;
  cursor: pointer;
}

.guia details p {
  margin: 8px 0 0;
}

.guia > :deep(*:is(a, button)) {
  align-self: flex-start;
}

.nota {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f3f4f6;
  font-size: 12px;
}

.archivo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.archivo span {
  color: #6b7280;
  font-size: 13px;
}

.comprobaciones {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  font-size: 14px;
  list-style: none;
}

.comprobaciones li::before {
  display: inline-block;
  width: 18px;
  font-weight: 700;
}

.comprobaciones .correcto::before {
  color: #15803d;
  content: '✓';
}

.comprobaciones .advertencia {
  color: #92400e;
}

.comprobaciones .advertencia::before {
  content: '!';
}

.comprobaciones .bloqueo {
  color: #b91c1c;
  font-weight: 600;
}

.comprobaciones .bloqueo::before {
  content: '✕';
}

.tabla-contenedor {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

th,
td {
  padding: 9px 10px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: top;
}

th {
  background: #f9fafb;
  color: #434655;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.acciones-revision {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.metricas {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.metrica {
  padding: 14px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.metrica span {
  color: #434655;
  font-size: 12px;
}

.metrica strong {
  display: block;
  margin-top: 4px;
  color: #191c1e;
  font-size: 26px;
}

.metrica.destacada {
  border-color: #a7f3d0;
  background: #ecfdf5;
}

.metrica.alerta {
  border-color: #fecaca;
  background: #fef2f2;
}

.pestanas {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  border-bottom: 1px solid #e5e7eb;
}

.pestanas button {
  padding: 10px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: #434655;
  font-size: 14px;
  cursor: pointer;
}

.pestanas button.activa {
  border-bottom-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

.aviso-credenciales {
  margin: 0 0 12px;
  padding: 12px 14px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 13.5px;
  line-height: 1.5;
}

.barra-tabla {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  color: #6b7280;
  font-size: 13px;
}

.celda-contrasena {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.celda-contrasena code {
  min-width: 96px;
  padding: 3px 8px;
  font-size: 13px;
}

.boton-mini {
  padding: 4px 10px;
  border: 1px solid #c3c6d7;
  border-radius: 6px;
  background: white;
  color: #191c1e;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.motivo {
  display: block;
  margin-top: 4px;
  color: #991b1b;
  font-size: 12px;
}

.vacio {
  margin: 12px 0;
  color: #6b7280;
}

@media (max-width: 1000px) {
  .cuadricula {
    grid-template-columns: 1fr;
  }

  .metricas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .pagina-carga {
    padding: 20px 16px;
  }
}
</style>
