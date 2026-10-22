<script setup lang="ts">
import { useId } from 'vue'
import type { Area, Competencia } from '~/types/competencia'

defineProps<{
  /** Area a mostrar; puede traer solo las competencias que coinciden con el filtro. */
  area: Area
  /** Cantidad real de competencias del area, sin filtrar. */
  totalCompetencias: number
  expandida: boolean
}>()

const emitir = defineEmits<{
  alternar: []
  editarArea: []
  cambiarEstadoArea: []
  agregarCompetencia: []
  editarCompetencia: [competencia: Competencia]
  cambiarEstadoCompetencia: [competencia: Competencia]
}>()

const idContenido = useId()
const MOTIVO_INACTIVA = 'Actívala para editarla.'

function describirCantidad(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'competencia' : 'competencias'}`
}
</script>

<template>
  <article class="tarjeta-area" :class="{ inactiva: !area.activo }">
    <header class="encabezado-area">
      <button
        type="button"
        class="boton-desplegar"
        :aria-expanded="expandida"
        :aria-controls="idContenido"
        @click="emitir('alternar')"
      >
        <span class="flecha" :class="{ abierta: expandida }" aria-hidden="true">›</span>

        <span class="titulo-area">
          <strong>{{ area.nombre }}</strong>
          <small v-if="area.descripcion">{{ area.descripcion }}</small>
        </span>
      </button>

      <div class="datos-area">
        <InsigniaEstado :texto="area.activo ? 'Activa' : 'Inactiva'" :variante="area.activo ? 'exito' : 'neutro'" />
        <span class="cantidad">{{ describirCantidad(totalCompetencias) }}</span>
      </div>

      <div class="acciones-area">
        <button
          type="button"
          class="boton-tabla"
          :disabled="!area.activo"
          :title="area.activo ? undefined : MOTIVO_INACTIVA"
          :aria-label="`Editar área ${area.nombre}`"
          @click="emitir('editarArea')"
        >
          Editar
        </button>

        <button
          type="button"
          class="boton-tabla"
          :aria-label="`${area.activo ? 'Desactivar' : 'Activar'} área ${area.nombre}`"
          @click="emitir('cambiarEstadoArea')"
        >
          {{ area.activo ? 'Desactivar' : 'Activar' }}
        </button>
      </div>
    </header>

    <div v-if="expandida" :id="idContenido" class="contenido-area">
      <p v-if="!area.activo" class="aviso-inactiva">
        El área está inactiva: sus competencias no estarán disponibles para nuevas evaluaciones hasta que se active.
      </p>

      <div class="tabla-desplazable">
        <table>
          <thead>
            <tr>
              <th scope="col">Competencia</th>
              <th scope="col">Estado</th>
              <th scope="col">Notas registradas</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="competencia in area.competencias" :key="competencia.id">
              <td>
                <div class="celda-competencia">
                  <strong>{{ competencia.nombre }}</strong>
                  <small v-if="competencia.descripcion">{{ competencia.descripcion }}</small>
                </div>
              </td>

              <td>
                <InsigniaEstado
                  :texto="competencia.activo ? 'Activa' : 'Inactiva'"
                  :variante="competencia.activo ? 'exito' : 'neutro'"
                />
              </td>

              <td>{{ competencia.tieneNotasRegistradas ? 'Sí' : 'No' }}</td>

              <td>
                <div class="acciones-competencia">
                  <button
                    type="button"
                    class="boton-tabla"
                    :disabled="!competencia.activo"
                    :title="competencia.activo ? undefined : MOTIVO_INACTIVA"
                    :aria-label="`Editar competencia ${competencia.nombre}`"
                    @click="emitir('editarCompetencia', competencia)"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    class="boton-tabla"
                    :aria-label="`${competencia.activo ? 'Desactivar' : 'Activar'} competencia ${competencia.nombre}`"
                    @click="emitir('cambiarEstadoCompetencia', competencia)"
                  >
                    {{ competencia.activo ? 'Desactivar' : 'Activar' }}
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="area.competencias.length === 0">
              <td colspan="4" class="sin-resultados">Ninguna competencia de esta área coincide con los filtros.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="pie-area">
        <button
          type="button"
          class="boton-agregar"
          :disabled="!area.activo"
          :title="area.activo ? undefined : MOTIVO_INACTIVA"
          @click="emitir('agregarCompetencia')"
        >
          + Agregar competencia
        </button>
      </footer>
    </div>
  </article>
</template>

<style scoped>
.tarjeta-area {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.tarjeta-area.inactiva {
  background: #f7f9fb;
}

.encabezado-area {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
}

.boton-desplegar {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.boton-desplegar:focus-visible {
  border-radius: 6px;
  outline: 2px solid #004ac6;
  outline-offset: 4px;
}

.flecha {
  display: inline-flex;
  width: 20px;
  flex: 0 0 20px;
  justify-content: center;
  color: #434655;
  font-size: 22px;
  line-height: 22px;
  transition: transform 0.15s ease;
}

.flecha.abierta {
  transform: rotate(90deg);
}

.titulo-area {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.titulo-area strong {
  color: #191c1e;
  font-size: 17px;
}

.titulo-area small {
  color: #434655;
  font-size: 13px;
}

.datos-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cantidad {
  color: #434655;
  font-size: 13px;
  white-space: nowrap;
}

.acciones-area,
.acciones-competencia {
  display: flex;
  gap: 8px;
}

.acciones-area {
  flex-wrap: wrap;
}

.contenido-area {
  border-top: 1px solid #e5e7eb;
}

.aviso-inactiva {
  margin: 15px 20px 16px; /* 15px + 1px del borde superior = 16px, igual que abajo */
  padding: 10px 14px;
  border: 1px solid #fde68a;
  border-radius: 8px;
  background: #fffbeb;
  color: #92400e;
  font-size: 13px;
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
  padding: 12px 20px;
  color: #434655;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

td {
  padding: 12px 20px;
  border-top: 1px solid #e5e7eb;
  color: #191c1e;
  font-size: 13px;
  vertical-align: top;
}

.celda-competencia {
  display: flex;
  min-width: 260px;
  flex-direction: column;
  gap: 4px;
}

.celda-competencia strong {
  font-weight: 600;
}

.celda-competencia small {
  color: #434655;
  font-size: 12px;
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

.boton-tabla:hover:not(:disabled) {
  background: #eef2ff;
}

.boton-tabla:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.boton-tabla:disabled {
  border-color: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
}

.sin-resultados {
  padding: 24px 20px;
  color: #737686;
  text-align: center;
}

.pie-area {
  padding: 12px 20px 16px;
  border-top: 1px solid #e5e7eb;
}

.boton-agregar {
  padding: 8px 14px;
  border: 1px dashed #004ac6;
  border-radius: 8px;
  background: white;
  color: #004ac6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.boton-agregar:hover:not(:disabled) {
  background: #eef2ff;
}

.boton-agregar:disabled {
  border-color: #c3c6d7;
  color: #9ca3af;
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .encabezado-area {
    grid-template-columns: 1fr;
  }

  .datos-area {
    padding-left: 32px;
  }

  .acciones-area {
    padding-left: 32px;
  }

  table {
    min-width: 760px;
  }
}
</style>
