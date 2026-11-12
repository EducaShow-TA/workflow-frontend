# EducaShow — frontend

SPA del Sistema de Información Web para la Gestión Integral de un Colegio de Educación Secundaria. Está desarrollada con Nuxt 4, Vue 3, TypeScript y Pinia, sin SSR, y consume el API REST de [`workflow-backend`](https://github.com/EducaShow-TA/workflow-backend).

## Estado funcional actual

La interfaz disponible depende del rol autenticado:

- **Administración:** panel general; registro de estudiantes con datos de apoderados y consulta de estudiantes; matrícula, periodos y vacantes; cuentas, roles y carga masiva CSV; catálogo curricular; calificaciones, reglas de consolidación y libretas; pensiones y reportes; plantillas de horario y programación semanal por sección, con selección de aulas; asistencia por sesión y gestión de asistencia docente; registro de errores y auditoría de calificaciones.
- **Docencia:** portal con clases y horario propios, marcaje de entrada/salida, listas y asistencia de estudiantes, registro de calificaciones con evidencia, seguimiento de tareas y consulta de libretas.
- **Familia y estudiante:** consulta de libretas en `/libretas`, según los permisos del backend. La interfaz actual no incluye un portal para consultar boletas o registrar pagos como apoderado.
- **Acceso:** inicio de sesión, recuperación y restablecimiento de contraseña, y control de navegación por rol. Las contraseñas nuevas deben tener al menos 8 caracteres, incluir minúscula, mayúscula, número y símbolo, y ocupar como máximo 72 bytes UTF-8.

La pantalla docente consulta el endpoint de riesgo académico, que cuenta las notas finales `C` por área y aplica el umbral elegido. El flujo de pagos permite registrar pagos en el sistema, pero no procesa transacciones con una pasarela externa. La recuperación completa por correo depende de configurar el servicio de correo del backend.

El README del backend mantiene el [estado por historia](https://github.com/EducaShow-TA/workflow-backend/blob/Development/README.md) con dos etiquetas: **Completa** (sin brechas conocidas en el código revisado) y **Parcial** (con una brecha descrita). Es una revisión del código, no una aprobación formal de aceptación.

## Despliegue local

La guía completa (MySQL, backend y frontend) está en [`docs/despliegue-local.md`](https://github.com/EducaShow-TA/workflow-backend/blob/Development/docs/despliegue-local.md).

Con el backend corriendo en `http://localhost:8080`:

```bash
npm ci
npm run dev    # http://localhost:3000
```

En desarrollo, `devProxy` en `nuxt.config.ts` reenvía `/api` al backend; no hace falta configurar `.env` ni CORS.

Requisitos del frontend: Node.js 22 LTS y npm 11 o superior.

## Verificaciones antes de un Pull Request

```bash
npm test
npm run lint
npm run format:check
npm run typecheck
```

## Build de producción

```bash
npm run generate   # genera la SPA estática en .output/public
```

En producción Nginx sirve los archivos estáticos y reenvía `/api/*` al backend. El flujo de ramas y Pull Requests está documentado en [`docs/flujo-de-trabajo.md`](https://github.com/EducaShow-TA/workflow-backend/blob/Development/docs/flujo-de-trabajo.md).
