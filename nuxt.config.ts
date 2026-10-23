export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiBase: '',
      datosPrueba: '',
    },
  },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',

  devtools: {
    enabled: true,
  },

  // Frontend como Single Page Application
  ssr: false,

  // Validacion estricta de TypeScript
  typescript: {
    strict: true,
  },

  // Modulos del proyecto
  modules: ['@pinia/nuxt', '@nuxt/eslint'],

  // Solo en `nuxt dev`: reenvia /api al backend local para trabajar en el mismo origen, como en produccion
  // (Nginx sirve la SPA y /api desde el mismo dominio), sin habilitar CORS en el backend.
  nitro: {
    devProxy: {
      '/api': {
        target: 'http://localhost:8080/api',
        changeOrigin: true,
      },
    },
  },
})
