import type { ResumenPanel } from '~/types/panel'

export function useResumenPanel(): ResumenPanel {
  return {
    acciones: [
      {
        id: 'registrar-estudiante',
        titulo: 'Registrar Estudiante',
        icono: '/icons/accion-estudiante.svg',
        colorFondo: '#004ac61a',
      },
      {
        id: 'crear-matricula',
        titulo: 'Crear Matrícula',
        icono: '/icons/accion-matricula.svg',
        colorFondo: '#4059aa1a',
      },
      {
        id: 'registrar-pago',
        titulo: 'Registrar Pago',
        icono: '/icons/accion-pago.svg',
        colorFondo: '#196fc01a',
      },
      {
        id: 'gestionar-horarios',
        titulo: 'Gestionar Horarios',
        icono: '/icons/accion-horarios.svg',
        colorFondo: '#7376861a',
      },
    ],

    metricas: [
      {
        id: 'total-estudiantes',
        titulo: 'TOTAL ESTUDIANTES',
        valor: '1,240',
        icono: '/icons/metrica-estudiantes.svg',
        detalle: '-12 desde el mes pasado',
        colorDetalle: 'negativo',
        iconoDetalle: '/icons/metrica-bajada.svg',
      },
      {
        id: 'docentes-activos',
        titulo: 'DOCENTES ACTIVOS',
        valor: '85',
        icono: '/icons/metrica-docentes.svg',
        detalle: '+3 nuevos este ciclo',
        colorDetalle: 'positivo',
        iconoDetalle: '/icons/metrica-subida.svg',
      },
      {
        id: 'matriculados',
        titulo: 'MATRICULADOS',
        valor: '1,150',
        icono: '/icons/metrica-matriculados.svg',
        detalle: 'Vacantes: 90',
        colorDetalle: 'neutro',
        porcentajeProgreso: 93,
      },
      {
        id: 'asistencia-hoy',
        titulo: 'ASISTENCIA HOY',
        valor: '96%',
        icono: '/icons/metrica-asistencia.svg',
        detalle: 'Óptimo',
        colorDetalle: 'positivo',
        iconoDetalle: '/icons/metrica-optimo.svg',
      },
    ],
  }
}
