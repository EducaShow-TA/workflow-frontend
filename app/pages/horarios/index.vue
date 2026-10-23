<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { FiltroEstadoPlantilla, FiltroTurno, PlantillaHorario } from '~/types/plantillaHorario'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  TURNOS,
  filtrarPlantillas,
  formatearMinutos,
  obtenerNombreTurno,
  resumirPlantilla,
  usePlantillasHorario,
} from '~/composables/usePlantillasHorario'
import { usePermisosRol } from '~/composables/usePermisosRol'

definePageMeta({
  middleware: 'autenticacion',
})

const ruta = useRoute()
const { puede } = usePermisosRol()
const { listarPlantillas, cambiarEstadoPlantilla } = usePlantillasHorario()

const plantillas = ref<PlantillaHorario[]>([])
const cargando = ref(true)
const errorCarga = ref('')
const filtroTurno = ref<FiltroTurno>('TODOS')
const filtroEstado = ref<FiltroEstadoPlantilla>('ACTIVAS')
const mensajeExito = ref(obtenerMensajeInicial())
const errorEstado = ref('')
const idProcesando = ref<number | null>(null)
const plantillaPorDesactivar = ref<PlantillaHorario | null>(null)
const plantillaDetalle = ref<PlantillaHorario | null>(null)

const puedeGestionar = computed(() => puede('HORARIO_GESTIONAR'))

function obtenerMensajeInicial(): string {
  if (typeof ruta.query.creada === 'string') {
    return `Plantilla "${ruta.query.creada}" creada correctamente.`
  }

  return typeof ruta.query.actualizada === 'string'
    ? `Plantilla "${ruta.query.actualizada}" actualizada correctamente.`
    : ''
}

async function cargar(): Promise<void> {
  cargando.value = true
  errorCarga.value = ''

  try {
    plantillas.value = await listarPlantillas()
  } catch (error: unknown) {
    errorCarga.value = obtenerMensajeError(error, 'No se pudieron cargar las plantillas de horario.')
  } finally {
    cargando.value = false
  }
}

const filtradas = computed(() => filtrarPlantillas(plantillas.value, filtroTurno.value, filtroEstado.value))
const grupos = computed(() =>
  TURNOS.map((turno) => ({
    turno,
    plantillas: filtradas.value.filter((plantilla) => plantilla.turno === turno),
  })).filter((grupo) => grupo.plantillas.length > 0),
)

function describirJornada(plantilla: PlantillaHorario): string {
  const resumen = resumirPlantilla(plantilla)
  const recreos = resumen.cantidadRecreos === 1 ? '1 recreo' : `${resumen.cantidadRecreos} recreos`
  return `${plantilla.cantidadBloquesPedagogicos} horas de ${plantilla.duracionHoraPedagogicaMinutos} min · ${recreos}`
}

function describirFin(plantilla: PlantillaHorario): string {
  const resumen = resumirPlantilla(plantilla)
  const fin = `Termina a las ${formatearMinutos(resumen.finBloques)}`
  return resumen.minutosSinUsar > 0 ? `${fin} · ${resumen.minutosSinUsar} min sin usar` : `${fin} · sin tiempo libre`
}

function rangoJornada(plantilla: PlantillaHorario): string {
  const resumen = resumirPlantilla(plantilla)
  return `${formatearMinutos(resumen.inicioJornada)} – ${formatearMinutos(resumen.finJornada)}`
}

function reemplazar(actualizada: PlantillaHorario): void {
  plantillas.value = plantillas.value.map((plantilla) => (plantilla.id === actualizada.id ? actualizada : plantilla))
}

async function aplicarEstado(plantilla: PlantillaHorario, activo: boolean): Promise<void> {
  idProcesando.value = plantilla.id
  errorEstado.value = ''
  mensajeExito.value = ''

  try {
    reemplazar(await cambiarEstadoPlantilla(plantilla.id, activo))
    mensajeExito.value = `Plantilla "${plantilla.nombre}" ${activo ? 'activada' : 'desactivada'}.`
    plantillaPorDesactivar.value = null
  } catch (error: unknown) {
    errorEstado.value = obtenerMensajeError(error, 'No se pudo cambiar el estado de la plantilla.')
  } finally {
    idProcesando.value = null
  }
}

function solicitarCambio(plantilla: PlantillaHorario, activo: boolean): void {
  if (activo) {
    void aplicarEstado(plantilla, true)
    return
  }

  errorEstado.value = ''
  plantillaPorDesactivar.value = plantilla
}

onMounted(cargar)
</script>

<template>
  <main class="pagina-horarios">
    <EncabezadoPagina
      titulo="Plantillas de horario"
      descripcion="Define la jornada, la hora pedagógica y los recreos de cada turno."
    >
      <template v-if="puedeGestionar" #acciones>
        <BotonAccion destino="/horarios/nueva">+ Nueva plantilla</BotonAccion>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="mensajeExito" :mensaje="mensajeExito" tipo="exito" cerrable @cerrar="mensajeExito = ''" />
    <AvisoMensaje
      v-if="errorEstado && !plantillaPorDesactivar"
      :mensaje="errorEstado"
      tipo="error"
      cerrable
      @cerrar="errorEstado = ''"
    />

    <section class="filtros" aria-label="Filtros">
      <div class="campo-filtro">
        <label for="filtro-turno">Turno</label>
        <select id="filtro-turno" v-model="filtroTurno">
          <option value="TODOS">Todos</option>
          <option v-for="turno in TURNOS" :key="turno" :value="turno">{{ obtenerNombreTurno(turno) }}</option>
        </select>
      </div>

      <div class="campo-filtro">
        <label for="filtro-estado">Estado</label>
        <select id="filtro-estado" v-model="filtroEstado">
          <option value="ACTIVAS">Activas</option>
          <option value="INACTIVAS">Inactivas</option>
          <option value="TODAS">Todas</option>
        </select>
      </div>

      <ul class="leyenda" aria-label="Leyenda de colores">
        <li class="pedagogico">Hora pedagógica</li>
        <li class="recreo">Recreo</li>
        <li class="sin-usar">Sin usar</li>
      </ul>
    </section>

    <PanelEstadoCarga :cargando="cargando" :error="errorCarga" @reintentar="cargar">
      <div v-if="plantillas.length === 0" class="vacio">
        <h2>Todavía no hay plantillas de horario</h2>
        <p>Crea la primera para definir los bloques de clase y recreo de un turno.</p>
        <BotonAccion v-if="puedeGestionar" destino="/horarios/nueva">+ Nueva plantilla</BotonAccion>
      </div>

      <p v-else-if="grupos.length === 0" class="vacio">No hay plantillas que coincidan con los filtros.</p>

      <section
        v-for="grupo in grupos"
        :key="grupo.turno"
        class="grupo-turno"
        :aria-labelledby="`titulo-${grupo.turno}`"
      >
        <h2 :id="`titulo-${grupo.turno}`">
          Turno {{ obtenerNombreTurno(grupo.turno).toLowerCase() }}
          <InsigniaEstado
            :texto="grupo.plantillas.length === 1 ? '1 plantilla' : `${grupo.plantillas.length} plantillas`"
            variante="informacion"
          />
        </h2>

        <div class="tarjetas">
          <article
            v-for="plantilla in grupo.plantillas"
            :key="plantilla.id"
            class="tarjeta"
            :class="{ inactiva: !plantilla.activo }"
          >
            <div class="titulo-tarjeta">
              <h3>{{ plantilla.nombre }}</h3>
              <InsigniaEstado
                :texto="plantilla.activo ? 'Activa' : 'Inactiva'"
                :variante="plantilla.activo ? 'exito' : 'neutro'"
              />
            </div>

            <p class="dato">
              <strong>{{ rangoJornada(plantilla) }}</strong> · {{ describirJornada(plantilla) }}
            </p>
            <FranjaPlantilla :resumen="resumirPlantilla(plantilla)" />
            <p class="dato">{{ describirFin(plantilla) }}</p>

            <div class="pie-tarjeta">
              <InterruptorEstado
                v-if="puedeGestionar"
                :activo="plantilla.activo"
                :etiqueta="plantilla.activo ? 'Activa' : 'Inactiva'"
                :procesando="idProcesando === plantilla.id"
                @cambiar="solicitarCambio(plantilla, $event)"
              />
              <span v-else />

              <div class="acciones-tarjeta">
                <button type="button" class="boton-enlace" @click="plantillaDetalle = plantilla">Ver bloques</button>
                <BotonAccion v-if="puedeGestionar" variante="secundario" :destino="`/horarios/${plantilla.id}/editar`">
                  Editar
                </BotonAccion>
              </div>
            </div>
          </article>
        </div>
      </section>
    </PanelEstadoCarga>

    <VentanaModal
      :abierta="plantillaDetalle !== null"
      :titulo="plantillaDetalle?.nombre ?? ''"
      :descripcion="
        plantillaDetalle
          ? `Turno ${obtenerNombreTurno(plantillaDetalle.turno).toLowerCase()} · ${rangoJornada(plantillaDetalle)} · ${describirJornada(plantillaDetalle)}`
          : ''
      "
      @cerrar="plantillaDetalle = null"
    >
      <LineaTiempoBloques
        v-if="plantillaDetalle"
        :bloques="resumirPlantilla(plantillaDetalle).bloques"
        :fin-jornada="resumirPlantilla(plantillaDetalle).finJornada"
      />

      <template #pie>
        <BotonAccion variante="secundario" @click="plantillaDetalle = null">Cerrar</BotonAccion>
        <BotonAccion v-if="puedeGestionar && plantillaDetalle" :destino="`/horarios/${plantillaDetalle.id}/editar`">
          Editar
        </BotonAccion>
      </template>
    </VentanaModal>

    <VentanaConfirmacion
      :abierta="plantillaPorDesactivar !== null"
      titulo="Desactivar plantilla"
      :mensaje="`¿Desactivar ${plantillaPorDesactivar?.nombre ?? ''}? Dejará de estar disponible para armar horarios. Podrás activarla de nuevo desde el filtro Inactivas.`"
      texto-confirmar="Desactivar"
      variante="peligro"
      :procesando="idProcesando !== null"
      :error="errorEstado"
      @confirmar="plantillaPorDesactivar && aplicarEstado(plantillaPorDesactivar, false)"
      @cancelar="((plantillaPorDesactivar = null), (errorEstado = ''))"
    />
  </main>
</template>

<style scoped>
.pagina-horarios {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}

.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  padding: 16px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.campo-filtro {
  display: flex;
  min-width: 200px;
  flex-direction: column;
  gap: 6px;
}

.campo-filtro label {
  color: #434655;
  font-size: 12px;
  font-weight: 600;
}

.campo-filtro select {
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid #bbc5ce;
  border-radius: 6px;
  background: white;
  font-size: 14px;
}

.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin: 0 0 0 auto;
  padding: 0;
  color: #6b7280;
  font-size: 12px;
  list-style: none;
}

.leyenda li::before {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 2px;
  content: '';
  vertical-align: -1px;
}

.leyenda .pedagogico::before {
  background: #bfdbfe;
}

.leyenda .recreo::before {
  background: #fde68a;
}

.leyenda .sin-usar::before {
  background: #e5e7eb;
}

.grupo-turno + .grupo-turno {
  margin-top: 24px;
}

.grupo-turno h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  color: #434655;
  font-size: 16px;
}

.tarjetas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 16px;
}

.tarjeta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.tarjeta.inactiva {
  background: #fafafa;
}

.tarjeta.inactiva h3 {
  opacity: 0.75;
}

.titulo-tarjeta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.titulo-tarjeta h3 {
  margin: 0;
  color: #191c1e;
  font-size: 16px;
  overflow-wrap: anywhere;
}

.dato {
  margin: 0;
  color: #434655;
  font-size: 13px;
}

.dato strong {
  color: #191c1e;
}

.pie-tarjeta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
}

.acciones-tarjeta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.boton-enlace {
  padding: 6px 4px;
  border: 0;
  background: none;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.boton-enlace:hover {
  text-decoration: underline;
}

.vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 40px 20px;
  border: 1px dashed #c3c6d7;
  border-radius: 12px;
  background: white;
  color: #434655;
  text-align: center;
}

.vacio h2 {
  margin: 0;
  color: #191c1e;
  font-size: 18px;
}

.vacio p {
  margin: 0;
}

@media (max-width: 760px) {
  .pagina-horarios {
    padding: 20px 16px;
  }

  .leyenda {
    margin-left: 0;
  }

  .tarjetas {
    grid-template-columns: 1fr;
  }
}
</style>
