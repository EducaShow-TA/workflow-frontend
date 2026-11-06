<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { EstadoMarcable, FilaListaAsistencia, ListaAsistencia } from '~/types/sesionClase'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { formatearFecha } from '~/composables/useFechas'
import {
  describirMomento,
  formatearHora,
  horaDeMomento,
  nombreSeccion,
  obtenerEtiquetaEstado,
  obtenerSituacion,
  useSesionesClase,
} from '~/composables/useSesionesClase'
import { useAutenticacionStore } from '~/stores/autenticacion'

type Modo = 'tomar' | 'lectura' | 'edicion' | 'por-abrir' | 'cerrada'

const OPCIONES: { estado: EstadoMarcable; etiqueta: string }[] = [
  { estado: 'PRESENTE', etiqueta: 'Presente' },
  { estado: 'TARDANZA', etiqueta: 'Tardanza' },
  { estado: 'AUSENTE', etiqueta: 'Ausente' },
]

const propiedades = defineProps<{
  sesionId: number
  /** A dónde vuelve: Mis clases del docente o Sesiones de clase del administrador. */
  rutaVolver: string
}>()

const autenticacion = useAutenticacionStore()
const { obtenerLista, guardarAsistencias } = useSesionesClase()

const esAdministrador = computed(() => autenticacion.usuario?.rol === 'ADMINISTRADOR')

const lista = ref<ListaAsistencia | null>(null)
const marcas = ref<Record<number, EstadoMarcable | null>>({})
const modo = ref<Modo>('lectura')
const busqueda = ref('')
const cargando = ref(true)
const guardando = ref(false)
const error = ref('')
const errorGuardar = ref('')
const resumenGuardado = ref<{ presentes: number; tardanzas: number; ausentes: number } | null>(null)

const sesion = computed(() => lista.value?.sesion ?? null)
const editable = computed(() => modo.value === 'tomar' || modo.value === 'edicion')
const alumnosVisibles = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()
  const alumnos = lista.value?.alumnos ?? []
  return texto
    ? alumnos.filter((alumno) => `${alumno.nombreCompleto} ${alumno.dni}`.toLowerCase().includes(texto))
    : alumnos
})
const marcables = computed(() => (lista.value?.alumnos ?? []).filter((alumno) => alumno.estado !== 'JUSTIFICADA'))
const conteo = computed(() => {
  const resultado = { PRESENTE: 0, TARDANZA: 0, AUSENTE: 0, JUSTIFICADA: 0, pendientes: 0 }
  for (const alumno of lista.value?.alumnos ?? []) {
    const estado =
      alumno.estado === 'JUSTIFICADA'
        ? 'JUSTIFICADA'
        : editable.value
          ? marcas.value[alumno.estudianteId]
          : alumno.estado
    if (estado) resultado[estado] += 1
    else resultado.pendientes += 1
  }
  return resultado
})
const cambios = computed(() =>
  marcables.value.filter((alumno) => (marcas.value[alumno.estudianteId] ?? null) !== (alumno.estado ?? null)),
)
const puedeGuardar = computed(
  () => editable.value && !guardando.value && conteo.value.pendientes === 0 && cambios.value.length > 0,
)
const textoAuditoria = computed(() => {
  if (!lista.value?.sesion.registradaEn) return ''
  const partes = [`Registrada el ${describirMomento(lista.value.sesion.registradaEn)}`]
  if (lista.value.registradaPor) partes[0] += ` por ${lista.value.registradaPor}`
  if (lista.value.corregidaEn) {
    partes.push(
      `Última corrección el ${describirMomento(lista.value.corregidaEn)}${lista.value.corregidaPor ? ` por ${lista.value.corregidaPor}` : ''}`,
    )
  }
  return partes.join(' · ')
})

function iniciales(nombre: string): string {
  return nombre
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
}

function copiarMarcas(alumnos: FilaListaAsistencia[]): void {
  marcas.value = Object.fromEntries(
    alumnos
      .filter((alumno) => alumno.estado !== 'JUSTIFICADA')
      .map((alumno) => [alumno.estudianteId, (alumno.estado as EstadoMarcable | null) ?? null]),
  )
}

function decidirModo(datos: ListaAsistencia): Modo {
  const situacion = obtenerSituacion(datos.sesion)
  if (situacion === 'REGISTRADA') return 'lectura'
  if (situacion === 'ABIERTA' || esAdministrador.value) return 'tomar'
  return situacion === 'POR_ABRIR' ? 'por-abrir' : 'cerrada'
}

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''

  try {
    const datos = await obtenerLista(propiedades.sesionId)
    lista.value = datos
    copiarMarcas(datos.alumnos)
    modo.value = decidirModo(datos)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar la lista de asistencia.')
  } finally {
    cargando.value = false
  }
}

function marcar(estudianteId: number, estado: EstadoMarcable): void {
  marcas.value = { ...marcas.value, [estudianteId]: estado }
  errorGuardar.value = ''
}

function marcarTodosPresentes(): void {
  const nuevas = { ...marcas.value }
  for (const alumno of marcables.value) {
    if (!nuevas[alumno.estudianteId]) nuevas[alumno.estudianteId] = 'PRESENTE'
  }
  marcas.value = nuevas
  errorGuardar.value = ''
}

function editar(): void {
  if (lista.value) copiarMarcas(lista.value.alumnos)
  errorGuardar.value = ''
  modo.value = 'edicion'
}

function cancelar(): void {
  if (modo.value === 'edicion') {
    if (lista.value) copiarMarcas(lista.value.alumnos)
    errorGuardar.value = ''
    modo.value = 'lectura'
    return
  }
  void navigateTo(propiedades.rutaVolver)
}

async function guardar(): Promise<void> {
  if (!puedeGuardar.value) return
  guardando.value = true
  errorGuardar.value = ''

  try {
    const datos = await guardarAsistencias(propiedades.sesionId, {
      asistencias: marcables.value.map((alumno) => ({
        estudianteId: alumno.estudianteId,
        estado: marcas.value[alumno.estudianteId] as EstadoMarcable,
      })),
    })
    lista.value = datos
    copiarMarcas(datos.alumnos)
    modo.value = 'lectura'
    resumenGuardado.value = {
      presentes: datos.sesion.presentes,
      tardanzas: datos.sesion.tardanzas,
      ausentes: datos.sesion.ausentes,
    }
  } catch (fallo: unknown) {
    errorGuardar.value = obtenerMensajeError(fallo, 'No se pudo guardar la asistencia. Inténtalo nuevamente.')
  } finally {
    guardando.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <section class="pagina-lista">
    <NuxtLink :to="rutaVolver" class="volver">← {{ esAdministrador ? 'Sesiones de clase' : 'Mis clases' }}</NuxtLink>

    <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="cargar" />

    <template v-else-if="lista && sesion">
      <EncabezadoPagina
        :titulo="`${sesion.areaNombre} · ${nombreSeccion(sesion)}`"
        :descripcion="`${formatearFecha(sesion.fecha)} · ${formatearHora(sesion.horaInicio)} – ${formatearHora(sesion.horaFin)} · ${sesion.totalAlumnos} alumnos · ${sesion.docenteNombre}`"
      >
        <template #acciones>
          <BotonAccion v-if="modo === 'lectura'" variante="secundario" @click="editar">✎ Editar asistencia</BotonAccion>
          <InsigniaEstado
            v-else-if="modo === 'tomar' && sesion.ventanaAbierta"
            :texto="`Ventana abierta hasta las ${horaDeMomento(sesion.ventanaCierre)}`"
            variante="advertencia"
          />
        </template>
      </EncabezadoPagina>

      <AvisoMensaje v-if="modo === 'lectura' && textoAuditoria" :mensaje="`✓ ${textoAuditoria}.`" tipo="exito" />
      <AvisoMensaje
        v-else-if="modo === 'edicion'"
        mensaje="Estás corrigiendo una asistencia ya registrada. Se guardará quién hizo la corrección y cuándo."
        tipo="informacion"
      />
      <AvisoMensaje
        v-else-if="modo === 'tomar' && !sesion.ventanaAbierta"
        :mensaje="`La ventana de esta sesión fue de ${horaDeMomento(sesion.ventanaApertura)} a ${horaDeMomento(sesion.ventanaCierre)}. Como administrador puedes registrarla fuera de ese horario.`"
        tipo="advertencia"
      />

      <template v-if="modo === 'por-abrir' || modo === 'cerrada'">
        <AvisoMensaje
          v-if="modo === 'por-abrir'"
          :mensaje="`La toma de asistencia se habilita a las ${horaDeMomento(sesion.ventanaApertura)} y se cierra a las ${horaDeMomento(sesion.ventanaCierre)}.`"
        />
        <AvisoMensaje
          v-else
          :mensaje="`La asistencia de esta sesión no se registró: la ventana estuvo abierta de ${horaDeMomento(sesion.ventanaApertura)} a ${horaDeMomento(sesion.ventanaCierre)}. Pasado ese plazo, solo el administrador puede registrarla.`"
          tipo="advertencia"
        />
        <div>
          <BotonAccion variante="secundario" :destino="rutaVolver">← Volver a mis clases</BotonAccion>
        </div>
      </template>

      <template v-else>
        <dl class="totales">
          <div class="total presente">
            <dt>Presentes</dt>
            <dd>{{ conteo.PRESENTE }}</dd>
          </div>
          <div class="total tardanza">
            <dt>Tardanzas</dt>
            <dd>{{ conteo.TARDANZA }}</dd>
          </div>
          <div class="total ausente">
            <dt>Ausentes</dt>
            <dd>{{ conteo.AUSENTE }}</dd>
          </div>
          <div class="total neutro">
            <dt>{{ editable ? 'Sin marcar' : 'Justificadas' }}</dt>
            <dd>{{ editable ? conteo.pendientes : conteo.JUSTIFICADA }}</dd>
          </div>
        </dl>

        <section class="tarjeta" aria-labelledby="titulo-alumnos">
          <h2 id="titulo-alumnos" class="solo-lectores">Alumnos de la sesión</h2>
          <div class="barra-lista">
            <label for="buscar-alumno" class="solo-lectores">Buscar alumno</label>
            <input
              id="buscar-alumno"
              v-model="busqueda"
              type="search"
              placeholder="Buscar por nombre o DNI"
              autocomplete="off"
            />
            <BotonAccion
              v-if="editable"
              variante="secundario"
              :deshabilitado="guardando || conteo.pendientes === 0"
              @click="marcarTodosPresentes"
            >
              ✓ Marcar todos como presentes
            </BotonAccion>
          </div>

          <p v-if="!lista.alumnos.length" class="vacio">
            No hay alumnos con matrícula confirmada en esta sección para la fecha de la sesión.
          </p>
          <p v-else-if="!alumnosVisibles.length" class="vacio">Ningún alumno coincide con la búsqueda.</p>

          <ol v-else class="alumnos">
            <li
              v-for="alumno in alumnosVisibles"
              :key="alumno.estudianteId"
              class="alumno"
              :class="{ pendiente: editable && alumno.estado !== 'JUSTIFICADA' && !marcas[alumno.estudianteId] }"
            >
              <div class="identidad">
                <span class="iniciales" aria-hidden="true">{{ iniciales(alumno.nombreCompleto) }}</span>
                <div>
                  <p class="nombre">{{ alumno.nombreCompleto }}</p>
                  <p class="dni">
                    DNI {{ alumno.dni }}<template v-if="!alumno.matriculado"> · Ya no está matriculado</template>
                  </p>
                </div>
              </div>

              <InsigniaEstado v-if="alumno.estado === 'JUSTIFICADA'" texto="Justificada" variante="informacion" />
              <div
                v-else-if="editable"
                class="selector"
                role="group"
                :aria-label="`Asistencia de ${alumno.nombreCompleto}`"
              >
                <button
                  v-for="opcion in OPCIONES"
                  :key="opcion.estado"
                  type="button"
                  :class="[opcion.estado.toLowerCase(), { elegido: marcas[alumno.estudianteId] === opcion.estado }]"
                  :aria-pressed="marcas[alumno.estudianteId] === opcion.estado"
                  :disabled="guardando"
                  @click="marcar(alumno.estudianteId, opcion.estado)"
                >
                  {{ opcion.etiqueta }}
                </button>
              </div>
              <InsigniaEstado
                v-else-if="alumno.estado"
                :texto="obtenerEtiquetaEstado(alumno.estado)"
                :variante="
                  alumno.estado === 'PRESENTE' ? 'exito' : alumno.estado === 'TARDANZA' ? 'advertencia' : 'error'
                "
              />
              <InsigniaEstado v-else texto="Sin registro" variante="neutro" />
            </li>
          </ol>

          <div v-if="editable" class="pie-lista">
            <div class="estado-pie">
              <AvisoMensaje v-if="errorGuardar" :mensaje="errorGuardar" tipo="error" />
              <p v-else-if="conteo.pendientes" class="falta">
                Faltan {{ conteo.pendientes }} {{ conteo.pendientes === 1 ? 'alumno' : 'alumnos' }} por marcar
              </p>
              <p v-else-if="cambios.length" class="listo">Hay cambios sin guardar</p>
              <p v-else class="sin-cambios">Sin cambios</p>
            </div>
            <div class="botones-pie">
              <BotonAccion variante="secundario" :deshabilitado="guardando" @click="cancelar">Cancelar</BotonAccion>
              <BotonAccion :deshabilitado="!puedeGuardar" @click="guardar">
                {{ guardando ? 'Guardando...' : 'Guardar asistencia' }}
              </BotonAccion>
            </div>
          </div>
        </section>
      </template>
    </template>

    <VentanaModal
      :abierta="resumenGuardado !== null"
      titulo="Asistencia guardada"
      :descripcion="sesion ? `${sesion.areaNombre} · ${nombreSeccion(sesion)} · ${formatearFecha(sesion.fecha)}` : ''"
      @cerrar="resumenGuardado = null"
    >
      <dl v-if="resumenGuardado" class="totales modal">
        <div class="total presente">
          <dt>Presentes</dt>
          <dd>{{ resumenGuardado.presentes }}</dd>
        </div>
        <div class="total tardanza">
          <dt>Tardanzas</dt>
          <dd>{{ resumenGuardado.tardanzas }}</dd>
        </div>
        <div class="total ausente">
          <dt>Ausentes</dt>
          <dd>{{ resumenGuardado.ausentes }}</dd>
        </div>
      </dl>
      <template #pie>
        <BotonAccion variante="secundario" @click="resumenGuardado = null">Ver asistencia</BotonAccion>
        <BotonAccion @click="navigateTo(rutaVolver)">
          {{ esAdministrador ? 'Volver a sesiones' : 'Volver a mis clases' }}
        </BotonAccion>
      </template>
    </VentanaModal>
  </section>
</template>

<style scoped>
.pagina-lista {
  display: flex;
  width: 100%;
  max-width: 1000px;
  flex-direction: column;
  gap: 20px;
  margin: 0 auto;
}

.volver {
  align-self: flex-start;
  color: #004ac6;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.volver:hover {
  text-decoration: underline;
}

.totales {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.totales.modal {
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.barra-lista {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.barra-lista input {
  min-width: 0;
  max-width: 360px;
  min-height: 44px;
  flex: 1 1 240px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
}

.vacio {
  margin: 0;
  padding: 32px 16px;
  color: #434655;
  text-align: center;
}

.alumnos {
  margin: 0;
  padding: 0;
  list-style: none;
}

.alumno {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #eef0f2;
}

.alumno.pendiente {
  background: #fffbeb;
}

.identidad {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.iniciales {
  display: flex;
  width: 36px;
  height: 36px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 12px;
  font-weight: 700;
}

.nombre,
.dni {
  margin: 0;
}

.nombre {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.dni {
  color: #6b7280;
  font-size: 12px;
}

.selector {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
}

.selector button {
  min-height: 40px;
  padding: 8px 14px;
  border: 0;
  border-right: 1px solid #c3c6d7;
  background: white;
  color: #434655;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.selector button:last-child {
  border-right: 0;
}

.selector button:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: -2px;
}

.selector button:disabled {
  cursor: not-allowed;
}

.selector .presente.elegido {
  background: #16a34a;
  color: white;
}

.selector .tardanza.elegido {
  background: #ea580c;
  color: white;
}

.selector .ausente.elegido {
  background: #dc2626;
  color: white;
}

.pie-lista {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  background: white;
}

.estado-pie {
  min-width: 0;
  flex: 1 1 260px;
}

.estado-pie p {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.falta {
  color: #9a3412;
}

.listo {
  color: #004ac6;
}

.sin-cambios {
  color: #6b7280;
}

.botones-pie {
  display: flex;
  gap: 12px;
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
  .totales {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .selector {
    display: flex;
    width: 100%;
  }

  .selector button {
    flex: 1;
  }

  .botones-pie {
    width: 100%;
  }

  .botones-pie > * {
    flex: 1;
  }
}
</style>
