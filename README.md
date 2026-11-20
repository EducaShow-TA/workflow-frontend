# EducaShow — frontend

SPA del Sistema de Información Web para la Gestión Integral de un Colegio de Educación Secundaria. Está desarrollada con Nuxt 4, Vue 3, TypeScript y Pinia, sin SSR, y consume el API REST de [`workflow-backend`](https://github.com/EducaShow-TA/workflow-backend).

## Estado funcional actual

La interfaz disponible depende del rol autenticado:

- **Administración:** panel general; registro de estudiantes con datos de apoderados, consulta de estudiantes y administración de sus apoderados con verificación por documento; matrícula, periodos y vacantes; cuentas, roles y carga masiva CSV de usuarios; catálogo curricular; calificaciones, reglas de consolidación y libretas; pensiones, auditoría de transacciones y pagos, y reportes; plantillas de horario y programación semanal por sección, con selección de aulas; asistencia por sesión y gestión/configuración de asistencia docente, incluida la carga CSV de marcajes con plantilla, validación y guardado en lote; registro de errores y auditoría de calificaciones, con el motivo de cada rectificación y filtro por acción. La carga CSV de asistencia de alumnos aún no tiene pantalla.
- **Docencia:** portal con clases y horario propios, marcaje de entrada/salida, listas y asistencia de estudiantes, registro de calificaciones con evidencia y su rectificación con motivo obligatorio e historial de cambios por nota, seguimiento de tareas con descarga del archivo que entregó cada alumno y consulta de libretas.
- **Apoderado:** portal propio en `/familia` con panel (resumen de pagos de la familia, recordatorios configurables de boletas próximas a vencer y asistencia por hijo), historial de asistencia filtrable por fechas, consulta de libretas y pagos: compromiso anual, boletas por pagar con pago en línea de una o varias a la vez mediante una pasarela simulada (los datos de la tarjeta no salen del navegador), historial y descarga de comprobantes en PDF. La consulta del horario del hijo aún no está integrada en el portal familiar.
- **Estudiante:** portal propio en `/estudiante` con panel del mes (próximas tareas y asistencia) y calendario de asistencia que muestra cada clase y su estado, con el detalle por día y las incidencias del mes. En `/estudiante/tareas` ve sus tareas por entregar, entregadas y vencidas, agrupadas por cercanía y filtrables por curso; cada tarea tiene su página con la consigna y la entrega del archivo (hasta 10 MB, reemplazable hasta la fecha límite). Puede consultar su horario vigente. Calificaciones y configuración aparecen como próximos.
- **Acceso:** inicio de sesión, recuperación y restablecimiento de contraseña, y control de navegación por rol. Las contraseñas nuevas deben tener al menos 8 caracteres, incluir minúscula, mayúscula, número y símbolo, y ocupar como máximo 72 bytes UTF-8.

La pantalla docente consulta el endpoint de riesgo académico, que cuenta las notas finales `C` por área y aplica el umbral elegido. El flujo de pagos permite registrar pagos en el sistema y el pago en línea del apoderado usa una pasarela simulada; no procesa transacciones con una pasarela externa. La recuperación completa por correo depende de configurar el servicio de correo del backend.

El [Product Backlog](https://github.com/EducaShow-TA/workflow-backend/blob/Development/docs/Product%20Backlog.md) y los README de ambos repositorios reflejan el estado observado en el código. Las historias compartidas pueden estar completas en backend y pendientes de interfaz; el backlog marca esos casos como «En proceso». La revisión documental no equivale a una aprobación formal de aceptación.

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
