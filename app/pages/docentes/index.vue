<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { CuentaUsuario } from '~/types/cuentaUsuario'
import type { DisponibilidadDocenteHorario } from '~/types/horarioSeccion'
import type { DocenteOpcion } from '~/types/sesionClase'
import { useCuentasUsuario } from '~/composables/useCuentasUsuario'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { nombreDia, useHorarioSeccion } from '~/composables/useHorarioSeccion'
import { usePermisosRol } from '~/composables/usePermisosRol'
import { recortarHora } from '~/composables/usePlantillasHorario'
import { useSesionesClase } from '~/composables/useSesionesClase'

definePageMeta({
  middleware: 'autenticacion',
})

interface DocenteAdministracion extends CuentaUsuario {
  perfilId?: number
  asignaciones: DisponibilidadDocenteHorario[]
}

const anio = ahoraSistema().getFullYear()
const { listarCuentas } = useCuentasUsuario()
const { listarDocentes } = useSesionesClase()
const { listarDisponibilidadDocente } = useHorarioSeccion()
const { puede } = usePermisosRol()

const docentes = ref<DocenteAdministracion[]>([])
const cargando = ref(true)
const errorCarga = ref('')
const activos = computed(() => docentes.value.filter((docente) => docente.activo !== false).length)

async function cargarDocentes(): Promise<void> {
  cargando.value = true
  errorCarga.value = ''

  try {
    const [cuentas, perfiles] = await Promise.all([listarCuentas(), listarDocentes()])
    const perfilPorUsuario = new Map<string, DocenteOpcion>(perfiles.map((perfil) => [perfil.username, perfil]))
    const cuentasDocentes = cuentas.filter((cuenta) => cuenta.rol === 'DOCENTE')

    docentes.value = await Promise.all(
      cuentasDocentes.map(async (cuenta) => {
        const perfil = perfilPorUsuario.get(cuenta.username)
        const asignaciones = perfil && cuenta.activo !== false ? await listarDisponibilidadDocente(perfil.id, anio) : []

        return {
          ...cuenta,
          perfilId: perfil?.id,
          asignaciones,
        }
      }),
    )
  } catch (fallo: unknown) {
    errorCarga.value = obtenerMensajeError(fallo, 'No se pudo cargar la información de docentes.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargarDocentes)
</script>

<template>
  <main class="pagina-docentes">
    <EncabezadoPagina
      titulo="Gestión de docentes"
      descripcion="Consulta los datos de las cuentas docentes y los cursos y horarios que tienen asignados."
    >
      <template v-if="puede('USUARIO_CREAR')" #acciones>
        <BotonAccion variante="secundario" destino="/usuarios/carga-masiva?rol=DOCENTE"> Cargar docentes </BotonAccion>
        <BotonAccion destino="/usuarios/nuevo?rol=DOCENTE">+ Nuevo docente</BotonAccion>
      </template>
    </EncabezadoPagina>

    <section class="resumen" aria-label="Resumen de docentes">
      <div>
        <span>Docentes registrados</span>
        <strong>{{ docentes.length }}</strong>
      </div>
      <div>
        <span>Cuentas activas</span>
        <strong>{{ activos }}</strong>
      </div>
      <NuxtLink class="enlace-usuarios" to="/usuarios">Administrar todas las cuentas</NuxtLink>
    </section>

    <p class="nota-horario">Los cursos y horarios corresponden a las asignaciones vigentes del año {{ anio }}.</p>

    <PanelEstadoCarga :cargando="cargando" :error="errorCarga" @reintentar="cargarDocentes">
      <section v-if="docentes.length" class="lista-docentes" aria-label="Docentes registrados">
        <article v-for="docente in docentes" :key="docente.id" class="tarjeta-docente">
          <header class="cabecera-docente">
            <div>
              <h2>{{ docente.nombreCompleto }}</h2>
              <p>{{ docente.activo === false ? 'Cuenta inactiva' : 'Cuenta activa' }}</p>
            </div>
            <span class="estado" :class="{ inactivo: docente.activo === false }">
              {{ docente.activo === false ? 'Inactivo' : 'Activo' }}
            </span>
          </header>

          <dl class="datos-docente">
            <div>
              <dt>DNI</dt>
              <dd>{{ docente.dni }}</dd>
            </div>
            <div>
              <dt>Usuario</dt>
              <dd>{{ docente.username }}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{{ docente.correo || 'No registrado' }}</dd>
            </div>
          </dl>

          <section class="asignaciones" :aria-label="`Cursos y horarios de ${docente.nombreCompleto}`">
            <h3>Qué dicta · {{ anio }}</h3>
            <p v-if="!docente.perfilId" class="sin-asignaciones">Aún no tiene un perfil docente asociado.</p>
            <p v-else-if="docente.asignaciones.length === 0" class="sin-asignaciones">
              No tiene cursos asignados en un horario vigente.
            </p>
            <ul v-else>
              <li
                v-for="asignacion in docente.asignaciones"
                :key="`${asignacion.dia}-${asignacion.horaInicio}-${asignacion.seccion}-${asignacion.area}`"
              >
                <strong>{{ asignacion.area }}</strong>
                <span>{{ asignacion.seccion }}</span>
                <small>
                  {{ nombreDia(asignacion.dia) }} · {{ recortarHora(asignacion.horaInicio) }}–{{
                    recortarHora(asignacion.horaFin)
                  }}
                </small>
              </li>
            </ul>
          </section>
        </article>
      </section>

      <section v-else class="vacio" aria-live="polite">
        <h2>No hay docentes registrados</h2>
        <p>Al crear un usuario con rol docente, aparecerá aquí junto con sus asignaciones de horario.</p>
        <BotonAccion v-if="puede('USUARIO_CREAR')" destino="/usuarios/nuevo?rol=DOCENTE"> Crear docente </BotonAccion>
      </section>
    </PanelEstadoCarga>
  </main>
</template>

<style scoped>
.pagina-docentes {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}

.resumen {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
  padding: 18px 22px;
  border: 1px solid #e1e4eb;
  border-radius: 12px;
  background: white;
}

.resumen div {
  display: flex;
  min-width: 140px;
  flex-direction: column;
  gap: 4px;
}

.resumen span,
.datos-docente dt {
  color: #5c6270;
  font-size: 13px;
}

.resumen strong {
  color: #191c1e;
  font-size: 22px;
}

.enlace-usuarios {
  margin-left: auto;
  color: #004ac6;
  font-size: 14px;
  font-weight: 600;
}

.nota-horario {
  margin: 0;
  color: #434655;
  font-size: 14px;
}

.lista-docentes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
  gap: 18px;
}

.tarjeta-docente {
  overflow: hidden;
  border: 1px solid #e1e4eb;
  border-radius: 12px;
  background: white;
}

.cabecera-docente {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 14px;
}

.cabecera-docente h2 {
  margin: 0;
  color: #191c1e;
  font-size: 18px;
}

.cabecera-docente p {
  margin: 5px 0 0;
  color: #5c6270;
  font-size: 13px;
}

.estado {
  flex: 0 0 auto;
  padding: 5px 10px;
  border-radius: 999px;
  background: #e8f5e9;
  color: #176b36;
  font-size: 12px;
  font-weight: 600;
}

.estado.inactivo {
  background: #f1f1f4;
  color: #5c6270;
}

.datos-docente {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0 22px 18px;
}

.datos-docente dt {
  margin-bottom: 4px;
}

.datos-docente dd {
  overflow-wrap: anywhere;
  margin: 0;
  color: #191c1e;
  font-size: 14px;
}

.asignaciones {
  padding: 16px 22px 20px;
  border-top: 1px solid #e5e7eb;
  background: #f8f9fc;
}

.asignaciones h3 {
  margin: 0 0 12px;
  color: #191c1e;
  font-size: 15px;
}

.asignaciones ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.asignaciones li {
  display: grid;
  grid-template-columns: minmax(90px, 0.7fr) minmax(100px, 1fr) minmax(150px, 1.2fr);
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid #e1e4eb;
  border-radius: 8px;
  background: white;
  font-size: 13px;
}

.asignaciones li strong {
  color: #003e9f;
}

.asignaciones li small {
  color: #5c6270;
  text-align: right;
}

.sin-asignaciones {
  margin: 0;
  color: #5c6270;
  font-size: 14px;
}

.vacio {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 48px 24px;
  border: 1px dashed #c3c6d7;
  border-radius: 12px;
  background: white;
  text-align: center;
}

.vacio h2,
.vacio p {
  margin: 0;
}

.vacio h2 {
  color: #191c1e;
  font-size: 18px;
}

.vacio p {
  margin-bottom: 8px;
  color: #5c6270;
  font-size: 14px;
}

@media (max-width: 760px) {
  .pagina-docentes {
    padding: 20px 16px;
  }

  .enlace-usuarios {
    margin-left: 0;
  }

  .asignaciones li {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .asignaciones li small {
    text-align: left;
  }
}
</style>
