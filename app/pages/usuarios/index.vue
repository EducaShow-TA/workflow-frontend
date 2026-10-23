<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { RolUsuario } from '~/types/autenticacion'
import type { CuentaUsuario, FiltroEstadoCuenta, FiltroRol } from '~/types/cuentaUsuario'
import type { VarianteInsignia } from '~/types/interfaz'
import {
  CUENTAS_POR_PAGINA,
  calcularTotalPaginas,
  contarPorEstado,
  contarPorRol,
  filtrarCuentas,
  obtenerIniciales,
  obtenerMotivoProteccion,
  obtenerPagina,
  useCuentasUsuario,
} from '~/composables/useCuentasUsuario'
import { ROLES, obtenerNombreRol, usePermisosRol } from '~/composables/usePermisosRol'
import { obtenerMensajeError } from '~/composables/useDatosPrueba'
import { useCambioEstadoCuenta } from '~/composables/useCambioEstadoCuenta'
import { useAutenticacionStore } from '~/stores/autenticacion'

definePageMeta({
  middleware: 'autenticacion',
})

const VARIANTES_ROL: Record<RolUsuario, VarianteInsignia> = {
  ADMINISTRADOR: 'informacion',
  DOCENTE: 'exito',
  ALUMNO: 'advertencia',
  APODERADO: 'neutro',
}

const { listarCuentas } = useCuentasUsuario()
const { puede } = usePermisosRol()
const autenticacion = useAutenticacionStore()
const ruta = useRoute()
const enrutador = useRouter()

const cuentas = ref<CuentaUsuario[]>([])
const cargando = ref(true)
const errorCarga = ref('')
const mensajeExito = ref('')

async function cargarCuentas(): Promise<void> {
  cargando.value = true
  errorCarga.value = ''

  try {
    cuentas.value = await listarCuentas()
  } catch (error: unknown) {
    errorCarga.value = obtenerMensajeError(error, 'No se pudo cargar la lista de usuarios.')
  } finally {
    cargando.value = false
  }
}

onMounted(async () => {
  if (typeof ruta.query.creado === 'string') {
    mensajeExito.value = `Se creó la cuenta ${ruta.query.creado}.`
  } else if (typeof ruta.query.editado === 'string') {
    mensajeExito.value = `Se actualizaron los datos de ${ruta.query.editado}.`
  }

  if (mensajeExito.value) {
    await enrutador.replace({ query: {} })
  }

  await cargarCuentas()
})

const busqueda = ref('')
const filtroRol = ref<FiltroRol>('TODOS')
const filtroEstado = ref<FiltroEstadoCuenta>('TODOS')
const paginaActual = ref(1)

const conteoPorRol = computed(() => contarPorRol(cuentas.value))
const conteoPorEstado = computed(() => contarPorEstado(cuentas.value))
const cuentasFiltradas = computed(() =>
  filtrarCuentas(cuentas.value, busqueda.value, filtroRol.value, filtroEstado.value),
)
const totalPaginas = computed(() => calcularTotalPaginas(cuentasFiltradas.value.length))
const cuentasPagina = computed(() => obtenerPagina(cuentasFiltradas.value, paginaActual.value))
const hayFiltros = computed(
  () => Boolean(busqueda.value.trim()) || filtroRol.value !== 'TODOS' || filtroEstado.value !== 'TODOS',
)

const rangoMostrado = computed(() => {
  if (cuentasFiltradas.value.length === 0) {
    return 'Sin resultados'
  }

  const inicio = (paginaActual.value - 1) * CUENTAS_POR_PAGINA + 1
  const fin = inicio + cuentasPagina.value.length - 1
  return `Mostrando ${inicio}–${fin} de ${cuentasFiltradas.value.length} usuarios`
})

watch([busqueda, filtroRol, filtroEstado], () => {
  paginaActual.value = 1
})

function limpiarFiltros(): void {
  busqueda.value = ''
  filtroRol.value = 'TODOS'
  filtroEstado.value = 'TODOS'
}

function describirBloqueoEstado(cuenta: CuentaUsuario): string {
  return obtenerMotivoProteccion(cuenta, cuentas.value, autenticacion.usuario?.username ?? '')
}

const {
  cuentaPorDesactivar,
  idProcesando,
  errorConfirmacion,
  errorEstado,
  solicitarCambio,
  confirmarDesactivacion,
  cancelarDesactivacion,
} = useCambioEstadoCuenta((actualizada, mensaje) => {
  cuentas.value = cuentas.value.map((cuenta) => (cuenta.id === actualizada.id ? actualizada : cuenta))
  mensajeExito.value = mensaje
})

function describirEstado(cuenta: CuentaUsuario): string {
  if (cuenta.activo === undefined) {
    return `Estado de ${cuenta.nombreCompleto}: sin información`
  }

  return `Estado de ${cuenta.nombreCompleto}: ${cuenta.activo ? 'activa' : 'inactiva'}`
}

function irAPagina(pagina: number): void {
  paginaActual.value = Math.min(Math.max(1, pagina), totalPaginas.value)
}
</script>

<template>
  <main class="pagina-usuarios">
    <EncabezadoPagina
      titulo="Gestión de usuarios"
      descripcion="Administra el acceso al sistema, el rol y los datos de cada usuario."
    >
      <template v-if="puede('USUARIO_CREAR')" #acciones>
        <BotonAccion destino="/usuarios/nuevo">+ Crear usuario</BotonAccion>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="mensajeExito" :mensaje="mensajeExito" tipo="exito" cerrable @cerrar="mensajeExito = ''" />
    <AvisoMensaje v-if="errorEstado" :mensaje="errorEstado" tipo="error" cerrable @cerrar="errorEstado = ''" />

    <PanelEstadoCarga :cargando="cargando" :error="errorCarga" @reintentar="cargarCuentas">
      <section class="resumen" aria-label="Usuarios por rol">
        <div class="indicador">
          <span>Total de usuarios</span>
          <strong>{{ cuentas.length }}</strong>
          <small class="detalle-estado">
            {{ conteoPorEstado.activos }} {{ conteoPorEstado.activos === 1 ? 'activo' : 'activos' }} ·
            <span :class="{ inactivos: conteoPorEstado.inactivos > 0 }">
              {{ conteoPorEstado.inactivos }} {{ conteoPorEstado.inactivos === 1 ? 'inactivo' : 'inactivos' }}
            </span>
          </small>
        </div>

        <div v-for="rol in ROLES" :key="rol" class="indicador">
          <span>{{ obtenerNombreRol(rol) }}</span>
          <strong>{{ conteoPorRol[rol] }}</strong>
        </div>
      </section>

      <section class="panel-tabla" aria-label="Usuarios del sistema">
        <div class="barra-filtros">
          <div class="campo-filtro filtro-rol">
            <label for="filtro-rol">Rol</label>

            <select id="filtro-rol" v-model="filtroRol">
              <option value="TODOS">Todos los roles</option>
              <option v-for="rol in ROLES" :key="rol" :value="rol">{{ obtenerNombreRol(rol) }}</option>
            </select>
          </div>

          <div class="campo-filtro filtro-estado">
            <label for="filtro-estado">Estado</label>

            <select id="filtro-estado" v-model="filtroEstado">
              <option value="TODOS">Todos</option>
              <option value="ACTIVOS">Activos</option>
              <option value="INACTIVOS">Inactivos</option>
            </select>
          </div>

          <div class="campo-filtro filtro-busqueda">
            <label for="busqueda-usuario">Buscar</label>

            <input
              id="busqueda-usuario"
              v-model="busqueda"
              type="search"
              placeholder="Nombre, correo o DNI"
              autocomplete="off"
            />
          </div>

          <button type="button" class="boton-limpiar" :disabled="!hayFiltros" @click="limpiarFiltros">
            Limpiar filtros
          </button>
        </div>

        <div class="tabla-desplazable">
          <table>
            <colgroup>
              <col class="ancho-usuario" />
              <col class="ancho-dni" />
              <col class="ancho-rol" />
              <col class="ancho-estado" />
              <col class="ancho-acciones" />
            </colgroup>

            <thead>
              <tr>
                <th scope="col">Usuario</th>
                <th scope="col">DNI</th>
                <th scope="col">Rol</th>
                <th scope="col">Estado</th>
                <th scope="col" class="columna-acciones">Acciones</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="cuenta in cuentasPagina" :key="cuenta.id">
                <td>
                  <div class="celda-usuario">
                    <span class="avatar" aria-hidden="true">{{ obtenerIniciales(cuenta.nombreCompleto) }}</span>

                    <span class="datos-usuario">
                      <strong>{{ cuenta.nombreCompleto }}</strong>
                      <small>{{ cuenta.username }}</small>
                    </span>
                  </div>
                </td>
                <td>{{ cuenta.dni || '—' }}</td>
                <td>
                  <InsigniaEstado :texto="obtenerNombreRol(cuenta.rol)" :variante="VARIANTES_ROL[cuenta.rol]" />
                </td>
                <td>
                  <InterruptorEstado
                    :activo="cuenta.activo"
                    :etiqueta="describirEstado(cuenta)"
                    :motivo="describirBloqueoEstado(cuenta)"
                    :procesando="idProcesando === cuenta.id"
                    @cambiar="(activo) => solicitarCambio(cuenta, activo)"
                  />
                </td>
                <td class="columna-acciones">
                  <NuxtLink
                    v-if="puede('USUARIO_EDITAR')"
                    :to="`/usuarios/${cuenta.id}/editar`"
                    class="boton-icono"
                    :aria-label="`Editar a ${cuenta.nombreCompleto}`"
                    title="Editar usuario"
                  >
                    <svg width="18" height="18" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
                      <path
                        d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"
                      />
                    </svg>
                  </NuxtLink>
                </td>
              </tr>

              <tr v-if="cuentasPagina.length === 0">
                <td colspan="5" class="sin-resultados">
                  {{ hayFiltros ? 'Ningún usuario coincide con los filtros.' : 'Todavía no hay usuarios registrados.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="pie-tabla">
          <span>{{ rangoMostrado }}</span>

          <nav v-if="totalPaginas > 1" class="paginacion" aria-label="Paginación de usuarios">
            <button
              type="button"
              class="boton-pagina"
              :disabled="paginaActual === 1"
              aria-label="Página anterior"
              @click="irAPagina(paginaActual - 1)"
            >
              ‹
            </button>

            <span>Página {{ paginaActual }} de {{ totalPaginas }}</span>

            <button
              type="button"
              class="boton-pagina"
              :disabled="paginaActual === totalPaginas"
              aria-label="Página siguiente"
              @click="irAPagina(paginaActual + 1)"
            >
              ›
            </button>
          </nav>
        </footer>
      </section>
    </PanelEstadoCarga>

    <VentanaConfirmacion
      :abierta="cuentaPorDesactivar !== null"
      titulo="Desactivar cuenta"
      :mensaje="`¿Desactivar la cuenta de ${cuentaPorDesactivar?.nombreCompleto ?? ''}? No podrá iniciar sesión mientras esté inactiva. Su información histórica se conserva.`"
      texto-confirmar="Desactivar cuenta"
      :procesando="idProcesando !== null"
      :error="errorConfirmacion"
      @confirmar="confirmarDesactivacion"
      @cancelar="cancelarDesactivacion"
    />
  </main>
</template>

<style scoped>
.pagina-usuarios {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}

.resumen {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
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

.detalle-estado {
  color: #737686;
  font-size: 12px;
}

.detalle-estado .inactivos {
  color: #b91c1c;
  font-weight: 600;
}

.panel-tabla {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.barra-filtros {
  display: grid;
  grid-template-columns: 200px 160px minmax(0, 1fr) auto;
  align-items: end;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
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
  padding: 8px 14px;
  border: 1px solid #c3c6d7;
  border-radius: 7px;
  background: white;
  color: #004ac6;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.boton-limpiar:disabled {
  color: #9ca3af;
  cursor: not-allowed;
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
  padding: 12px 16px;
  color: #434655;
  font-size: 12px;
  font-weight: 600;
}

td {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  color: #191c1e;
  font-size: 13px;
}

.celda-usuario {
  display: flex;
  min-width: 260px;
  align-items: center;
  gap: 12px;
}

.avatar {
  display: flex;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #dbe1ff;
  color: #003e9f;
  font-size: 13px;
  font-weight: 700;
}

.datos-usuario {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.datos-usuario strong {
  font-weight: 600;
}

.datos-usuario small {
  color: #434655;
  font-size: 12px;
}

.ancho-usuario {
  width: 36%;
}

.ancho-dni {
  width: 16%;
}

.ancho-rol {
  width: 18%;
}

.ancho-estado,
.ancho-acciones {
  width: 15%;
}

.columna-acciones {
  text-align: center;
  white-space: nowrap;
}

.boton-icono {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 7px;
  color: #434655;
}

.boton-icono:hover {
  border-color: #c3c6d7;
  background: #eef2ff;
  color: #004ac6;
}

.boton-icono:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.sin-resultados {
  padding: 32px 16px;
  color: #737686;
  text-align: center;
}

.pie-tabla {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  color: #434655;
  font-size: 13px;
}

.paginacion {
  display: flex;
  align-items: center;
  gap: 10px;
}

.boton-pagina {
  width: 32px;
  height: 32px;
  border: 1px solid #c3c6d7;
  border-radius: 7px;
  background: white;
  color: #004ac6;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.boton-pagina:disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.boton-limpiar:focus-visible,
.boton-pagina:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

@media (max-width: 1100px) {
  .resumen {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .pagina-usuarios {
    padding: 20px 16px;
  }

  .resumen {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .indicador {
    padding: 12px;
  }

  .indicador strong {
    font-size: 22px;
  }

  .barra-filtros {
    grid-template-columns: 1fr;
  }
}
</style>
