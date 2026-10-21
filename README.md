# EducaShow — frontend

SPA del Sistema de Información Web para la Gestión Integral de un Colegio de Educación Secundaria
(Nuxt 4 + Vue 3 + TypeScript + Pinia, sin SSR). Consume el API REST de
[`workflow-backend`](https://github.com/EducaShow-TA/workflow-backend).

## Despliegue local

La guía completa (requisitos, MySQL en Docker, backend y frontend) está en el backend:
[`docs/despliegue-local.md`](https://github.com/EducaShow-TA/workflow-backend/blob/Development/docs/despliegue-local.md).

Resumen del frontend, con el backend ya corriendo en `http://localhost:8080`:

```bash
npm ci         # instala dependencias (Node 22)
npm run dev    # http://localhost:3000
```

En desarrollo, el `devProxy` de `nuxt.config.ts` reenvía `/api` al backend: no hace falta `.env` ni CORS.

## Verificaciones antes de un Pull Request

```bash
npx eslint .
npx prettier --check .
npx nuxi typecheck
```

## Build de producción

```bash
npm run generate   # genera la SPA estática en .output/public (la sirve Nginx)
```

Flujo de ramas y Pull Requests:
[`docs/flujo-de-trabajo.md`](https://github.com/EducaShow-TA/workflow-backend/blob/Development/docs/flujo-de-trabajo.md)
(en el backend).
