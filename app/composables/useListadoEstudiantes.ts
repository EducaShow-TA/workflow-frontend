import type { EstudianteListado } from '~/types/estudiante'

const estudiantesDemostracion: EstudianteListado[] = [
  {
    codigo: 'EST-2023-001',
    nombres: 'Ana',
    apellidos: 'García Mendoza',
    correoElectronico: 'ana.garcia@school.edu',
    numeroDocumento: '73829104',
    grado: '3ro Secundaria',
    seccion: 'A',
    estado: 'ACTIVO',
    avatar: '/images/estudiantes/ana-garcia.svg',
  },
  {
    codigo: 'EST-2023-045',
    nombres: 'Carlos',
    apellidos: 'Mendoza Ruiz',
    correoElectronico: 'carlos.m@school.edu',
    numeroDocumento: '74920183',
    grado: '3ro Secundaria',
    seccion: 'B',
    estado: 'INACTIVO',
  },
  {
    codigo: 'EST-2024-102',
    nombres: 'Luis',
    apellidos: 'Silva Torres',
    correoElectronico: 'luis.st@school.edu',
    numeroDocumento: '75839201',
    grado: '1ro Secundaria',
    seccion: 'A',
    estado: 'ACTIVO',
    avatar: '/images/estudiantes/luis-silva.svg',
  },
]

export function useListadoEstudiantes(): EstudianteListado[] {
  return estudiantesDemostracion
}
