<script setup lang="ts">
import { computed, ref } from 'vue'
import { useListadoEstudiantes } from '~/composables/useListadoEstudiantes'

definePageMeta({
  middleware: 'autenticacion',
})

const estudiantes = useListadoEstudiantes()

const busqueda = ref('')
const gradoSeleccionado = ref('')
const seccionSeleccionada = ref('')
const mensajeInformativo = ref('')

const grados = [...new Set(estudiantes.map((estudiante) => estudiante.grado))]
const secciones = [...new Set(estudiantes.map((estudiante) => estudiante.seccion))]

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const estudiantesFiltrados = computed(() => {
  const criterio = normalizarTexto(busqueda.value.trim())

  return estudiantes.filter((estudiante) => {
    const nombreCompleto = `${estudiante.nombres} ${estudiante.apellidos}`

    const coincideBusqueda =
      !criterio ||
      normalizarTexto(nombreCompleto).includes(criterio) ||
      estudiante.numeroDocumento.includes(criterio) ||
      normalizarTexto(estudiante.codigo).includes(criterio)

    const coincideGrado = !gradoSeleccionado.value || estudiante.grado === gradoSeleccionado.value

    const coincideSeccion = !seccionSeleccionada.value || estudiante.seccion === seccionSeleccionada.value

    return coincideBusqueda && coincideGrado && coincideSeccion
  })
})

function limpiarFiltros(): void {
  busqueda.value = ''
  gradoSeleccionado.value = ''
  seccionSeleccionada.value = ''
}

function obtenerIniciales(nombres: string, apellidos: string): string {
  return `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase()
}

async function informarNuevoEstudiante(): Promise<void> {
  await navigateTo('/estudiantes/nuevo')
}
</script>

<template>
  <main class="pagina-estudiantes">
    <div class="encabezado-pagina">
      <div>
        <h1>Gestión de Estudiantes</h1>

        <p>Administra los registros, matrículas y estados de los estudiantes.</p>
      </div>

      <button type="button" class="boton-nuevo" @click="informarNuevoEstudiante">
        <span aria-hidden="true">+</span>
        Nuevo Estudiante
      </button>
    </div>

    <p v-if="mensajeInformativo" class="aviso-informativo" role="status">
      {{ mensajeInformativo }}
    </p>

    <section class="panel-filtros" aria-label="Filtros de estudiantes">
      <div class="campo-filtro campo-busqueda">
        <label for="buscar-estudiante"> Buscar estudiante por nombre o documento </label>

        <input id="buscar-estudiante" v-model="busqueda" type="search" placeholder="Ej. Ana García" />
      </div>

      <div class="campo-filtro">
        <label for="filtrar-grado"> Grado </label>

        <select id="filtrar-grado" v-model="gradoSeleccionado">
          <option value="">Todos los Grados</option>

          <option v-for="grado in grados" :key="grado" :value="grado">
            {{ grado }}
          </option>
        </select>
      </div>

      <div class="campo-filtro">
        <label for="filtrar-seccion"> Sección </label>

        <select id="filtrar-seccion" v-model="seccionSeleccionada">
          <option value="">Todas las Secciones</option>

          <option v-for="seccion in secciones" :key="seccion" :value="seccion">
            {{ seccion }}
          </option>
        </select>
      </div>

      <button type="button" class="boton-limpiar" @click="limpiarFiltros">Limpiar filtros</button>
    </section>

    <section class="panel-tabla" aria-label="Listado de estudiantes">
      <div class="tabla-desplazable">
        <table>
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Estudiante</th>
              <th scope="col">Documento</th>
              <th scope="col">Grado</th>
              <th scope="col">Sección</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="estudiante in estudiantesFiltrados" :key="estudiante.codigo">
              <td class="codigo">
                {{ estudiante.codigo }}
              </td>

              <td>
                <div class="informacion-estudiante">
                  <img v-if="estudiante.avatar" :src="estudiante.avatar" alt="" class="avatar" />

                  <span v-else class="avatar avatar-iniciales">
                    {{ obtenerIniciales(estudiante.nombres, estudiante.apellidos) }}
                  </span>

                  <div class="datos-estudiante">
                    <strong> {{ estudiante.nombres }} {{ estudiante.apellidos }} </strong>

                    <small>
                      {{ estudiante.correoElectronico }}
                    </small>
                  </div>
                </div>
              </td>

              <td>{{ estudiante.numeroDocumento }}</td>
              <td>{{ estudiante.grado }}</td>
              <td>{{ estudiante.seccion }}</td>

              <td>
                <span class="estado" :class="estudiante.estado === 'ACTIVO' ? 'activo' : 'inactivo'">
                  {{ estudiante.estado === 'ACTIVO' ? 'Activo' : 'Inactivo' }}
                </span>
              </td>

              <td>
                <span class="accion-pendiente">Pendiente</span>
              </td>
            </tr>

            <tr v-if="estudiantesFiltrados.length === 0">
              <td colspan="7" class="sin-resultados">No se encontraron estudiantes con los filtros seleccionados.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="pie-tabla">
        Mostrando {{ estudiantesFiltrados.length }} de {{ estudiantes.length }} registros de demostración
      </footer>
    </section>
  </main>
</template>

<style scoped>
.pagina-estudiantes {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}

.encabezado-pagina {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.encabezado-pagina h1 {
  margin: 0 0 4px;
  color: #191c1e;
  font-size: 28px;
  font-weight: 700;
}

.encabezado-pagina p {
  margin: 0;
  color: #434655;
  font-size: 14px;
}

.boton-nuevo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 10px 18px;
  border: 0;
  border-radius: 8px;
  background: #004ac6;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.boton-nuevo:hover {
  background: #003e9f;
}

.aviso-informativo {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #434655;
  font-size: 14px;
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

.panel-tabla {
  display: flex;
  min-height: 480px;
  flex-direction: column;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  overflow: hidden;
  background: white;
}

.tabla-desplazable {
  flex: 1;
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

.codigo {
  color: #434655;
  font-family: monospace;
}

.informacion-estudiante {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 190px;
}

.avatar {
  display: flex;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-iniciales {
  background: #8fa7fe;
  color: #1d3989;
  font-size: 12px;
  font-weight: 600;
}

.datos-estudiante {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.datos-estudiante strong {
  font-size: 13px;
  font-weight: 600;
}

.datos-estudiante small {
  color: #434655;
  font-size: 12px;
}

.estado {
  display: inline-flex;
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.estado.activo {
  background: #ecfdf5;
  color: #047857;
}

.estado.inactivo {
  background: #fee2e2;
  color: #b91c1c;
}

.accion-pendiente {
  color: #737686;
  font-size: 12px;
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

@media (max-width: 1050px) {
  .panel-filtros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .campo-busqueda {
    grid-column: 1 / -1;
  }
}

@media (max-width: 600px) {
  .pagina-estudiantes {
    padding: 16px;
  }

  .encabezado-pagina {
    align-items: flex-start;
    flex-direction: column;
  }

  .panel-filtros {
    grid-template-columns: 1fr;
  }

  .campo-busqueda {
    grid-column: auto;
  }

  table {
    min-width: 850px;
  }
}
</style>
